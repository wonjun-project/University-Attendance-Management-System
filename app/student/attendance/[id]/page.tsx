'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface SessionData {
  sessionId: string
  courseId: string
  courseName: string
  location: {
    lat: number
    lng: number
    address: string
    radius: number
  }
  expiresAt: string
  attendanceUrl: string
}

export default function AttendancePage() {
  const { user, loading } = useAuth()
  const params = useParams()
  const sessionId = params.id as string

  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number } | null>(null)
  const [locationError, setLocationError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [attendanceResult, setAttendanceResult] = useState<string | null>(null)

  useEffect(() => {
    // URL에서 QR 코드 데이터 파싱 시도
    if (sessionId) {
      try {
        // 실제로는 서버에서 세션 정보를 가져와야 함
        fetchSessionData()
      } catch (error) {
        console.error('세션 데이터 파싱 실패:', error)
      }
    }
  }, [sessionId])

  const fetchSessionData = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '세션 정보를 가져올 수 없습니다.')
      }

      // QR 코드 데이터에서 세션 정보 추출
      let sessionInfo = data.session

      // QR 코드 데이터가 문자열로 저장되어 있다면 파싱
      if (typeof sessionInfo.qrCode === 'string') {
        try {
          const qrData = JSON.parse(sessionInfo.qrCode)
          sessionInfo.location = qrData.location
        } catch (e) {
          console.log('QR 코드 파싱 실패, 기본 위치 정보 사용')
        }
      }

      const sessionData: SessionData = {
        sessionId: sessionInfo.id,
        courseId: sessionInfo.courseId,
        courseName: sessionInfo.courseName,
        location: sessionInfo.location,
        expiresAt: sessionInfo.expiresAt,
        attendanceUrl: `/student/attendance/${sessionInfo.id}`
      }

      setSessionData(sessionData)
    } catch (error) {
      console.error('세션 데이터 가져오기 실패:', error)
      setLocationError(error instanceof Error ? error.message : '세션 정보를 가져올 수 없습니다.')
    }
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('위치 서비스를 지원하지 않는 브라우저입니다.')
      return
    }

    setLocationError('')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        })
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('위치 접근 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.')
            break
          case error.POSITION_UNAVAILABLE:
            setLocationError('위치 정보를 가져올 수 없습니다.')
            break
          case error.TIMEOUT:
            setLocationError('위치 요청 시간이 초과되었습니다.')
            break
          default:
            setLocationError('위치를 가져오는 중 오류가 발생했습니다.')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    )
  }

  // 거리 계산은 서버에서 처리

  const submitAttendance = async () => {
    if (!sessionData || !currentLocation || !user) return

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/attendance/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionData.sessionId,
          studentId: user.id,
          studentName: user.name,
          currentLocation: currentLocation
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '출석 처리에 실패했습니다.')
      }

      setAttendanceResult(data.message)

    } catch (error) {
      console.error('출석 제출 오류:', error)
      setAttendanceResult(error instanceof Error ? `❌ ${error.message}` : '❌ 출석 처리 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50" />
  }

  if (!user || user.role !== 'student') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-gray-600">학생 계정으로 로그인해주세요.</p>
            <div className="mt-4 text-center">
              <Link href="/auth/login">
                <Button>로그인</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-gray-600">세션 정보를 불러오는 중...</p>
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
              <Link href="/student" className="text-gray-400 hover:text-gray-600">
                ← 대시보드
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">출석 체크</h1>
              <Badge variant="primary">위치 기반</Badge>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">{user.name} 학생</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{sessionData.courseName}</CardTitle>
            <p className="text-sm text-gray-600">
              세션 ID: {sessionData.sessionId}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* 강의실 정보 */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900">강의실 정보</h3>
                <div className="mt-2 space-y-1 text-sm text-blue-800">
                  <p>📍 위치: {sessionData.location.address}</p>
                  <p>📏 출석 인정 범위: {sessionData.location.radius}m 이내</p>
                </div>
              </div>

              {/* 현재 위치 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">현재 위치 확인</h3>
                  <Button
                    onClick={getCurrentLocation}
                    variant="secondary"
                    size="sm"
                  >
                    위치 가져오기
                  </Button>
                </div>

                {locationError && (
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-red-800 text-sm">{locationError}</p>
                  </div>
                )}

                {currentLocation && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-green-800 text-sm">
                      ✅ 위치 정보를 성공적으로 가져왔습니다.
                    </p>
                    <p className="text-green-700 text-xs mt-1">
                      위도: {currentLocation.lat.toFixed(6)}, 경도: {currentLocation.lng.toFixed(6)}
                    </p>
                  </div>
                )}
              </div>

              {/* 출석 버튼 */}
              <Button
                onClick={submitAttendance}
                disabled={!currentLocation || isSubmitting}
                className="w-full"
                loading={isSubmitting}
              >
                {isSubmitting ? '출석 처리 중...' : '출석 체크'}
              </Button>

              {/* 결과 */}
              {attendanceResult && (
                <div className={`p-4 rounded-lg ${
                  attendanceResult.includes('✅')
                    ? 'bg-green-50 text-green-800'
                    : 'bg-red-50 text-red-800'
                }`}>
                  <p className="text-center font-medium">{attendanceResult}</p>
                </div>
              )}

              {/* 안내 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">출석 방법</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>1. &apos;위치 가져오기&apos; 버튼을 클릭하세요</p>
                  <p>2. 브라우저에서 위치 권한을 허용해주세요</p>
                  <p>3. 강의실 범위 내에서 &apos;출석 체크&apos; 버튼을 클릭하세요</p>
                  <p>4. 위치가 확인되면 자동으로 출석 처리됩니다</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}