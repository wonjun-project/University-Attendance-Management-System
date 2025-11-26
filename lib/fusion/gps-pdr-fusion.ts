/**
 * GPS-PDR 융합 관리자
 * GPS Kalman Filter + PDR + 2D Kalman Filter 통합
 */

import { GPSKalmanFilter } from '@/lib/utils/gps-filter'
import { PDRTracker, type PDRPosition, type PDRDelta, cartesianToGPS, gpsToCartesian } from '@/lib/pdr/pdr-tracker'
import { KalmanFilter2D } from './kalman-filter'

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
 * 융합 결과 (Kalman Filter 적용)
 */
export interface FusedPosition extends Position2D {
  /** 융합된 X 좌표 (미터) */
  x: number
  /** 융합된 Y 좌표 (미터) */
  y: number
  /** 신뢰도 (0~1) */
  confidence: number
  /** 사용된 센서 */
  source: 'gps' | 'pdr' | 'fused'
  /** 불확실성 (표준편차) */
  uncertainty?: { x: number, y: number }
  /** Legacy: GPS 가중치 */
  gpsWeight: number
  /** Legacy: PDR 가중치 */
  pdrWeight: number
  /** GPS 이상치 연속 감지 횟수 (서버 조퇴 판단용) */
  gpsAnomalyCount?: number
  /** 마지막 GPS 이상치 시 감지된 거리 (Kalman 예측과의 차이, 미터) */
  lastGpsAnomalyDistance?: number
}

/**
 * GPS-PDR 융합 설정
 */
export interface GPSPDRFusionConfig {
  /** PDR 설정 */
  pdrConfig?: {
    sensorFrequency?: number
    userHeight?: number
  }
  /** Kalman Filter 설정 */
  kalmanConfig?: {
    processNoise?: number // PDR 노이즈 분산
  }
  /** GPS 재보정 전략 */
  recalibration?: {
    /** 주기적 재보정 간격 (ms, 기본 60초) - Kalman Filter에서는 덜 자주 필요 */
    periodicInterval?: number
    /** 오차 임계값 (m, 이보다 크면 강제 리셋) */
    errorThreshold?: number
    /** 최소 GPS 정확도 (m, 이보다 나쁘면 GPS 무시) */
    minGpsAccuracy?: number
  }
}

/**
 * 융합 통계
 */
export interface FusionStatistics {
  /** GPS 업데이트 횟수 */
  gpsUpdateCount: number
  /** PDR 업데이트 횟수 (걸음 수) */
  pdrUpdateCount: number
  /** 융합 횟수 */
  fusionCount: number
  /** 재보정 횟수 */
  recalibrationCount: number
  /** 평균 GPS 정확도 (m) */
  averageGpsAccuracy: number
  /** 현재 융합 위치 */
  currentPosition: FusedPosition | null
  /** 추적 시작 시간 */
  startTime: number
  /** 경과 시간 (초) */
  elapsedTime: number
}

/**
 * 내부 config 타입
 */
interface InternalFusionConfig {
  pdrConfig: {
    sensorFrequency?: number
    userHeight?: number
  }
  kalmanConfig: {
    processNoise: number
  }
  recalibration: {
    periodicInterval: number
    errorThreshold: number
    minGpsAccuracy: number
  }
}

/**
 * GPS-PDR 융합 관리자 클래스
 */
export class GPSPDRFusionManager {
  private config: InternalFusionConfig

  // 구성 요소
  private gpsKalmanFilter: GPSKalmanFilter // 1차적으로 GPS 노이즈 제거
  private pdrTracker: PDRTracker
  private kalmanFilter: KalmanFilter2D

  // GPS 원점 (PDR Cartesian 좌표계의 기준점)
  private gpsOrigin: { lat: number, lng: number } | null = null

  // 마지막 GPS 위치
  private lastGpsPosition: Position2D | null = null
  private lastRecalibrationTime = 0

  // GPS 이상치 연속 감지 카운터
  private consecutiveGpsAnomalyCount = 0
  private readonly GPS_ANOMALY_RESET_THRESHOLD = 2 // 연속 2회 이상 이상치 감지 시 리셋

  // 마지막으로 감지된 이상치 GPS 위치 (리셋용)
  private lastAnomalyGpsPosition: { position: Position2D, cartesian: { x: number, y: number } } | null = null

  // 통계
  private stats = {
    gpsUpdateCount: 0,
    pdrUpdateCount: 0,
    fusionCount: 0,
    recalibrationCount: 0,
    gpsAccuracySum: 0,
    currentPosition: null as FusedPosition | null
  }

