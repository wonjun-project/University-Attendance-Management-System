/**
 * GPS-PDR 융합 관리자
 * GPS Kalman Filter + PDR + Complementary Filter 통합
 */

import { GPSKalmanFilter } from '@/lib/utils/gps-filter'
import { PDRTracker, type PDRPosition, type PDRDelta, cartesianToGPS, gpsToCartesian } from '@/lib/pdr/pdr-tracker'
import { ComplementaryFilter, type FusedPosition, type Position2D } from './complementary-filter'

// Re-export FusedPosition for external use
export type { FusedPosition, Position2D }

/**
 * GPS-PDR 융합 설정
 */
export interface GPSPDRFusionConfig {
  /** PDR 설정 */
  pdrConfig?: {
    sensorFrequency?: number
    userHeight?: number
  }
  /** Complementary Filter 설정 */
  fusionConfig?: {
    defaultGpsWeight?: number
    minGpsAccuracy?: number
  }
  /** GPS 재보정 전략 */
  recalibration?: {
    /** 주기적 재보정 간격 (ms, 기본 30초) */
    periodicInterval?: number
    /** 오차 임계값 (m, 이보다 크면 즉시 재보정) */
    errorThreshold?: number
    /** 최소 GPS 정확도 (m, 이보다 나쁘면 재보정 스킵) */
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
  /** 평균 GPS 가중치 */
  averageGpsWeight: number
  /** 현재 융합 위치 */
  currentPosition: FusedPosition | null
  /** 추적 시작 시간 */
  startTime: number
  /** 경과 시간 (초) */
  elapsedTime: number
}

/**
 * 내부 config 타입 (모든 속성이 required)
 */
interface InternalFusionConfig {
  pdrConfig: {
    sensorFrequency?: number
    userHeight?: number
  }
  fusionConfig: {
    defaultGpsWeight?: number
    minGpsAccuracy?: number
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
  private gpsKalmanFilter: GPSKalmanFilter
  private pdrTracker: PDRTracker
  private complementaryFilter: ComplementaryFilter

  // GPS 원점 (PDR Cartesian 좌표계의 기준점)
  private gpsOrigin: { lat: number, lng: number } | null = null

  // 마지막 GPS 위치
  private lastGpsPosition: Position2D | null = null
  private lastGpsRecalibrationTime = 0

  // 통계
  private stats = {
    gpsUpdateCount: 0,
    pdrUpdateCount: 0,
    fusionCount: 0,
    recalibrationCount: 0,
    gpsAccuracySum: 0
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
      fusionConfig: config.fusionConfig ?? {},
      recalibration: {
        periodicInterval: config.recalibration?.periodicInterval ?? 30000,  // 30초
        errorThreshold: config.recalibration?.errorThreshold ?? 15,  // 15m
        minGpsAccuracy: config.recalibration?.minGpsAccuracy ?? 30  // 30m
      }
    }

    // 구성 요소 초기화
    this.gpsKalmanFilter = new GPSKalmanFilter()
    this.pdrTracker = new PDRTracker(this.config.pdrConfig)
    this.complementaryFilter = new ComplementaryFilter(this.config.fusionConfig)

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

      // 2. Kalman Filter 초기화
      this.gpsKalmanFilter.reset()

      // 3. PDR 초기화
      const initialized = await this.pdrTracker.initialize()
      if (!initialized) {
        throw new Error('PDR 센서 초기화 실패')
      }

      // 4. PDR 추적 시작 (원점 (0, 0)에서 시작)
      await this.pdrTracker.startTracking({
        x: 0,
        y: 0,
        heading: 0
      })

      // 5. 초기 위치 설정
      this.lastGpsPosition = initialGpsPosition
      this.lastGpsRecalibrationTime = Date.now()

      const initialFused = this.complementaryFilter.useGpsOnly(initialGpsPosition)
      this.onPositionUpdateCallback?.(initialFused)

      this.isTracking = true
      this.startTime = Date.now()

      console.log('✅ GPS-PDR 융합 추적 시작')
      console.log(`   GPS 원점: (${initialGpsPosition.lat.toFixed(6)}, ${initialGpsPosition.lng.toFixed(6)})`)

      return true

    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error('추적 시작 실패'))
      return false
    }
  }

  /**
   * GPS 위치 업데이트
   */
  updateGPS(rawGpsPosition: Position2D): void {
    if (!this.isTracking || !this.gpsOrigin) {
      console.warn('추적이 시작되지 않았습니다')
      return
    }

    // 1. Kalman Filter 적용
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

    this.lastGpsPosition = gpsPosition
    this.stats.gpsUpdateCount++
    this.stats.gpsAccuracySum += gpsPosition.accuracy ?? 20

    // 2. PDR 위치 가져오기
    const pdrCartesian = this.pdrTracker.getCurrentPosition()
    const pdrGps = cartesianToGPS(
      { x: pdrCartesian.x, y: pdrCartesian.y },
      this.gpsOrigin
    )

    const pdrPosition: Position2D = {
      lat: pdrGps.lat,
      lng: pdrGps.lng,
      timestamp: pdrCartesian.timestamp
    }

    // 3. GPS + PDR 융합
    const fusedPosition = this.complementaryFilter.fuse(gpsPosition, pdrPosition)
    this.stats.fusionCount++

    // 4. 재보정 확인
    this.checkRecalibration(gpsPosition, pdrPosition, fusedPosition)

    // 5. 콜백 호출
    this.onPositionUpdateCallback?.(fusedPosition)
  }

  /**
   * PDR 업데이트 처리 (내부 콜백)
   */
  private handlePDRUpdate(pdrPosition: PDRPosition, delta: PDRDelta): void {
    if (!this.isTracking || !this.gpsOrigin) return

    this.stats.pdrUpdateCount++

    // GPS 업데이트가 없으면 PDR만 사용
    if (!this.lastGpsPosition) {
      const pdrGps = cartesianToGPS(
        { x: pdrPosition.x, y: pdrPosition.y },
        this.gpsOrigin
      )

      const pdrOnly: Position2D = {
        lat: pdrGps.lat,
        lng: pdrGps.lng,
        timestamp: pdrPosition.timestamp
      }

      const fusedPosition = this.complementaryFilter.usePdrOnly(pdrOnly)
      this.onPositionUpdateCallback?.(fusedPosition)
    }
  }

  /**
   * 재보정 확인 및 실행
   */
  private checkRecalibration(
    gpsPosition: Position2D,
    pdrPosition: Position2D,
    fusedPosition: FusedPosition
  ): void {
    const now = Date.now()
    const timeSinceLastRecalibration = now - this.lastGpsRecalibrationTime

    // 1. GPS 정확도 확인
    const gpsAccuracy = gpsPosition.accuracy ?? 100
    if (gpsAccuracy > this.config.recalibration.minGpsAccuracy) {
      // GPS 정확도가 너무 나쁘면 재보정 스킵
      return
    }

    // 2. 오차 임계값 확인 (GPS와 PDR의 차이)
    const error = this.calculateDistance(gpsPosition, pdrPosition)

    if (error > this.config.recalibration.errorThreshold) {
      // 즉시 재보정
      this.recalibrate(gpsPosition, `오차 임계값 초과 (${error.toFixed(1)}m)`)
      return
    }

    // 3. 주기적 재보정
    if (timeSinceLastRecalibration > this.config.recalibration.periodicInterval) {
      this.recalibrate(gpsPosition, '주기적 재보정')
    }
  }

  /**
   * PDR 재보정 실행
   */
  private recalibrate(gpsPosition: Position2D, reason: string): void {
    if (!this.gpsOrigin) return

    console.log(`🔄 PDR 재보정: ${reason}`)

    // 1. GPS 위치를 새로운 PDR 원점으로 설정
    const newCartesian = gpsToCartesian(
      { lat: gpsPosition.lat, lng: gpsPosition.lng },
      this.gpsOrigin
    )

    this.pdrTracker.resetPosition({
      x: newCartesian.x,
      y: newCartesian.y
    })

    // 2. Complementary Filter의 PDR 신뢰도 리셋
    this.complementaryFilter.resetPdr()

    // 3. 재보정 시간 업데이트
    this.lastGpsRecalibrationTime = Date.now()
    this.stats.recalibrationCount++

    // 4. 콜백 호출
    this.onRecalibrationCallback?.(reason)
  }

  /**
   * 두 위치 사이의 거리 계산 (Haversine)
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

    const lastFused = this.complementaryFilter.getLastFusedPosition()
    const averageGpsWeight = lastFused?.gpsWeight ?? 0

    return {
      gpsUpdateCount: this.stats.gpsUpdateCount,
      pdrUpdateCount: this.stats.pdrUpdateCount,
      fusionCount: this.stats.fusionCount,
      recalibrationCount: this.stats.recalibrationCount,
      averageGpsAccuracy,
      averageGpsWeight,
      currentPosition: lastFused,
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
    return this.complementaryFilter.getLastFusedPosition()
  }

  /**
   * 전체 초기화
   */
  reset(): void {
    this.stopTracking()

    this.gpsKalmanFilter.reset()
    this.pdrTracker.reset()
    this.complementaryFilter.reset()

    this.gpsOrigin = null
    this.lastGpsPosition = null
    this.lastGpsRecalibrationTime = 0

    this.stats = {
      gpsUpdateCount: 0,
      pdrUpdateCount: 0,
      fusionCount: 0,
      recalibrationCount: 0,
      gpsAccuracySum: 0
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
 * GPS-PDR 융합 유틸리티 함수
 */

/**
 * GPS 정확도 상태 판단
 */
export function getGPSAccuracyStatus(accuracy: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (accuracy <= 10) return 'excellent'
  if (accuracy <= 20) return 'good'
  if (accuracy <= 50) return 'fair'
  return 'poor'
}

/**
 * 융합 모드 판단
 */
export function getFusionMode(fusedPosition: FusedPosition): string {
  const { gpsWeight, pdrWeight } = fusedPosition

  if (gpsWeight > 0.8) return 'GPS 주도'
  if (pdrWeight > 0.8) return 'PDR 주도'
  return '균형 융합'
}
