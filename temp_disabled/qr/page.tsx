'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { QRCodeDisplay } from '@/components/qr'
import { QRCodeData } from '@/lib/qr/qr-generator'
import LocationSelector, { LocationData } from '@/components/location/LocationSelector'
import { Card, CardHeader, CardTitle, CardContent, Button, LoadingPage } from '@/components/ui'

export default function QRGeneratorPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [qrData, setQrData] = useState<QRCodeData | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string>('')
  const [locationData, setLocationData] = useState<LocationData | null>(null)

  if (loading || !user || user.role !== 'professor') {
    return <div className="min-h-screen bg-gray-50" />
  }

  const generateQRCode = async () => {
    // Check if location is set
    if (!locationData) {
      setError('먼저 강의실 위치를 설정해주세요.')
      return
    }

    setGenerating(true)
    setError('')

    try {
      // For MVP, we'll create a dummy course ID
      // In real implementation, this would come from course selection
      const dummyCourseId = 'demo-course-' + user.id

      const response = await fetch('/api/qr/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId: dummyCourseId,
          expiresInMinutes: 30,
          classroomLocation: {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            radius: locationData.radius,
            displayName: locationData.displayName
          }
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'QR코드 생성에 실패했습니다.')
      }

      setQrData(result.qrData)
    } catch (error: any) {
      console.error('QR generation error:', error)
      setError(error.message || 'QR코드 생성 중 오류가 발생했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  const handleRefreshQR = () => {
    generateQRCode()
  }

  const handleExpiredQR = () => {
    setQrData(null)
    setError('QR코드가 만료되었습니다. 새로 생성해주세요.')
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
                QR코드 생성
              </h1>
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">{user.name} 교수님</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Location Selector - Always visible when QR is not generated */}
          {!qrData && (
            <div className="max-w-3xl mx-auto">
              <LocationSelector
                value={locationData}
                onChange={(data) => {
                  console.log('Location data changed:', data)
                  setLocationData(data)
                }}
                disabled={generating}
              />
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-8">
            {/* QR Code Display */}
            <div className="flex justify-center">
              {qrData ? (
                <QRCodeDisplay
                  qrData={qrData}
                  onRefresh={handleRefreshQR}
                  onExpire={handleExpiredQR}
                />
              ) : (
                <Card className="w-full max-w-md">
                  <CardContent className="p-8">
                    <div className="text-center space-y-6">
                      {error && (
                        <div className="bg-error-50 border border-error-200 text-error-800 px-4 py-3 rounded-lg text-sm">
                          {error}
                        </div>
                      )}

                      <div className="w-32 h-32 bg-primary-100 rounded-full flex items-center justify-center mx-auto">
                        <svg className="w-16 h-16 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                      </div>

                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                          출석용 QR코드 생성
                        </h2>
                        <p className="text-gray-600">
                          위에서 강의실 위치를 설정한 후 QR코드를 생성하세요.
                        </p>
                      </div>

                      <Button 
                        onClick={generateQRCode} 
                        loading={generating}
                        disabled={generating || !locationData}
                        className="w-full"
                        size="lg"
                      >
                        {generating ? '생성 중...' : 
                         !locationData ? '위치를 먼저 설정하세요' :
                         'QR코드 생성하기'}
                      </Button>

                      {/* 디버깅용 정보 */}
                      <div className="mt-2 text-xs text-gray-500">
                        Debug: locationData = {locationData ? 'SET' : 'NULL'} 
                        {locationData && ` (${locationData.displayName})`}
                      </div>

                      {locationData && (
                        <div className="mt-4 p-3 bg-success-50 border border-success-200 rounded-lg text-left">
                          <div className="text-sm text-success-800">
                            <strong>설정된 위치:</strong> {locationData.displayName}
                            <div className="text-xs text-success-600 mt-1">
                              반경: {locationData.radius}m
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Information Panel */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>QR코드 사용 방법</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 text-sm font-medium">
                      1
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">강의실 위치 설정</h4>
                      <p className="text-sm text-gray-600">현재 위치 또는 미리 정의된 강의실을 선택하세요.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 text-sm font-medium">
                      2
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">QR코드 생성</h4>
                      <p className="text-sm text-gray-600">위치 설정 후 QR코드를 생성하세요.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 text-sm font-medium">
                      3
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">화면 공유</h4>
                      <p className="text-sm text-gray-600">강의실 스크린에 QR코드를 표시하세요.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 text-sm font-medium">
                      4
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">학생 출석</h4>
                      <p className="text-sm text-gray-600">학생들이 QR코드를 스캔하여 출석체크를 하게됩니다.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>주요 기능</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center space-x-3 text-sm">
                    <svg className="w-5 h-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>30분 자동 만료</span>
                  </div>
                  
                  <div className="flex items-center space-x-3 text-sm">
                    <svg className="w-5 h-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>GPS 위치 기반 인증</span>
                  </div>
                  
                  <div className="flex items-center space-x-3 text-sm">
                    <svg className="w-5 h-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>실시간 출석 현황</span>
                  </div>
                  
                  <div className="flex items-center space-x-3 text-sm">
                    <svg className="w-5 h-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>지능형 위치 선택</span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Button 
                  variant="secondary" 
                  onClick={() => router.push('/professor')}
                  className="w-full"
                >
                  대시보드로 돌아가기
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}