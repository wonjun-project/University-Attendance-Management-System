/**
 * DeviceMotion API 래퍼 (iOS Safari, Firefox)
 * https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent
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
  RotationRateData
} from './sensor-types'

/**
 * DeviceMotion Event 타입 확장 (iOS 13+ 권한)
 */
interface DeviceMotionEventExtended extends DeviceMotionEvent {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

interface DeviceMotionEventConstructor {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

/**
 * DeviceMotion API 관리자 (iOS Safari 전용)
 */
export class DeviceMotionManager {
  private isTracking = false
  private state: SensorState = SensorState.IDLE
  private config: Required<SensorConfig>

  private onDataCallback: SensorEventHandler | null = null
  private onErrorCallback: SensorErrorHandler | null = null

  private motionHandler: ((event: DeviceMotionEvent) => void) | null = null

  constructor(config: SensorConfig = {}) {
    this.config = {
      frequency: config.frequency ?? 60,  // DeviceMotion은 자동 주파수 (보통 60Hz)
      autoRequestPermission: config.autoRequestPermission ?? true,
      maxRetries: config.maxRetries ?? 3
    }
  }

  /**
   * DeviceMotion API 지원 여부 확인
   */
  static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'DeviceMotionEvent' in window
    )
  }

  /**
   * iOS 13+ 권한 요청 필요 여부 확인
   */
  static needsPermission(): boolean {
    if (!DeviceMotionManager.isSupported()) return false

    const DeviceMotionEvent = window.DeviceMotionEvent as unknown as DeviceMotionEventConstructor

    return (
      typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function'
    )
  }

  /**
   * 센서 초기화
   */
  async initialize(): Promise<boolean> {
    if (!DeviceMotionManager.isSupported()) {
      throw new SensorError(
        'DeviceMotion API가 지원되지 않는 브라우저입니다',
        SensorErrorCode.NOT_SUPPORTED
      )
    }

    this.state = SensorState.INITIALIZING

    try {
      // iOS 13+ 권한 요청
      if (this.config.autoRequestPermission && DeviceMotionManager.needsPermission()) {
        const granted = await this.requestPermission()
        if (!granted) {
          throw new SensorError(
            '센서 권한이 거부되었습니다',
            SensorErrorCode.PERMISSION_DENIED
          )
        }
      }

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
   * iOS 13+ 센서 권한 요청
   * 주의: 사용자 제스처(클릭, 터치 등) 내에서만 호출 가능
   */
  async requestPermission(): Promise<boolean> {
    if (!DeviceMotionManager.needsPermission()) {
      // 권한 요청 불필요한 환경 (구형 iOS, Android 등)
      return true
    }

    try {
      const DeviceMotionEvent = window.DeviceMotionEvent as unknown as DeviceMotionEventConstructor

      if (!DeviceMotionEvent.requestPermission) {
        return true
      }

      const permission = await DeviceMotionEvent.requestPermission()
      return permission === 'granted'

    } catch (error) {
      console.error('DeviceMotion 권한 요청 실패:', error)
      throw new SensorError(
        '센서 권한 요청 중 오류 발생',
        SensorErrorCode.PERMISSION_DENIED,
        error
      )
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

    if (this.isTracking) {
      console.warn('센서 추적이 이미 시작되었습니다')
      return
    }

    this.onDataCallback = onData
    this.onErrorCallback = onError ?? null

    this.motionHandler = (event: DeviceMotionEvent) => {
      try {
        const sensorData = this.parseMotionEvent(event)

        if (this.onDataCallback) {
          this.onDataCallback(sensorData)
        }

      } catch (error) {
        const sensorError = new SensorError(
          '센서 데이터 파싱 실패',
          SensorErrorCode.READING_FAILED,
          error
        )

        if (this.onErrorCallback) {
          this.onErrorCallback(sensorError)
        } else {
          console.error('센서 에러:', sensorError)
        }
      }
    }

    window.addEventListener('devicemotion', this.motionHandler, true)

    this.isTracking = true
    this.state = SensorState.TRACKING
  }

  /**
   * DeviceMotionEvent를 SensorData로 변환
   */
  private parseMotionEvent(event: DeviceMotionEvent): SensorData {
    // 가속도 (중력 제외) - 우선 사용
    let acceleration = event.acceleration

    // acceleration이 없으면 accelerationIncludingGravity 사용
    if (!acceleration || (acceleration.x === null && acceleration.y === null && acceleration.z === null)) {
      acceleration = event.accelerationIncludingGravity
    }

    if (!acceleration) {
      throw new Error('가속도 데이터를 사용할 수 없습니다')
    }

    const accelData: AccelerationData = {
      x: acceleration.x ?? 0,
      y: acceleration.y ?? 0,
      z: acceleration.z ?? 0,
      timestamp: Date.now()  // DeviceMotionEvent에는 timestamp 없음
    }

    // 회전 속도
    const rotation = event.rotationRate
    const rotationData: RotationRateData | null = rotation ? {
      alpha: rotation.alpha ?? 0,  // Z축 (yaw)
      beta: rotation.beta ?? 0,    // X축 (pitch)
      gamma: rotation.gamma ?? 0   // Y축 (roll)
    } : null

    return {
      acceleration: accelData,
      rotation: rotationData,
      // DeviceMotion API는 magnetometer 지원하지 않음
    }
  }

  /**
   * 센서 추적 중지
   */
  stopTracking(): void {
    if (!this.isTracking) return

    if (this.motionHandler) {
      window.removeEventListener('devicemotion', this.motionHandler, true)
      this.motionHandler = null
    }

    this.onDataCallback = null
    this.isTracking = false
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
   * 지원 기능 확인
   */
  getSupportedFeatures(): SensorFeatures {
    return {
      hasAccelerometer: true,
      hasGyroscope: true,  // DeviceMotion은 rotationRate 제공
      hasMagnetometer: false,  // DeviceMotion은 magnetometer 미지원
      platform: 'devicemotion'
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

    this.onDataCallback = null
    this.onErrorCallback = null
    this.motionHandler = null

    this.state = SensorState.IDLE
  }
}
