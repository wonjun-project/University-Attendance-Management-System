/**
 * 통합 센서 관리자
 * Generic Sensor API와 DeviceMotion API를 추상화하여
 * 브라우저 환경에 맞게 자동으로 적절한 API 선택
 */

import { GenericSensorManager } from './generic-sensor'
import { DeviceMotionManager } from './device-motion'
import {
  SensorData,
  SensorFeatures,
  SensorConfig,
  SensorState,
  SensorError,
  SensorErrorCode,
  SensorEventHandler,
  SensorErrorHandler
} from './sensor-types'

type SensorManagerType = 'generic' | 'devicemotion' | null

/**
 * 통합 센서 관리자 클래스
 * 모든 브라우저에서 동작하는 센서 API 추상화 레이어
 */
export class UnifiedSensorManager {
  private genericSensor: GenericSensorManager | null = null
  private deviceMotion: DeviceMotionManager | null = null
  private activeManager: SensorManagerType = null
  private config: SensorConfig

  constructor(config: SensorConfig = {}) {
    this.config = config
  }

  /**
   * 센서 초기화
   * 브라우저 환경에 맞는 API 자동 선택
   */
  async initialize(): Promise<boolean> {
    console.log('🔍 센서 API 탐지 중...')

    // 1. Generic Sensor API 시도 (Chrome/Edge/Opera)
    if (GenericSensorManager.isSupported()) {
      console.log('✅ Generic Sensor API 지원 감지')

      try {
        this.genericSensor = new GenericSensorManager(this.config)
        await this.genericSensor.initialize()

        this.activeManager = 'generic'
        console.log('🎉 Generic Sensor API 초기화 성공')
        return true

      } catch (error) {
        console.warn('⚠️ Generic Sensor API 초기화 실패:', error)
        // Fallback to DeviceMotion
      }
    }

    // 2. DeviceMotion API fallback (iOS Safari, Firefox)
    if (DeviceMotionManager.isSupported()) {
      console.log('✅ DeviceMotion API 지원 감지 (iOS Safari)')

      try {
        this.deviceMotion = new DeviceMotionManager(this.config)
        await this.deviceMotion.initialize()

        this.activeManager = 'devicemotion'
        console.log('🎉 DeviceMotion API 초기화 성공')
        return true

      } catch (error) {
        console.error('❌ DeviceMotion API 초기화 실패:', error)
        throw error
      }
    }

    // 3. 모든 API 사용 불가
    throw new SensorError(
      '이 브라우저는 센서 API를 지원하지 않습니다',
      SensorErrorCode.NOT_SUPPORTED
    )
  }

  /**
   * iOS 13+ 권한 요청 (사용자 제스처 필요)
   * 버튼 클릭 이벤트 핸들러 내에서 호출해야 함
   */
  async requestPermission(): Promise<boolean> {
    if (this.activeManager === 'generic') {
      // Generic Sensor는 자동 권한 요청
      return true
    }

    if (this.activeManager === 'devicemotion' && this.deviceMotion) {
      return await this.deviceMotion.requestPermission()
    }

    throw new SensorError(
      '센서가 초기화되지 않았습니다',
      SensorErrorCode.SENSOR_NOT_AVAILABLE
    )
  }

  /**
   * 센서 추적 시작
   */
  startTracking(
    onData: SensorEventHandler,
    onError?: SensorErrorHandler
  ): void {
    if (!this.activeManager) {
      throw new SensorError(
        '센서가 초기화되지 않았습니다. initialize()를 먼저 호출하세요.',
        SensorErrorCode.SENSOR_NOT_AVAILABLE
      )
    }

    console.log(`🚀 센서 추적 시작 (${this.activeManager})`)

    if (this.activeManager === 'generic' && this.genericSensor) {
      this.genericSensor.startTracking(onData, onError)
    } else if (this.activeManager === 'devicemotion' && this.deviceMotion) {
      this.deviceMotion.startTracking(onData, onError)
    }
  }

  /**
   * 센서 추적 중지
   */
  stopTracking(): void {
    console.log('⏸️ 센서 추적 중지')

    this.genericSensor?.stopTracking()
    this.deviceMotion?.stopTracking()
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
    if (this.activeManager === 'generic' && this.genericSensor) {
      this.genericSensor.resume(onData, onError)
    } else if (this.activeManager === 'devicemotion' && this.deviceMotion) {
      this.deviceMotion.resume(onData, onError)
    }
  }

  /**
   * 지원 기능 확인
   */
  getSupportedFeatures(): SensorFeatures {
    if (this.activeManager === 'generic' && this.genericSensor) {
      return this.genericSensor.getSupportedFeatures()
    }

    if (this.activeManager === 'devicemotion' && this.deviceMotion) {
      return this.deviceMotion.getSupportedFeatures()
    }

    return {
      hasAccelerometer: false,
      hasGyroscope: false,
      hasMagnetometer: false,
      platform: 'none'
    }
  }

  /**
   * 현재 센서 상태 반환
   */
  getState(): SensorState {
    if (this.activeManager === 'generic' && this.genericSensor) {
      return this.genericSensor.getState()
    }

    if (this.activeManager === 'devicemotion' && this.deviceMotion) {
      return this.deviceMotion.getState()
    }

    return SensorState.IDLE
  }

  /**
   * 사용 중인 센서 API 타입 반환
   */
  getActiveManager(): SensorManagerType {
    return this.activeManager
  }

  /**
   * 센서 API 지원 여부 정적 체크
   */
  static isAnySensorSupported(): boolean {
    return (
      GenericSensorManager.isSupported() ||
      DeviceMotionManager.isSupported()
    )
  }

  /**
   * iOS 13+ 권한 요청 필요 여부 체크
   */
  static needsPermission(): boolean {
    return DeviceMotionManager.needsPermission()
  }

  /**
   * 브라우저 정보 및 센서 지원 상태 반환
   */
  static getBrowserInfo(): {
    userAgent: string
    supportsGenericSensor: boolean
    supportsDeviceMotion: boolean
    needsPermission: boolean
  } {
    return {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      supportsGenericSensor: GenericSensorManager.isSupported(),
      supportsDeviceMotion: DeviceMotionManager.isSupported(),
      needsPermission: DeviceMotionManager.needsPermission()
    }
  }

  /**
   * 센서 정리 (메모리 해제)
   */
  destroy(): void {
    console.log('🧹 센서 정리 중...')

    this.stopTracking()

    this.genericSensor?.destroy()
    this.deviceMotion?.destroy()

    this.genericSensor = null
    this.deviceMotion = null
    this.activeManager = null

    console.log('✅ 센서 정리 완료')
  }
}

/**
 * 싱글톤 센서 관리자 인스턴스 (선택적 사용)
 */
let globalSensorManager: UnifiedSensorManager | null = null

export function getGlobalSensorManager(config?: SensorConfig): UnifiedSensorManager {
  if (!globalSensorManager) {
    globalSensorManager = new UnifiedSensorManager(config)
  }
  return globalSensorManager
}

export function destroyGlobalSensorManager(): void {
  if (globalSensorManager) {
    globalSensorManager.destroy()
    globalSensorManager = null
  }
}
