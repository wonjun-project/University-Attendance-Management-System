'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, LoadingPage } from '@/components/ui'

interface AttendanceRecord {
  id: string
  sessionId: string
  courseName: string
  courseCode: string
  sessionDate: string
  checkedInAt: string | null
  status: 'present' | 'late' | 'absent'
  locationVerified: boolean
}

export default function AttendanceStatusPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const fetchAttendanceRecords = async () => {
      // Only fetch if user is authenticated and is a student
      if (!user || user.role !== 'student' || loading) {
        return
      }

      try {
        setIsLoading(true)
        const response = await fetch('/api/attendance/student/records', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error('출석 기록을 가져오는데 실패했습니다.')
        }

        const data = await response.json()
        setAttendanceRecords(data.records || [])
      } catch (error: unknown) {
        console.error('Fetch attendance records error:', error)
        const message = error instanceof Error ? error.message : '출석 기록을 불러오는 중 오류가 발생했습니다.'
        setError(message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAttendanceRecords()
  }, [user, loading])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge variant="success">출석</Badge>
      case 'late':
        return <Badge variant="warning">지각</Badge>
      case 'absent':
        return <Badge variant="error">결석</Badge>
      default:
        return <Badge variant="secondary">미확인</Badge>
    }
  }

  const getStatusStats = () => {
    const total = attendanceRecords.length
    const present = attendanceRecords.filter(r => r.status === 'present').length
    const late = attendanceRecords.filter(r => r.status === 'late').length
    const absent = attendanceRecords.filter(r => r.status === 'absent').length
    
    return { total, present, late, absent }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const stats = getStatusStats()

  // Early returns after all hooks
  if (loading || !user || user.role !== 'student') {
    return <LoadingPage message="로딩 중..." />
  }

  if (isLoading) {
    return <LoadingPage message="출석 기록을 불러오는 중..." />
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
                출석 현황
              </h1>
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">{user.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-sm text-gray-600">전체 수업</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-success-600">{stats.present}</div>
                <div className="text-sm text-gray-600">출석</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-warning-600">{stats.late}</div>
                <div className="text-sm text-gray-600">지각</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-error-600">{stats.absent}</div>
                <div className="text-sm text-gray-600">결석</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Attendance Rate */}
        {stats.total > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>출석률</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">출석률</span>
                <span className="text-sm font-medium">
                  {((stats.present / stats.total) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-success-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(stats.present / stats.total) * 100}%` }}
                ></div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                <div className="text-center">
                  <div className="text-success-600 font-medium">{stats.present}회</div>
                  <div className="text-gray-500">출석</div>
                </div>
                <div className="text-center">
                  <div className="text-warning-600 font-medium">{stats.late}회</div>
                  <div className="text-gray-500">지각</div>
                </div>
                <div className="text-center">
                  <div className="text-error-600 font-medium">{stats.absent}회</div>
                  <div className="text-gray-500">결석</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Attendance Records */}
        <Card>
          <CardHeader>
            <CardTitle>출석 기록</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {attendanceRecords.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <p className="text-sm">아직 출석 기록이 없습니다.</p>
                <p className="text-xs text-gray-400 mt-1">첫 번째 출석을 체크해보세요!</p>
                <Button 
                  className="mt-4"
                  onClick={() => router.push('/student/scan')}
                >
                  QR코드 스캔하기
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {attendanceRecords.map((record) => (
                  <div key={record.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-medium text-gray-900">
                            {record.courseName}
                          </h3>
                          {getStatusBadge(record.status)}
                        </div>
                        <p className="text-sm text-gray-600 mb-1">
                          {record.courseCode} • {new Date(record.sessionDate).toLocaleDateString('ko-KR')}
                        </p>
                        {record.checkedInAt && (
                          <p className="text-xs text-gray-400">
                            체크인: {formatDate(record.checkedInAt)}
                          </p>
                        )}
                        {record.locationVerified && (
                          <p className="text-xs text-success-600 mt-1">
                            📍 위치 인증됨
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/student/attendance/${record.id}`)}
                        >
                          상세보기
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="mt-8 flex gap-4">
          <Button 
            onClick={() => router.push('/student/scan')}
            className="flex-1"
          >
            새 출석 체크
          </Button>
          <Button 
            variant="secondary"
            onClick={() => router.push('/student')}
            className="flex-1"
          >
            대시보드로 돌아가기
          </Button>
        </div>
      </div>
    </div>
  )
}
