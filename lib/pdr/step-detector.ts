/**
 * 걸음 감지기 (Step Detector)
 * Peak Detection 알고리즘으로 가속도 데이터에서 걸음 감지
 */

import type { AccelerationData } from '@/lib/sensors/sensor-types'

/**
 * 걸음 감지 설정
 */
export interface StepDetectorConfig {
  /** 걸음 감지 임계값 (G 단위, 기본 1.5) */
  threshold?: number
  /** 최소 걸음 간격 (ms, 기본 200ms = 5 steps/sec) */
  minStepInterval?: number
  /** 가속도 버퍼 크기 (기본 10) */
  bufferSize?: number
  /** 적응형 임계값 사용 여부 (기본 true) */
  adaptiveThreshold?: boolean
}

/**
 * 걸음 정보
 */
export interface StepInfo {
  /** 걸음 발생 시간 */
  timestamp: number
  /** 가속도 크기 (peak) */
  magnitude: number
  /** 걸음 번호 (누적) */
  stepNumber: number
  /** 이전 걸음과의 시간 간격 (ms) */
  intervalMs: number
}

/**
 * 걸음 감지 통계
 */
export interface StepStatistics {
  /** 총 걸음 수 */
  totalSteps: number
  /** 평균 걸음 간격 (ms) */
  averageInterval: number
  /** 평균 가속도 크기 */
  averageMagnitude: number
  /** 추정 걸음 빈도 (steps/sec) */
  estimatedCadence: number
  /** 마지막 걸음 시간 */
  lastStepTime: number
}

/**
 * 걸음 감지기 클래스
 * Peak Detection 알고리즘 사용
 */
export class StepDetector {
  private config: Required<StepDetectorConfig>

  // 가속도 버퍼
  private accelerationBuffer: number[] = []
  private timestampBuffer: number[] = []

  // 걸음 통계
  private stepCount = 0
  private lastStepTime = 0
  private stepHistory: StepInfo[] = []

  // 적응형 임계값
  private currentThreshold: number
  private recentMagnitudes: number[] = []

  // 콜백
  private onStepCallback: ((step: StepInfo) => void) | null = null

  constructor(config: StepDetectorConfig = {}) {
    this.config = {
      threshold: config.threshold ?? 1.5,
      minStepInterval: config.minStepInterval ?? 200,
      bufferSize: config.bufferSize ?? 10,
      adaptiveThreshold: config.adaptiveThreshold ?? true
    }

    this.currentThreshold = this.config.threshold
  }

  /**
   * 걸음 감지 콜백 등록
   */
  onStep(callback: (step: StepInfo) => void): void {
    this.onStepCallback = callback
  }

  /**
   * 가속도 데이터 처리 (실시간 호출)
   */
  processAcceleration(acceleration: AccelerationData): boolean {
    // 1. 가속도 크기 계산 (중력 제거)
    const magnitude = this.calculateMagnitude(acceleration)

    // 2. 버퍼에 추가
    this.accelerationBuffer.push(magnitude)
    this.timestampBuffer.push(acceleration.timestamp)

    // 버퍼 크기 제한
    if (this.accelerationBuffer.length > this.config.bufferSize) {
      this.accelerationBuffer.shift()
      this.timestampBuffer.shift()
    }

    // 3. 적응형 임계값 업데이트
    if (this.config.adaptiveThreshold) {
      this.updateAdaptiveThreshold(magnitude)
    }

    // 4. Peak 감지 (최소 3개 데이터 필요)
    if (this.accelerationBuffer.length < 3) {
      return false
    }

    const isStep = this.detectPeak()

    if (isStep) {
      const stepInfo = this.recordStep(magnitude, acceleration.timestamp)

      if (this.onStepCallback) {
        this.onStepCallback(stepInfo)
      }
    }

    return isStep
  }

  /**
   * 가속도 크기 계산 (3축 벡터 크기)
   */
  private calculateMagnitude(acceleration: AccelerationData): number {
    const { x, y, z } = acceleration
    return Math.sqrt(x * x + y * y + z * z)
  }

  /**
   * Peak Detection 알고리즘
   * 현재 값이 이전/다음 값보다 크고 임계값을 초과하면 peak
   */
  private detectPeak(): boolean {
    const len = this.accelerationBuffer.length
    if (len < 3) return false

    const current = this.accelerationBuffer[len - 1]
    const prev = this.accelerationBuffer[len - 2]
    const prevPrev = this.accelerationBuffer[len - 3]

    // Peak 조건:
    // 1. prev > prevPrev (상승)
    // 2. prev > current (하강)
    // 3. prev > threshold (충분한 크기)
    const isPeak = prev > prevPrev && prev > current && prev > this.currentThreshold

    if (!isPeak) return false

    // 시간 간격 확인 (너무 빠른 걸음 제거)
    const currentTime = this.timestampBuffer[len - 2]  // prev의 타임스탬프
    const timeSinceLastStep = currentTime - this.lastStepTime

    if (timeSinceLastStep < this.config.minStepInterval) {
      return false  // 오탐지 (너무 빠름)
    }

    return true
  }

