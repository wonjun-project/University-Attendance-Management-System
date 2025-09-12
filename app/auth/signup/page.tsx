'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui'
import { useAuth } from '@/lib/auth-context'

export default function SignupPage() {
  const router = useRouter()
  const { refreshUser } = useAuth()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    studentId: '',
    professorId: '',
    userType: 'student' as 'student' | 'professor'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const validateForm = () => {
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return false
    }
    
    if (formData.password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.')
      return false
    }

    if (formData.userType === 'student' && !formData.studentId) {
      setError('학번을 입력해주세요.')
      return false
    }

    if (formData.userType === 'student' && !/^\d{9}$/.test(formData.studentId)) {
      setError('학번은 9자리 숫자여야 합니다. (예: 202012345)')
      return false
    }

    if (formData.userType === 'professor' && !formData.professorId) {
      setError('교수번호를 입력해주세요.')
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!validateForm()) {
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          userType: formData.userType,
          studentId: formData.userType === 'student' ? formData.studentId : undefined,
          professorId: formData.userType === 'professor' ? formData.professorId : undefined,
          password: formData.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || '회원가입에 실패했습니다.')
        return
      }

      console.log('Signup successful, user type:', data.user?.type)

      // Refresh auth context after successful signup
      await refreshUser()

      // Redirect to appropriate dashboard
      if (data.user?.type === 'student') {
        console.log('Redirecting to /student')
        router.push('/student')
      } else if (data.user?.type === 'professor') {
        console.log('Redirecting to /professor')  
        router.push('/professor')
      } else {
        console.log('Unknown user type, redirecting to login')
        router.push('/auth/login?message=회원가입이 완료되었습니다. 로그인해주세요.')
      }
    } catch (error) {
      console.error('Signup error:', error)
      setError('회원가입 중 오류가 발생했습니다.')
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
            새 계정을 생성하세요
          </p>
        </div>

        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle className="text-center">회원가입</CardTitle>
          </CardHeader>
          <CardContent>
            {/* User Type Tabs */}
            <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-gray-100 rounded-lg">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, userType: 'student' }))}
                className={`py-2 px-4 text-sm font-medium rounded-md transition-all ${
                  formData.userType === 'student'
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                학생
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, userType: 'professor' }))}
                className={`py-2 px-4 text-sm font-medium rounded-md transition-all ${
                  formData.userType === 'professor'
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

              <Input
                label="이름"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="홍길동"
                required
              />

              {formData.userType === 'student' ? (
                <Input
                  label="학번"
                  type="text"
                  value={formData.studentId}
                  onChange={(e) => setFormData(prev => ({ ...prev, studentId: e.target.value }))}
                  placeholder="202012345"
                  helperText="9자리 학번만 입력하세요"
                  required
                />
              ) : (
                <Input
                  label="교수번호"
                  type="text"
                  value={formData.professorId}
                  onChange={(e) => setFormData(prev => ({ ...prev, professorId: e.target.value }))}
                  placeholder="PROF001"
                  helperText="교수번호를 입력하세요"
                  required
                />
              )}

              <Input
                label="비밀번호"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="최소 6자 이상"
                helperText="최소 6자 이상 입력하세요"
                required
              />

              <Input
                label="비밀번호 확인"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="비밀번호를 다시 입력하세요"
                required
              />

              <Button
                type="submit"
                className="w-full"
                loading={loading}
                disabled={loading}
              >
                회원가입
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                이미 계정이 있으신가요?{' '}
                <Link 
                  href="/auth/login" 
                  className="font-medium text-primary-600 hover:text-primary-500 transition-colors"
                >
                  로그인
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}