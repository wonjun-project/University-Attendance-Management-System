'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'

interface AttendanceDetail {
  id: string
  sessionId: string
  courseName: string
  courseCode: string
  sessionDate: string
  startTime?: string
  endTime?: string
  checkedInAt: string | null
  status: 'present' | 'late' | 'absent'
  locationVerified: boolean
  studentLocation?: {
    latitude: number
    longitude: number
    accuracy: number
    timestamp: string
  }
  classroomLocation?: {
    latitude: number
    longitude: number
    radius: number
    address: string
  }
  distance?: number
}

export default function AttendanceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user, loading } = useAuth()
  const [attendanceDetail, setAttendanceDetail] = useState<AttendanceDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')


  useEffect(() => {
    const fetchAttendanceDetail = async () => {
      if (!user || user.role !== 'student' || loading || !params?.id) {
        return
      }

      try {
        setIsLoading(true)
        // For now, we'll simulate data since we don't have the detailed API yet
        // In a real implementation, this would fetch from `/api/attendance/student/${params?.id}`
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Mock data for demonstration
        const mockDetail: AttendanceDetail = {
          id: params?.id as string,
          sessionId: 'session-123',
          courseName: '컴퓨터과학개론',
          courseCode: 'CS101',
          sessionDate: '2025-09-11',
          startTime: '09:00',
          endTime: '10:30',
          checkedInAt: '2025-09-11T09:05:30Z',
          status: 'present',
          locationVerified: true,
          studentLocation: {
            latitude: 37.5665,
            longitude: 126.9780,
            accuracy: 15,
            timestamp: '2025-09-11T09:05:25Z'
          },
          classroomLocation: {
            latitude: 37.5665,
            longitude: 126.9780,
            radius: 50,
            address: '공학관 201호'
          },
          distance: 12.5
        }
        
        setAttendanceDetail(mockDetail)
      } catch (error: any) {
        console.error('Fetch attendance detail error:', error)
        setError(error.message || '출석 상세 정보를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchAttendanceDetail()
  }, [user, loading, params?.id])

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'text-success-600'
      case 'late':
        return 'text-warning-600'
      case 'absent':
        return 'text-error-600'
      default:
        return 'text-gray-600'
    }
  }

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString)
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short'
    })
  }

  const formatTime = (timeString?: string) => {
    return timeString?.slice(0, 5) // HH:MM format
  }

  if (loading || !user || user.role !== 'student') {
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
          <p className="text-gray-600">출석 상세 정보를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error || !attendanceDetail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
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
                <h1 className="text-xl font-semibold text-gray-900">출석 상세</h1>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-error-600">
                <svg className="mx-auto h-12 w-12 text-error-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm">{error || '출석 정보를 찾을 수 없습니다.'}</p>
                <Button className="mt-4" onClick={() => router.back()}>
                  돌아가기
                </Button>
              </div>
            </CardContent>
          </Card>
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
                출석 상세
              </h1>
              {getStatusBadge(attendanceDetail.status)}
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">{user.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Course Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>강의 정보</span>
              <span className={`text-lg font-bold ${getStatusColor(attendanceDetail.status)}`}>
                {attendanceDetail.status === 'present' && '✅ 출석'}
                {attendanceDetail.status === 'late' && '⚠️ 지각'}
                {attendanceDetail.status === 'absent' && '❌ 결석'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">강의명</label>
                <p className="text-lg font-semibold text-gray-900">{attendanceDetail.courseName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">강의코드</label>
                <p className="text-lg font-semibold text-gray-900">{attendanceDetail.courseCode}</p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">수업 날짜</label>
                <p className="font-medium text-gray-900">{formatDate(attendanceDetail.sessionDate)}</p>
              </div>
              {attendanceDetail.startTime && attendanceDetail.endTime && (
                <div>
                  <label className="text-sm font-medium text-gray-500">수업 시간</label>
                  <p className="font-medium text-gray-900">
                    {formatTime(attendanceDetail.startTime)} - {formatTime(attendanceDetail.endTime)}
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-500">위치 인증</label>
                <div className="flex items-center space-x-2">
                  {attendanceDetail.locationVerified ? (
                    <>
                      <span className="text-success-600">✅</span>
                      <span className="text-success-600 font-medium">인증됨</span>
                    </>
                  ) : (
                    <>
                      <span className="text-error-600">❌</span>
                      <span className="text-error-600 font-medium">인증 실패</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>출석 세부 정보</CardTitle>
          </CardHeader>
          <CardContent>
            {attendanceDetail.checkedInAt ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">체크인 시간</label>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatDateTime(attendanceDetail.checkedInAt)}
                  </p>
                </div>
                
                {attendanceDetail.studentLocation && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">체크인 위치</label>
                    <div className="bg-gray-50 p-4 rounded-lg mt-2">
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">위도:</span> {attendanceDetail.studentLocation.latitude.toFixed(6)}
                        </div>
                        <div>
                          <span className="font-medium">경도:</span> {attendanceDetail.studentLocation.longitude.toFixed(6)}
                        </div>
                        <div>
                          <span className="font-medium">정확도:</span> ±{attendanceDetail.studentLocation.accuracy}m
                        </div>
                        <div>
                          <span className="font-medium">측정 시간:</span> {formatDateTime(attendanceDetail.studentLocation.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {attendanceDetail.classroomLocation && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">강의실 위치</label>
                    <div className="bg-blue-50 p-4 rounded-lg mt-2">
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">주소:</span> {attendanceDetail.classroomLocation.address}
                        </div>
                        <div>
                          <span className="font-medium">허용 반경:</span> {attendanceDetail.classroomLocation.radius}m
                        </div>
                        <div>
                          <span className="font-medium">강의실 위도:</span> {attendanceDetail.classroomLocation.latitude.toFixed(6)}
                        </div>
                        <div>
                          <span className="font-medium">강의실 경도:</span> {attendanceDetail.classroomLocation.longitude.toFixed(6)}
                        </div>
                      </div>
                      
                      {attendanceDetail.distance !== undefined && (
                        <div className="mt-3 pt-3 border-t border-blue-200">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">실제 거리:</span>
                            <span className={`font-bold ${
                              attendanceDetail.distance <= attendanceDetail.classroomLocation.radius 
                                ? 'text-success-600' 
                                : 'text-error-600'
                            }`}>
                              {attendanceDetail.distance.toFixed(1)}m
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium">출석 체크를 하지 않았습니다.</p>
                <p className="text-xs text-gray-400 mt-1">이 수업에서는 출석 체크인이 이루어지지 않았습니다.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button onClick={() => router.push('/student/attendance')} className="flex-1">
            출석 목록으로 돌아가기
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