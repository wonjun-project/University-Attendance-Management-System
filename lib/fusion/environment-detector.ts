/**
 * 실내/실외 환경 감지기
 * GPS 신호 품질 모니터링으로 환경 전환 감지
 */

/**
 * 환경 타입
 */
export type EnvironmentType = 'outdoor' | 'indoor' | 'unknown'

/**
 * GPS 신호 품질 정보
 */
export interface GPSQuality {
  /** GPS 정확도 (m) */
  accuracy: number
  /** 타임스탬프 */
  timestamp: number
  /** 위성 개수 (선택적) */
  satelliteCount?: number
}

/**
 * 환경 감지 결과
 */
export interface EnvironmentDetection {
  /** 현재 환경 */
  environment: EnvironmentType
  /** 신뢰도 (0~1) */
  confidence: number
  /** 마지막 전환 시간 */
  lastTransitionTime: number
  /** 전환 이유 */
  reason: string
}

/**
 * 환경 감지 설정
 */
export interface EnvironmentDetectorConfig {
  /** 실외 정확도 임계값 (m, 기본 30m) */
  outdoorAccuracyThreshold?: number
  /** 실내 정확도 임계값 (m, 기본 100m) */
  indoorAccuracyThreshold?: number
  /** GPS 타임아웃 (ms, 기본 10초) */
  gpsTimeout?: number
  /** 히스테리시스 시간 (ms, 잦은 전환 방지, 기본 5초) */
  hysteresisTime?: number
  /** 최소 샘플 수 (전환 판단에 필요, 기본 3) */
  minSampleCount?: number
}

/**
 * 환경 감지 통계
 */
export interface EnvironmentStatistics {
  /** 현재 환경 */
  currentEnvironment: EnvironmentType
  /** 실외 시간 (ms) */
  outdoorTime: number
  /** 실내 시간 (ms) */
  indoorTime: number
  /** 전환 횟수 */
  transitionCount: number
  /** 평균 GPS 정확도 (m) */
  averageAccuracy: number
  /** 최근 GPS 업데이트 */
  lastGpsUpdate: number
}

/**
 * 환경 감지기 클래스
 */
export class EnvironmentDetector {
  private config: Required<EnvironmentDetectorConfig>

  // 현재 환경
  private currentEnvironment: EnvironmentType = 'unknown'
  private confidence = 0

  // GPS 품질 히스토리
  private qualityHistory: GPSQuality[] = []
  private readonly MAX_HISTORY = 20

  // 전환 추적
  private lastTransitionTime = 0
  private transitionPending: EnvironmentType | null = null
  private transitionPendingTime = 0

  // 통계
  private stats = {
    transitionCount: 0,
    outdoorStartTime: 0,
    indoorStartTime: 0,
    totalOutdoorTime: 0,
    totalIndoorTime: 0,
    accuracySum: 0,
    sampleCount: 0,
    lastGpsUpdate: 0
  }

  // 콜백
  private onEnvironmentChangeCallback: ((detection: EnvironmentDetection) => void) | null = null

  constructor(config: EnvironmentDetectorConfig = {}) {
    this.config = {
      outdoorAccuracyThreshold: config.outdoorAccuracyThreshold ?? 30,
      indoorAccuracyThreshold: config.indoorAccuracyThreshold ?? 100,
      gpsTimeout: config.gpsTimeout ?? 10000,  // 10초
      hysteresisTime: config.hysteresisTime ?? 5000,  // 5초
      minSampleCount: config.minSampleCount ?? 3
    }
  }

  /**
   * GPS 품질 업데이트
   */
  updateGPSQuality(quality: GPSQuality): void {
    // 1. 히스토리에 추가
    this.qualityHistory.push(quality)

    if (this.qualityHistory.length > this.MAX_HISTORY) {
      this.qualityHistory.shift()
    }

    // 2. 통계 업데이트
    this.stats.sampleCount++
    this.stats.accuracySum += quality.accuracy
    this.stats.lastGpsUpdate = quality.timestamp

    // 3. 환경 감지
    if (this.qualityHistory.length >= this.config.minSampleCount) {
      this.detectEnvironment()
    }
  }

