/**
 * PDR 통합 추적기 (Pedestrian Dead Reckoning Tracker)
 * 걸음 감지 + 걸음 길이 + 방향 추정 통합
 */

import { UnifiedSensorManager } from '@/lib/sensors/sensor-manager'
import type { SensorData } from '@/lib/sensors/sensor-types'

import { StepDetector, type StepInfo, type StepDetectorConfig } from './step-detector'
import { StepLengthEstimator, type StepLengthConfig } from './step-length-estimator'
import { HeadingEstimator, type HeadingEstimatorConfig } from './heading-estimator'

/**
 * PDR 추적 설정
 */
export interface PDRTrackerConfig {
  /** 걸음 감지 설정 */
  stepDetector?: StepDetectorConfig
  /** 걸음 길이 설정 */
  stepLength?: StepLengthConfig
  /** 방향 설정 */
  heading?: HeadingEstimatorConfig
  /** 센서 샘플링 주파수 (Hz) */
  sensorFrequency?: number
}

/**
 * PDR 위치 (Cartesian 좌표계)
 */
export interface PDRPosition {
  /** X 좌표 (동쪽 방향, 미터) */
  x: number
  /** Y 좌표 (북쪽 방향, 미터) */
  y: number
  /** 현재 방향 (라디안) */
  heading: number
  /** 신뢰도 (0~1) */
  confidence: number
  /** 타임스탬프 */
  timestamp: number
}

/**
 * PDR 델타 (변화량)
 */
export interface PDRDelta {
  /** X 방향 변화량 (미터) */
  dx: number
  /** Y 방향 변화량 (미터) */
  dy: number
  /** 거리 변화량 (미터) */
  distance: number
  /** 방향 (라디안) */
  heading: number
  /** 걸음 정보 */
  step: StepInfo
}

/**
 * PDR 통계
 */
export interface PDRStatistics {
  /** 총 걸음 수 */
  totalSteps: number
  /** 총 이동 거리 (미터) */
  totalDistance: number
  /** 평균 걸음 길이 (미터) */
  averageStepLength: number
  /** 현재 위치 */
  currentPosition: PDRPosition
  /** 추적 시작 시간 */
  startTime: number
  /** 경과 시간 (초) */
  elapsedTime: number
}

/**
 * PDR 추적기 클래스
 */
export class PDRTracker {
  private config: Required<PDRTrackerConfig>

  // 센서 관리자
  private sensorManager: UnifiedSensorManager

  // PDR 구성 요소
  private stepDetector: StepDetector
  private stepLengthEstimator: StepLengthEstimator
  private headingEstimator: HeadingEstimator

  // 현재 위치 (Cartesian 좌표계)
  private currentPosition: PDRPosition = {
    x: 0,
    y: 0,
    heading: 0,
    confidence: 1.0,
    timestamp: Date.now()
  }

  // 이동 거리 누적
  private totalDistance = 0

  // 추적 시작 시간
  private startTime = 0

  // 가속도 범위 추적 (Weinberg 공식용)
  private recentAccelerationMax = 0
  private recentAccelerationMin = Infinity

  // 콜백
  private onPositionUpdateCallback: ((position: PDRPosition, delta: PDRDelta) => void) | null = null
  private onErrorCallback: ((error: Error) => void) | null = null

  // 추적 상태
  private isTracking = false

  constructor(config: PDRTrackerConfig = {}) {
    this.config = {
      stepDetector: config.stepDetector ?? {},
      stepLength: config.stepLength ?? {},
      heading: config.heading ?? {},
      sensorFrequency: config.sensorFrequency ?? 60
    }

    // 구성 요소 초기화
    this.stepDetector = new StepDetector(this.config.stepDetector)
    this.stepLengthEstimator = new StepLengthEstimator(this.config.stepLength)
    this.headingEstimator = new HeadingEstimator(this.config.heading)

    // 센서 관리자 초기화
    this.sensorManager = new UnifiedSensorManager({
      frequency: this.config.sensorFrequency
    })

    // 걸음 감지 이벤트 등록
    this.stepDetector.onStep((step) => this.handleStep(step))
  }

