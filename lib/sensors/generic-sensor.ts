/**
 * Generic Sensor API 래퍼 (Chrome/Edge/Opera)
 * https://developer.chrome.com/docs/capabilities/web-apis/generic-sensor
 */

import {
  SensorData,
  SensorFeatures,
  SensorConfig,
  SensorState,
  SensorError,
  SensorErrorCode,
  SensorEventHandler,
  SensorErrorHandler,
  AccelerationData,
  RotationRateData,
  MagnetometerData
} from './sensor-types'

/**
 * Generic Sensor API 인터페이스 (TypeScript 타입 정의)
 */
interface GenericSensor extends EventTarget {
  readonly activated: boolean
  readonly hasReading: boolean
  readonly timestamp: DOMHighResTimeStamp | null
  start(): void
  stop(): void
  onreading: ((this: GenericSensor, ev: Event) => void) | null
  onerror: ((this: GenericSensor, ev: Event) => void) | null
  onactivate: ((this: GenericSensor, ev: Event) => void) | null
}

interface Accelerometer extends GenericSensor {
  readonly x: number | null
  readonly y: number | null
  readonly z: number | null
}

interface Gyroscope extends GenericSensor {
  readonly x: number | null
  readonly y: number | null
  readonly z: number | null
}

interface Magnetometer extends GenericSensor {
  readonly x: number | null
  readonly y: number | null
  readonly z: number | null
}

interface AccelerometerConstructor {
  new(options?: { frequency?: number }): Accelerometer
}

interface GyroscopeConstructor {
  new(options?: { frequency?: number }): Gyroscope
}

interface MagnetometerConstructor {
  new(options?: { frequency?: number }): Magnetometer
}

declare global {
  interface Window {
    Accelerometer?: AccelerometerConstructor
    Gyroscope?: GyroscopeConstructor
    Magnetometer?: MagnetometerConstructor
  }
}

/**
 * Generic Sensor API 관리자 (Chrome/Edge/Opera 전용)
 */
export class GenericSensorManager {
  private accelerometer: Accelerometer | null = null
  private gyroscope: Gyroscope | null = null
  private magnetometer: Magnetometer | null = null

  private state: SensorState = SensorState.IDLE
  private config: Required<SensorConfig>

  private onDataCallback: SensorEventHandler | null = null
  private onErrorCallback: SensorErrorHandler | null = null

  constructor(config: SensorConfig = {}) {
    this.config = {
      frequency: config.frequency ?? 60,          // 기본 60Hz
      autoRequestPermission: config.autoRequestPermission ?? true,
      maxRetries: config.maxRetries ?? 3
    }
  }

