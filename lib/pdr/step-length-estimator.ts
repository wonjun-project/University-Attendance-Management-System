/**
 * 걸음 길이 추정기 (Step Length Estimator)
 * Weinberg 공식 및 동적 추정 알고리즘
 */

/**
 * 걸음 길이 추정 설정
 */
export interface StepLengthConfig {
  /** 사용자 키 (cm, 선택적) */
  userHeight?: number
  /** Weinberg 계수 K (기본 0.43) */
  weinbergK?: number
  /** 고정 걸음 길이 (m, fallback 용) */
  fixedStepLength?: number
  /** 추정 방법 */
  method?: 'weinberg' | 'fixed' | 'adaptive'
}

/**
 * 걸음 길이 정보
 */
export interface StepLengthInfo {
  /** 추정된 걸음 길이 (m) */
  length: number
  /** 사용된 방법 */
  method: 'weinberg' | 'fixed' | 'adaptive'
  /** 신뢰도 (0~1) */
  confidence: number
}

/**
 * 걸음 길이 추정기 클래스
 */
export class StepLengthEstimator {
  private config: Required<StepLengthConfig>

  // 적응형 추정을 위한 히스토리
  private lengthHistory: number[] = []
  private readonly MAX_HISTORY = 20

  constructor(config: StepLengthConfig = {}) {
    this.config = {
      userHeight: config.userHeight ?? 170,  // 평균 성인 키
      weinbergK: config.weinbergK ?? 0.43,
      fixedStepLength: config.fixedStepLength ?? 0.65,  // 평균 성인 걸음 길이
      method: config.method ?? 'weinberg'
    }
  }

  /**
   * Weinberg 공식으로 걸음 길이 추정
   * 공식: SL = K × ⁴√(amax - amin)
   *
   * @param accelerationMax - 가속도 최대값 (m/s²)
   * @param accelerationMin - 가속도 최소값 (m/s²)
   * @returns 걸음 길이 (m)
   */
  estimateWeinberg(
    accelerationMax: number,
    accelerationMin: number
  ): number {
    // K 값 조정 (사용자 키 기반)
    const K = this.calculateWeinbergK()

    // Weinberg 공식 적용
    const delta = Math.abs(accelerationMax - accelerationMin)
    const stepLength = K * Math.pow(delta, 0.25)  // 4제곱근

    // 일반적인 걸음 길이 범위로 제한 (0.4m ~ 1.2m)
    return this.clampStepLength(stepLength)
  }

  /**
   * 사용자 키 기반 Weinberg K 계산
   * 경험적 공식: K = 0.37 + (height - 170) × 0.0003
   */
  private calculateWeinbergK(): number {
    if (!this.config.userHeight) {
      return this.config.weinbergK
    }

    const height = this.config.userHeight
    const K = 0.37 + (height - 170) * 0.0003

    // K 범위 제한 (0.35 ~ 0.55)
    return Math.max(0.35, Math.min(0.55, K))
  }

  /**
   * 걸음 길이 범위 제한
   */
  private clampStepLength(length: number): number {
    const MIN_STEP_LENGTH = 0.4  // 최소 40cm
    const MAX_STEP_LENGTH = 1.2  // 최대 120cm

    return Math.max(MIN_STEP_LENGTH, Math.min(MAX_STEP_LENGTH, length))
  }

  /**
   * 고정 걸음 길이 반환
   */
  getFixedStepLength(): number {
    return this.config.fixedStepLength
  }

  /**
   * 적응형 걸음 길이 추정
   * 최근 걸음들의 평균을 사용하여 동적으로 조정하며, 이상치를 제거합니다.
   */
  estimateAdaptive(currentEstimate: number): number {
    // 1. 이상치 필터링 (Outlier Filtering)
    let filteredEstimate = currentEstimate
    
    if (this.lengthHistory.length >= 3) {
      const average = this.getAverageStepLength()
      const diff = Math.abs(currentEstimate - average)
      const threshold = average * 0.3 // 30% 허용
      
      if (diff > threshold) {
        // 이상치로 판단되면 평균값과의 중간값 사용 (Soft Limiting)
        filteredEstimate = average + (currentEstimate - average) * 0.3
      }
    }

    // 2. 히스토리에 추가
    this.lengthHistory.push(filteredEstimate)

    // 히스토리 크기 제한
    if (this.lengthHistory.length > this.MAX_HISTORY) {
      this.lengthHistory.shift()
    }

    // 최근 걸음들의 가중 평균 (최근 것일수록 가중치 높음)
    if (this.lengthHistory.length < 3) {
      return filteredEstimate  // 데이터 부족 시 현재 값 사용
    }

    const weights = this.lengthHistory.map((_, index) =>
      (index + 1) / this.lengthHistory.length  // 선형 가중치
    )

    const weightedSum = this.lengthHistory.reduce(
      (sum, length, index) => sum + length * weights[index],
      0
    )

    const totalWeight = weights.reduce((sum, w) => sum + w, 0)

    return weightedSum / totalWeight
  }

