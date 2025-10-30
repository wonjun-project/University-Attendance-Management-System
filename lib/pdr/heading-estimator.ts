/**
 * 방향 추정기 (Heading Estimator)
 * 자이로스코프 + 지자기 센서 융합
 */

import type { RotationRateData, MagnetometerData } from '@/lib/sensors/sensor-types'

/**
 * 방향 추정 설정
 */
export interface HeadingEstimatorConfig {
  /** 초기 방향 (라디안, 기본 0 = 북쪽) */
  initialHeading?: number
  /** Complementary Filter 가중치 (0~1, 기본 0.98) */
  gyroWeight?: number
  /** 지자기 센서 보정 활성화 (기본 true) */
  enableMagnetometer?: boolean
  /** 지자기 센서 보정 주기 (ms, 기본 1000) */
  magnetometerCalibrationInterval?: number
}

/**
 * 방향 정보
 */
export interface HeadingInfo {
  /** 현재 방향 (라디안, 0 = 북쪽, 시계방향) */
  heading: number
  /** 현재 방향 (도, 0~360) */
  headingDegrees: number
  /** 방향 변화율 (라디안/초) */
  rotationRate: number
  /** 신뢰도 (0~1) */
  confidence: number
  /** 사용된 센서 */
  source: 'gyroscope' | 'magnetometer' | 'fused'
}

/**
 * 방향 추정기 클래스
 */
export class HeadingEstimator {
  private config: Required<HeadingEstimatorConfig>

  // 현재 방향 (라디안)
  private currentHeading: number

  // 마지막 업데이트 시간
  private lastUpdateTime: number = Date.now()
  private lastMagnetometerCalibration: number = Date.now()

  // Gyroscope drift 보정
  private gyroDriftRate = 0  // 라디안/초
  private driftHistory: number[] = []

  // 방향 히스토리 (drift 감지용)
  private headingHistory: Array<{ heading: number, timestamp: number }> = []
  private readonly MAX_HISTORY = 50

  constructor(config: HeadingEstimatorConfig = {}) {
    this.config = {
      initialHeading: config.initialHeading ?? 0,
      gyroWeight: config.gyroWeight ?? 0.98,
      enableMagnetometer: config.enableMagnetometer ?? true,
      magnetometerCalibrationInterval: config.magnetometerCalibrationInterval ?? 1000
    }

    this.currentHeading = this.config.initialHeading
  }

  /**
   * 자이로스코프 데이터로 방향 업데이트 (상대 회전)
   */
  updateFromGyroscope(rotationRate: RotationRateData): HeadingInfo {
    const now = Date.now()
    const dt = (now - this.lastUpdateTime) / 1000  // 초 단위

    // Z축 회전 (yaw, 수평 방향)만 사용
    // alpha는 도/초 단위이므로 라디안으로 변환
    const angularVelocity = rotationRate.alpha * (Math.PI / 180)

    // Drift 보정 적용
    const correctedVelocity = angularVelocity - this.gyroDriftRate

    // 방향 업데이트 (적분)
    const deltaHeading = correctedVelocity * dt
    this.currentHeading += deltaHeading

    // 각도 정규화 (0 ~ 2π)
    this.currentHeading = this.normalizeAngle(this.currentHeading)

    // 히스토리 업데이트
    this.updateHistory(this.currentHeading, now)

    this.lastUpdateTime = now

    return {
      heading: this.currentHeading,
      headingDegrees: this.toDegrees(this.currentHeading),
      rotationRate: angularVelocity,
      confidence: this.calculateGyroscopeConfidence(dt),
      source: 'gyroscope'
    }
  }

  /**
   * 지자기 센서로 절대 방향 보정
   */
  calibrateFromMagnetometer(magnetometer: MagnetometerData): HeadingInfo | null {
    if (!this.config.enableMagnetometer) {
      return null
    }

    const now = Date.now()
    const timeSinceLastCalibration = now - this.lastMagnetometerCalibration

    // 보정 주기 확인
    if (timeSinceLastCalibration < this.config.magnetometerCalibrationInterval) {
      return null
    }

    // 지자기 센서로 절대 방향 계산
    const magnetometerHeading = Math.atan2(magnetometer.y, magnetometer.x)
    const normalizedMagHeading = this.normalizeAngle(magnetometerHeading)

    // Complementary Filter: 자이로 가중치 높게
    const alpha = this.config.gyroWeight
    const fusedHeading = this.complementaryFilter(
      this.currentHeading,
      normalizedMagHeading,
      alpha
    )

    // Drift 계산 (자이로와 지자기 센서 차이)
    const drift = this.calculateAngleDifference(this.currentHeading, normalizedMagHeading)
    this.updateDriftEstimate(drift, timeSinceLastCalibration / 1000)

    this.currentHeading = fusedHeading
    this.lastMagnetometerCalibration = now

    return {
      heading: this.currentHeading,
      headingDegrees: this.toDegrees(this.currentHeading),
      rotationRate: 0,
      confidence: 0.9,  // 지자기 보정 시 높은 신뢰도
      source: 'fused'
    }
  }

  /**
   * Complementary Filter
   */
  private complementaryFilter(
    gyroHeading: number,
    magHeading: number,
    alpha: number
  ): number {
    // 각도 차이 계산 (짧은 경로)
    const diff = this.calculateAngleDifference(gyroHeading, magHeading)

    // 가중 평균
    const fusedHeading = gyroHeading + (1 - alpha) * diff

    return this.normalizeAngle(fusedHeading)
  }

