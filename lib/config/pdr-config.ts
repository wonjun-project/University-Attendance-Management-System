/**
 * PDR (Pedestrian Dead Reckoning) 시스템 파라미터 설정
 *
 * 이 파일은 PDR 시스템의 모든 튜닝 가능한 파라미터를 중앙화하여 관리합니다.
 * 실제 환경 테스트를 통해 최적값을 찾아 업데이트하세요.
 */

/**
 * Step Detector 파라미터
 */
export const STEP_DETECTOR_CONFIG = {
  /**
   * 걸음 감지 임계값 (G 단위)
   *
   * - 현재값: 1.5G
   * - 권장 범위: 1.3 ~ 2.0G
   * - 낮을수록: 더 민감 (거짓 양성 증가)
   * - 높을수록: 덜 민감 (거짓 음성 증가)
   *
   * 튜닝 가이드:
   * - 일반 걷기: 1.5 ~ 1.8G
   * - 빠른 걷기/조깅: 1.8 ~ 2.0G
   * - 실내 환경: 1.3 ~ 1.5G (작은 움직임 감지)
   */
  threshold: 1.5,

  /**
   * 최소 걸음 간격 (ms)
   *
   * - 현재값: 200ms (최대 5 steps/sec)
   * - 권장 범위: 150 ~ 300ms
   *
   * 튜닝 가이드:
   * - 일반 걷기: 200 ~ 250ms (2~2.5 steps/sec)
   * - 빠른 걷기: 150 ~ 200ms (최대 4~5 steps/sec)
   */
  minStepInterval: 200,

  /**
   * 가속도 버퍼 크기
   *
   * - 현재값: 10
   * - 권장 범위: 8 ~ 15
   * - 큰 값: 더 부드러운 감지, 지연 증가
   * - 작은 값: 더 즉각적인 감지, 노이즈 증가
   */
  bufferSize: 10,

  /**
   * 적응형 임계값 사용 여부
   *
   * - 현재값: true
   * - true: 사용자 걷기 패턴에 자동 적응
   * - false: 고정 임계값 사용
   */
  adaptiveThreshold: true
} as const

/**
 * Weinberg 걸음 길이 추정 파라미터
 */
export const WEINBERG_CONFIG = {
  /**
   * Weinberg 계수 K
   *
   * - 현재값: 0.43
   * - 표준 범위: 0.35 ~ 0.55
   * - 문헌 권장값: 0.43 (성인 평균)
   *
   * 튜닝 가이드:
   * - 짧은 걸음: 0.35 ~ 0.40
   * - 평균 걸음: 0.40 ~ 0.45
   * - 긴 걸음: 0.45 ~ 0.55
   *
   * 공식: stepLength = K × ⁴√(amax - amin)
   */
  K: 0.43,

  /**
   * 사용자 평균 키 (cm)
   *
   * - 현재값: 170cm
   * - 이 값을 기준으로 K 값이 자동 조정됩니다.
   *
   * K 조정 공식: K = 0.37 + (height - 170) × 0.0003
   */
  defaultHeight: 170,

  /**
   * K 값 범위 제한
   *
   * - 최소: 0.35
   * - 최대: 0.55
   */
  minK: 0.35,
  maxK: 0.55,

  /**
   * 고정 걸음 길이 (m) - fallback 용
   *
   * - 현재값: 0.65m
   * - 성인 평균: 0.60 ~ 0.75m
   */
  fixedStepLength: 0.65,

  /**
   * 걸음 길이 범위 제한
   */
  minStepLength: 0.4,  // 40cm
  maxStepLength: 1.2   // 120cm
} as const

/**
 * GPS-PDR Fusion 재보정 파라미터
 */
