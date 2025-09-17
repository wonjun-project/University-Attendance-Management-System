'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'
import Link from 'next/link'

interface Course {
  id: string
  name: string
  courseCode: string
  description?: string
  location?: string
  totalSessions: number
}

export default function CoursesPage() {
  const { user, loading, signOut } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    courseCode: '',
    description: '',
    location: ''
  })

  useEffect(() => {
    const fetchCourses = async () => {
      if (!user || user.role !== 'professor' || loading) {
        return
      }

      try {
        setIsLoading(true)
        const response = await fetch('/api/courses')
        if (response.ok) {
          const data = (await response.json()) as { courses?: Course[] }
          setCourses(data.courses ?? [])
        } else {
          setError('강의 목록을 불러오는데 실패했습니다.')
        }
      } catch (error: unknown) {
        console.error('Failed to fetch courses:', error)
        setError('강의 목록을 불러오는데 실패했습니다.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchCourses()
  }, [user, loading])

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.courseCode) {
      setError('강의명과 강의코드는 필수입니다.')
      return
    }

    try {
      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = (await response.json()) as { course: Course; error?: string }

      if (!response.ok) {
        throw new Error(data.error || '강의 생성에 실패했습니다.')
      }

      // 새 강의를 목록에 추가
      setCourses(prev => [...prev, data.course])

      // 폼 초기화
      setFormData({ name: '', courseCode: '', description: '', location: '' })
      setShowCreateForm(false)
      setError('')

    } catch (error: unknown) {
      console.error('Course creation error:', error)
      const message = error instanceof Error ? error.message : '강의 생성 중 오류가 발생했습니다.'
      setError(message)
    }
  }

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
              <Link href="/professor" className="text-gray-400 hover:text-gray-600">
                ← 대시보드
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">
                강의 관리
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
        {error && (
          <div className="mb-6 p-4 bg-error-50 border border-error-200 rounded-lg">
            <p className="text-error-800">{error}</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setError('')}>
              닫기
            </Button>
          </div>
        )}

        {/* Header Actions */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">내 강의 목록</h2>
            <p className="text-gray-600 mt-1">강의를 생성하고 관리하세요.</p>
          </div>
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? '취소' : '새 강의 생성'}
          </Button>
        </div>

        {/* Create Course Form */}
        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>새 강의 생성</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCourse} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      강의명 *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="예: 웹 프로그래밍"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      강의코드 *
                    </label>
                    <input
                      type="text"
                      value={formData.courseCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, courseCode: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="예: WEB301"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    강의 설명
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="강의에 대한 간단한 설명을 입력하세요"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    강의실 위치
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="예: 제1자연관 501호"
                  />
                </div>
                <div className="flex space-x-3">
                  <Button type="submit">강의 생성</Button>
                  <Button type="button" variant="secondary" onClick={() => setShowCreateForm(false)}>
                    취소
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Courses List */}
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">강의 목록을 불러오는 중...</p>
          </div>
        ) : courses.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Card key={course.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-lg">{course.name}</h3>
                    <Badge variant="secondary">{course.courseCode}</Badge>
                  </div>

                  {course.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {course.description}
                    </p>
                  )}

                  <div className="space-y-2 text-sm text-gray-500 mb-4">
                    <div className="flex items-center">
                      <span>📍 {course.location || '위치 미설정'}</span>
                    </div>
                    <div className="flex items-center">
                      <span>📊 {course.totalSessions}개 세션</span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => window.location.href = `/professor/courses/${course.id}`}
                    >
                      상세보기
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => window.location.href = '/professor/qr'}
                    >
                      QR생성
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-gray-500">
                <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <h3 className="text-lg font-semibold mb-2">강의가 없습니다</h3>
                <p className="text-sm text-gray-600 mb-4">첫 번째 강의를 생성해보세요.</p>
                <Button onClick={() => setShowCreateForm(true)}>
                  새 강의 생성
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
