'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui'
import { QRCodeGenerator, QRCodeData } from '@/lib/qr/qr-generator'

interface QRCodeDisplayProps {
  qrData: QRCodeData
  onRefresh?: () => void
  onExpire?: () => void
  onEndSession?: () => void
}

export function QRCodeDisplay({ qrData, onRefresh, onExpire, onEndSession }: QRCodeDisplayProps) {
  const [qrCodeImage, setQrCodeImage] = useState<string>('')
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [isEndingSession, setIsEndingSession] = useState(false)
  const [sessionEnded, setSessionEnded] = useState(false)

  // Generate QR code image
  useEffect(() => {
    const generateQRCode = async () => {
      try {
        setLoading(true)
        setError('')
        const dataURL = await QRCodeGenerator.generateDataURL(qrData, {
          width: 300,
          color: {
            dark: '#0369a1',
            light: '#ffffff'
          }
        })
        setQrCodeImage(dataURL)
      } catch {
        setError('QR코드 생성에 실패했습니다.')
      } finally {
        setLoading(false)
      }
    }

    generateQRCode()
  }, [qrData])

  // Update countdown timer
  useEffect(() => {
    const updateTimer = () => {
      const remaining = QRCodeGenerator.getTimeRemaining(qrData)
      setTimeRemaining(remaining)
      
      if (remaining <= 0 && onExpire) {
        onExpire()
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [qrData, onExpire])

  const isExpired = QRCodeGenerator.isExpired(qrData)
  const timeRemainingText = QRCodeGenerator.formatTimeRemaining(timeRemaining)

  // 수업 종료 핸들러
  const handleEndSession = async () => {
    if (!onEndSession || isEndingSession) return;

    try {
      setIsEndingSession(true);

      // 확인 다이얼로그
      const confirmed = window.confirm(
        '수업을 종료하시겠습니까?\n\n종료 후:\n- 모든 학생의 GPS 추적이 중지됩니다\n- QR코드가 비활성화됩니다\n- 출석 상태가 최종 확정됩니다'
      );

      if (confirmed) {
        await onEndSession();
        setSessionEnded(true);
      }
    } catch (error) {
      console.error('수업 종료 중 오류:', error);
      alert('수업 종료 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsEndingSession(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-64 h-64 bg-gray-100 rounded-lg animate-pulse"></div>
            <div className="text-center">
              <p className="text-sm text-gray-500">QR코드 생성 중...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <div className="text-center">
            <div className="w-64 h-64 bg-error-50 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-12 h-12 text-error-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-error-600 mb-4">{error}</p>
            {onRefresh && (
              <Button size="sm" onClick={onRefresh}>
                다시 시도
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {sessionEnded ? '수업 종료됨' : '출석 QR코드'}
          </CardTitle>
          <Badge
            variant={sessionEnded ? "default" : isExpired ? "error" : timeRemaining < 300000 ? "warning" : "success"}
          >
            {sessionEnded ? '종료됨' : isExpired ? '만료됨' : timeRemainingText}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex flex-col items-center space-y-4">
          {/* QR Code */}
          <div className={`p-4 bg-white rounded-xl border-2 ${
            sessionEnded ? 'border-gray-300 opacity-30' :
            isExpired ? 'border-error-200 opacity-50' : 'border-gray-200'
          }`}>
            {sessionEnded ? (
              <div className="w-64 h-64 bg-gray-50 rounded-lg flex flex-col items-center justify-center">
                <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500 text-sm font-medium">수업이 종료되었습니다</p>
                <p className="text-gray-400 text-xs mt-1">QR코드가 비활성화됨</p>
              </div>
            ) : (
              <Image
                src={qrCodeImage}
                alt="출석 QR코드"
                width={256}
                height={256}
                unoptimized
                className="w-64 h-64"
              />
            )}
          </div>

          {/* Instructions */}
          <div className="text-center space-y-2">
            {sessionEnded ? (
              <>
                <p className="text-sm font-medium text-gray-700">
                  수업이 종료되었습니다
                </p>
                <p className="text-xs text-gray-500">
                  모든 학생의 GPS 추적이 중지되고 출석 상태가 확정되었습니다
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-900">
                  학생들에게 이 QR코드를 보여주세요
                </p>
                <p className="text-xs text-gray-500">
                  QR코드를 스캔하면 자동으로 출석 페이지로 이동합니다
                </p>
              </>
            )}
          </div>

          {/* Status and Actions */}
          {sessionEnded ? (
            <div className="text-center space-y-3 w-full">
              <div className="text-xs text-gray-400">
                세션 ID: {qrData.sessionId.slice(0, 8)}...
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700 font-medium">
                  ✅ 수업이 성공적으로 종료되었습니다
                </p>
              </div>
            </div>
          ) : isExpired ? (
            <div className="text-center space-y-3 w-full">
              <p className="text-sm text-error-600">
                QR코드가 만료되었습니다
              </p>
              <div className="space-y-2">
                {onRefresh && (
                  <Button className="w-full" onClick={onRefresh}>
                    새 QR코드 생성
                  </Button>
                )}
                {onEndSession && (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={handleEndSession}
                    disabled={isEndingSession}
                  >
                    {isEndingSession ? '수업 종료 중...' : '수업 종료'}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center space-y-3 w-full">
              <div className="text-xs text-gray-400">
                QR코드 ID: {qrData.sessionId.slice(0, 8)}...
              </div>
              <div className="space-y-2">
                {onRefresh && (
                  <Button variant="secondary" size="sm" className="w-full" onClick={onRefresh}>
                    새로고침
                  </Button>
                )}
                {onEndSession && (
                  <Button
                    variant="danger"
                    size="sm"
                    className="w-full"
                    onClick={handleEndSession}
                    disabled={isEndingSession}
                  >
                    {isEndingSession ? '수업 종료 중...' : '🏁 수업 종료'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
