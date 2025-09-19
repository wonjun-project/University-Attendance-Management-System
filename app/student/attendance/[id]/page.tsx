'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createHeartbeatManager, type HeartbeatCallback } from '@/lib/realtime/heartbeat-manager'
import { getRealtimeTracker } from '@/lib/realtime/supabase-tracker'

interface SessionInfo {
  sessionId: string
  courseId: string
  courseName: string
  status: 'scheduled' | 'active' | 'ended'
  autoEnded?: boolean
  autoEndAt?: string | null
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
  const [sessionEnded, setSessionEnded] = useState(false)
  const [heartbeatManager, setHeartbeatManager] = useState<ReturnType<typeof createHeartbeatManager> | null>(null)

  // Heartbeat 콜백 함수
  const handleHeartbeatUpdate: HeartbeatCallback = useCallback((data) => {
    console.log('💓 Heartbeat 업데이트:', data)

    if (data.success && data.location && data.response) {
      // 위치 정보 업데이트
      setCurrentLocation({
        lat: data.location.latitude,
        lng: data.location.longitude
      })
      setLastLocationUpdate(new Date(data.location.timestamp))

      // 추적 상태 업데이트
      setTrackingStatus(data.response.locationValid ? 'in_range' : 'out_of_range')

      // 메시지 표시
      if (data.response.locationValid) {
        const distance = data.response.distance ? `${data.response.distance}m` : '범위 내'
        setLocationError(`✅ 강의실 범위 내 (거리: ${distance})`)
        setTimeout(() => setLocationError(''), 3000)
      } else {
        const distance = data.response.distance ? `${data.response.distance}m` : '범위 외'
        const radius = data.response.allowedRadius ? `${data.response.allowedRadius}m` : '설정된 범위'
        setLocationError(`⚠️ 강의실 범위를 벗어났습니다! (현재: ${distance}, 허용: ${radius})`)
      }

      // 세션 종료 감지
      if (data.response.sessionEnded) {
        console.log('🏁 세션이 종료되어 Heartbeat를 중지합니다')
        setSessionEnded(true)
        stopHeartbeatTracking()
      }
    } else if (data.error) {
      console.error('💓 Heartbeat 오류:', data.error)
      setLocationError(data.error)
      setTrackingStatus('out_of_range')
    }
  }, [])

  // Heartbeat 추적 시작
  const startHeartbeatTracking = useCallback(
    async (attendanceId: string) => {
      if (isTracking || heartbeatManager) {
        console.log('💓 이미 Heartbeat 추적 중입니다')
        return
      }

      try {
        console.log('💓 Heartbeat 추적 시작:', attendanceId)

        // Heartbeat Manager 생성
        const manager = createHeartbeatManager(handleHeartbeatUpdate, {
          interval: 30000, // 30초 (포그라운드)
          backgroundInterval: 60000, // 1분 (백그라운드)
          enableHighAccuracy: true
        })

        setHeartbeatManager(manager)

        // Heartbeat 시작
        const success = await manager.startHeartbeat(attendanceId, sessionId)

        if (success) {
          setIsTracking(true)
          setTrackingStatus('checking')
          console.log('✅ Heartbeat 추적 시작 성공')
        } else {
          throw new Error('Heartbeat 시작 실패')
        }

      } catch (error) {
        console.error('❌ Heartbeat 추적 시작 실패:', error)
        setLocationError('위치 추적 시작에 실패했습니다. 페이지를 새로고침해주세요.')
        setHeartbeatManager(null)
      }
    },
    [isTracking, heartbeatManager, handleHeartbeatUpdate, sessionId]
  )

  // Heartbeat 추적 중지
  const stopHeartbeatTracking = useCallback(() => {
    if (heartbeatManager) {
      console.log('💓 Heartbeat 추적 중지')
      heartbeatManager.stopHeartbeat()
      setHeartbeatManager(null)
    }
    setIsTracking(false)
    setTrackingStatus('checking')
  }, [heartbeatManager])

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
        status: sessionInfo.status,
        autoEnded: sessionInfo.autoEnded,
        autoEndAt: sessionInfo.autoEndAt,
        location: sessionInfo.location,
        expiresAt: sessionInfo.expiresAt,
        attendanceUrl: `/student/attendance/${sessionInfo.id}`,
      })
      if (sessionInfo.status !== 'active') {
        setSessionEnded(true)
      }

      const attendanceResponse = await fetch(`/api/attendance/student-status?sessionId=${sessionId}`)
      const attendancePayload = await attendanceResponse.json()

      if (attendanceResponse.ok && attendancePayload.attendance) {
        setAttendanceData({
          id: attendancePayload.attendance.id,
          status: attendancePayload.attendance.status,
          sessionId,
        })

        if (attendancePayload.session.isActive && attendancePayload.attendance.status === 'present') {
          await startHeartbeatTracking(attendancePayload.attendance.id)
        }
      }

      if (!attendancePayload.session.isActive) {
        setSessionEnded(true)
        stopHeartbeatTracking()
      }
    } catch (error) {
      console.error('데이터 가져오기 실패:', error)
      setLocationError(error instanceof Error ? error.message : '정보를 가져올 수 없습니다.')
    }
  }, [sessionId, startHeartbeatTracking, stopHeartbeatTracking])

  useEffect(() => {
    if (sessionId) {
      fetchSessionData()
    }

    return () => {
      stopHeartbeatTracking()
    }
  }, [sessionId, fetchSessionData, stopHeartbeatTracking])

  useEffect(() => {
    return () => {
      stopHeartbeatTracking()
    }
  }, [stopHeartbeatTracking])

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

              {sessionEnded && sessionData && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h3 className="font-semibold text-gray-700">
                    🏁 수업이 종료되었습니다
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {sessionData.autoEnded
                      ? '수업 시작 후 2시간이 지남에 따라 자동으로 종료되었습니다.'
                      : '교수님이 수업을 종료하여 위치 추적이 중지되었습니다.'}
                    {' '}출석 상태가 최종 확정되었습니다.
                  </p>
                  {sessionData.autoEndAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      자동 종료 시각: {new Date(sessionData.autoEndAt).toLocaleString('ko-KR')}
                    </p>
                  )}
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
                    <Button size="sm" variant="secondary" onClick={stopHeartbeatTracking}>
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