  /**
   * 환경 감지 로직
   */
  private detectEnvironment(): void {
    const recentQualities = this.qualityHistory.slice(-this.config.minSampleCount)

    // 1. 평균 정확도 계산
    const averageAccuracy = recentQualities.reduce((sum, q) => sum + q.accuracy, 0) / recentQualities.length

    // 2. GPS 타임아웃 확인
    const now = Date.now()
    const timeSinceLastUpdate = now - this.stats.lastGpsUpdate

    if (timeSinceLastUpdate > this.config.gpsTimeout) {
      // GPS 신호 손실 → 실내로 판단
      this.requestTransition('indoor', 0.9, 'GPS 신호 손실')
      return
    }

    // 3. 정확도 기반 환경 판단
    let detectedEnvironment: EnvironmentType
    let detectedConfidence: number
    let reason: string

    if (averageAccuracy <= this.config.outdoorAccuracyThreshold) {
      // 정확도 좋음 → 실외
      detectedEnvironment = 'outdoor'
      detectedConfidence = 1.0 - (averageAccuracy / this.config.outdoorAccuracyThreshold) * 0.3
      reason = `GPS 정확도 우수 (${averageAccuracy.toFixed(1)}m)`

    } else if (averageAccuracy >= this.config.indoorAccuracyThreshold) {
      // 정확도 나쁨 → 실내
      detectedEnvironment = 'indoor'
      detectedConfidence = Math.min(1.0, averageAccuracy / this.config.indoorAccuracyThreshold)
      reason = `GPS 정확도 저하 (${averageAccuracy.toFixed(1)}m)`

    } else {
      // 중간 범위 → 애매한 상태 (기존 환경 유지)
      detectedEnvironment = this.currentEnvironment === 'unknown' ? 'outdoor' : this.currentEnvironment
      detectedConfidence = 0.5
      reason = '중간 범위 (기존 환경 유지)'
    }

    // 4. 전환 요청
    if (detectedEnvironment !== this.currentEnvironment) {
      this.requestTransition(detectedEnvironment, detectedConfidence, reason)
    } else {
      this.confidence = detectedConfidence
    }
  }

  /**
   * 환경 전환 요청 (히스테리시스 적용)
   */
  private requestTransition(
    newEnvironment: EnvironmentType,
    confidence: number,
    reason: string
  ): void {
    const now = Date.now()

    // 현재 환경과 동일하면 무시
    if (newEnvironment === this.currentEnvironment) {
      this.transitionPending = null
      return
    }

    // 1. 전환 대기 중인지 확인
    if (this.transitionPending === newEnvironment) {
      const pendingDuration = now - this.transitionPendingTime

      // 히스테리시스 시간 경과 확인
      if (pendingDuration >= this.config.hysteresisTime) {
        // 전환 실행
        this.executeTransition(newEnvironment, confidence, reason)
      }

    } else {
      // 새로운 전환 대기 시작
      this.transitionPending = newEnvironment
      this.transitionPendingTime = now
      console.log(`⏳ 환경 전환 대기: ${this.currentEnvironment} → ${newEnvironment}`)
    }
  }

  /**
   * 환경 전환 실행
   */
  private executeTransition(
    newEnvironment: EnvironmentType,
    confidence: number,
    reason: string
  ): void {
    const now = Date.now()

    // 이전 환경 시간 기록
    if (this.currentEnvironment === 'outdoor' && this.stats.outdoorStartTime > 0) {
      this.stats.totalOutdoorTime += now - this.stats.outdoorStartTime
    } else if (this.currentEnvironment === 'indoor' && this.stats.indoorStartTime > 0) {
      this.stats.totalIndoorTime += now - this.stats.indoorStartTime
    }

    // 새로운 환경으로 전환
    const previousEnvironment = this.currentEnvironment
    this.currentEnvironment = newEnvironment
    this.confidence = confidence
    this.lastTransitionTime = now
    this.stats.transitionCount++
    this.transitionPending = null

    // 새로운 환경 시간 시작
    if (newEnvironment === 'outdoor') {
      this.stats.outdoorStartTime = now
    } else if (newEnvironment === 'indoor') {
      this.stats.indoorStartTime = now
    }

    console.log(`🔄 환경 전환: ${previousEnvironment} → ${newEnvironment} (${reason})`)

    // 콜백 호출
    if (this.onEnvironmentChangeCallback) {
      const detection: EnvironmentDetection = {
        environment: newEnvironment,
        confidence,
        lastTransitionTime: now,
        reason
      }

      this.onEnvironmentChangeCallback(detection)
    }
  }

  /**
   * 현재 환경 반환
   */
  getCurrentEnvironment(): EnvironmentType {
    return this.currentEnvironment
  }

  /**
   * 현재 환경 감지 결과 반환
   */
  getDetection(): EnvironmentDetection {
    return {
      environment: this.currentEnvironment,
      confidence: this.confidence,
      lastTransitionTime: this.lastTransitionTime,
      reason: ''
    }
  }

  /**
   * 실내 여부 반환
   */
  isIndoor(): boolean {
    return this.currentEnvironment === 'indoor'
  }

