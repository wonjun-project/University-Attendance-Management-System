'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui'
import { useAuth } from '@/lib/auth-context'

export default function LoginPage() {
  const router = useRouter()
  const { refreshUser } = useAuth()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    studentId: '',
    professorId: '',
    loginType: 'student' as 'student' | 'professor'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: formData.loginType === 'student' ? formData.studentId : formData.professorId,
          password: formData.password,
          userType: formData.loginType,
        }),
      })

      const data = await response.json()

      console.log('Login response:', { ok: response.ok, status: response.status, data })

      if (!response.ok) {
        console.log('Login failed:', data)
        setError(data.error || '로그인에 실패했습니다.')
        return
      }

      console.log('Login successful, user type:', data.user?.type)

      // Refresh auth context before redirecting
      console.log('Refreshing user context...')
      await refreshUser()
      console.log('User context refreshed successfully')

      // Wait a bit more to ensure auth context is fully updated
      await new Promise(resolve => setTimeout(resolve, 500))

      // Redirect based on user type
      if (data.user?.type === 'student') {
        console.log('Redirecting to /student')
        window.location.href = '/student'
      } else if (data.user?.type === 'professor') {
        console.log('Redirecting to /professor')
        window.location.href = '/professor'
      } else {
        console.log('Unknown user type:', data.user?.type)
        setError('사용자 타입을 알 수 없습니다.')
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('로그인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            출석 관리 시스템
          </h1>
          <p className="text-gray-600">
            계정에 로그인하세요
          </p>
        </div>

        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle className="text-center">로그인</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Login Type Tabs */}
            <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-gray-100 rounded-lg">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, loginType: 'student' }))}
                className={`py-2 px-4 text-sm font-medium rounded-md transition-all ${
                  formData.loginType === 'student'
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                학생
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, loginType: 'professor' }))}
                className={`py-2 px-4 text-sm font-medium rounded-md transition-all ${
                  formData.loginType === 'professor'
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                교수
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-error-50 border border-error-200 text-error-800 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {formData.loginType === 'student' ? (
                <Input
                  label="학번"
                  type="text"
                  value={formData.studentId}
                  onChange={(e) => setFormData(prev => ({ ...prev, studentId: e.target.value }))}
                  placeholder="202012345"
                  required
                />
              ) : (
                <Input
                  label="교수번호"
                  type="text"
                  value={formData.professorId}
                  onChange={(e) => setFormData(prev => ({ ...prev, professorId: e.target.value }))}
                  placeholder="PROF001"
                  required
                />
              )}

              <Input
                label="비밀번호"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="비밀번호를 입력하세요"
                required
              />

              <Button
                type="submit"
                className="w-full"
                loading={loading}
                disabled={loading}
              >
                로그인
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                계정이 없으신가요?{' '}
                <Link 
                  href="/auth/signup" 
                  className="font-medium text-primary-600 hover:text-primary-500 transition-colors"
                >
                  회원가입
                </Link>
              </p>
            </div>

            <div className="mt-4 text-center">
              <Link
                href="/"
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                ← 홈으로 돌아가기
              </Link>
            </div>

            {/* 테스트 계정 정보 */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-800 mb-3">🧪 테스트 계정</h3>
              <div className="space-y-2 text-xs text-blue-700">
                <div>
                  <span className="font-medium">👨‍🎓 학생:</span>
                  <div className="ml-2">
                    학번: <code className="bg-blue-100 px-1 rounded">stu001</code><br/>
                    비밀번호: <code className="bg-blue-100 px-1 rounded">password123</code>
                  </div>
                </div>
                <div className="border-t border-blue-200 pt-2">
                  <span className="font-medium">👨‍🏫 교수:</span>
                  <div className="ml-2">
                    교수번호: <code className="bg-blue-100 px-1 rounded">prof001</code><br/>
                    비밀번호: <code className="bg-blue-100 px-1 rounded">password123</code>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}