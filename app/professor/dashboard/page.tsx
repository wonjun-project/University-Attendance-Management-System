'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'

interface AttendanceStudent {
  studentId: string
  name: string
  status: 'present' | 'late' | 'absent'
  checkInTime: string | null
  locationVerified: boolean
}

interface SessionAttendance {
  total: number
  present: number
  late: number
  leftEarly: number
  absent: number
  students: AttendanceStudent[]
}

interface ActiveSession {
  id: string
  courseName: string
  courseCode: string
  date: string
  startTime: string | null
  endTime: string | null
  attendance: SessionAttendance
}

interface DashboardData {
  totalCourses: number
  activeSessionsCount: number
  activeSessions: ActiveSession[]
}

export default function ProfessorDashboardPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user || user.role !== 'professor' || loading) {
        console.log('⏸️ [Professor Dashboard] API 호출 건너뜀:', { user: !!user, role: user?.role, loading })
        return
      }

      try {
        console.log('📡 [Professor Dashboard] API 호출 시작...')
        setIsLoading(true)
        const response = await fetch('/api/attendance/professor/dashboard', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        console.log('📡 [Professor Dashboard] API 응답 수신:', { status: response.status, ok: response.ok })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('❌ [Professor Dashboard] API 에러 응답:', errorData)
          throw new Error('대시보드 데이터를 가져오는데 실패했습니다.')
        }

        const data = await response.json()
        console.log('✅ [Professor Dashboard] API 응답 데이터:', {
          totalCourses: data.dashboard?.totalCourses,
          activeSessionsCount: data.dashboard?.activeSessionsCount,
          activeSessions: data.dashboard?.activeSessions?.map((s: any) => ({
            id: s.id,
            courseName: s.courseName,
            studentCount: s.attendance?.total
          }))
        })
        setDashboardData(data.dashboard)
      } catch (error: unknown) {
        console.error('❌ [Professor Dashboard] Fetch 에러:', error)
        const message = error instanceof Error ? error.message : '대시보드를 불러오는 중 오류가 발생했습니다.'
        setError(message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000)

    return () => clearInterval(interval)
  }, [user, loading])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge variant="success">출석</Badge>
      case 'late':
        return <Badge variant="warning">지각</Badge>
      case 'absent':
        return <Badge variant="error">결석</Badge>
      case 'left_early':
        return <Badge variant="warning">조퇴</Badge>
      default:
        return <Badge variant="secondary">미확인</Badge>
    }
  }

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '--:--'
    return timeString.slice(0, 5) // HH:MM format
  }

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString)
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading || !user || user.role !== 'professor') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">대시보드 데이터를 불러오는 중...</p>
        </div>
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
                실시간 출석 현황
              </h1>
              <Badge variant="primary">실시간</Badge>
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">{user.name} 교수님</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-primary-100 rounded-lg">
                  <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">{dashboardData?.totalCourses || 0}</div>
                  <div className="text-sm text-gray-600">총 강의수</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-success-100 rounded-lg">
                  <svg className="w-8 h-8 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">{dashboardData?.activeSessionsCount || 0}</div>
                  <div className="text-sm text-gray-600">진행중인 수업</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-warning-100 rounded-lg">
                  <svg className="w-8 h-8 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {dashboardData?.activeSessions?.reduce((acc, session) => acc + session.attendance.total, 0) || 0}
                  </div>
                  <div className="text-sm text-gray-600">총 출석 학생</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error State */}
        {error && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="text-center text-error-600">
                <svg className="mx-auto h-12 w-12 text-error-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm">{error}</p>
                <Button className="mt-4" onClick={() => window.location.reload()}>
                  다시 시도
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Sessions */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              진행중인 수업 ({dashboardData?.activeSessions?.length || 0})
            </h2>
            <Button size="sm" onClick={() => window.location.reload()}>
              새로고침
            </Button>
          </div>

          {dashboardData?.activeSessions?.length === 0 ? (
            <Card>
              <CardContent className="p-12">
                <div className="text-center text-gray-500">
                  <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">진행중인 수업이 없습니다</h3>
                  <p className="text-sm text-gray-500 mb-4">새로운 수업을 시작하여 출석을 받아보세요.</p>
                  <Button onClick={() => router.push('/professor/qr')}>
                    새 수업 시작
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {dashboardData?.activeSessions?.map((session) => (
                <Card key={session.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{session.courseName}</CardTitle>
                        <p className="text-sm text-gray-600">
                          {session.courseCode} • {formatTime(session.startTime)} - {formatTime(session.endTime)}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="success" className="mb-2">진행중</Badge>
                        <div className="text-sm text-gray-600">
                          출석: {session.attendance.present} / 총: {session.attendance.total}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Attendance Summary */}
                    <div className="grid grid-cols-4 gap-4 mb-6">
                      <div className="text-center p-4 bg-success-50 rounded-lg">
                        <div className="text-2xl font-bold text-success-600">{session.attendance.present}</div>
                        <div className="text-sm text-success-700">출석</div>
                      </div>
                      <div className="text-center p-4 bg-warning-50 rounded-lg">
                        <div className="text-2xl font-bold text-warning-600">{session.attendance.late}</div>
                        <div className="text-sm text-warning-700">지각</div>
                      </div>
                      <div className="text-center p-4 bg-warning-50 rounded-lg">
                        <div className="text-2xl font-bold text-warning-600">{session.attendance.leftEarly}</div>
                        <div className="text-sm text-warning-700">조퇴</div>
                      </div>
                      <div className="text-center p-4 bg-error-50 rounded-lg">
                        <div className="text-2xl font-bold text-error-600">{session.attendance.absent}</div>
                        <div className="text-sm text-error-700">결석</div>
                      </div>
                    </div>

                    {/* Student List */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">학생 출석 현황</h4>
                      {session.attendance.students.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">아직 출석한 학생이 없습니다.</p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {session.attendance.students.map((student, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center space-x-3">
                                <div className="font-medium text-gray-900">{student.name}</div>
                                <div className="text-sm text-gray-500">({student.studentId})</div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {student.locationVerified && (
                                  <span className="text-success-600 text-xs">📍 위치인증</span>
                                )}
                                {student.checkInTime && (
                                  <span className="text-xs text-gray-500">
                                    {formatDateTime(student.checkInTime)}
                                  </span>
                                )}
                                {getStatusBadge(student.status)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Auto-refresh indicator */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            🔄 30초마다 자동 업데이트됩니다. 마지막 업데이트: {new Date().toLocaleTimeString('ko-KR')}
          </p>
        </div>
      </div>
    </div>
  )
}