  /**
   * PDR 초기화
   */
  async initialize(): Promise<boolean> {
    try {
      const initialized = await this.sensorManager.initialize()
      if (!initialized) {
        throw new Error('센서 초기화 실패')
      }
      return true
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error('초기화 실패'))
      return false
    }
  }

  /**
   * PDR 추적 시작
   */
  async startTracking(
    initialPosition?: { x: number, y: number, heading?: number }
  ): Promise<void> {
    if (this.isTracking) {
      console.warn('PDR 추적이 이미 시작되었습니다')
      return
    }

    // 초기 위치 설정
    if (initialPosition) {
      this.currentPosition = {
        x: initialPosition.x,
        y: initialPosition.y,
        heading: initialPosition.heading ?? 0,
        confidence: 1.0,
        timestamp: Date.now()
      }

      if (initialPosition.heading !== undefined) {
        this.headingEstimator.setHeading(initialPosition.heading)
      }
    }

    this.startTime = Date.now()
    this.totalDistance = 0

    // 센서 추적 시작
    this.sensorManager.startTracking(
      (data) => this.processSensorData(data),
      (error) => this.handleError(error)
    )

    this.isTracking = true
    console.log('✅ PDR 추적 시작')
  }

  /**
   * PDR 추적 중지
   */
  stopTracking(): void {
    if (!this.isTracking) return

    this.sensorManager.stopTracking()
    this.isTracking = false

    console.log('⏸️ PDR 추적 중지')
  }

  /**
   * 센서 데이터 처리
   */
  private processSensorData(data: SensorData): void {
    // 1. 가속도 범위 추적 (Weinberg 공식용)
    const magnitude = Math.sqrt(
      data.acceleration.x ** 2 +
      data.acceleration.y ** 2 +
      data.acceleration.z ** 2
    )

    this.recentAccelerationMax = Math.max(this.recentAccelerationMax, magnitude)
    this.recentAccelerationMin = Math.min(this.recentAccelerationMin, magnitude)

    // 2. 걸음 감지 (자동으로 handleStep 호출됨)
    this.stepDetector.processAcceleration(data.acceleration)

    // 3. 방향 업데이트 (자이로스코프)
    if (data.rotation) {
      this.headingEstimator.updateFromGyroscope(data.rotation)
    }

    // 4. 지자기 센서 보정 (있는 경우)
    if (data.magnetometer) {
      this.headingEstimator.calibrateFromMagnetometer(data.magnetometer)
    }
  }

  /**
   * 걸음 감지 시 처리
   */
  private handleStep(step: StepInfo): void {
    // 1. 걸음 길이 추정
    const stepLengthInfo = this.stepLengthEstimator.estimate(
      this.recentAccelerationMax,
      this.recentAccelerationMin
    )

    // 가속도 범위 초기화
    this.recentAccelerationMax = 0
    this.recentAccelerationMin = Infinity

    // 2. 현재 방향 가져오기
    const heading = this.headingEstimator.getHeading()

    // 3. 위치 변화량 계산 (Cartesian 좌표계)
    const dx = stepLengthInfo.length * Math.cos(heading)
    const dy = stepLengthInfo.length * Math.sin(heading)

    // 4. 위치 업데이트
    this.currentPosition = {
      x: this.currentPosition.x + dx,
      y: this.currentPosition.y + dy,
      heading,
      confidence: Math.min(this.currentPosition.confidence * 0.98, stepLengthInfo.confidence),
      timestamp: step.timestamp
    }

    this.totalDistance += stepLengthInfo.length

    // 5. 델타 정보 생성
    const delta: PDRDelta = {
      dx,
      dy,
      distance: stepLengthInfo.length,
      heading,
      step
    }

    // 6. 콜백 호출
    if (this.onPositionUpdateCallback) {
      this.onPositionUpdateCallback(this.currentPosition, delta)
    }
  }

  /**
   * 위치 업데이트 콜백 등록
   */
  onPositionUpdate(callback: (position: PDRPosition, delta: PDRDelta) => void): void {
    this.onPositionUpdateCallback = callback
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
    console.error('PDR 에러:', error)

    if (this.onErrorCallback) {
      this.onErrorCallback(error)
    }
  }

  /**
   * 현재 위치 반환
   */
  getCurrentPosition(): Readonly<PDRPosition> {
    return { ...this.currentPosition }
  }

  /**
   * 통계 반환
   */
  getStatistics(): PDRStatistics {
    const elapsedTime = (Date.now() - this.startTime) / 1000  // 초 단위

    return {
      totalSteps: this.stepDetector.getStepCount(),
      totalDistance: this.totalDistance,
      averageStepLength: this.stepLengthEstimator.getAverageStepLength(),
      currentPosition: this.getCurrentPosition(),
      startTime: this.startTime,
      elapsedTime
    }
  }

  /**
   * 위치 재설정 (GPS 재보정 시 사용)
   */
  resetPosition(position: { x: number, y: number, heading?: number }): void {
    this.currentPosition = {
      x: position.x,
      y: position.y,
      heading: position.heading ?? this.currentPosition.heading,
      confidence: 1.0,  // 재보정 시 신뢰도 리셋
      timestamp: Date.now()
    }

    if (position.heading !== undefined) {
      this.headingEstimator.setHeading(position.heading)
    }

    console.log('📍 PDR 위치 재설정:', position)
  }

  /**
   * 전체 초기화
   */
  reset(): void {
    this.stopTracking()

    this.stepDetector.reset()
    this.stepLengthEstimator.reset()
    this.headingEstimator.reset()

    this.currentPosition = {
      x: 0,
      y: 0,
      heading: 0,
      confidence: 1.0,
      timestamp: Date.now()
    }

    this.totalDistance = 0
    this.startTime = 0
    this.recentAccelerationMax = 0
    this.recentAccelerationMin = Infinity

    console.log('🔄 PDR 초기화 완료')
  }

  /**
   * 정리 (메모리 해제)
   */
  destroy(): void {
    this.stopTracking()
    this.sensorManager.destroy()
    this.onPositionUpdateCallback = null
    this.onErrorCallback = null

    console.log('🧹 PDR 추적기 정리 완료')
  }
}

