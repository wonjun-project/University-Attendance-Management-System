'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'
import Link from 'next/link'

interface Course {
  id: string
  name: string
  courseCode: string
  location?: string
}

interface QRSession {
  id: string
  courseId: string
  courseName: string
  courseCode: string
  qrCode: string
  expiresAt: string
  isActive: boolean
  createdAt: string
}

export default function QRCodePage() {
  const { user, loading, signOut } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<string>('')
  const [activeSession, setActiveSession] = useState<QRSession | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchCourses = async () => {
      if (!user || user.role !== 'professor' || loading) {
        return
      }

      try {
        const response = await fetch('/api/courses')
        if (response.ok) {
          const data = await response.json()
          setCourses(data.courses || [])
        }
      } catch (error) {
        console.error('Failed to fetch courses:', error)
        setError('강의 목록을 불러오는데 실패했습니다.')
      }
    }

    fetchCourses()
  }, [user, loading])

  const generateQRCode = async () => {
    if (!selectedCourse) {
      setError('강의를 선택해주세요.')
      return
    }

    setIsGenerating(true)
    setError('')

    try {
      const response = await fetch('/api/sessions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId: selectedCourse
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'QR코드 생성에 실패했습니다.')
      }

      setActiveSession(data.session)
    } catch (error: any) {
      console.error('QR code generation error:', error)
      setError(error.message || 'QR코드 생성 중 오류가 발생했습니다.')
    } finally {
      setIsGenerating(false)
    }
  }

  const endSession = async () => {
    if (!activeSession) return

    try {
      const response = await fetch(`/api/sessions/${activeSession.id}/end`, {
        method: 'POST',
      })

      if (response.ok) {
        setActiveSession(null)
        setSelectedCourse('')
      }
    } catch (error) {
      console.error('Failed to end session:', error)
      setError('세션 종료에 실패했습니다.')
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
                QR코드 생성
              </h1>
              <Badge variant="primary">출석 관리</Badge>
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-error-50 border border-error-200 rounded-lg">
            <p className="text-error-800">{error}</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setError('')}>
              닫기
            </Button>
          </div>
        )}

        {!activeSession ? (
          /* QR 생성 폼 */
          <Card>
            <CardHeader>
              <CardTitle>새 출석 세션 시작</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    강의 선택
                  </label>
                  <select
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">강의를 선택하세요</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.name} ({course.courseCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={generateQRCode}
                    disabled={isGenerating || !selectedCourse}
                    className="w-full"
                    loading={isGenerating}
                  >
                    {isGenerating ? 'QR코드 생성 중...' : 'QR코드 생성 및 세션 시작'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* 활성 세션 표시 */
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{activeSession.courseName}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      {activeSession.courseCode} • 세션 ID: {activeSession.id}
                    </p>
                  </div>
                  <Badge variant="success">진행 중</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="bg-white p-8 rounded-lg shadow-inner inline-block">
                    <div
                      className="qr-code-container"
                      dangerouslySetInnerHTML={{
                        __html: `<div style="display: flex; justify-content: center; align-items: center; min-height: 200px; background: white; border: 1px solid #e5e7eb; border-radius: 8px;"><p style="color: #6b7280;">QR코드가 여기에 표시됩니다</p></div>`
                      }}
                    />
                    <p className="text-sm text-gray-600 mt-4">
                      만료 시간: {new Date(activeSession.expiresAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-center space-x-4">
                  <Button variant="secondary" onClick={() => window.location.href = `/professor/dashboard/${activeSession.id}`}>
                    실시간 출석 현황
                  </Button>
                  <Button variant="danger" onClick={endSession}>
                    세션 종료
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>사용 안내</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-start space-x-2">
                    <span className="text-primary-600 font-semibold">1.</span>
                    <p>학생들이 QR코드를 스캔하여 출석을 체크할 수 있습니다.</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-primary-600 font-semibold">2.</span>
                    <p>QR코드는 30분 후 자동으로 만료됩니다.</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-primary-600 font-semibold">3.</span>
                    <p>실시간 출석 현황에서 학생들의 출석 상태를 확인할 수 있습니다.</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-primary-600 font-semibold">4.</span>
                    <p>수업이 끝나면 '세션 종료' 버튼을 클릭해주세요.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}