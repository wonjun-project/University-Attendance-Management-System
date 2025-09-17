'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { QRCodeScannerNative } from '@/components/qr/QRCodeScannerNative'
import { QRCodeData } from '@/lib/qr/qr-generator'
import { Card, CardHeader, CardTitle, CardContent, Button, LoadingPage } from '@/components/ui'

export default function ScanPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [scannerActive, setScannerActive] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState(false)

  if (loading || !user || user.role !== 'student') {
    return <div className="min-h-screen bg-gray-50" />
  }

  const handleScanSuccess = async (qrData: QRCodeData) => {
    setScannerActive(false)
    setProcessing(true)
    setError('')

    try {
      // Get user's current location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0 // 캐시 사용 안함 - 항상 새로운 위치 요청
        })
      })

      const { latitude, longitude, accuracy } = position.coords

      // 먼저 해당 강의에 자동 등록 시도 (MVP용)
      try {
        const enrollResponse = await fetch('/api/enrollment/auto', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            courseId: qrData.courseId
          })
        })
        
        if (enrollResponse.ok) {
          const enrollResult = await enrollResponse.json()
          console.log('Auto-enrollment result:', enrollResult)
        }
      } catch (enrollError) {
        console.warn('Auto-enrollment failed:', enrollError)
        // 등록 실패해도 체크인은 시도
      }

      // Check in to attendance
      const response = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: qrData.sessionId,
          latitude,
          longitude,
          accuracy
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '출석 체크에 실패했습니다.')
      }

      setSuccess(true)
      
      // Redirect to attendance tracking page after 2 seconds
      setTimeout(() => {
        router.push(`/student/attendance/${result.sessionId}`)
      }, 2000)

    } catch (error: any) {
      console.error('Check-in error:', error)
      
      if (error.code === 1) {
        setError('위치 접근이 거부되었습니다. 브라우저 설정에서 위치 접근을 허용해주세요.')
      } else if (error.code === 2) {
        setError('현재 위치를 확인할 수 없습니다. GPS가 켜져있는지 확인해주세요.')
      } else if (error.code === 3) {
        setError('위치 확인 시간이 초과되었습니다. 다시 시도해주세요.')
      } else {
        setError(error.message || '출석 체크 중 오류가 발생했습니다.')
      }
    } finally {
      setProcessing(false)
    }
  }

  const handleScanError = (error: string) => {
    setError(error)
    setScannerActive(false)
  }

  if (processing) {
    return <LoadingPage message="출석을 처리하는 중..." />
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                출석 완료! 🎉
              </h2>
              <p className="text-gray-600 text-sm mb-4">
                출석이 성공적으로 처리되었습니다.
              </p>
              <p className="text-xs text-gray-400">
                잠시 후 출석 추적 페이지로 이동합니다...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-xl font-semibold text-gray-900">
                QR코드 스캔
              </h1>
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">{user.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!scannerActive ? (
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-center">출석 체크</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="text-center space-y-6">
                {error && (
                  <div className="bg-error-50 border border-error-200 text-error-800 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="w-24 h-24 sm:w-32 sm:h-32 bg-primary-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-12 h-12 sm:w-16 sm:h-16 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>

                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                    📱 QR코드 스캔
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600 mb-6 leading-relaxed">
                    교수님이 제공한 QR코드를 스캔하여 출석을 체크하세요.<br />
                    <span className="text-xs text-gray-500">📍 GPS 위치 정보가 함께 확인됩니다.</span>
                  </p>
                </div>

                <div className="space-y-4">
                  <Button
                    onClick={() => setScannerActive(true)}
                    className="w-full text-lg font-semibold py-4 px-6 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95"
                    size="lg"
                  >
                    📸 QR코드 스캔 시작
                  </Button>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      variant="secondary" 
                      onClick={() => router.push('/student')}
                      className="py-3"
                    >
                      ← 돌아가기
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => router.push('/student/status')}
                      className="py-3 text-xs"
                    >
                      📊 출석현황
                    </Button>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-4 text-xs text-blue-800 space-y-1">
                  <div className="font-semibold mb-2">📋 스캔 전 확인사항</div>
                  <p>📷 카메라 접근 권한이 필요합니다</p>
                  <p>📍 위치 접근 권한이 필요합니다</p>
                  <p>🏫 강의실 내에서 스캔해주세요</p>
                  <p>💡 밝은 곳에서 스캔하면 더 정확합니다</p>
                  <p>⚙️ 자동으로 최적 모드로 실행됩니다</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {scannerActive && (
          <QRCodeScannerNative
            onScanSuccess={handleScanSuccess}
            onScanError={handleScanError}
            onClose={() => setScannerActive(false)}
          />
        )}
      </div>
    </div>
  )
}