/**
 * PDR 유틸리티 함수
 */

/**
 * Cartesian 좌표를 GPS 좌표로 변환 (근사)
 */
export function cartesianToGPS(
  cartesian: { x: number, y: number },
  origin: { lat: number, lng: number }
): { lat: number, lng: number } {
  // 1도 위도 ≈ 111,320m
  // 1도 경도 ≈ 111,320m × cos(latitude)

  const latOffset = cartesian.y / 111320
  const lngOffset = cartesian.x / (111320 * Math.cos(origin.lat * Math.PI / 180))

  return {
    lat: origin.lat + latOffset,
    lng: origin.lng + lngOffset
  }
}

/**
 * GPS 좌표를 Cartesian 좌표로 변환 (근사)
 */
export function gpsToCartesian(
  gps: { lat: number, lng: number },
  origin: { lat: number, lng: number }
): { x: number, y: number } {
  const latDiff = gps.lat - origin.lat
  const lngDiff = gps.lng - origin.lng

  const y = latDiff * 111320
  const x = lngDiff * 111320 * Math.cos(origin.lat * Math.PI / 180)

  return { x, y }
}

/**
 * 두 Cartesian 좌표 사이의 거리 계산
 */
export function calculateCartesianDistance(
  pos1: { x: number, y: number },
  pos2: { x: number, y: number }
): number {
  const dx = pos2.x - pos1.x
  const dy = pos2.y - pos1.y
  return Math.sqrt(dx * dx + dy * dy)
}
