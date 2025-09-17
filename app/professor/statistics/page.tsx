'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui'

interface CourseStatistics {
  courseId: string
  courseName: string
  courseCode: string
  totalSessions: number
  totalStudents: number
  totalAttendance: number
  presentCount: number
  attendanceRate: number
}

interface StudentStatistics {
  studentId: string
  name: string
  total: number
  present: number
  late: number
  absent: number
  attendanceRate: number
}

interface TimePattern {
  byHour: { hour: number; count: number }[]
  byDayOfWeek: { day: string; dayNumber: number; count: number }[]
}

interface StatisticsData {
  overview: {
    totalCourses: number
    totalSessions: number
    totalStudents: number
    overallAttendanceRate: number
  }
  courseStats: CourseStatistics[]
  studentStats: StudentStatistics[]
  timePatterns: TimePattern
  trends: {
    attendanceByDate: Array<{
      date: string
      attendanceRate: number
      totalStudents: number
      presentStudents: number
    }>
    attendanceRateByWeek: Array<{
      weekStart: string
      attendanceRate: number
      totalStudents: number
      presentStudents: number
    }>
  }
}

export default function ProfessorStatisticsPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [statistics, setStatistics] = useState<StatisticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('month')
  const [selectedCourse, setSelectedCourse] = useState<string>('all')

  useEffect(() => {
    const fetchStatistics = async () => {
      if (!user || user.role !== 'professor' || loading) {
        return
      }

      try {
        setIsLoading(true)
        const params = new URLSearchParams()
        if (selectedPeriod !== 'all') {
          params.append('period', selectedPeriod)
        }
        if (selectedCourse !== 'all') {
          params.append('courseId', selectedCourse)
        }

        const response = await fetch(`/api/attendance/professor/statistics?${params}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error('통계 데이터를 가져오는데 실패했습니다.')
        }

        const data = await response.json()
        setStatistics(data.statistics)
      } catch (error: unknown) {
        console.error('Fetch statistics error:', error)
        const message = error instanceof Error ? error.message : '통계를 불러오는 중 오류가 발생했습니다.'
        setError(message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStatistics()
  }, [user, loading, selectedPeriod, selectedCourse])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric'
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
          <p className="text-gray-600">통계 데이터를 불러오는 중...</p>
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
                출석 통계 분석
              </h1>
              <Badge variant="primary">상세 분석</Badge>
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">{user.name} 교수님</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">기간</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="all">전체 기간</option>
              <option value="week">최근 1주일</option>
              <option value="month">최근 1개월</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">강의</label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="all">전체 강의</option>
              {statistics?.courseStats.map(course => (
                <option key={course.courseId} value={course.courseId}>
                  {course.courseName} ({course.courseCode})
                </option>
              ))}
            </select>
          </div>
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
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overview Statistics */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-primary-100 rounded-lg">
                  <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">{statistics?.overview.totalCourses || 0}</div>
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">{statistics?.overview.totalStudents || 0}</div>
                  <div className="text-sm text-gray-600">등록 학생수</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-warning-100 rounded-lg">
                  <svg className="w-8 h-8 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">{statistics?.overview.overallAttendanceRate || 0}%</div>
                  <div className="text-sm text-gray-600">전체 출석률</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-info-100 rounded-lg">
                  <svg className="w-8 h-8 text-info-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">{statistics?.overview.totalSessions || 0}</div>
                  <div className="text-sm text-gray-600">총 수업 세션</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Course Statistics */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>강의별 출석 현황</CardTitle>
          </CardHeader>
          <CardContent>
            {!statistics?.courseStats.length ? (
              <div className="text-center text-gray-500 py-8">
                <p>출석 데이터가 없습니다.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">강의명</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">총 세션</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">학생수</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">총 출석</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">출석률</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {statistics.courseStats.map(course => (
                      <tr key={course.courseId}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{course.courseName}</div>
                          <div className="text-sm text-gray-500">{course.courseCode}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {course.totalSessions}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {course.totalStudents}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {course.presentCount} / {course.totalAttendance}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  course.attendanceRate >= 80 ? 'bg-success-500' :
                                  course.attendanceRate >= 60 ? 'bg-warning-500' : 'bg-error-500'
                                }`}
                                style={{ width: `${course.attendanceRate}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-900">
                              {course.attendanceRate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Time Patterns */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>요일별 출석 패턴</CardTitle>
            </CardHeader>
            <CardContent>
              {!statistics?.timePatterns.byDayOfWeek.length ? (
                <div className="text-center text-gray-500 py-8">
                  <p>패턴 데이터가 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {statistics.timePatterns.byDayOfWeek.map(day => (
                    <div key={day.dayNumber} className="flex items-center">
                      <div className="w-16 text-sm font-medium text-gray-600">{day.day}</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-2 mx-3">
                        <div 
                          className="bg-primary-500 h-2 rounded-full"
                          style={{ 
                            width: `${statistics.timePatterns.byDayOfWeek.length > 0 
                              ? (day.count / Math.max(...statistics.timePatterns.byDayOfWeek.map(d => d.count))) * 100 
                              : 0}%` 
                          }}
                        ></div>
                      </div>
                      <div className="w-12 text-right text-sm text-gray-600">{day.count}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>출석률 추이</CardTitle>
            </CardHeader>
            <CardContent>
              {!statistics?.trends.attendanceByDate.length ? (
                <div className="text-center text-gray-500 py-8">
                  <p>추이 데이터가 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {statistics.trends.attendanceByDate.slice(-10).map((entry, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">{formatDate(entry.date)}</div>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              entry.attendanceRate >= 80 ? 'bg-success-500' :
                              entry.attendanceRate >= 60 ? 'bg-warning-500' : 'bg-error-500'
                            }`}
                            style={{ width: `${entry.attendanceRate}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-10 text-right">
                          {entry.attendanceRate}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Students */}
        <Card>
          <CardHeader>
            <CardTitle>학생별 출석률 순위</CardTitle>
          </CardHeader>
          <CardContent>
            {!statistics?.studentStats.length ? (
              <div className="text-center text-gray-500 py-8">
                <p>학생 데이터가 없습니다.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">순위</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">학생명</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">출석</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">지각</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">결석</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">출석률</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {statistics.studentStats.slice(0, 10).map((student, index) => (
                      <tr key={student.studentId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{student.name}</div>
                          <div className="text-sm text-gray-500">({student.studentId})</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-success-600 font-medium">
                          {student.present}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-warning-600 font-medium">
                          {student.late}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-error-600 font-medium">
                          {student.absent}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  student.attendanceRate >= 80 ? 'bg-success-500' :
                                  student.attendanceRate >= 60 ? 'bg-warning-500' : 'bg-error-500'
                                }`}
                                style={{ width: `${student.attendanceRate}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-900">
                              {student.attendanceRate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
