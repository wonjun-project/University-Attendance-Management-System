'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'
import { QRCodeDisplay } from '@/components/qr'
import LocationSelector, { type LocationData } from '@/components/location/LocationSelector'
import { QRCodeData } from '@/lib/qr/qr-generator'

interface Course { id: string; name: string; courseCode: string }

export default function QRCodePage() {
  const { user, loading, signOut } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [qrData, setQrData] = useState<QRCodeData | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [locationData, setLocationData] = useState<LocationData | null>(null)

  useEffect(() => {
    const fetchCourses = async () => {
      if (!user || user.role !== 'professor' || loading) return
      try {
        const res = await fetch('/api/courses')
        if (res.ok) {
          const data = await res.json()
          setCourses(data.courses || [])
        }
      } catch (e) {
        console.error('Failed to fetch courses:', e)
        setError('강의 목록을 불러오는데 실패했습니다.')
      }
    }
    fetchCourses()
  }, [user, loading])

  const generateQRCode = async () => {
    if (!locationData) {
      setError('먼저 강의실 위치를 설정해주세요.')
      return
    }
    setIsGenerating(true)
    setError('')
    try {
      const response = await fetch('/api/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          courseId: selectedCourse || `demo-course-${user?.id}`,
          expiresInMinutes: 30,
          classroomLocation: {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            radius: locationData.radius,
            locationType: locationData.locationType,
            predefinedLocationId: locationData.predefinedLocationId ?? null,
            displayName: locationData.displayName ?? undefined
          }
        })
      })
      const raw = await response.text()
      if (!raw) {
        throw new Error(`서버 응답이 비어 있습니다. 상태코드: ${response.status}. 환경변수 및 권한 설정을 확인하세요.`)
      }
      let result:
        | { success: true; qrData: QRCodeData; qrCode: string; expiresAt: string }
        | { error: string }
      try {
        result = JSON.parse(raw)
      } catch {
        throw new Error(`서버 응답을 파싱하지 못했습니다. 상태코드: ${response.status}. 콘솔/함수 로그를 확인하세요.`)
      }
      if (!response.ok || 'error' in result) {
        throw new Error(('error' in result && result.error) || 'QR코드 생성에 실패했습니다.')
      }
      setQrData(result.qrData)
    } catch (error: unknown) {
      console.error('QR generation error:', error)
      const message = error instanceof Error ? error.message : 'QR코드 생성 중 오류가 발생했습니다.'
      setError(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRefreshQR = () => generateQRCode()
  const handleExpiredQR = () => {
    setQrData(null)
    setError('QR코드가 만료되었습니다. 새로 생성해주세요.')
  }

  const handleEndSession = async () => {
    if (!qrData?.sessionId) {
      setError('세션 ID를 찾을 수 없습니다.')
      return
    }

    try {
      console.log('🏁 수업 종료 시작:', qrData.sessionId)

      const response = await fetch(`/api/sessions/${qrData.sessionId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '수업 종료에 실패했습니다.')
      }

      const result = await response.json()
      console.log('✅ 수업 종료 성공:', result)

      // 성공 메시지 표시
      alert(`수업이 성공적으로 종료되었습니다!\n\n📊 출석 통계:\n- 전체 학생: ${result.statistics.total}명\n- 출석: ${result.statistics.present}명\n- 지각: ${result.statistics.late}명\n- 결석: ${result.statistics.absent}명\n- 조퇴: ${result.statistics.left_early}명\n- 출석률: ${result.statistics.attendance_rate}`)

    } catch (error) {
      console.error('❌ 수업 종료 실패:', error)
      const message = error instanceof Error ? error.message : '수업 종료 중 오류가 발생했습니다.'
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
              <Link href="/professor" className="text-gray-400 hover:text-gray-600">← 대시보드</Link>
              <h1 className="text-xl font-semibold text-gray-900">강의 시작</h1>
              <Badge variant="primary">출석 관리</Badge>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600"><span className="font-medium">{user.name} 교수님</span></div>
              <Button variant="ghost" size="sm" onClick={signOut}>로그아웃</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-error-50 border border-error-200 rounded-lg">
            <p className="text-error-800">{error}</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setError('')}>닫기</Button>
          </div>
        )}

        {!qrData && (
          <div className="max-w-3xl mx-auto mb-8">
            <LocationSelector value={locationData} onChange={setLocationData} />
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="flex justify-center">
            {qrData ? (
              <QRCodeDisplay
                qrData={qrData}
                onRefresh={handleRefreshQR}
                onExpire={handleExpiredQR}
                onEndSession={handleEndSession}
              />
            ) : (
              <Card className="w-full max-w-md">
                <CardContent className="p-8">
                  <div className="text-center space-y-6">
                    <div className="w-32 h-32 bg-primary-100 rounded-full flex items-center justify-center mx-auto">
                      <svg className="w-16 h-16 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M19 10a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">강의 시작</h2>
                      <p className="text-gray-600">수업용 QR코드를 생성하세요.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">강의 선택(선택)</label>
                      <select
                        value={selectedCourse}
                        onChange={(e) => setSelectedCourse(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="">데모 강의 생성</option>
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.name} ({course.courseCode})
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      onClick={generateQRCode}
                      loading={isGenerating}
                      disabled={isGenerating || !locationData}
                      className="w-full"
                    >
                      {isGenerating ? '강의 시작 중...' : !locationData ? '위치를 먼저 설정하세요' : '강의 시작'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>강의 진행 방법</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-gray-600">
                <p>1. 강의실 위치를 설정합니다(현재 위치 또는 미리 정의된 강의실).</p>
                <p>2. 강의 시작 버튼을 눌러 출석용 QR코드를 생성합니다.</p>
                <p>3. 학생들은 QR을 스캔하고 GPS 검증을 통과하면 출석 처리됩니다.</p>
                <p>4. QR코드는 기본 30분 후 만료됩니다.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