  /**
   * 두 각도 사이의 최단 차이 계산 (-π ~ π)
   */
  private calculateAngleDifference(angle1: number, angle2: number): number {
    let diff = angle2 - angle1

    // -π ~ π 범위로 정규화
    while (diff > Math.PI) diff -= 2 * Math.PI
    while (diff < -Math.PI) diff += 2 * Math.PI

    return diff
  }

  /**
   * 각도 정규화 (0 ~ 2π)
   */
  private normalizeAngle(angle: number): number {
    let normalized = angle % (2 * Math.PI)
    if (normalized < 0) {
      normalized += 2 * Math.PI
    }
    return normalized
  }

  /**
   * 라디안 → 도 변환
   */
  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI)
  }

  /**
   * 도 → 라디안 변환
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  /**
   * 자이로스코프 신뢰도 계산
   * 시간 경과에 따라 drift로 인해 신뢰도 감소
   */
  private calculateGyroscopeConfidence(dt: number): number {
    const timeSinceCalibration = (Date.now() - this.lastMagnetometerCalibration) / 1000

    // 1분 후 신뢰도 50%까지 감소
    const confidenceDecay = Math.exp(-timeSinceCalibration / 60)

    return Math.max(0.5, confidenceDecay)
  }

  /**
   * Drift 추정 업데이트
   */
  private updateDriftEstimate(drift: number, timePeriod: number): void {
    // Drift rate = 각도 차이 / 시간
    const driftRate = drift / timePeriod

    this.driftHistory.push(driftRate)

    // 히스토리 크기 제한
    if (this.driftHistory.length > 10) {
      this.driftHistory.shift()
    }

    // 평균 drift rate 계산
    if (this.driftHistory.length > 0) {
      const sum = this.driftHistory.reduce((acc, rate) => acc + rate, 0)
      this.gyroDriftRate = sum / this.driftHistory.length
    }
  }

  /**
   * 방향 히스토리 업데이트
   */
  private updateHistory(heading: number, timestamp: number): void {
    this.headingHistory.push({ heading, timestamp })

    if (this.headingHistory.length > this.MAX_HISTORY) {
      this.headingHistory.shift()
    }
  }

  /**
   * 현재 방향 반환
   */
  getHeading(): number {
    return this.currentHeading
  }

  /**
   * 현재 방향 (도) 반환
   */
  getHeadingDegrees(): number {
    return this.toDegrees(this.currentHeading)
  }

  /**
   * 방향 변화 통계
   */
  getStatistics(): {
    currentHeading: number
    currentHeadingDegrees: number
    estimatedDrift: number
    timeSinceCalibration: number
    confidence: number
  } {
    const timeSinceCalibration = (Date.now() - this.lastMagnetometerCalibration) / 1000

    return {
      currentHeading: this.currentHeading,
      currentHeadingDegrees: this.toDegrees(this.currentHeading),
      estimatedDrift: this.gyroDriftRate * (180 / Math.PI),  // 도/초 단위
      timeSinceCalibration,
      confidence: this.calculateGyroscopeConfidence(0)
    }
  }

  /**
   * 방향 설정 (수동 보정)
   */
  setHeading(heading: number): void {
    this.currentHeading = this.normalizeAngle(heading)
    this.lastMagnetometerCalibration = Date.now()
  }

  /**
   * 방향 설정 (도 단위)
   */
  setHeadingDegrees(degrees: number): void {
    this.setHeading(this.toRadians(degrees))
  }

  /**
   * 초기화
   */
  reset(initialHeading?: number): void {
    this.currentHeading = initialHeading ?? this.config.initialHeading
    this.lastUpdateTime = Date.now()
    this.lastMagnetometerCalibration = Date.now()
    this.gyroDriftRate = 0
    this.driftHistory = []
    this.headingHistory = []
  }

  /**
   * 설정 업데이트
   */
  updateConfig(config: Partial<HeadingEstimatorConfig>): void {
    this.config = {
      ...this.config,
      ...config
    }
  }
}

/**
 * 방향 유틸리티 함수
 */

/**
 * 방향을 방위로 변환
 */
export function headingToCardinalDirection(headingDegrees: number): string {
  const normalized = ((headingDegrees % 360) + 360) % 360

  if (normalized < 22.5 || normalized >= 337.5) return '북'
  if (normalized < 67.5) return '북동'
  if (normalized < 112.5) return '동'
  if (normalized < 157.5) return '남동'
  if (normalized < 202.5) return '남'
  if (normalized < 247.5) return '남서'
  if (normalized < 292.5) return '서'
  return '북서'
}

/**
 * 두 방향 사이의 각도 차이 계산
 */
export function calculateHeadingDifference(
  heading1Degrees: number,
  heading2Degrees: number
): number {
  let diff = heading2Degrees - heading1Degrees

  // -180 ~ 180 범위로 정규화
  while (diff > 180) diff -= 360
  while (diff < -180) diff += 360

  return Math.abs(diff)
}

/**
 * 방향으로 방향 벡터 계산 (단위 벡터)
 */
export function headingToVector(headingRadians: number): { x: number, y: number } {
  return {
    x: Math.cos(headingRadians),
    y: Math.sin(headingRadians)
  }
}

/**
 * 방향 벡터로 방향 계산
 */
export function vectorToHeading(x: number, y: number): number {
  return Math.atan2(y, x)
}