  // 추적 상태
  private isTracking = false
  private startTime = 0

  // 콜백
  private onPositionUpdateCallback: ((position: FusedPosition) => void) | null = null
  private onRecalibrationCallback: ((reason: string) => void) | null = null
  private onErrorCallback: ((error: Error) => void) | null = null

  constructor(config: GPSPDRFusionConfig = {}) {
    this.config = {
      pdrConfig: config.pdrConfig ?? {},
      kalmanConfig: {
        processNoise: config.kalmanConfig?.processNoise ?? 1.0 // 기본값
      },
      recalibration: {
        periodicInterval: config.recalibration?.periodicInterval ?? 60000, // 60초
        errorThreshold: config.recalibration?.errorThreshold ?? 20, // 20m (강의실 간 거리가 가깝기 때문에 낮춤)
        minGpsAccuracy: config.recalibration?.minGpsAccuracy ?? 40 // 40m
      }
    }

    // 구성 요소 초기화
    this.gpsKalmanFilter = new GPSKalmanFilter()
    this.pdrTracker = new PDRTracker(this.config.pdrConfig)
    this.kalmanFilter = new KalmanFilter2D(this.config.kalmanConfig.processNoise)

    // PDR 업데이트 콜백 등록
    this.pdrTracker.onPositionUpdate((position, delta) => {
      this.handlePDRUpdate(position, delta)
    })

    this.pdrTracker.onError((error) => {
      this.handleError(error)
    })
  }