  /**
   * Generic Sensor API 지원 여부 확인
   */
  static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'Accelerometer' in window &&
      'Gyroscope' in window
    )
  }

  /**
   * 센서 초기화
   */
  async initialize(): Promise<boolean> {
    if (!GenericSensorManager.isSupported()) {
      throw new SensorError(
        'Generic Sensor API가 지원되지 않는 브라우저입니다',
        SensorErrorCode.NOT_SUPPORTED
      )
    }

    this.state = SensorState.INITIALIZING

    try {
      // 권한 요청 (Chrome 91+)
      if (this.config.autoRequestPermission) {
        const granted = await this.requestPermissions()
        if (!granted) {
          throw new SensorError(
            '센서 권한이 거부되었습니다',
            SensorErrorCode.PERMISSION_DENIED
          )
        }
      }

      // 센서 객체 생성
      this.accelerometer = new window.Accelerometer!({
        frequency: this.config.frequency
      })

      this.gyroscope = new window.Gyroscope!({
        frequency: this.config.frequency
      })

      // 지자기 센서 (선택적 - Chrome 91+에서만 지원)
      if ('Magnetometer' in window) {
        this.magnetometer = new window.Magnetometer!({
          frequency: 10  // 낮은 주파수 (배터리 절약)
        })
      }

      // 에러 핸들러 등록
      this.setupErrorHandlers()

      this.state = SensorState.READY
      return true

    } catch (error) {
      this.state = SensorState.ERROR

      if (error instanceof SensorError) {
        throw error
      }

      throw new SensorError(
        '센서 초기화 실패',
        SensorErrorCode.INITIALIZATION_FAILED,
        error
      )
    }
  }

  /**
   * 센서 권한 요청
   */
  private async requestPermissions(): Promise<boolean> {
    if (!('permissions' in navigator)) {
      // 권한 API 없는 구형 브라우저는 자동 허용으로 간주
      return true
    }

    try {
      const [accelPerm, gyroPerm] = await Promise.all([
        navigator.permissions.query({ name: 'accelerometer' as PermissionName }),
        navigator.permissions.query({ name: 'gyroscope' as PermissionName })
      ])

      return accelPerm.state === 'granted' && gyroPerm.state === 'granted'

    } catch (error) {
      // 권한 쿼리 실패 시 초기화 시도 (fallback)
      console.warn('권한 쿼리 실패, 센서 초기화 시도:', error)
      return true
    }
  }

  /**
   * 센서 추적 시작
   */
  startTracking(
    onData: SensorEventHandler,
    onError?: SensorErrorHandler
  ): void {
    if (this.state !== SensorState.READY && this.state !== SensorState.PAUSED) {
      throw new SensorError(
        '센서가 초기화되지 않았습니다. initialize()를 먼저 호출하세요.',
        SensorErrorCode.SENSOR_NOT_AVAILABLE
      )
    }

    this.onDataCallback = onData
    this.onErrorCallback = onError ?? null

    if (!this.accelerometer || !this.gyroscope) {
      throw new SensorError(
        '센서 객체가 생성되지 않았습니다',
        SensorErrorCode.SENSOR_NOT_AVAILABLE
      )
    }

    // 가속도계 읽기 이벤트
    this.accelerometer.onreading = () => {
      if (!this.accelerometer || !this.onDataCallback) return

      const accelData: AccelerationData = {
        x: this.accelerometer.x ?? 0,
        y: this.accelerometer.y ?? 0,
        z: this.accelerometer.z ?? 0,
        timestamp: this.accelerometer.timestamp ?? Date.now()
      }

      const gyroData: RotationRateData | null = this.gyroscope ? {
        alpha: this.gyroscope.x ?? 0,
        beta: this.gyroscope.y ?? 0,
        gamma: this.gyroscope.z ?? 0
      } : null

      const magData: MagnetometerData | undefined = this.magnetometer ? {
        x: this.magnetometer.x ?? 0,
        y: this.magnetometer.y ?? 0,
        z: this.magnetometer.z ?? 0,
        timestamp: this.magnetometer.timestamp ?? Date.now()
      } : undefined

      const sensorData: SensorData = {
        acceleration: accelData,
        rotation: gyroData,
        magnetometer: magData
      }

      this.onDataCallback(sensorData)
    }

    // 센서 시작
    this.accelerometer.start()
    this.gyroscope?.start()
    this.magnetometer?.start()

    this.state = SensorState.TRACKING
  }

  /**
   * 센서 추적 중지
   */
  stopTracking(): void {
    if (this.state !== SensorState.TRACKING) return

    this.accelerometer?.stop()
    this.gyroscope?.stop()
    this.magnetometer?.stop()

    this.onDataCallback = null
    this.state = SensorState.PAUSED
  }

  /**
   * 센서 추적 일시 중지
   */
  pause(): void {
    this.stopTracking()
  }

  /**
   * 센서 추적 재개
   */
  resume(onData: SensorEventHandler, onError?: SensorErrorHandler): void {
    if (this.state !== SensorState.PAUSED) {
      throw new SensorError(
        '일시 중지 상태가 아닙니다',
        SensorErrorCode.SENSOR_NOT_AVAILABLE
      )
    }

    this.startTracking(onData, onError)
  }

  /**
   * 에러 핸들러 설정
   */
  private setupErrorHandlers(): void {
    if (!this.accelerometer || !this.gyroscope) return

    const errorHandler = (event: Event) => {
      const error = new SensorError(
        '센서 읽기 실패',
        SensorErrorCode.READING_FAILED,
        event
      )

      this.state = SensorState.ERROR

      if (this.onErrorCallback) {
        this.onErrorCallback(error)
      } else {
        console.error('센서 에러:', error)
      }
    }

    this.accelerometer.onerror = errorHandler
    this.gyroscope.onerror = errorHandler

    if (this.magnetometer) {
      this.magnetometer.onerror = errorHandler
    }
  }

  /**
   * 지원 기능 확인
   */
  getSupportedFeatures(): SensorFeatures {
    return {
      hasAccelerometer: !!this.accelerometer,
      hasGyroscope: !!this.gyroscope,
      hasMagnetometer: !!this.magnetometer,
      platform: 'generic'
    }
  }

  /**
   * 현재 센서 상태 반환
   */
  getState(): SensorState {
    return this.state
  }

  /**
   * 센서 정리 (메모리 해제)
   */
  destroy(): void {
    this.stopTracking()

    this.accelerometer = null
    this.gyroscope = null
    this.magnetometer = null

    this.onDataCallback = null
    this.onErrorCallback = null

    this.state = SensorState.IDLE
  }
}
