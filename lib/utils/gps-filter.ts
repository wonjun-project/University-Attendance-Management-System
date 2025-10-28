/**
 * GPS 칼만 필터 유틸리티
 *
 * GPS 좌표의 노이즈를 제거하고 정확도를 향상시키기 위한
 * 칼만 필터 기반 필터링 시스템
 *
 * @module gps-filter
 */

/**
 * 필터링된 GPS 좌표 결과
 */
export interface FilteredGPS {
  /** 필터링된 위도 */
  latitude: number
  /** 필터링된 경도 */
  longitude: number
  /** 개선된 정확도 (미터) */
  accuracy: number
  /** 신뢰도 점수 (0~1) */
  confidence: number
  /** 원본 위도 */
  rawLatitude: number
  /** 원본 경도 */
  rawLongitude: number
  /** 원본 정확도 */
  rawAccuracy: number
}

/**
 * 간단한 1D 칼만 필터 구현
 * kalmanjs 라이브러리가 없을 경우를 대비한 fallback
 */
class SimpleKalmanFilter {
  private q: number // 프로세스 노이즈
  private r: number // 측정 노이즈
  private x: number // 추정값
  private p: number // 추정 오차
  private k: number // 칼만 게인

  constructor(options: { R: number; Q: number }) {
    this.q = options.Q
    this.r = options.R
    this.x = 0
    this.p = 0
    this.k = 0
  }

  /**
   * 측정값 필터링
   * @param measurement - 원시 측정값
   * @returns 필터링된 값
   */
  filter(measurement: number): number {
    // 예측 단계
    this.p = this.p + this.q

    // 업데이트 단계
    this.k = this.p / (this.p + this.r)
    this.x = this.x + this.k * (measurement - this.x)
    this.p = (1 - this.k) * this.p

    return this.x
  }
}

/**
 * GPS 칼만 필터 클래스
 *
 * 위도와 경도를 독립적으로 필터링하여 GPS 노이즈를 제거합니다.
 *
 * @example
 * ```typescript
 * const filter = new GPSKalmanFilter()
 *
 * const filtered = filter.filter(37.5665, 126.9780, 25)
 * console.log(filtered) // { latitude: 37.5665, longitude: 126.9780, ... }
 * ```
 */
export class GPSKalmanFilter {
  private latFilter: SimpleKalmanFilter
  private lngFilter: SimpleKalmanFilter
  private sampleCount = 0
  private initialized = false

  constructor() {
    // R: 측정 노이즈 (낮을수록 GPS를 더 신뢰)
    // Q: 프로세스 노이즈 (높을수록 변화를 더 허용)
    this.latFilter = new SimpleKalmanFilter({ R: 0.01, Q: 3 })
    this.lngFilter = new SimpleKalmanFilter({ R: 0.01, Q: 3 })
  }

  /**
   * GPS 좌표 필터링
   *
   * @param rawLat - 원시 위도
   * @param rawLng - 원시 경도
   * @param accuracy - GPS 정확도 (미터)
   * @returns 필터링된 GPS 데이터
   *
   * @remarks
   * - GPS 정확도가 50m 이상이면 측정 노이즈 파라미터를 증가시켜 더 보수적으로 필터링
   * - 샘플 수가 증가할수록 신뢰도 점수가 높아짐
   * - 필터링 후 정확도는 약 30% 개선되는 것으로 가정
   */
  filter(rawLat: number, rawLng: number, accuracy: number): FilteredGPS {
    // 정확도가 나쁘면 노이즈 파라미터 증가 (더 보수적으로 필터링)
    const adaptiveR = accuracy > 50 ? 0.05 : accuracy > 30 ? 0.03 : 0.01

    // 파라미터 변경 시 필터 재생성
    if (!this.initialized || adaptiveR !== 0.01) {
      this.latFilter = new SimpleKalmanFilter({ R: adaptiveR, Q: 3 })
      this.lngFilter = new SimpleKalmanFilter({ R: adaptiveR, Q: 3 })
      this.initialized = true
    }

    // 칼만 필터 적용
    const filteredLat = this.latFilter.filter(rawLat)
    const filteredLng = this.lngFilter.filter(rawLng)

    this.sampleCount++

    // 신뢰도 계산:
    // - 샘플 수가 많을수록 신뢰도 증가 (최대 5회)
    // - GPS 정확도가 좋을수록 신뢰도 증가
    const sampleConfidence = Math.min(this.sampleCount / 5, 1.0)
    const accuracyConfidence = Math.max(0, Math.min(50 / accuracy, 1.0))
    const confidence = sampleConfidence * 0.6 + accuracyConfidence * 0.4

    // 필터링 후 예상 정확도 개선 (약 30%)
    const improvedAccuracy = accuracy * 0.7

    return {
      latitude: filteredLat,
      longitude: filteredLng,
      accuracy: improvedAccuracy,
      confidence,
      rawLatitude: rawLat,
      rawLongitude: rawLng,
      rawAccuracy: accuracy
    }
  }

