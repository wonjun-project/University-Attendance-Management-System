/**
 * Complementary Filter (상보 필터)
 * GPS + PDR 데이터 융합
 */

/**
 * 2D 위치 (위도, 경도)
 */
export interface Position2D {
  lat: number
  lng: number
  accuracy?: number  // 정확도 (미터)
  timestamp: number
}

/**
 * 융합 결과
 */
export interface FusedPosition extends Position2D {
  /** 융합에 사용된 가중치 (0~1, GPS 가중치) */
  gpsWeight: number
  /** 융합에 사용된 가중치 (0~1, PDR 가중치) */
  pdrWeight: number
  /** 신뢰도 (0~1) */
  confidence: number
  /** 사용된 센서 */
  source: 'gps' | 'pdr' | 'fused'
}

/**
 * Complementary Filter 설정
 */
export interface ComplementaryFilterConfig {
  /** 기본 GPS 가중치 (0~1, 기본 0.7) */
  defaultGpsWeight?: number
  /** 최소 GPS 정확도 (m, 이보다 나쁘면 가중치 낮춤) */
  minGpsAccuracy?: number
  /** PDR 신뢰도 감쇠율 (시간당, 기본 0.1) */
  pdrDecayRate?: number
  /** 위치 차이 임계값 (m, 이보다 크면 이상으로 판단) */
  positionDifferenceThreshold?: number
}

/**
 * Complementary Filter 클래스
 */
export class ComplementaryFilter {
  private config: Required<ComplementaryFilterConfig>

  // 마지막 융합 위치
  private lastFusedPosition: FusedPosition | null = null

  // PDR 시작 시간 (drift 추적용)
  private pdrStartTime = 0

  constructor(config: ComplementaryFilterConfig = {}) {
    this.config = {
      defaultGpsWeight: config.defaultGpsWeight ?? 0.7,
      minGpsAccuracy: config.minGpsAccuracy ?? 20,  // 20m
      pdrDecayRate: config.pdrDecayRate ?? 0.1,
      positionDifferenceThreshold: config.positionDifferenceThreshold ?? 50  // 50m
    }
  }

  /**
   * GPS + PDR 위치 융합
   *
   * @param gpsPosition - GPS 위치
   * @param pdrPosition - PDR 위치
   * @returns 융합된 위치
   */
  fuse(gpsPosition: Position2D, pdrPosition: Position2D): FusedPosition {
    // 1. GPS 신뢰도 계산
    const gpsConfidence = this.calculateGpsConfidence(gpsPosition)

    // 2. PDR 신뢰도 계산
    const pdrConfidence = this.calculatePdrConfidence()

    // 3. 가중치 계산 (정규화)
    const totalConfidence = gpsConfidence + pdrConfidence
    const gpsWeight = gpsConfidence / totalConfidence
    const pdrWeight = pdrConfidence / totalConfidence

    // 4. 위치 융합 (가중 평균)
    const fusedLat = gpsPosition.lat * gpsWeight + pdrPosition.lat * pdrWeight
    const fusedLng = gpsPosition.lng * gpsWeight + pdrPosition.lng * pdrWeight

    // 5. 정확도 추정 (가중 평균)
    const gpsAccuracy = gpsPosition.accuracy ?? this.config.minGpsAccuracy
    const pdrAccuracy = this.estimatePdrAccuracy()
    const fusedAccuracy = gpsAccuracy * gpsWeight + pdrAccuracy * pdrWeight

    // 6. 융합 결과 생성
    const fused: FusedPosition = {
      lat: fusedLat,
      lng: fusedLng,
      accuracy: fusedAccuracy,
      timestamp: Date.now(),
      gpsWeight,
      pdrWeight,
      confidence: Math.max(gpsConfidence, pdrConfidence),
      source: 'fused'
    }

    // 7. 이상치 감지 및 처리
    if (this.lastFusedPosition) {
      const distance = this.calculateDistance(this.lastFusedPosition, fused)

      if (distance > this.config.positionDifferenceThreshold) {
        console.warn(`⚠️ 위치 차이가 임계값 초과: ${distance.toFixed(1)}m`)

        // GPS 신뢰도가 높으면 GPS를 신뢰
        if (gpsConfidence > 0.7) {
          console.log('GPS 신뢰도 높음 → GPS 위치 사용')
          return this.useGpsPosition(gpsPosition)
        }
      }
    }

    this.lastFusedPosition = fused
    return fused
  }

  /**
   * GPS만 사용 (PDR 데이터 없을 때)
   */
  useGpsOnly(gpsPosition: Position2D): FusedPosition {
    const confidence = this.calculateGpsConfidence(gpsPosition)

    const fused: FusedPosition = {
      ...gpsPosition,
      gpsWeight: 1.0,
      pdrWeight: 0,
      confidence,
      source: 'gps'
    }

    this.lastFusedPosition = fused
    return fused
  }