export const RECALIBRATION_CONFIG = {
  /**
   * 주기적 재보정 간격 (ms)
   *
   * - 현재값: 30000ms (30초)
   * - 권장 범위: 20000 ~ 60000ms (20초 ~ 1분)
   *
   * 튜닝 가이드:
   * - Heartbeat 간격과 동일하게 설정 권장
   * - 짧을수록: 더 정확, 배터리 소모 증가
   * - 길수록: 배터리 절약, PDR drift 증가
   */
  periodicInterval: 30000,

  /**
   * GPS-PDR 오차 임계값 (m)
   *
   * - 현재값: 15m
   * - 권장 범위: 10 ~ 20m
   *
   * 이 값을 초과하면 즉시 재보정합니다.
   *
   * 튜닝 가이드:
   * - 실내/교실: 10 ~ 15m (작은 공간)
   * - 실외/캠퍼스: 15 ~ 20m (큰 공간)
   */
  errorThreshold: 15,

  /**
   * 최소 GPS 정확도 (m)
   *
   * - 현재값: 30m
   * - 권장 범위: 20 ~ 50m
   *
   * GPS 정확도가 이 값보다 나쁘면 재보정을 스킵합니다.
   *
   * 튜닝 가이드:
   * - 엄격한 재보정: 20m (실내에서 재보정 거의 안 함)
   * - 완화된 재보정: 40 ~ 50m (실내에서도 재보정)
   */
  minGpsAccuracy: 30
} as const

/**
 * Complementary Filter 융합 파라미터
 */
export const FUSION_CONFIG = {
  /**
   * 기본 GPS 가중치 (0~1)
   *
   * - 현재값: 0.7
   * - 권장 범위: 0.5 ~ 0.9
   *
   * 튜닝 가이드:
   * - GPS 신뢰: 0.7 ~ 0.9 (실외 위주)
   * - PDR 신뢰: 0.5 ~ 0.6 (실내 위주)
   */
  defaultGpsWeight: 0.7,

  /**
   * 최소 GPS 정확도 (m)
   *
   * - 현재값: 20m
   * - 권장 범위: 15 ~ 30m
   *
   * GPS 정확도가 이 값보다 나쁘면 GPS 가중치를 낮춥니다.
   */
  minGpsAccuracy: 20,

  /**
   * PDR 신뢰도 감쇠율 (시간당)
   *
   * - 현재값: 0.1
   * - 권장 범위: 0.05 ~ 0.2
   *
   * 시간이 지날수록 PDR drift로 인해 신뢰도가 감소합니다.
   */
  pdrDecayRate: 0.1,

  /**
   * 위치 차이 임계값 (m)
   *
   * - 현재값: 25m
   * - 권장 범위: 20 ~ 50m
   *
   * GPS와 PDR 위치 차이가 이 값을 초과하면 이상으로 판단합니다.
   * 강의실 간 거리가 가깝기 때문에 낮춤
   */
  positionDifferenceThreshold: 25
} as const

/**
 * Environment Detector 파라미터
 */
export const ENVIRONMENT_CONFIG = {
  /**
   * 실외 GPS 정확도 임계값 (m)
   *
   * - 현재값: 30m
   * - 권장 범위: 20 ~ 40m
   *
   * GPS 정확도가 이 값보다 좋으면 실외로 판단합니다.
   */
  outdoorAccuracyThreshold: 30,

  /**
   * 실내 GPS 정확도 임계값 (m)
   *
   * - 현재값: 50m
   * - 권장 범위: 40 ~ 80m
   *
   * GPS 정확도가 이 값보다 나쁘면 실내로 판단합니다.
   * 강의실 간 거리가 가깝기 때문에 낮춤
   */
  indoorAccuracyThreshold: 50,

  /**
   * GPS 타임아웃 (ms)
   *
   * - 현재값: 10000ms (10초)
   * - 권장 범위: 8000 ~ 15000ms
   */
  gpsTimeout: 10000,

  /**
   * 히스테리시스 시간 (ms)
   *
   * - 현재값: 5000ms (5초)
   * - 권장 범위: 3000 ~ 10000ms
   *
   * 잦은 환경 전환을 방지하기 위한 지연 시간입니다.
   */
  hysteresisTime: 5000,

  /**
   * 최소 샘플 수
   *
   * - 현재값: 3
   * - 권장 범위: 2 ~ 5
   *
   * 환경 전환 판단에 필요한 최소 GPS 샘플 수입니다.
   */
  minSampleCount: 3
} as const

/**
 * 파라미터 프리셋
 *
 * 다양한 환경과 사용 사례에 맞는 사전 정의된 파라미터 세트입니다.
 */