  /**
   * 실외 여부 반환
   */
  isOutdoor(): boolean {
    return this.currentEnvironment === 'outdoor'
  }

  /**
   * 통계 반환
   */
  getStatistics(): EnvironmentStatistics {
    const now = Date.now()

    // 현재 환경 시간 계산
    let currentOutdoorTime = this.stats.totalOutdoorTime
    let currentIndoorTime = this.stats.totalIndoorTime

    if (this.currentEnvironment === 'outdoor' && this.stats.outdoorStartTime > 0) {
      currentOutdoorTime += now - this.stats.outdoorStartTime
    } else if (this.currentEnvironment === 'indoor' && this.stats.indoorStartTime > 0) {
      currentIndoorTime += now - this.stats.indoorStartTime
    }

    const averageAccuracy = this.stats.sampleCount > 0
      ? this.stats.accuracySum / this.stats.sampleCount
      : 0

    return {
      currentEnvironment: this.currentEnvironment,
      outdoorTime: currentOutdoorTime,
      indoorTime: currentIndoorTime,
      transitionCount: this.stats.transitionCount,
      averageAccuracy,
      lastGpsUpdate: this.stats.lastGpsUpdate
    }
  }

  /**
   * GPS 타임아웃 확인 (외부에서 주기적으로 호출)
   */
  checkTimeout(): void {
    const now = Date.now()
    const timeSinceLastUpdate = now - this.stats.lastGpsUpdate

    if (this.stats.lastGpsUpdate > 0 && timeSinceLastUpdate > this.config.gpsTimeout) {
      // GPS 신호 손실 감지
      if (this.currentEnvironment !== 'indoor') {
        this.requestTransition('indoor', 0.9, `GPS 타임아웃 (${(timeSinceLastUpdate / 1000).toFixed(0)}초)`)
      }
    }
  }

  /**
   * 환경 변경 콜백 등록
   */
  onEnvironmentChange(callback: (detection: EnvironmentDetection) => void): void {
    this.onEnvironmentChangeCallback = callback
  }

  /**
   * 수동 환경 설정
   */
  setEnvironment(environment: EnvironmentType): void {
    if (environment !== this.currentEnvironment) {
      this.executeTransition(environment, 1.0, '수동 설정')
    }
  }

  /**
   * 초기화
   */
  reset(): void {
    this.currentEnvironment = 'unknown'
    this.confidence = 0
    this.qualityHistory = []
    this.lastTransitionTime = 0
    this.transitionPending = null
    this.transitionPendingTime = 0

    this.stats = {
      transitionCount: 0,
      outdoorStartTime: 0,
      indoorStartTime: 0,
      totalOutdoorTime: 0,
      totalIndoorTime: 0,
      accuracySum: 0,
      sampleCount: 0,
      lastGpsUpdate: 0
    }

    console.log('🔄 환경 감지기 초기화')
  }

  /**
   * 설정 업데이트
   */
  updateConfig(config: Partial<EnvironmentDetectorConfig>): void {
    this.config = {
      ...this.config,
      ...config
    }
  }
}

/**
 * 환경 감지 유틸리티 함수
 */

/**
 * GPS 정확도로 환경 추정 (간단한 방법)
 */
export function estimateEnvironmentFromAccuracy(accuracy: number): EnvironmentType {
  if (accuracy <= 30) return 'outdoor'
  if (accuracy >= 100) return 'indoor'
  return 'unknown'
}

/**
 * 환경별 권장 추적 모드
 */
export function getRecommendedTrackingMode(environment: EnvironmentType): 'gps' | 'pdr' | 'fusion' {
  switch (environment) {
    case 'outdoor':
      return 'gps'      // GPS 신뢰도 높음
    case 'indoor':
      return 'pdr'      // PDR 주도
    case 'unknown':
      return 'fusion'   // 균형 융합
  }
}

/**
 * 환경 전환 빈도 계산
 */
export function calculateTransitionFrequency(
  transitionCount: number,
  elapsedTimeMs: number
): number {
  const elapsedHours = elapsedTimeMs / (1000 * 60 * 60)
  return elapsedHours > 0 ? transitionCount / elapsedHours : 0
}

/**
 * 환경별 시간 비율 계산
 */
export function calculateEnvironmentRatio(stats: EnvironmentStatistics): {
  outdoorRatio: number
  indoorRatio: number
} {
  const totalTime = stats.outdoorTime + stats.indoorTime

  if (totalTime === 0) {
    return { outdoorRatio: 0, indoorRatio: 0 }
  }

  return {
    outdoorRatio: stats.outdoorTime / totalTime,
    indoorRatio: stats.indoorTime / totalTime
  }
}
