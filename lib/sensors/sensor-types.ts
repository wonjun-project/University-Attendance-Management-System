/**
 * 센서 관련 TypeScript 타입 정의
 * PDR (Pedestrian Dead Reckoning) + 센서 퓨전을 위한 타입
 */

/**
 * 3축 가속도 데이터
 * 단위: m/s² (미터/초²)
 */
export interface AccelerationData {
  x: number
  y: number
  z: number
  timestamp: number  // 밀리초 단위
}

/**
 * 3축 회전 속도 데이터 (자이로스코프)
 * 단위: degree/s (도/초)
 */
export interface RotationRateData {
  alpha: number  // Z축 회전 (yaw - 수평 방향)
  beta: number   // X축 회전 (pitch - 상하)
  gamma: number  // Y축 회전 (roll - 좌우)
}

/**
 * 지자기 센서 데이터 (나침반)
 * 단위: μT (마이크로 테슬라)
 */
export interface MagnetometerData {
  x: number
  y: number
  z: number
  timestamp: number
}

/**
 * 통합 센서 데이터
 */
export interface SensorData {
  acceleration: AccelerationData
  rotation: RotationRateData | null  // iOS DeviceMotion은 rotation이 없을 수 있음
  magnetometer?: MagnetometerData    // Generic Sensor API만 지원
}

/**
 * 센서 지원 기능
 */
export interface SensorFeatures {
  hasAccelerometer: boolean
  hasGyroscope: boolean
  hasMagnetometer: boolean
  platform: 'generic' | 'devicemotion' | 'none'
}

/**
 * 센서 권한 상태
 */
export type SensorPermissionState = 'unknown' | 'granted' | 'denied' | 'prompt'

/**
 * 센서 에러 타입
 */
export class SensorError extends Error {
  constructor(
    message: string,
    public code: SensorErrorCode,
    public details?: unknown
  ) {
    super(message)
    this.name = 'SensorError'
  }
}

export enum SensorErrorCode {
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  SENSOR_NOT_AVAILABLE = 'SENSOR_NOT_AVAILABLE',
  READING_FAILED = 'READING_FAILED',
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED'
}

/**
 * 센서 설정 옵션
 */
export interface SensorConfig {
  /** 샘플링 주파수 (Hz) */
  frequency?: number
  /** 권한 요청 자동 실행 여부 */
  autoRequestPermission?: boolean
  /** 에러 발생 시 재시도 횟수 */
  maxRetries?: number
}

/**
 * 센서 상태
 */
export enum SensorState {
  IDLE = 'IDLE',              // 초기화 안 됨
  INITIALIZING = 'INITIALIZING',
  READY = 'READY',            // 초기화 완료, 추적 시작 가능
  TRACKING = 'TRACKING',      // 추적 중
  PAUSED = 'PAUSED',          // 일시 중지
  ERROR = 'ERROR'             // 에러 발생
}

/**
 * 센서 이벤트 타입
 */
export type SensorEventType =
  | 'reading'      // 새로운 센서 데이터 읽기
  | 'error'        // 에러 발생
  | 'statechange'  // 상태 변경

/**
 * 센서 이벤트 핸들러
 */
export type SensorEventHandler<T = SensorData> = (data: T) => void
export type SensorErrorHandler = (error: SensorError) => void
export type SensorStateChangeHandler = (state: SensorState) => void
