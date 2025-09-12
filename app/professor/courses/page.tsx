'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'
import LocationSelector, { LocationData } from '@/components/location/LocationSelector'

interface Course {
  id: string
  name: string
  courseCode: string
  description?: string
  schedule?: string
  location?: string
  locationLatitude?: number
  locationLongitude?: number
  locationRadius?: number
  createdAt: string
  totalSessions: number
  activeSessions: number
}

export default function ProfessorCoursesPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [showCreateForm, setShowCreateForm] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    schedule: '',
    location: ''
  })
  const [locationData, setLocationData] = useState<LocationData | null>(null)

  useEffect(() => {
    const fetchCourses = async () => {
      if (!user || user.role !== 'professor' || loading) {
        return
      }

      try {
        setIsLoading(true)
        const response = await fetch('/api/courses', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error('강의 목록을 가져오는데 실패했습니다.')
        }

        const data = await response.json()
        setCourses(data.courses || [])
      } catch (error: any) {
        console.error('Fetch courses error:', error)
        setError(error.message || '강의 목록을 불러오는 중 오류가 발생했습니다.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchCourses()
  }, [user, loading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      setError('강의명은 필수입니다.')
      return
    }

    if (!locationData) {
      setError('강의실 위치를 설정해주세요.')
      return
    }

    try {
      setIsLoading(true)
      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          schedule: formData.schedule.trim() || null,
          location: locationData?.displayName || formData.location.trim() || null,
          locationLatitude: locationData?.latitude || null,
          locationLongitude: locationData?.longitude || null,
          locationRadius: locationData?.radius || 50
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '강의 생성에 실패했습니다.')
      }

      const data = await response.json()
      setCourses(prev => [...prev, {
        id: data.course.id,
        name: data.course.name,
        courseCode: data.course.courseCode || '',
        description: data.course.description,
        schedule: data.course.schedule,
        location: data.course.location,
        locationLatitude: data.course.locationLatitude,
        locationLongitude: data.course.locationLongitude,
        locationRadius: data.course.locationRadius,
        createdAt: data.course.createdAt,
        totalSessions: 0,
        activeSessions: 0
      }])

      // Reset form
      setFormData({
        name: '',
        description: '',
        schedule: '',
        location: ''
      })
      setLocationData(null)
      setShowCreateForm(false)
      setError('')
    } catch (error: any) {
      console.error('Create course error:', error)
      setError(error.message || '강의 생성 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (courseId: string, courseName: string) => {
    if (!confirm(`"${courseName}" 강의를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      return
    }

    try {
      const response = await fetch(`/api/courses/${courseId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '강의 삭제에 실패했습니다.')
      }

      setCourses(prev => prev.filter(course => course.id !== courseId))
    } catch (error: any) {
      console.error('Delete course error:', error)
      setError(error.message || '강의 삭제 중 오류가 발생했습니다.')
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
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
                강의 관리
              </h1>
              <Badge variant="primary">관리</Badge>
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">{user.name} 교수님</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Actions */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            내 강의 목록 ({courses.length})
          </h2>
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? '취소' : '새 강의 생성'}
          </Button>
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

        {/* Create Form */}
        {showCreateForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>새 강의 생성</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    강의명 *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    placeholder="예: 컴퓨터과학개론"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    강의 설명
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    rows={3}
                    placeholder="강의에 대한 간단한 설명을 입력하세요"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    수업 일정
                  </label>
                  <input
                    type="text"
                    value={formData.schedule}
                    onChange={(e) => setFormData(prev => ({ ...prev, schedule: e.target.value }))}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    placeholder="예: 화/목 09:00-10:30"
                  />
                </div>

                {/* Location Selector - Same as QR Generation Page */}
                <LocationSelector
                  value={locationData}
                  onChange={(data) => {
                    console.log('Location data changed:', data)
                    setLocationData(data)
                  }}
                  disabled={isLoading}
                />

                <div className="flex space-x-3 pt-4">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? '생성 중...' : '강의 생성'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setShowCreateForm(false)}>
                    취소
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && !showCreateForm && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">강의 목록을 불러오는 중...</p>
          </div>
        )}

        {/* Courses List */}
        {!isLoading && courses.length === 0 ? (
          <Card>
            <CardContent className="p-12">
              <div className="text-center text-gray-500">
                <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">아직 강의가 없습니다</h3>
                <p className="text-sm text-gray-500 mb-4">첫 번째 강의를 생성해보세요.</p>
                <Button onClick={() => setShowCreateForm(true)}>
                  새 강의 생성
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {courses.map((course) => (
              <Card key={course.id} className="transition-all duration-200 hover:shadow-lg">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <CardTitle className="text-lg">{course.name}</CardTitle>
                        <Badge variant="secondary">{course.courseCode}</Badge>
                        {course.activeSessions > 0 && (
                          <Badge variant="success">진행중</Badge>
                        )}
                      </div>
                      {course.description && (
                        <p className="text-sm text-gray-600 mb-2">{course.description}</p>
                      )}
                      <div className="text-sm text-gray-500 space-y-1">
                        {course.schedule && (
                          <p>📅 {course.schedule}</p>
                        )}
                        {course.location && (
                          <p>📍 {course.location}</p>
                        )}
                        {course.locationLatitude && course.locationLongitude && (
                          <p>🎯 GPS: {course.locationLatitude.toFixed(6)}, {course.locationLongitude.toFixed(6)} (반경 {course.locationRadius}m)</p>
                        )}
                        <p>📊 총 {course.totalSessions}개 세션</p>
                        <p>📅 생성일: {formatDate(course.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2">
                      <Button
                        size="sm"
                        onClick={() => router.push(`/professor/courses/${course.id}`)}
                      >
                        상세보기
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => router.push(`/professor/courses/${course.id}/edit`)}
                      >
                        편집
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(course.id, course.name)}
                      >
                        삭제
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}