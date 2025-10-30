'use client'

/**
 * 센서 권한 요청 버튼 컴포넌트
 * iOS 13+ Safari에서 사용자 제스처(클릭) 필요
 */

import { useState } from 'react'
import { UnifiedSensorManager } from '@/lib/sensors/sensor-manager'
import type { SensorPermissionState } from '@/lib/sensors/sensor-types'

interface SensorPermissionButtonProps {
  onPermissionGranted?: () => void
  onPermissionDenied?: () => void
  className?: string
  variant?: 'default' | 'primary' | 'secondary'
}

export function SensorPermissionButton({
  onPermissionGranted,
  onPermissionDenied,
  className = '',
  variant = 'primary'
}: SensorPermissionButtonProps) {
  const [permissionState, setPermissionState] = useState<SensorPermissionState>('unknown')
  const [isRequesting, setIsRequesting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')

  const requestPermission = async () => {
    setIsRequesting(true)
    setErrorMessage('')

    try {
      const sensorManager = new UnifiedSensorManager()

      // 센서 초기화
      const initialized = await sensorManager.initialize()

      if (!initialized) {
        throw new Error('센서 초기화 실패')
      }

      setPermissionState('granted')
      onPermissionGranted?.()

      // 정리
      sensorManager.destroy()

    } catch (error) {
      console.error('센서 권한 요청 실패:', error)

      setPermissionState('denied')
      setErrorMessage(
        error instanceof Error
          ? error.message
          : '센서 권한을 허용할 수 없습니다'
      )

      onPermissionDenied?.()

    } finally {
      setIsRequesting(false)
    }
  }

  const getButtonStyle = () => {
    const baseStyle = 'px-6 py-3 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'

    switch (variant) {
      case 'primary':
        return `${baseStyle} bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800`
      case 'secondary':
        return `${baseStyle} bg-gray-200 text-gray-800 hover:bg-gray-300 active:bg-gray-400`
      default:
        return `${baseStyle} bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 active:bg-gray-100`
    }
  }

  // 브라우저 정보 표시
  const browserInfo = UnifiedSensorManager.getBrowserInfo()
  const needsPermission = UnifiedSensorManager.needsPermission()

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 권한 상태에 따른 UI */}
      {permissionState === 'unknown' && (
        <div className="space-y-3">
          <button
            onClick={requestPermission}
            disabled={isRequesting}
            className={getButtonStyle()}
          >
            {isRequesting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                센서 권한 확인 중...
              </span>
            ) : (
              '센서 권한 요청'
            )}
          </button>

          <div className="text-sm text-gray-600 space-y-1">
            <p>
              📱 출석 체크를 위해 <strong>센서 권한</strong>이 필요합니다
            </p>
            {needsPermission && (
              <p className="text-orange-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                iOS 사용자: 버튼 클릭 후 "허용" 을 선택해주세요
              </p>
            )}
          </div>
        </div>
      )}

      {permissionState === 'granted' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-800">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">센서 권한이 허용되었습니다</span>
          </div>
          <p className="text-sm text-green-700 mt-1">
            이제 출석 체크를 진행할 수 있습니다
          </p>
        </div>
      )}

      {permissionState === 'denied' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-red-800">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">센서 권한이 거부되었습니다</span>
          </div>

          {errorMessage && (
            <p className="text-sm text-red-700">
              <strong>오류:</strong> {errorMessage}
            </p>
          )}

          <div className="text-sm text-red-700 space-y-2">
            <p className="font-medium">해결 방법:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>브라우저 설정 &gt; 사이트 설정 &gt; 센서 권한 허용</li>
              <li>페이지 새로고침 후 다시 시도</li>
              {needsPermission && (
                <li>iOS: 설정 &gt; Safari &gt; 개인 정보 보호 &gt; 동작 및 방향 접근 허용</li>
              )}
            </ol>
          </div>

          <button
            onClick={() => {
              setPermissionState('unknown')
              setErrorMessage('')
            }}
            className="text-sm text-red-600 hover:text-red-700 underline"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 디버그 정보 (개발 환경만) */}
      {process.env.NODE_ENV === 'development' && (
        <details className="text-xs text-gray-500 border border-gray-200 rounded p-2">
          <summary className="cursor-pointer font-medium">디버그 정보</summary>
          <pre className="mt-2 overflow-auto">
            {JSON.stringify(browserInfo, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}
