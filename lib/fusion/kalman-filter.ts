/**
 * 2D Kalman Filter
 * GPS와 PDR 데이터를 융합하여 최적의 위치(x, y)를 추정합니다.
 *
 * 상태 벡터 X: [x, y]
 * 공분산 행렬 P: [[varX, covXY], [covXY, varY]]
 */
export class KalmanFilter2D {
  // 상태 벡터 (현재 추정 위치)
  private x: number = 0
  private y: number = 0

  // 공분산 행렬 (위치 불확실성)
  // P = [[p11, p12], [p21, p22]]
  private p11: number = 0 // x 분산
  private p12: number = 0 // xy 공분산
  private p21: number = 0 // yx 공분산
  private p22: number = 0 // y 분산

  // 프로세스 노이즈 (PDR 예측 불확실성)
  private qVariance: number

  // 초기화 여부
  private initialized: boolean = false

  /**
   * @param processNoiseVariance PDR 예측 단계의 노이즈 분산 (기본값: 1.0)
   * 값이 클수록 PDR 데이터를 덜 신뢰하고 불확실성이 빠르게 증가함
   */
  constructor(processNoiseVariance: number = 1.0) {
    this.qVariance = processNoiseVariance
    this.reset()
  }

  /**
   * 초기 위치와 불확실성 설정
   */
  initialize(x: number, y: number, initialVariance: number = 10.0): void {
    this.x = x
    this.y = y
    
    // 초기 공분산 행렬 설정 (대각 성분만 설정)
    this.p11 = initialVariance
    this.p12 = 0
    this.p21 = 0
    this.p22 = initialVariance
    
    this.initialized = true
  }

  /**
   * 예측 단계 (PDR)
   * PDR로 계산된 이동량(dx, dy)을 사용하여 상태를 업데이트하고 불확실성을 증가시킵니다.
   *
   * X_k = X_{k-1} + u_k
   * P_k = P_{k-1} + Q
   */
  predict(dx: number, dy: number): void {
    if (!this.initialized) return

    // 1. 상태 예측 (단순 이동)
    this.x += dx
    this.y += dy

    // 2. 공분산 예측 (불확실성 증가)
    // 프로세스 노이즈 Q를 더함 (단순화하여 대각 성분에만 추가)
    // 실제로는 이동 방향에 따라 공분산이 달라지지만, 여기서는 단순화
    this.p11 += this.qVariance
    this.p22 += this.qVariance
  }

  /**
   * 업데이트 단계 (GPS)
   * GPS 관측값으로 예측된 상태를 보정하고 불확실성을 감소시킵니다.
   *
   * K = P * H^T * (H * P * H^T + R)^-1
   * X = X + K * (Z - H * X)
   * P = (I - K * H) * P
   *
   * 여기서 H는 단위 행렬(Identity matrix)이므로 식을 단순화할 수 있음:
   * K = P * (P + R)^-1
   * X = X + K * (Z - X)
   * P = (I - K) * P
   */
  update(measurementX: number, measurementY: number, accuracy: number): void {
    if (!this.initialized) {
      this.initialize(measurementX, measurementY, accuracy * accuracy)
      return
    }

    // 측정 노이즈 R (GPS 정확도의 제곱을 분산으로 사용)
    const rVariance = accuracy * accuracy

    // x축 칼만 게인 계산
    // K_x = p11 / (p11 + R)
    const kx = this.p11 / (this.p11 + rVariance)

    // y축 칼만 게인 계산
    // K_y = p22 / (p22 + R)
    const ky = this.p22 / (this.p22 + rVariance)

    // 상태 업데이트 (보정)
    // x = x + K_x * (z_x - x)
    this.x = this.x + kx * (measurementX - this.x)
    this.y = this.y + ky * (measurementY - this.y)

    // 공분산 업데이트 (불확실성 감소)
    // P = (1 - K) * P
    // 단순화된 업데이트 (비대각 성분 무시)
    this.p11 = (1 - kx) * this.p11
    this.p22 = (1 - ky) * this.p22
    
    // 비대각 성분도 감소
    this.p12 = (1 - kx) * this.p12 // 근사치
    this.p21 = (1 - ky) * this.p21 // 근사치
  }

  /**
   * 현재 추정 위치 반환
   */
  getPosition(): { x: number, y: number } {
    return { x: this.x, y: this.y }
  }

  /**
   * 현재 불확실성(표준편차) 반환
   */
  getUncertainty(): { stdDevX: number, stdDevY: number } {
    return {
      stdDevX: Math.sqrt(Math.max(0, this.p11)),
      stdDevY: Math.sqrt(Math.max(0, this.p22))
    }
  }

  /**
   * 필터 재설정
   */
  reset(): void {
    this.x = 0
    this.y = 0
    this.p11 = 0
    this.p12 = 0
    this.p21 = 0
    this.p22 = 0
    this.initialized = false
  }
  
  /**
   * 현재 상태를 특정 값으로 강제 설정 (재보정 등)
   */
  setState(x: number, y: number, variance: number = 0): void {
    this.x = x
    this.y = y
    this.p11 = variance
    this.p22 = variance
    this.p12 = 0
    this.p21 = 0
    this.initialized = true
  }
}