  /**
   * 종합 걸음 길이 추정 (설정된 방법 사용)
   */
  estimate(
    accelerationMax: number,
    accelerationMin: number
  ): StepLengthInfo {
    let length: number
    let confidence: number
    let method = this.config.method

    switch (this.config.method) {
      case 'weinberg': {
        length = this.estimateWeinberg(accelerationMax, accelerationMin)
        confidence = 0.8  // Weinberg는 높은 신뢰도
        break
      }

      case 'adaptive': {
        const weinberg = this.estimateWeinberg(accelerationMax, accelerationMin)
        length = this.estimateAdaptive(weinberg)
        confidence = Math.min(0.9, 0.5 + this.lengthHistory.length / this.MAX_HISTORY * 0.4)
        break
      }

      case 'fixed':
      default: {
        length = this.getFixedStepLength()
        confidence = 0.6  // 고정 길이는 낮은 신뢰도
        method = 'fixed'
        break
      }
    }

    return {
      length,
      method,
      confidence
    }
  }

  /**
   * 최근 평균 걸음 길이 반환
   */
  getAverageStepLength(): number {
    if (this.lengthHistory.length === 0) {
      return this.config.fixedStepLength
    }

    const sum = this.lengthHistory.reduce((acc, len) => acc + len, 0)
    return sum / this.lengthHistory.length
  }

  /**
   * 걸음 길이 통계 반환
   */
  getStatistics(): {
    average: number
    min: number
    max: number
    stdDev: number
    count: number
  } {
    if (this.lengthHistory.length === 0) {
      return {
        average: 0,
        min: 0,
        max: 0,
        stdDev: 0,
        count: 0
      }
    }

    const average = this.getAverageStepLength()
    const min = Math.min(...this.lengthHistory)
    const max = Math.max(...this.lengthHistory)

    // 표준편차 계산
    const squaredDiffs = this.lengthHistory.map(len =>
      Math.pow(len - average, 2)
    )
    const variance = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / this.lengthHistory.length
    const stdDev = Math.sqrt(variance)

    return {
      average,
      min,
      max,
      stdDev,
      count: this.lengthHistory.length
    }
  }

  /**
   * 사용자 키 설정
   */
  setUserHeight(height: number): void {
    this.config.userHeight = height
  }

  /**
   * 추정 방법 변경
   */
  setMethod(method: 'weinberg' | 'fixed' | 'adaptive'): void {
    this.config.method = method
  }

  /**
   * 히스토리 초기화
   */
  reset(): void {
    this.lengthHistory = []
  }

  /**
   * 설정 업데이트
   */
  updateConfig(config: Partial<StepLengthConfig>): void {
    this.config = {
      ...this.config,
      ...config
    }
  }
}

/**
 * 걸음 길이 유틸리티 함수
 */

/**
 * 사용자 키로 예상 걸음 길이 계산 (간단한 경험적 공식)
 * 일반적으로 걸음 길이는 키의 약 0.4배
 */
export function estimateStepLengthFromHeight(heightCm: number): number {
  const stepLength = heightCm * 0.004  // 0.4배를 미터로 변환
  return Math.max(0.4, Math.min(1.0, stepLength))
}

/**
 * 걸음 빈도로 걸음 길이 보정
 * 빠르게 걸을수록 걸음 길이가 늘어남
 */
export function adjustStepLengthByCadence(
  baseLength: number,
  cadence: number  // steps/sec
): number {
  // 기준 cadence: 1.5 steps/sec (보통 걸음)
  const baseCadence = 1.5
  const cadenceRatio = cadence / baseCadence

  // 비선형 보정 (느리면 짧아지고, 빠르면 길어짐)
  const adjustmentFactor = 0.8 + cadenceRatio * 0.2

  return baseLength * adjustmentFactor
}

/**
 * 활동 상태별 걸음 길이 추정
 */
export function estimateStepLengthByActivity(
  baseLength: number,
  activity: 'standing' | 'walking' | 'running'
): number {
  switch (activity) {
    case 'standing':
      return 0  // 정지 상태
    case 'walking':
      return baseLength
    case 'running':
      return baseLength * 1.4  // 뛸 때는 약 1.4배
  }
}

/**
 * 걸음 길이로 이동 거리 계산
 */
export function calculateDistance(stepLength: number, stepCount: number): number {
  return stepLength * stepCount
}