  /**
   * PDR만 사용 (GPS 데이터 없을 때)
   */
  usePdrOnly(pdrPosition: Position2D): FusedPosition {
    const confidence = this.calculatePdrConfidence()

    const fused: FusedPosition = {
      ...pdrPosition,
      accuracy: this.estimatePdrAccuracy(),
      gpsWeight: 0,
      pdrWeight: 1.0,
      confidence,
      source: 'pdr'
    }

    this.lastFusedPosition = fused
    return fused
  }

  /**
   * GPS 신뢰도 계산
   * 정확도가 좋을수록 신뢰도 높음
   */
  private calculateGpsConfidence(gpsPosition: Position2D): number {
    const accuracy = gpsPosition.accuracy ?? this.config.minGpsAccuracy

    // 정확도가 minGpsAccuracy 이하이면 신뢰도 1.0
    // 정확도가 나빠질수록 신뢰도 감소
    if (accuracy <= this.config.minGpsAccuracy) {
      return 1.0
    }

    // 지수 감쇠 (accuracy가 2배 증가하면 신뢰도 절반)
    const confidence = Math.exp(-(accuracy - this.config.minGpsAccuracy) / this.config.minGpsAccuracy)

    return Math.max(0.1, Math.min(1.0, confidence))
  }

  /**
   * PDR 신뢰도 계산
   * 시간이 지날수록 drift로 인해 신뢰도 감소
   */
  private calculatePdrConfidence(): number {
    if (this.pdrStartTime === 0) {
      this.pdrStartTime = Date.now()
      return 1.0
    }

    const elapsedTimeHours = (Date.now() - this.pdrStartTime) / (1000 * 60 * 60)

    // 시간에 따라 지수 감쇠
    const confidence = Math.exp(-this.config.pdrDecayRate * elapsedTimeHours)

    return Math.max(0.3, Math.min(1.0, confidence))
  }

  /**
   * PDR 정확도 추정
   * 시간이 지날수록 오차 증가
   */
  private estimatePdrAccuracy(): number {
    if (this.pdrStartTime === 0) {
      return 5  // 초기 정확도 5m
    }

    const elapsedTimeMinutes = (Date.now() - this.pdrStartTime) / (1000 * 60)

    // 분당 0.5m씩 오차 증가
    const accuracy = 5 + elapsedTimeMinutes * 0.5

    return Math.min(50, accuracy)  // 최대 50m
  }

  /**
   * 두 위치 사이의 거리 계산 (Haversine 공식)
   */
  private calculateDistance(pos1: Position2D, pos2: Position2D): number {
    const R = 6371e3  // 지구 반지름 (미터)

    const lat1 = pos1.lat * Math.PI / 180
    const lat2 = pos2.lat * Math.PI / 180
    const deltaLat = (pos2.lat - pos1.lat) * Math.PI / 180
    const deltaLng = (pos2.lng - pos1.lng) * Math.PI / 180

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  /**
   * GPS 위치만 사용하는 FusedPosition 생성
   */
  private useGpsPosition(gpsPosition: Position2D): FusedPosition {
    return {
      ...gpsPosition,
      gpsWeight: 1.0,
      pdrWeight: 0,
      confidence: this.calculateGpsConfidence(gpsPosition),
      source: 'gps'
    }
  }

  /**
   * PDR 재시작 (GPS 재보정 후 호출)
   */
  resetPdr(): void {
    this.pdrStartTime = Date.now()
    console.log('🔄 PDR 재시작 (신뢰도 리셋)')
  }

  /**
   * 마지막 융합 위치 반환
   */
  getLastFusedPosition(): Readonly<FusedPosition> | null {
    return this.lastFusedPosition ? { ...this.lastFusedPosition } : null
  }

  /**
   * 전체 초기화
   */
  reset(): void {
    this.lastFusedPosition = null
    this.pdrStartTime = 0
    console.log('🔄 Complementary Filter 초기화')
  }

  /**
   * 설정 업데이트
   */
  updateConfig(config: Partial<ComplementaryFilterConfig>): void {
    this.config = {
      ...this.config,
      ...config
    }
  }
}

/**
 * Complementary Filter 유틸리티 함수
 */

/**
 * 가중 평균 계산
 */
export function weightedAverage(
  value1: number,
  value2: number,
  weight1: number
): number {
  const weight2 = 1 - weight1
  return value1 * weight1 + value2 * weight2
}

/**
 * 신뢰도 기반 가중치 계산
 */
export function calculateWeights(
  confidence1: number,
  confidence2: number
): { weight1: number, weight2: number } {
  const total = confidence1 + confidence2

  if (total === 0) {
    return { weight1: 0.5, weight2: 0.5 }
  }

  return {
    weight1: confidence1 / total,
    weight2: confidence2 / total
  }
}

/**
 * 적응형 가중치 계산 (정확도 기반)
 */
export function adaptiveWeight(
  accuracy: number,
  minAccuracy: number,
  maxAccuracy: number
): number {
  // 정규화: 정확도가 좋을수록 가중치 높음
  const normalized = (accuracy - minAccuracy) / (maxAccuracy - minAccuracy)
  const weight = 1 - Math.max(0, Math.min(1, normalized))

  return weight
}
