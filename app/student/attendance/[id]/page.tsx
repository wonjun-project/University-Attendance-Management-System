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

interface AttendanceData {
  id: string
  status: 'present' | 'late' | 'absent' | 'left_early'
  sessionId: string
}

export default function AttendancePage() {
  const { user, loading } = useAuth()
  const params = useParams()
  const sessionId = params.id as string

  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number } | null>(null)
  const [locationError, setLocationError] = useState('')
  const [isTracking, setIsTracking] = useState(false)
  const [trackingStatus, setTrackingStatus] = useState<'in_range' | 'out_of_range' | 'checking'>('checking')
  const [lastLocationUpdate, setLastLocationUpdate] = useState<Date | null>(null)
  const [trackingInterval, setTrackingInterval] = useState<NodeJS.Timeout | null>(null)

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

  // 컴포넌트 언마운트 시 위치 추적 정리
  useEffect(() => {
    return () => {
      if (trackingInterval) {
        console.log('Component unmounting, clearing location tracking interval')
        clearInterval(trackingInterval)
        setTrackingInterval(null)
        setIsTracking(false)
      }
    }
  }, [trackingInterval])

  const fetchSessionData = async () => {
    try {
      // 세션 정보 조회
      const sessionResponse = await fetch(`/api/sessions/${sessionId}`)
      const sessionData = await sessionResponse.json()

      if (!sessionResponse.ok) {
        throw new Error(sessionData.error || '세션 정보를 가져올 수 없습니다.')
      }

      let sessionInfo = sessionData.session
      setSessionData({
        sessionId: sessionInfo.id,
        courseId: sessionInfo.courseId,
        courseName: sessionInfo.courseName,
        location: sessionInfo.location,
        expiresAt: sessionInfo.expiresAt,
        attendanceUrl: `/student/attendance/${sessionInfo.id}`
      })

      // 현재 사용자의 출석 정보 조회 (학생용 API 사용)
      const attendanceResponse = await fetch(`/api/attendance/student-status?sessionId=${sessionId}`)
      const attendanceData = await attendanceResponse.json()

      if (attendanceResponse.ok && attendanceData.attendance) {
        setAttendanceData({
          id: attendanceData.attendance.id,
          status: attendanceData.attendance.status,
          sessionId: sessionId
        })

        // 출석 상태가 'present'면 자동으로 위치 추적 시작
        if (attendanceData.attendance.status === 'present') {
          startLocationTracking(attendanceData.attendance.id)
        }
      }
    } catch (error) {
      console.error('데이터 가져오기 실패:', error)
      setLocationError(error instanceof Error ? error.message : '정보를 가져올 수 없습니다.')
    }
  }

  // 지속적인 위치 추적 시작
  const startLocationTracking = (attendanceId: string) => {
    if (isTracking || trackingInterval) {
      console.log('Location tracking already active, skipping...')
      return // 이미 추적 중이면 중복 시작 방지
    }

    setIsTracking(true)
    setTrackingStatus('checking')
    console.log('Location tracking started for attendance:', attendanceId)

    // 초기 위치 확인
    trackLocation(attendanceId)

    // 30초마다 위치 추적
    const interval = setInterval(() => {
      trackLocation(attendanceId)
    }, 30000)

    setTrackingInterval(interval)
    console.log('Location tracking interval set:', interval)
  }

  // 실제 위치 추적 및 서버 전송
  const trackLocation = async (attendanceId: string) => {
    try {
      setTrackingStatus('checking')

      // 현재 위치 가져오기
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000
        })
      })

      const { latitude, longitude, accuracy } = position.coords
      setCurrentLocation({ lat: latitude, lng: longitude })
      setLocationError('')

      // 서버에 위치 전송
      const response = await fetch('/api/location/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          attendanceId,
          latitude,
          longitude,
          accuracy
        })
      })

      const result = await response.json()
      console.log('Location tracking response:', result)

      if (response.ok) {
        setTrackingStatus(result.locationValid ? 'in_range' : 'out_of_range')
        setLastLocationUpdate(new Date())

        if (!result.locationValid) {
          const distance = result.distance ? `${result.distance}m` : '범위 외'
          const radius = result.allowedRadius ? `${result.allowedRadius}m` : '설정된 범위'
          setLocationError(`⚠️ 강의실 범위를 벗어났습니다! (현재: ${distance}, 허용: ${radius})`)
        } else {
          const distance = result.distance ? `${result.distance}m` : '범위 내'
          setLocationError(`✅ 강의실 범위 내 (거리: ${distance})`)
          // 성공시에도 잠시 메시지를 보여주고 나서 지우기
          setTimeout(() => setLocationError(''), 3000)
        }
      } else {
        console.error('Location tracking failed:', result.error)
        setLocationError(`위치 추적 실패: ${result.error}`)
      }
    } catch (error: any) {
      console.error('Location tracking error:', error)

      if (error.code === 1) {
        setLocationError('위치 접근 권한이 필요합니다. 브라우저 설정에서 위치 권한을 허용해주세요.')
      } else if (error.code === 2) {
        setLocationError('위치 정보를 가져올 수 없습니다. GPS가 켜져있는지 확인해주세요.')
      } else if (error.code === 3) {
        setLocationError('위치 확인 시간이 초과되었습니다.')
      } else {
        setLocationError('위치 추적 중 오류가 발생했습니다.')
      }

      setTrackingStatus('out_of_range')
    }
  }

  // 추적 중지
  const stopLocationTracking = () => {
    console.log('Stopping location tracking...')

    if (trackingInterval) {
      clearInterval(trackingInterval)
      setTrackingInterval(null)
      console.log('Location tracking interval cleared')
    }

    setIsTracking(false)
    setTrackingStatus('checking')
    console.log('Location tracking stopped')
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

              {/* 출석 상태 */}
              {attendanceData && (
                <div className={`p-4 rounded-lg ${
                  attendanceData.status === 'present' ? 'bg-green-50' :
                  attendanceData.status === 'late' ? 'bg-yellow-50' : 'bg-red-50'
                }`}>
                  <h3 className={`font-semibold ${
                    attendanceData.status === 'present' ? 'text-green-900' :
                    attendanceData.status === 'late' ? 'text-yellow-900' : 'text-red-900'
                  }`}>
                    출석 상태: {
                      attendanceData.status === 'present' ? '✅ 출석' :
                      attendanceData.status === 'late' ? '⚠️ 지각' :
                      attendanceData.status === 'left_early' ? '🚪 조퇴' : '❌ 결석'
                    }
                  </h3>
                </div>
              )}

              {/* 실시간 위치 추적 상태 */}
              {isTracking && (
                <div className={`p-4 rounded-lg ${
                  trackingStatus === 'in_range' ? 'bg-green-50' :
                  trackingStatus === 'out_of_range' ? 'bg-red-50' : 'bg-gray-50'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`font-semibold ${
                      trackingStatus === 'in_range' ? 'text-green-900' :
                      trackingStatus === 'out_of_range' ? 'text-red-900' : 'text-gray-900'
                    }`}>
                      실시간 위치 추적
                    </h3>
                    <div className={`w-3 h-3 rounded-full ${
                      trackingStatus === 'in_range' ? 'bg-green-500' :
                      trackingStatus === 'out_of_range' ? 'bg-red-500' : 'bg-gray-500 animate-pulse'
                    }`} />
                  </div>

                  <div className={`text-sm ${
                    trackingStatus === 'in_range' ? 'text-green-800' :
                    trackingStatus === 'out_of_range' ? 'text-red-800' : 'text-gray-800'
                  }`}>
                    {trackingStatus === 'in_range' && '✅ 강의실 범위 내에 있습니다'}
                    {trackingStatus === 'out_of_range' && '⚠️ 강의실 범위를 벗어났습니다'}
                    {trackingStatus === 'checking' && '📍 위치를 확인하는 중...'}

                    {lastLocationUpdate && (
                      <p className="text-xs mt-1 opacity-70">
                        마지막 업데이트: {lastLocationUpdate.toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* 현재 위치 정보 */}
              {currentLocation && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">현재 위치</h4>
                  <p className="text-xs text-gray-600">
                    위도: {currentLocation.lat.toFixed(6)},
                    경도: {currentLocation.lng.toFixed(6)}
                  </p>
                </div>
              )}

              {/* 에러 메시지 */}
              {locationError && (
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-red-800 text-sm">{locationError}</p>
                </div>
              )}

              {/* 추적 제어 버튼 */}
              {attendanceData && attendanceData.status === 'present' && (
                <div className="flex space-x-2">
                  {isTracking ? (
                    <Button
                      onClick={stopLocationTracking}
                      variant="secondary"
                      className="flex-1"
                    >
                      추적 중지
                    </Button>
                  ) : (
                    <Button
                      onClick={() => startLocationTracking(attendanceData.id)}
                      className="flex-1"
                    >
                      위치 추적 시작
                    </Button>
                  )}
                </div>
              )}

              {/* 안내 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">🎯 지속적 출석 추적</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>• QR 인증 완료 후 자동으로 위치 추적이 시작됩니다</p>
                  <p>• 30초마다 현재 위치를 확인합니다</p>
                  <p>• 강의실 범위를 벗어나면 알림이 표시됩니다</p>
                  <p>• 수업 시간 동안 범위 내에 있어야 출석으로 인정됩니다</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}