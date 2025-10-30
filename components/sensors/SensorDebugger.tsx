'use client'

/**
 * 센서 디버거 컴포넌트
 * 실시간 센서 데이터 시각화 (개발/테스트용)
 */

import { useState, useEffect, useRef } from 'react'
import { UnifiedSensorManager } from '@/lib/sensors/sensor-manager'
import type { SensorData, SensorFeatures } from '@/lib/sensors/sensor-types'

interface SensorDebuggerProps {
  className?: string
  showControls?: boolean
  maxDataPoints?: number
}

export function SensorDebugger({
  className = '',
  showControls = true,
  maxDataPoints = 50
}: SensorDebuggerProps) {
  const [isTracking, setIsTracking] = useState(false)
  const [sensorData, setSensorData] = useState<SensorData | null>(null)
  const [features, setFeatures] = useState<SensorFeatures | null>(null)
  const [dataHistory, setDataHistory] = useState<SensorData[]>([])
  const [updateCount, setUpdateCount] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string>('')

  const sensorManagerRef = useRef<UnifiedSensorManager | null>(null)

  // 센서 추적 시작
  const startTracking = async () => {
    try {
      setErrorMessage('')

      const manager = new UnifiedSensorManager({ frequency: 60 })
      await manager.initialize()

      const supportedFeatures = manager.getSupportedFeatures()
      setFeatures(supportedFeatures)

      manager.startTracking(
        (data) => {
          setSensorData(data)
          setDataHistory((prev) => {
            const newHistory = [...prev, data]
            return newHistory.slice(-maxDataPoints)
          })
          setUpdateCount((count) => count + 1)
        },
        (error) => {
          console.error('센서 에러:', error)
          setErrorMessage(error.message)
        }
      )

      sensorManagerRef.current = manager
      setIsTracking(true)

    } catch (error) {
      console.error('센서 추적 시작 실패:', error)
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류')
    }
  }

  // 센서 추적 중지
  const stopTracking = () => {
    sensorManagerRef.current?.stopTracking()
    sensorManagerRef.current?.destroy()
    sensorManagerRef.current = null
    setIsTracking(false)
  }

  // 데이터 초기화
  const clearData = () => {
    setDataHistory([])
    setUpdateCount(0)
    setSensorData(null)
  }

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      stopTracking()
    }
  }, [])

  // 가속도 크기 계산
  const getAccelerationMagnitude = (data: SensorData): number => {
    const { x, y, z } = data.acceleration
    return Math.sqrt(x * x + y * y + z * z)
  }

  return (
    <div className={`bg-gray-50 border border-gray-300 rounded-lg p-4 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">센서 디버거</h3>
        {showControls && (
          <div className="flex gap-2">
            {!isTracking ? (
              <button
                onClick={startTracking}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
              >
                ▶ 시작
              </button>
            ) : (
              <button
                onClick={stopTracking}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
              >
                ⏹ 중지
              </button>
            )}
            <button
              onClick={clearData}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm font-medium"
            >
              🗑 초기화
            </button>
          </div>
        )}
      </div>

      {/* 에러 메시지 */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          <strong>에러:</strong> {errorMessage}
        </div>
      )}

      {/* 센서 지원 정보 */}
      {features && (
        <div className="bg-white rounded p-3 space-y-1 text-sm">
          <p className="font-medium text-gray-700">센서 지원 정보:</p>
          <div className="grid grid-cols-2 gap-2">
            <span className={features.hasAccelerometer ? 'text-green-600' : 'text-red-600'}>
              {features.hasAccelerometer ? '✅' : '❌'} 가속도계
            </span>
            <span className={features.hasGyroscope ? 'text-green-600' : 'text-red-600'}>
              {features.hasGyroscope ? '✅' : '❌'} 자이로스코프
            </span>
            <span className={features.hasMagnetometer ? 'text-green-600' : 'text-red-600'}>
              {features.hasMagnetometer ? '✅' : '❌'} 지자기 센서
            </span>
            <span className="text-blue-600">
              🔧 API: {features.platform}
            </span>
          </div>
        </div>
      )}

      {/* 실시간 센서 데이터 */}
      {sensorData && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-700">실시간 데이터:</p>
            <span className="text-xs text-gray-500">
              업데이트: {updateCount}회
            </span>
          </div>

          {/* 가속도 */}
          <div className="bg-white rounded p-3 space-y-1 text-sm">
            <p className="font-medium text-blue-600">가속도 (m/s²):</p>
            <div className="grid grid-cols-3 gap-2 font-mono">
              <div>
                <span className="text-gray-500">X:</span>{' '}
                <span className="font-bold">{sensorData.acceleration.x.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">Y:</span>{' '}
                <span className="font-bold">{sensorData.acceleration.y.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">Z:</span>{' '}
                <span className="font-bold">{sensorData.acceleration.z.toFixed(2)}</span>
              </div>
            </div>
            <p className="text-xs text-gray-600">
              크기: <span className="font-bold">{getAccelerationMagnitude(sensorData).toFixed(2)}</span> m/s²
            </p>
          </div>

          {/* 회전 속도 */}
          {sensorData.rotation && (
            <div className="bg-white rounded p-3 space-y-1 text-sm">
              <p className="font-medium text-purple-600">회전 속도 (deg/s):</p>
              <div className="grid grid-cols-3 gap-2 font-mono">
                <div>
                  <span className="text-gray-500">α (Yaw):</span>{' '}
                  <span className="font-bold">{sensorData.rotation.alpha.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">β (Pitch):</span>{' '}
                  <span className="font-bold">{sensorData.rotation.beta.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">γ (Roll):</span>{' '}
                  <span className="font-bold">{sensorData.rotation.gamma.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* 지자기 센서 */}
          {sensorData.magnetometer && (
            <div className="bg-white rounded p-3 space-y-1 text-sm">
              <p className="font-medium text-orange-600">지자기 (μT):</p>
              <div className="grid grid-cols-3 gap-2 font-mono">
                <div>
                  <span className="text-gray-500">X:</span>{' '}
                  <span className="font-bold">{sensorData.magnetometer.x.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Y:</span>{' '}
                  <span className="font-bold">{sensorData.magnetometer.y.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Z:</span>{' '}
                  <span className="font-bold">{sensorData.magnetometer.z.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* 가속도 시각화 (간단한 바 차트) */}
          <div className="bg-white rounded p-3 space-y-2 text-sm">
            <p className="font-medium text-gray-700">가속도 시각화:</p>
            <div className="space-y-1">
              {['x', 'y', 'z'].map((axis) => {
                const value = sensorData.acceleration[axis as keyof typeof sensorData.acceleration]
                const maxValue = 10  // ±10 m/s²
                const percentage = Math.min(Math.abs(value) / maxValue, 1) * 100
                const color = value >= 0 ? 'bg-blue-500' : 'bg-red-500'

                return (
                  <div key={axis} className="flex items-center gap-2">
                    <span className="w-4 text-gray-600 font-mono">{axis.toUpperCase()}</span>
                    <div className="flex-1 bg-gray-200 rounded h-4 overflow-hidden">
                      <div
                        className={`h-full ${color} transition-all duration-100`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-16 text-right font-mono text-xs">
                      {value.toFixed(2)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 데이터 히스토리 */}
      {dataHistory.length > 0 && (
        <details className="bg-white rounded p-3">
          <summary className="cursor-pointer font-medium text-sm text-gray-700">
            데이터 히스토리 ({dataHistory.length}개)
          </summary>
          <div className="mt-2 max-h-64 overflow-auto text-xs font-mono">
            <pre>{JSON.stringify(dataHistory.slice(-5), null, 2)}</pre>
          </div>
        </details>
      )}

      {/* 안내 메시지 */}
      {!isTracking && !sensorData && (
        <div className="text-center text-sm text-gray-500 py-4">
          📱 "시작" 버튼을 클릭하여 센서 추적을 시작하세요
        </div>
      )}
    </div>
  )
}
