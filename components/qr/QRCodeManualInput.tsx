'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui'
import { QRCodeGenerator, QRCodeData } from '@/lib/qr/qr-generator'

interface QRCodeManualInputProps {
  onScanSuccess: (qrData: QRCodeData) => void
  onScanError?: (error: string) => void
  onClose?: () => void
}

export function QRCodeManualInput({ onScanSuccess, onScanError, onClose }: QRCodeManualInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!inputValue.trim()) {
      setError('QR 코드 데이터를 입력해주세요')
      return
    }

    setProcessing(true)
    setError('')

    try {
      const raw = inputValue.trim()

      // 1) JSON 형식 시도
      let parsed = QRCodeGenerator.parseQRData(raw)

      // 2) JSON이 아니면 세션 ID로 처리
      if (!parsed) {
        let sessionId: string | null = null

        // URL에서 세션 ID 추출
        if (raw.startsWith('http://') || raw.startsWith('https://')) {
          try {
            const u = new URL(raw)
            const parts = u.pathname.split('/').filter(Boolean)
            sessionId = parts[parts.length - 1] || null
          } catch (e) {
            // URL 파싱 실패
          }
        } else if (raw.includes('session_')) {
          // session_으로 시작하는 부분 추출
          const match = raw.match(/session_[A-Za-z0-9_-]+/)
          sessionId = match ? match[0] : null
        } else {
          // 입력값 자체를 세션 ID로 사용
          sessionId = raw
        }

        if (!sessionId) {
          throw new Error('유효하지 않은 QR 코드 형식입니다')
        }

        // 세션 정보 조회
        const resp = await fetch(`/api/sessions/${sessionId}`)
        const data = await resp.json()

        if (!resp.ok) {
          throw new Error(data?.error || '세션 정보를 가져올 수 없습니다')
        }

        const s = data.session
        parsed = {
          sessionId: s.id,
          courseId: s.courseId || s.course_id || '',
          expiresAt: s.expiresAt || s.qrCodeExpiresAt || s.qr_code_expires_at || new Date(Date.now() + 25 * 60 * 1000).toISOString(),
          type: 'attendance' as const,
        }
      }

      // 만료 확인
      if (QRCodeGenerator.isExpired(parsed)) {
        throw new Error('QR코드가 만료되었습니다. 교수님께 새로운 QR코드를 요청하세요.')
      }

      // 성공
      onScanSuccess(parsed)
    } catch (err: any) {
      const errorMessage = err.message || 'QR 코드 처리 중 오류가 발생했습니다'
      setError(errorMessage)
      onScanError?.(errorMessage)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>수동 QR 입력</CardTitle>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-4">
                카메라를 사용할 수 없는 경우, QR 코드에 표시된 텍스트나 세션 ID를 직접 입력할 수 있습니다.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-blue-800">
                  <strong>💡 입력 방법:</strong><br />
                  1. QR 코드 아래 표시된 세션 ID (예: session_1234...)<br />
                  2. 교수님이 제공한 세션 코드<br />
                  3. QR 코드 전체 데이터
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <Input
              type="text"
              placeholder="세션 ID 또는 QR 데이터 입력"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={processing}
              className="font-mono text-sm"
              autoComplete="off"
            />

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={processing || !inputValue.trim()}
                className="flex-1"
              >
                {processing ? '처리 중...' : '확인'}
              </Button>
              {onClose && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  disabled={processing}
                >
                  취소
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}