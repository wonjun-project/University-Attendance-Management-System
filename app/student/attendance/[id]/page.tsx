'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface SessionInfo {
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

interface AttendanceInfo {
  id: string
  status: 'present' | 'late' | 'absent' | 'left_early'
  sessionId: string
}

export default function AttendancePage() {
  const { user, loading } = useAuth()
  const params = useParams()
  const sessionId = params.id as string

  const [sessionData, setSessionData] = useState<SessionInfo | null>(null)
  const [attendanceData, setAttendanceData] = useState<AttendanceInfo | null>(null)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState('')
  const [isTracking, setIsTracking] = useState(false)
  const [trackingStatus, setTrackingStatus] = useState<'in_range' | 'out_of_range' | 'checking'>('checking')
  const [lastLocationUpdate, setLastLocationUpdate] = useState<Date | null>(null)
  const [trackingInterval, setTrackingInterval] = useState<NodeJS.Timeout | null>(null)

  const trackLocation = useCallback(
    async (attendanceId: string) => {
      try {
        setTrackingStatus('checking')

        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 30000,
          })
        })

        const { latitude, longitude, accuracy } = position.coords
        setCurrentLocation({ lat: latitude, lng: longitude })
        setLocationError('')

        const response = await fetch('/api/location/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            attendanceId,
            latitude,
            longitude,
            accuracy,
          }),
        })

        const result = await response.json()

        if (response.ok) {
          const locationValid = Boolean(result.locationValid)
          setTrackingStatus(locationValid ? 'in_range' : 'out_of_range')
          setLastLocationUpdate(new Date())

          if (!locationValid) {
            const distance = result.distance ? `${result.distance}m` : '범위 외'
            const radius = result.allowedRadius ? `${result.allowedRadius}m` : '설정된 범위'
            setLocationError(`⚠️ 강의실 범위를 벗어났습니다! (현재: ${distance}, 허용: ${radius})`)
          } else {
            const distance = result.distance ? `${result.distance}m` : '범위 내'
            setLocationError(`✅ 강의실 범위 내 (거리: ${distance})`)
            setTimeout(() => setLocationError(''), 3000)
          }
        } else {
          setLocationError(`위치 추적 실패: ${result.error || '알 수 없는 오류'}`)
          setTrackingStatus('out_of_range')
        }
      } catch (error: unknown) {
        console.error('Location tracking error:', error)

        if (typeof error === 'object' && error !== null && 'code' in error) {
          const geoError = error as GeolocationPositionError
          if (geoError.code === geoError.PERMISSION_DENIED) {
            setLocationError('위치 접근 권한이 필요합니다. 브라우저 설정에서 위치 권한을 허용해주세요.')
          } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
            setLocationError('위치 정보를 가져올 수 없습니다. GPS가 켜져있는지 확인해주세요.')
          } else if (geoError.code === geoError.TIMEOUT) {
            setLocationError('위치 확인 시간이 초과되었습니다.')
          } else {
            setLocationError('위치 추적 중 오류가 발생했습니다.')
          }
        } else {
          setLocationError('위치 추적 중 오류가 발생했습니다.')
        }

        setTrackingStatus('out_of_range')
      }
    },
    []
  )

  const startLocationTracking = useCallback(
    (attendanceId: string) => {
      if (isTracking || trackingInterval) {
        return
      }

      setIsTracking(true)
      setTrackingStatus('checking')

      void trackLocation(attendanceId)

      const interval = setInterval(() => {
        void trackLocation(attendanceId)
      }, 30000)

      setTrackingInterval(interval)
    },
    [isTracking, trackingInterval, trackLocation]
  )

  const stopLocationTracking = useCallback(() => {
    if (trackingInterval) {
      clearInterval(trackingInterval)
      setTrackingInterval(null)
    }
    setIsTracking(false)
    setTrackingStatus('checking')
  }, [trackingInterval])

  const fetchSessionData = useCallback(async () => {
    try {
      const sessionResponse = await fetch(`/api/sessions/${sessionId}`)
      const sessionPayload = await sessionResponse.json()

      if (!sessionResponse.ok) {
        throw new Error(sessionPayload.error || '세션 정보를 가져올 수 없습니다.')
      }

      const sessionInfo = sessionPayload.session
      setSessionData({
        sessionId: sessionInfo.id,
        courseId: sessionInfo.courseId,
        courseName: sessionInfo.courseName,
        location: sessionInfo.location,
        expiresAt: sessionInfo.expiresAt,
        attendanceUrl: `/student/attendance/${sessionInfo.id}`,
      })

      const attendanceResponse = await fetch(`/api/attendance/student-status?sessionId=${sessionId}`)
      const attendancePayload = await attendanceResponse.json()

      if (attendanceResponse.ok && attendancePayload.attendance) {
        setAttendanceData({
          id: attendancePayload.attendance.id,
          status: attendancePayload.attendance.status,
          sessionId,
        })

        if (attendancePayload.attendance.status === 'present') {
          startLocationTracking(attendancePayload.attendance.id)
        }
      }
    } catch (error) {
      console.error('데이터 가져오기 실패:', error)
      setLocationError(error instanceof Error ? error.message : '정보를 가져올 수 없습니다.')
    }
  }, [sessionId, startLocationTracking])

  useEffect(() => {
    if (sessionId) {
      fetchSessionData()
    }

    return () => {
      stopLocationTracking()
    }
  }, [sessionId, fetchSessionData, stopLocationTracking])

  useEffect(() => {
    return () => {
      stopLocationTracking()
    }
  }, [stopLocationTracking])

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

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{sessionData.courseName}</CardTitle>
            <p className="text-sm text-gray-600">세션 ID: {sessionData.sessionId}</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900">강의실 정보</h3>
                <div className="mt-2 space-y-1 text-sm text-blue-800">
                  <p>📍 위치: {sessionData.location.address}</p>
                  <p>📏 출석 인정 범위: {sessionData.location.radius}m 이내</p>
                </div>
              </div>

              {attendanceData && (
                <div
                  className={`p-4 rounded-lg ${
                    attendanceData.status === 'present'
                      ? 'bg-green-50'
                      : attendanceData.status === 'late'
                      ? 'bg-yellow-50'
                      : 'bg-red-50'
                  }`}
                >
                  <h3
                    className={`font-semibold ${
                      attendanceData.status === 'present'
                        ? 'text-green-900'
                        : attendanceData.status === 'late'
                        ? 'text-yellow-900'
                        : 'text-red-900'
                    }`}
                  >
                    출석 상태:{' '}
                    {attendanceData.status === 'present'
                      ? '✅ 출석'
                      : attendanceData.status === 'late'
                      ? '⚠️ 지각'
                      : attendanceData.status === 'left_early'
                      ? '🚪 조퇴'
                      : '❌ 결석'}
                  </h3>
                </div>
              )}

              {isTracking && (
                <div
                  className={`p-4 rounded-lg ${
                    trackingStatus === 'in_range'
                      ? 'bg-green-50'
                      : trackingStatus === 'out_of_range'
                      ? 'bg-red-50'
                      : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3
                      className={`font-semibold ${
                        trackingStatus === 'in_range'
                          ? 'text-green-900'
                          : trackingStatus === 'out_of_range'
                          ? 'text-red-900'
                          : 'text-gray-900'
                      }`}
                    >
                      실시간 위치 추적
                    </h3>
                    <Button size="sm" variant="secondary" onClick={stopLocationTracking}>
                      추적 중지
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600">
                    상태:{' '}
                    {trackingStatus === 'in_range'
                      ? '강의실 범위 내에 있습니다.'
                      : trackingStatus === 'out_of_range'
                      ? '강의실 범위를 벗어났습니다.'
                      : '위치 확인 중...'}
                  </p>
                  {lastLocationUpdate && (
                    <p className="text-xs text-gray-500 mt-1">
                      마지막 업데이트: {lastLocationUpdate.toLocaleTimeString('ko-KR')}
                    </p>
                  )}
                </div>
              )}

              {locationError && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
                  {locationError}
                </div>
              )}

              {currentLocation && (
                <div className="text-xs text-gray-500">
                  현재 위치: {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