export const PDR_PRESETS = {
  /**
   * 기본 (균형잡힌 설정)
   */
  default: {
    stepDetector: STEP_DETECTOR_CONFIG,
    weinberg: WEINBERG_CONFIG,
    recalibration: RECALIBRATION_CONFIG,
    fusion: FUSION_CONFIG,
    environment: ENVIRONMENT_CONFIG
  },

  /**
   * 고정밀 (정확도 최우선, 배터리 소모 증가)
   */
  highPrecision: {
    stepDetector: { ...STEP_DETECTOR_CONFIG, threshold: 1.8 },
    weinberg: WEINBERG_CONFIG,
    recalibration: {
      ...RECALIBRATION_CONFIG,
      periodicInterval: 20000,  // 20초마다
      errorThreshold: 10,        // 10m 이하 허용
      minGpsAccuracy: 20        // 더 엄격한 GPS 요구
    },
    fusion: { ...FUSION_CONFIG, defaultGpsWeight: 0.8 },
    environment: ENVIRONMENT_CONFIG
  },

  /**
   * 배터리 절약 (배터리 효율 최우선)
   */
  batterySaver: {
    stepDetector: { ...STEP_DETECTOR_CONFIG, threshold: 1.7 },
    weinberg: WEINBERG_CONFIG,
    recalibration: {
      ...RECALIBRATION_CONFIG,
      periodicInterval: 60000,  // 1분마다
      errorThreshold: 20,       // 20m까지 허용
      minGpsAccuracy: 40       // GPS 재보정 덜 엄격
    },
    fusion: { ...FUSION_CONFIG, defaultGpsWeight: 0.6 },
    environment: ENVIRONMENT_CONFIG
  },

  /**
   * 실내 위주 (PDR 중심) - 강의실 간 거리가 가까운 환경에 최적화
   */
  indoor: {
    stepDetector: { ...STEP_DETECTOR_CONFIG, threshold: 1.4 },  // 더 민감
    weinberg: WEINBERG_CONFIG,
    recalibration: {
      ...RECALIBRATION_CONFIG,
      periodicInterval: 20000,  // 20초마다 (더 빈번하게)
      errorThreshold: 10,       // 10m 이하 허용 (정밀도 향상)
      minGpsAccuracy: 30        // GPS 정확도 30m 이하만 사용
    },
    fusion: { ...FUSION_CONFIG, defaultGpsWeight: 0.5, positionDifferenceThreshold: 20 },  // PDR 더 신뢰
    environment: {
      ...ENVIRONMENT_CONFIG,
      outdoorAccuracyThreshold: 15,  // 더 엄격한 실외 판단
      indoorAccuracyThreshold: 40    // 더 쉬운 실내 판단
    }
  },

  /**
   * 실외 위주 (GPS 중심)
   */
  outdoor: {
    stepDetector: STEP_DETECTOR_CONFIG,
    weinberg: WEINBERG_CONFIG,
    recalibration: {
      ...RECALIBRATION_CONFIG,
      periodicInterval: 30000,
      errorThreshold: 12,
      minGpsAccuracy: 25
    },
    fusion: { ...FUSION_CONFIG, defaultGpsWeight: 0.85 },  // GPS 더 신뢰
    environment: {
      ...ENVIRONMENT_CONFIG,
      outdoorAccuracyThreshold: 40,  // 더 쉬운 실외 판단
      indoorAccuracyThreshold: 120   // 더 엄격한 실내 판단
    }
  }
} as const

/**
 * 현재 활성 프리셋
 *
 * 환경에 따라 변경하세요:
 * - 'default': 대부분의 경우
 * - 'highPrecision': 정확도가 중요한 경우
 * - 'batterySaver': 배터리가 중요한 경우
 * - 'indoor': 주로 실내 사용 (강의실 환경에 최적화)
 * - 'outdoor': 주로 실외 사용
 *
 * 대학 강의실 환경에서는 indoor 프리셋 권장
 */
export const ACTIVE_PRESET: keyof typeof PDR_PRESETS = 'indoor'

/**
 * 현재 활성 설정 가져오기
 */
export function getActivePDRConfig() {
  return PDR_PRESETS[ACTIVE_PRESET]
}
