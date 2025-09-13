'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, LoadingPage } from '@/components/ui'

interface DashboardData {
  totalCourses: number
  activeSessionsCount: number
  courses: Array<{
    id: string
    name: string
    courseCode: string
    sessions: Array<{
      id: string
      date: string
      isActive: boolean
      attendance: {
        total: number
        present: number
        late: number
        absent: number
      }
    }>
  }>
  activeSessions: Array<{
    id: string
    courseName: string
    courseCode: string
    date: string
    attendance: {
      total: number
      present: number
      students: Array<{
        studentId: string
        name: string
        status: string
        checkInTime: string
        locationVerified: boolean
      }>
    }
  }>
}

interface Statistics {
  overview: {
    totalCourses: number
    totalSessions: number
    totalStudents: number
    overallAttendanceRate: number
  }
}

export default function ProfessorPage() {
  const { user, loading, signOut } = useAuth()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [courses, setCourses] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      if (!user || user.role !== 'professor' || loading) {
        return
      }

      try {
        setIsLoading(true)
        
        // Fetch dashboard data, statistics, and courses in parallel
        const [dashboardRes, statisticsRes, coursesRes] = await Promise.all([
          fetch('/api/attendance/professor/dashboard'),
          fetch('/api/attendance/professor/statistics'),
          fetch('/api/courses')
        ])

        if (dashboardRes.ok) {
          const dashboardResult = await dashboardRes.json()
          setDashboardData(dashboardResult.dashboard)
        }

        if (statisticsRes.ok) {
          const statisticsResult = await statisticsRes.json()
          setStatistics(statisticsResult.statistics)
        }

        if (coursesRes.ok) {
          const coursesResult = await coursesRes.json()
          setCourses(coursesResult.courses || [])
        }
      } catch (error: any) {
        console.error('Failed to fetch data:', error)
        setError('데이터를 불러오는데 실패했습니다.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [user, loading])

  if (loading || !user || user.role !== 'professor') {
    return <div className="min-h-screen bg-gray-50" />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">
                교수 대시보드
              </h1>
              <Badge variant="primary">관리</Badge>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">{user.name} 교수님</span>
              </div>
              <Button variant="ghost" size="sm" onClick={signOut}>
                로그아웃
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            안녕하세요, {user.name} 교수님! 👨‍🏫
          </h2>
          <p className="text-gray-600">
            강의를 관리하고 학생들의 출석 현황을 확인하세요.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="transition-all duration-200 hover:shadow-medium">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary-100 rounded-lg">
                  <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <CardTitle className="text-base">QR코드 생성</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm mb-4">
                수업용 QR코드를 생성하세요.
              </p>
              <Button size="sm" className="w-full" onClick={() => window.location.href = '/professor/qr'}>
                QR코드 생성
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-all duration-200 hover:shadow-medium">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-success-100 rounded-lg">
                  <svg className="w-6 h-6 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <CardTitle className="text-base">출석 현황</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm mb-4">
                실시간 출석 현황을 모니터링하세요.
              </p>
              <Button variant="secondary" size="sm" className="w-full" onClick={() => window.location.href = '/professor/dashboard'}>
                출석 현황 보기
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-all duration-200 hover:shadow-medium">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-warning-100 rounded-lg">
                  <svg className="w-6 h-6 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <CardTitle className="text-base">강의 관리</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm mb-4">
                강의실 설정과 강의를 관리하세요.
              </p>
              <Button variant="secondary" size="sm" className="w-full" onClick={() => window.location.href = '/professor/courses'}>
                강의 관리
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Current Session */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              현재 진행 중인 수업
            </h3>
            <Button size="sm" onClick={() => window.location.href = '/professor/qr'}>
              새 수업 시작
            </Button>
          </div>
          
          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">현재 세션을 확인 중...</p>
                </div>
              </CardContent>
            </Card>
          ) : dashboardData?.activeSessions && dashboardData.activeSessions.length > 0 ? (
            <div className="space-y-4">
              {dashboardData.activeSessions.map((session) => (
                <Card key={session.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="font-semibold text-lg">{session.courseName}</h4>
                          <Badge variant="success">진행 중</Badge>
                          <Badge variant="secondary">{session.courseCode}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">📅 {session.date}</p>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary-600">{session.attendance.total}</div>
                            <div className="text-xs text-gray-500">총 학생</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-success-600">{session.attendance.present}</div>
                            <div className="text-xs text-gray-500">출석</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-warning-600">
                              {session.attendance.total > 0 ? Math.round((session.attendance.present / session.attendance.total) * 100) : 0}%
                            </div>
                            <div className="text-xs text-gray-500">출석률</div>
                          </div>
                        </div>
                      </div>
                      <div className="ml-6">
                        <Button size="sm" onClick={() => window.location.href = `/professor/dashboard/${session.id}`}>
                          상세보기
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-gray-500 py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm">현재 진행 중인 수업이 없습니다.</p>
                  <p className="text-xs text-gray-400 mt-1">새 수업을 시작하거나 강의를 생성하세요.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* My Courses */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              내 강의 목록
            </h3>
            <Button variant="secondary" size="sm" onClick={() => window.location.href = '/professor/courses'}>
              강의 관리
            </Button>
          </div>
          
          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">강의 목록을 불러오는 중...</p>
                </div>
              </CardContent>
            </Card>
          ) : courses && courses.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-4">
              {courses.slice(0, 4).map((course) => (
                <Card key={course.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{course.name}</h4>
                      <Badge variant="secondary">{course.courseCode}</Badge>
                    </div>
                    {course.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{course.description}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>📍 {course.location || '위치 미설정'}</span>
                      <span>📊 {course.totalSessions || 0}개 세션</span>
                    </div>
                    <div className="mt-3 flex space-x-2">
                      <Button size="sm" className="flex-1" onClick={() => window.location.href = `/professor/courses/${course.id}`}>
                        상세보기
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => window.location.href = '/professor/qr'}>
                        QR생성
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-gray-500 py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <p className="text-sm">아직 등록된 강의가 없습니다.</p>
                  <p className="text-xs text-gray-400 mt-1">첫 번째 강의를 생성해보세요.</p>
                  <Button className="mt-4" size="sm" onClick={() => window.location.href = '/professor/courses'}>
                    새 강의 생성
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {courses.length > 4 && (
            <div className="mt-4 text-center">
              <Button variant="secondary" onClick={() => window.location.href = '/professor/courses'}>
                모든 강의 보기 ({courses.length}개)
              </Button>
            </div>
          )}
        </div>

        {/* Statistics */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              출석 통계
            </h3>
            <Button variant="secondary" size="sm" onClick={() => window.location.href = '/professor/statistics'}>
              상세 통계 보기
            </Button>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary-600 mb-1">
                  {isLoading ? '...' : (statistics?.overview.totalCourses || dashboardData?.totalCourses || 0)}
                </div>
                <div className="text-sm text-gray-600">총 강의수</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-success-600 mb-1">
                  {isLoading ? '...' : (statistics?.overview.totalStudents || 0)}
                </div>
                <div className="text-sm text-gray-600">등록 학생수</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-warning-600 mb-1">
                  {isLoading ? '...' : `${statistics?.overview.overallAttendanceRate || 0}%`}
                </div>
                <div className="text-sm text-gray-600">평균 출석률</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-gray-600 mb-1">
                  {isLoading ? '...' : (dashboardData?.activeSessions.reduce((total, session) => total + session.attendance.present, 0) || 0)}
                </div>
                <div className="text-sm text-gray-600">오늘 출석</div>
              </CardContent>
            </Card>
          </div>
        </div>
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-error-50 border border-error-200 rounded-md">
            <p className="text-error-700 text-sm">{error}</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setError('')}>
              닫기
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}