  /**
   * 걸음 기록
   */
  private recordStep(magnitude: number, timestamp: number): StepInfo {
    this.stepCount++

    const intervalMs = this.lastStepTime > 0
      ? timestamp - this.lastStepTime
      : 0

    const stepInfo: StepInfo = {
      timestamp,
      magnitude,
      stepNumber: this.stepCount,
      intervalMs
    }

    this.stepHistory.push(stepInfo)

    // 히스토리 크기 제한 (최근 100개만 유지)
    if (this.stepHistory.length > 100) {
      this.stepHistory.shift()
    }

    this.lastStepTime = timestamp

    return stepInfo
  }

  /**
   * 적응형 임계값 업데이트
   * 최근 가속도 크기의 평균과 표준편차를 기반으로 임계값 동적 조정
   */
  private updateAdaptiveThreshold(magnitude: number): void {
    this.recentMagnitudes.push(magnitude)

    // 최근 50개만 유지
    if (this.recentMagnitudes.length > 50) {
      this.recentMagnitudes.shift()
    }

    // 최소 20개 데이터가 모이면 적응형 임계값 계산
    if (this.recentMagnitudes.length < 20) return

    const mean = this.calculateMean(this.recentMagnitudes)
    const stdDev = this.calculateStandardDeviation(this.recentMagnitudes, mean)

    // 임계값 = 평균 + 1.5 × 표준편차 (통계적 이상치 감지)
    const adaptiveThreshold = mean + 1.5 * stdDev

    // 원래 임계값과 적응형 임계값 중 큰 값 사용 (너무 낮아지는 것 방지)
    this.currentThreshold = Math.max(this.config.threshold, adaptiveThreshold)
  }

  /**
   * 평균 계산
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0
    const sum = values.reduce((acc, val) => acc + val, 0)
    return sum / values.length
  }

  /**
   * 표준편차 계산
   */
  private calculateStandardDeviation(values: number[], mean: number): number {
    if (values.length === 0) return 0
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
    const variance = this.calculateMean(squaredDiffs)
    return Math.sqrt(variance)
  }

  /**
   * 걸음 수 반환
   */
  getStepCount(): number {
    return this.stepCount
  }

  /**
   * 걸음 통계 반환
   */
  getStatistics(): StepStatistics {
    if (this.stepHistory.length === 0) {
      return {
        totalSteps: 0,
        averageInterval: 0,
        averageMagnitude: 0,
        estimatedCadence: 0,
        lastStepTime: 0
      }
    }

    const intervals = this.stepHistory
      .filter(step => step.intervalMs > 0)
      .map(step => step.intervalMs)

    const magnitudes = this.stepHistory.map(step => step.magnitude)

    const averageInterval = intervals.length > 0
      ? this.calculateMean(intervals)
      : 0

    const averageMagnitude = this.calculateMean(magnitudes)

    // 걸음 빈도 (steps/sec)
    const estimatedCadence = averageInterval > 0
      ? 1000 / averageInterval  // ms → sec 변환
      : 0

    return {
      totalSteps: this.stepCount,
      averageInterval,
      averageMagnitude,
      estimatedCadence,
      lastStepTime: this.lastStepTime
    }
  }

  /**
   * 현재 임계값 반환 (디버깅용)
   */
  getCurrentThreshold(): number {
    return this.currentThreshold
  }

  /**
   * 걸음 히스토리 반환
   */
  getStepHistory(): ReadonlyArray<StepInfo> {
    return this.stepHistory
  }

  /**
   * 걸음 카운트 초기화
   */
  reset(): void {
    this.stepCount = 0
    this.lastStepTime = 0
    this.stepHistory = []
    this.accelerationBuffer = []
    this.timestampBuffer = []
    this.recentMagnitudes = []
    this.currentThreshold = this.config.threshold
  }

  /**
   * 설정 업데이트
   */
  updateConfig(config: Partial<StepDetectorConfig>): void {
    this.config = {
      ...this.config,
      ...config
    }

    if (config.threshold !== undefined) {
      this.currentThreshold = config.threshold
    }
  }
}

/**
 * 걸음 감지 유틸리티 함수
 */

/**
 * 걸음 빈도(cadence)로 걷기 상태 판단
 */
export function getWalkingState(cadence: number): 'standing' | 'walking' | 'running' {
  if (cadence < 0.5) return 'standing'  // 0.5 steps/sec 미만
  if (cadence < 2.5) return 'walking'   // 2.5 steps/sec 미만 (= 150 steps/min)
  return 'running'                       // 2.5 steps/sec 이상
}

/**
 * 걸음 간격으로 활동 수준 판단
 */
export function getActivityLevel(intervalMs: number): 'idle' | 'slow' | 'normal' | 'fast' {
  if (intervalMs > 2000) return 'idle'     // 2초 이상 간격
  if (intervalMs > 800) return 'slow'      // 800ms ~ 2초
  if (intervalMs > 400) return 'normal'    // 400ms ~ 800ms
  return 'fast'                            // 400ms 미만 (빠른 걷기/뛰기)
}