  /**
   * 초기화 및 추적 시작
   */
  async startTracking(initialGpsPosition: Position2D): Promise<boolean> {
    if (this.isTracking) {
      console.warn('이미 추적 중입니다')
      return false
    }

    try {
      // 1. GPS 원점 설정
      this.gpsOrigin = {
        lat: initialGpsPosition.lat,
        lng: initialGpsPosition.lng
      }

      // 2. 필터 초기화
      this.gpsKalmanFilter.reset()
      this.kalmanFilter.reset()
      
      // Kalman 필터 초기 상태 설정 (원점 0,0, 불확실성은 GPS 정확도)
      const accuracy = initialGpsPosition.accuracy ?? 20
      this.kalmanFilter.initialize(0, 0, accuracy * accuracy)

      // 3. PDR 초기화 (실패 시 GPS 전용 모드로 폴백)
      let pdrInitialized = false
      try {
        pdrInitialized = await this.pdrTracker.initialize()
      } catch (e) {
        console.warn('PDR 초기화 중 에러 발생:', e)
      }

      if (!pdrInitialized) {
        console.warn('⚠️ PDR 센서 초기화 실패 -> GPS 전용 모드로 동작합니다.')
        // PDR 없이 진행
      } else {
        // 4. PDR 추적 시작 (원점 (0, 0)에서 시작)
        await this.pdrTracker.startTracking({
          x: 0,
          y: 0,
          heading: 0
        })
      }

      // 5. 초기 위치 설정
      this.lastGpsPosition = initialGpsPosition
      this.lastRecalibrationTime = Date.now()

      // 초기 위치 전송
      const initialFused: FusedPosition = {
        ...initialGpsPosition,
        x: 0,
        y: 0,
        gpsWeight: 1, // Legacy support
        pdrWeight: 0, // Legacy support
        confidence: 1.0,
        source: 'gps'
      }
      this.onPositionUpdateCallback?.(initialFused)

      this.isTracking = true
      this.startTime = Date.now()

      console.log('✅ GPS-PDR 융합 추적 시작 (Kalman Filter)')
      console.log(`   GPS 원점: (${initialGpsPosition.lat.toFixed(6)}, ${initialGpsPosition.lng.toFixed(6)})`)

      return true

    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error('추적 시작 실패'))
      return false
    }
  }

  /**
   * GPS 유효성 검증 (이상치 감지)
   * @returns GPS가 유효하면 true, 이상치면 false
   */
  private isGPSValid(gpsPosition: Position2D, gpsCartesian: { x: number, y: number }): boolean {
    if (!this.lastGpsPosition) {
      return true // 첫 GPS 샘플은 항상 유효
    }

    // 1. 시간 간격 계산 (초)
    const timeDelta = (gpsPosition.timestamp - this.lastGpsPosition.timestamp) / 1000
    if (timeDelta <= 0) {
      return true // 시간 정보가 없거나 역순이면 일단 허용
    }

    // 2. 이전 GPS 위치를 Cartesian으로 변환
    const lastGpsCartesian = gpsToCartesian(
      { lat: this.lastGpsPosition.lat, lng: this.lastGpsPosition.lng },
      this.gpsOrigin!
    )

    // 3. 이동 거리 계산
    const dx = gpsCartesian.x - lastGpsCartesian.x
    const dy = gpsCartesian.y - lastGpsCartesian.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // 4. 속도 계산 (m/s)
    const speed = distance / timeDelta

    // 5. 속도 임계값 검증
    // 사람이 걷거나 뛰는 속도: 최대 ~10 m/s
    // GPS 튀는 경우를 거부하기 위해 20 m/s로 설정
    const MAX_REASONABLE_SPEED = 20 // m/s (~72 km/h)

    if (speed > MAX_REASONABLE_SPEED) {
      console.warn(`⚠️ GPS 속도 이상: ${speed.toFixed(1)} m/s (거리: ${distance.toFixed(1)}m, 시간: ${timeDelta.toFixed(1)}s)`)
      return false
    }

    // 6. Kalman Filter 예측 위치와의 거리 확인
    const kPos = this.kalmanFilter.getPosition()
    const kDx = gpsCartesian.x - kPos.x
    const kDy = gpsCartesian.y - kPos.y
    const kDistance = Math.sqrt(kDx * kDx + kDy * kDy)

    // Kalman Filter 예측과 너무 멀면 의심
    // 정확도를 고려하여 임계값 설정 (정확도의 3배 또는 최소 30m)
    // 강의실 간 거리가 가깝기 때문에 30m로 낮춤
    const threshold = Math.max(30, (gpsPosition.accuracy ?? 20) * 3)

    if (kDistance > threshold) {
      console.warn(`⚠️ GPS가 Kalman 예측과 차이 큼: ${kDistance.toFixed(1)}m (임계값: ${threshold.toFixed(1)}m)`)
      return false
    }

    return true
  }

  /**
   * GPS 위치 업데이트 (Update Step)
   */
  updateGPS(rawGpsPosition: Position2D): void {
    if (!this.isTracking || !this.gpsOrigin) {
      console.warn('추적이 시작되지 않았습니다')
      return
    }

    // 1. GPS 전처리 (노이즈 제거)
    const filteredPosition = this.gpsKalmanFilter.filter(
      rawGpsPosition.lat,
      rawGpsPosition.lng,
      rawGpsPosition.accuracy ?? 20
    )

    const gpsPosition: Position2D = {
      lat: filteredPosition.latitude,
      lng: filteredPosition.longitude,
      accuracy: filteredPosition.accuracy,
      timestamp: rawGpsPosition.timestamp
    }

    this.stats.gpsUpdateCount++
    this.stats.gpsAccuracySum += gpsPosition.accuracy ?? 20

    // 2. GPS 좌표를 Cartesian으로 변환
    const gpsCartesian = gpsToCartesian(
      { lat: gpsPosition.lat, lng: gpsPosition.lng },
      this.gpsOrigin
    )

    // ✅ 3. GPS 이상치 감지 (속도 기반 검증)
    if (this.lastGpsPosition && !this.isGPSValid(gpsPosition, gpsCartesian)) {
      this.consecutiveGpsAnomalyCount++
      this.lastAnomalyGpsPosition = { position: gpsPosition, cartesian: gpsCartesian }

      console.warn(`⚠️ GPS 이상치 감지 (연속 ${this.consecutiveGpsAnomalyCount}회) - 무시하고 PDR만 사용`)

      // 연속 N회 이상 이상치 감지 시 → 실제로 위치가 변경된 것으로 판단하고 강제 리셋
      if (this.consecutiveGpsAnomalyCount >= this.GPS_ANOMALY_RESET_THRESHOLD) {
        console.warn(`🔄 GPS 이상치 연속 ${this.consecutiveGpsAnomalyCount}회 감지 - 실제 이동으로 판단하여 Kalman 필터 강제 리셋`)

        // Kalman 필터를 새 GPS 위치로 강제 리셋
        const accuracy = gpsPosition.accuracy ?? 20
        this.kalmanFilter.setState(gpsCartesian.x, gpsCartesian.y, accuracy * accuracy)

        // PDRTracker 위치도 리셋
        this.pdrTracker.resetPosition({
          x: gpsCartesian.x,
          y: gpsCartesian.y
        })

        // 카운터 및 상태 리셋
        this.consecutiveGpsAnomalyCount = 0
        this.lastAnomalyGpsPosition = null
        this.lastGpsPosition = gpsPosition
        this.stats.recalibrationCount++

        this.onRecalibrationCallback?.('GPS 이상치 연속 감지로 인한 강제 리셋')

        // 리셋 후 융합 위치 내보내기
        this.emitFusedPosition('gps', gpsPosition.timestamp)
        return
      }

      // GPS가 튀는 경우 업데이트하지 않고 PDR만 사용
      return
    }

    // GPS 정상 - 이상치 카운터 리셋
    this.consecutiveGpsAnomalyCount = 0
    this.lastAnomalyGpsPosition = null

    this.lastGpsPosition = gpsPosition

    // 4. Kalman Filter Update (보정)
    // GPS 정확도가 너무 나쁘면 보정 스킵
    if ((gpsPosition.accuracy ?? 100) <= this.config.recalibration.minGpsAccuracy) {
      this.kalmanFilter.update(gpsCartesian.x, gpsCartesian.y, gpsPosition.accuracy ?? 20)
      this.stats.fusionCount++
    } else {
      console.log(`GPS 정확도 낮음(${gpsPosition.accuracy}m), 보정 스킵`)
    }

    // 5. 이상치 확인 (리셋 로직)
    this.checkRecalibration(gpsPosition, gpsCartesian)

    // 6. 융합된 위치 내보내기
    this.emitFusedPosition('fused', gpsPosition.timestamp)
  }

  /**
   * PDR 업데이트 처리 (Prediction Step)
   */
  private handlePDRUpdate(pdrPosition: PDRPosition, delta: PDRDelta): void {
    if (!this.isTracking || !this.gpsOrigin) return

    this.stats.pdrUpdateCount++

    // 1. Kalman Filter Predict (예측)
    // PDR의 dx, dy를 사용하여 상태 업데이트
    this.kalmanFilter.predict(delta.dx, delta.dy)

    // 2. 융합된 위치 내보내기
    this.emitFusedPosition('pdr', pdrPosition.timestamp)
  }

  /**
   * 현재 Kalman Filter 상태를 기반으로 FusedPosition 생성 및 콜백 호출
   */
  private emitFusedPosition(source: 'gps' | 'pdr' | 'fused', timestamp: number): void {
    if (!this.gpsOrigin) return

    const kPos = this.kalmanFilter.getPosition()
    const kUncertainty = this.kalmanFilter.getUncertainty()

    // Cartesian -> GPS 변환
    const fusedGps = cartesianToGPS(
      { x: kPos.x, y: kPos.y },
      this.gpsOrigin
    )

    // GPS 이상치 거리 계산 (마지막 이상치 GPS 위치와 현재 Kalman 위치 차이)
    let lastGpsAnomalyDistance: number | undefined = undefined
    if (this.lastAnomalyGpsPosition) {
      const dx = this.lastAnomalyGpsPosition.cartesian.x - kPos.x
      const dy = this.lastAnomalyGpsPosition.cartesian.y - kPos.y
      lastGpsAnomalyDistance = Math.sqrt(dx * dx + dy * dy)
    }

    const fusedPosition: FusedPosition = {
      lat: fusedGps.lat,
      lng: fusedGps.lng,
      accuracy: Math.max(kUncertainty.stdDevX, kUncertainty.stdDevY),
      timestamp: timestamp,
      x: kPos.x,
      y: kPos.y,
      confidence: 1.0 / (1.0 + Math.max(kUncertainty.stdDevX, kUncertainty.stdDevY)),
      source: source,
      uncertainty: { x: kUncertainty.stdDevX, y: kUncertainty.stdDevY },
      // Legacy fields
      gpsWeight: 0.5,
      pdrWeight: 0.5,
      // GPS 이상치 정보 (서버 조퇴 판단용)
      gpsAnomalyCount: this.consecutiveGpsAnomalyCount,
      lastGpsAnomalyDistance
    }

    this.stats.currentPosition = fusedPosition
    this.onPositionUpdateCallback?.(fusedPosition)
  }

  /**
   * 재보정 확인 (안전장치)
   * Kalman Filter가 발산하거나 GPS와 너무 멀어졌을 때 강제 리셋
   * ✅ GPS가 유효한 경우에만 재보정
   */
  private checkRecalibration(
    gpsPosition: Position2D,
    gpsCartesian: { x: number, y: number }
  ): void {
    const kPos = this.kalmanFilter.getPosition()

    // 현재 추정 위치와 GPS 위치 사이의 거리
    const dx = kPos.x - gpsCartesian.x
    const dy = kPos.y - gpsCartesian.y
    const distance = Math.sqrt(dx*dx + dy*dy)

    // ✅ 임계값 초과 시 - 하지만 GPS 정확도가 좋은 경우에만 리셋
    if (distance > this.config.recalibration.errorThreshold) {
      const gpsAccuracy = gpsPosition.accuracy ?? 20

      // GPS 정확도가 좋은 경우(20m 이하)에만 재보정
      // 정확도가 나쁜 GPS로는 재보정하지 않음
      if (gpsAccuracy <= 20) {
        console.log(`🔄 시스템 재보정: 오차 과다 (${distance.toFixed(1)}m), GPS 정확도: ${gpsAccuracy.toFixed(1)}m`)
        this.recalibrate(gpsCartesian, gpsAccuracy, `오차 과다 (${distance.toFixed(1)}m)`)
      } else {
        console.warn(`⚠️ 재보정 필요하지만 GPS 정확도 불량(${gpsAccuracy.toFixed(1)}m) - 재보정 스킵`)
      }
      return
    }
  }

  /**
   * 강제 재보정
   */
  private recalibrate(gpsCartesian: { x: number, y: number }, accuracy: number, reason: string): void {
    console.log(`🔄 시스템 재보정: ${reason}`)
    
    // Kalman Filter 강제 설정
    this.kalmanFilter.setState(gpsCartesian.x, gpsCartesian.y, accuracy * accuracy)
    
    // PDRTracker 위치도 리셋
    this.pdrTracker.resetPosition({
      x: gpsCartesian.x,
      y: gpsCartesian.y
      // heading은 유지
    })

    this.stats.recalibrationCount++
    this.onRecalibrationCallback?.(reason)
  }

  /**
   * 추적 중지
   */
  stopTracking(): void {
    if (!this.isTracking) return

    this.pdrTracker.stopTracking()
    this.isTracking = false

    console.log('⏸️ GPS-PDR 융합 추적 중지')
  }

  /**
   * 통계 반환
   */
  getStatistics(): FusionStatistics {
    const elapsedTime = this.isTracking
      ? (Date.now() - this.startTime) / 1000
      : 0

    const averageGpsAccuracy = this.stats.gpsUpdateCount > 0
      ? this.stats.gpsAccuracySum / this.stats.gpsUpdateCount
      : 0

    return {
      ...this.stats,
      averageGpsAccuracy,
      startTime: this.startTime,
      elapsedTime
    }
  }

  /**
   * PDR 통계 반환
   */
  getPDRStatistics() {
    return this.pdrTracker.getStatistics()
  }

  /**
   * 위치 업데이트 콜백 등록
   */
  onPositionUpdate(callback: (position: FusedPosition) => void): void {
    this.onPositionUpdateCallback = callback
  }

  /**
   * 재보정 콜백 등록
   */
  onRecalibration(callback: (reason: string) => void): void {
    this.onRecalibrationCallback = callback
  }

  /**
   * 에러 콜백 등록
   */
  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback
  }

  /**
   * 에러 처리
   */
  private handleError(error: Error): void {
    console.error('GPS-PDR 융합 에러:', error)
    if (this.onErrorCallback) {
      this.onErrorCallback(error)
    }
  }

  /**
   * 현재 융합 위치 반환
   */
  getCurrentPosition(): Readonly<FusedPosition> | null {
    return this.stats.currentPosition ? { ...this.stats.currentPosition } : null
  }

  /**
   * 전체 초기화
   */
  reset(): void {
    this.stopTracking()

    this.gpsKalmanFilter.reset()
    this.kalmanFilter.reset()
    this.pdrTracker.reset()

    this.gpsOrigin = null
    this.lastGpsPosition = null
    this.lastRecalibrationTime = 0
    this.consecutiveGpsAnomalyCount = 0
    this.lastAnomalyGpsPosition = null

    this.stats = {
      gpsUpdateCount: 0,
      pdrUpdateCount: 0,
      fusionCount: 0,
      recalibrationCount: 0,
      gpsAccuracySum: 0,
      currentPosition: null
    }

    this.startTime = 0

    console.log('🔄 GPS-PDR 융합 관리자 초기화')
  }

  /**
   * 정리 (메모리 해제)
   */
  destroy(): void {
    this.stopTracking()
    this.pdrTracker.destroy()

    this.onPositionUpdateCallback = null
    this.onRecalibrationCallback = null
    this.onErrorCallback = null

    console.log('🧹 GPS-PDR 융합 관리자 정리 완료')
  }
}

/**
 * 유틸리티 함수
 */
export function getGPSAccuracyStatus(accuracy: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (accuracy <= 10) return 'excellent'
  if (accuracy <= 20) return 'good'
  if (accuracy <= 50) return 'fair'
  return 'poor'
}