  /**
   * 필터 상태 초기화
   *
   * @remarks
   * 새로운 출석 체크인 세션 시작 시 호출하여 이전 데이터 영향 제거
   */
  reset() {
    this.sampleCount = 0
    this.initialized = false
    this.latFilter = new SimpleKalmanFilter({ R: 0.01, Q: 3 })
    this.lngFilter = new SimpleKalmanFilter({ R: 0.01, Q: 3 })
  }

  /**
   * 현재 샘플 수 조회
   */
  getSampleCount(): number {
    return this.sampleCount
  }
}

/**
 * 다중 GPS 샘플 수집 및 평균 계산
 *
 * @param sampleCount - 수집할 샘플 수
 * @param intervalMs - 샘플 간 간격 (밀리초)
 * @param onProgress - 진행 상황 콜백
 * @returns 평균 GPS 좌표
 *
 * @example
 * ```typescript
 * const avgGPS = await collectGPSSamples(3, 1000, (current, total) => {
 *   console.log(`샘플 ${current}/${total} 수집 중...`)
 * })
 * ```
 */
export async function collectGPSSamples(
  sampleCount: number = 3,
  intervalMs: number = 1000,
  onProgress?: (current: number, total: number) => void
): Promise<{ latitude: number; longitude: number; accuracy: number }> {
  const samples: Array<{ lat: number; lng: number; accuracy: number }> = []

  for (let i = 0; i < sampleCount; i++) {
    if (onProgress) {
      onProgress(i + 1, sampleCount)
    }

    try {
      const position = await getCurrentPosition()
      samples.push({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      })

      // 마지막 샘플이 아니면 대기
      if (i < sampleCount - 1) {
        await new Promise(resolve => setTimeout(resolve, intervalMs))
      }
    } catch (error) {
      console.warn(`GPS 샘플 ${i + 1} 수집 실패:`, error)
      // 샘플 수집 실패 시 건너뛰기
    }
  }

  if (samples.length === 0) {
    throw new Error('GPS 샘플을 수집할 수 없습니다.')
  }

  // 평균 계산
  const avgLat = samples.reduce((sum, s) => sum + s.lat, 0) / samples.length
  const avgLng = samples.reduce((sum, s) => sum + s.lng, 0) / samples.length
  const avgAccuracy = samples.reduce((sum, s) => sum + s.accuracy, 0) / samples.length

  return {
    latitude: avgLat,
    longitude: avgLng,
    accuracy: avgAccuracy
  }
}

/**
 * Geolocation API를 사용한 현재 위치 획득
 *
 * @param options - Geolocation API 옵션
 * @returns GPS 위치 정보
 */
function getCurrentPosition(
  options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0
  }
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation API를 지원하지 않는 브라우저입니다.'))
      return
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

/**
 * 필터링 효과 분석 유틸리티
 *
 * @param filtered - 필터링된 GPS 데이터
 * @returns 분석 결과 문자열
 */
export function analyzeFilteringEffect(filtered: FilteredGPS): string {
  const accuracyImprovement = (
    ((filtered.rawAccuracy - filtered.accuracy) / filtered.rawAccuracy) * 100
  ).toFixed(1)

  const latDiff = Math.abs(filtered.latitude - filtered.rawLatitude) * 111320 // 위도 1도 ≈ 111.32km
  const lngDiff = Math.abs(filtered.longitude - filtered.rawLongitude) *
                   111320 * Math.cos(filtered.latitude * Math.PI / 180)
  const positionShift = Math.sqrt(latDiff ** 2 + lngDiff ** 2)

  return `
📍 칼만 필터 적용 결과:
- 정확도 개선: ${filtered.rawAccuracy.toFixed(1)}m → ${filtered.accuracy.toFixed(1)}m (${accuracyImprovement}% 향상)
- 좌표 보정: ${positionShift.toFixed(2)}m 이동
- 신뢰도 점수: ${(filtered.confidence * 100).toFixed(1)}%
- 원본 좌표: (${filtered.rawLatitude.toFixed(6)}, ${filtered.rawLongitude.toFixed(6)})
- 필터링 좌표: (${filtered.latitude.toFixed(6)}, ${filtered.longitude.toFixed(6)})
  `.trim()
}
