'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import jsQR from 'jsqr'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'
import { QRCodeGenerator, QRCodeData } from '@/lib/qr/qr-generator'

interface QRCodeScannerNativeProps {
  onScanSuccess: (qrData: QRCodeData) => void
  onScanError?: (error: string) => void
  onClose?: () => void
}

type ScannerStatus = 'requesting_permission' | 'starting_camera' | 'camera_active' | 'scanning' | 'error' | 'permission_denied'

export function QRCodeScannerNative({ onScanSuccess, onScanError, onClose }: QRCodeScannerNativeProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  const [status, setStatus] = useState<ScannerStatus>('requesting_permission')
  const [error, setError] = useState<string>('')
  const [debugLogs, setDebugLogs] = useState<string[]>([])
  
  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const logMessage = `${timestamp}: ${message}`
    setDebugLogs(prev => [...prev.slice(-4), logMessage])
    console.log('[QR Scanner Native]', message)
  }, [])

  const stopCamera = useCallback(() => {
    addLog('Stopping camera...')
    
    // Clear scan interval
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    
    // Stop video stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    
    addLog('Camera stopped successfully')
  }, [addLog])

  const scanQRCode = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) return

    // Set canvas size to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    // Get image data for QR scanning
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    
    // Scan for QR code
    const qrCode = jsQR(imageData.data, imageData.width, imageData.height)
    
    if (qrCode) {
      const raw = qrCode.data?.trim() || ''
      addLog(`QR code detected: ${raw.substring(0, 60)}...`)

      try {
        // 1) 우선 JSON 기반 포맷 시도
        let parsed = QRCodeGenerator.parseQRData(raw)

        // 2) JSON이 아니면 URL/텍스트 폴백 파싱
        if (!parsed) {
          addLog('QR is not JSON. Trying URL/text fallback...')

          let sessionId: string | null = null
          try {
            if (raw.startsWith('http://') || raw.startsWith('https://')) {
              const u = new URL(raw)
              const parts = u.pathname.split('/').filter(Boolean)
              // 예상 패턴: /student/attendance/<sessionId>
              sessionId = parts[parts.length - 1] || null
            } else {
              // session_ 으로 시작하는 단순 문자열 처리
              const match = raw.match(/session_[A-Za-z0-9_-]+/)
              sessionId = match ? match[0] : null
            }
          } catch (e) {
            // URL 파싱 실패는 무시
          }

          if (!sessionId) {
            const errorMsg = '유효하지 않은 QR코드 형식입니다.'
            setError(errorMsg)
            onScanError?.(errorMsg)
            return
          }

          // 세션 정보를 서버에서 조회하여 표준 형태로 구성
          addLog(`Fetching session info for ${sessionId} ...`)
          const resp = await fetch(`/api/sessions/${sessionId}`)
          const data = await resp.json()

          if (!resp.ok) {
            const msg = data?.error || '세션 정보를 가져올 수 없습니다.'
            setError(msg)
            onScanError?.(msg)
            return
          }

          const s = data.session
          parsed = {
            sessionId: s.id,
            courseId: s.courseId || s.course_id || '',
            expiresAt: s.expiresAt || s.qr_code_expires_at || new Date(Date.now() + 25 * 60 * 1000).toISOString(),
            type: 'attendance' as const,
          }
        }

        // 만료 여부 확인
        if (QRCodeGenerator.isExpired(parsed)) {
          const errorMsg = 'QR코드가 만료되었습니다. 교수님께 새로운 QR코드를 요청하세요.'
          setError(errorMsg)
          onScanError?.(errorMsg)
          return
        }

        // 성공 처리
        addLog('QR validation successful!')
        if (navigator.vibrate) navigator.vibrate(200)
        stopCamera()
        setStatus('scanning')
        onScanSuccess(parsed)

      } catch (error: any) {
        addLog(`QR processing error: ${error.message}`)
        const errorMsg = 'QR코드 처리 중 오류가 발생했습니다.'
        setError(errorMsg)
        onScanError?.(errorMsg)
      }
    }
  }, [addLog, onScanSuccess, onScanError, stopCamera])

  const startCamera = useCallback(async () => {
    addLog('Starting camera initialization...')
    setStatus('requesting_permission')
    setError('')

    try {
      // Request camera permission and stream with timeout
      addLog('Requesting camera access...')
      addLog('⚠️ 브라우저 권한 대화상자에서 "허용"을 클릭하세요!')
      
      let stream: MediaStream
      
      const requestCameraWithTimeout = (constraints: MediaStreamConstraints, timeoutMs: number = 15000): Promise<MediaStream> => {
        return Promise.race([
          navigator.mediaDevices.getUserMedia(constraints),
          new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error('TIMEOUT: 카메라 권한 요청 시간이 초과되었습니다'))
            }, timeoutMs)
          })
        ])
      }
      
      try {
        // Try back camera first (better for QR scanning)
        addLog('🎥 후면 카메라로 시도 중...')
        stream = await requestCameraWithTimeout({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        })
        addLog('✅ 후면 카메라 접근 허용됨')
      } catch (backCameraError: any) {
        addLog(`후면 카메라 실패: ${backCameraError.message}`)
        
        if (backCameraError.message?.includes('TIMEOUT')) {
          setStatus('permission_denied')
          setError('카메라 권한 요청 시간이 초과되었습니다. 브라우저 주소창의 카메라 아이콘을 클릭하여 권한을 허용하거나 새로고침 후 다시 시도하세요.')
          return
        }
        
        try {
          // Fallback to any available camera
          addLog('📱 전면 카메라로 시도 중...')
          stream = await requestCameraWithTimeout({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          })
          addLog('✅ 전면 카메라 접근 허용됨')
        } catch (frontCameraError: any) {
          addLog(`전면 카메라 실패: ${frontCameraError.name || frontCameraError.message}`)
          
          if (frontCameraError.message?.includes('TIMEOUT')) {
            setStatus('permission_denied')
            setError('카메라 권한 요청 시간이 초과되었습니다. 브라우저 주소창의 카메라 아이콘을 클릭하여 권한을 허용하거나 새로고침 후 다시 시도하세요.')
            return
          }
          
          if (frontCameraError.name === 'NotAllowedError' || frontCameraError.name === 'PermissionDeniedError') {
            setStatus('permission_denied')
            setError('카메라 접근 권한이 필요합니다. 브라우저에서 카메라를 허용해주세요.')
            return
          } else {
            throw frontCameraError
          }
        }
      }

      // Set up video element
      addLog('Setting up video element...')
      setStatus('starting_camera')
      
      // Wait for video element to be available
      let video = videoRef.current
      let attempts = 0
      while (!video && attempts < 10) {
        addLog(`Waiting for video element... attempt ${attempts + 1}`)
        await new Promise(resolve => setTimeout(resolve, 100))
        video = videoRef.current
        attempts++
      }
      
      if (!video) {
        throw new Error('Video element not found after waiting')
      }
      
      addLog('Video element found successfully')

      // Store stream reference for cleanup
      streamRef.current = stream
      
      // Set video source to camera stream
      video.srcObject = stream
      
      // Wait for video to be ready
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
          video.play()
            .then(resolve)
            .catch(reject)
        }
        video.onerror = reject
      })

      addLog('Video stream started successfully!')
      setStatus('camera_active')

      // Start QR code scanning loop
      addLog('Starting QR code scanning...')
      scanIntervalRef.current = setInterval(scanQRCode, 100) // Scan every 100ms
      
    } catch (error: any) {
      addLog(`Camera initialization failed: ${error.message}`)
      setStatus('error')
      setError(`카메라 시작 실패: ${error.message}`)
    }
  }, [addLog, scanQRCode])

  const handleRetry = useCallback(() => {
    addLog('Retrying camera initialization...')
    setError('')
    setDebugLogs([])
    
    stopCamera()
    
    // Wait a moment then retry
    setTimeout(() => {
      startCamera()
    }, 1000)
  }, [addLog, stopCamera, startCamera])

  // Initialize camera on mount
  useEffect(() => {
    let mounted = true
    
    // Longer delay to ensure DOM is fully ready
    const timeoutId = setTimeout(() => {
      if (mounted) {
        addLog('Initializing camera after DOM ready...')
        startCamera()
      }
    }, 1000)

    return () => {
      mounted = false
      clearTimeout(timeoutId)
      stopCamera()
    }
  }, [startCamera, stopCamera, addLog])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-2 sm:p-4">
      <Card className="w-full max-w-sm sm:max-w-md h-full sm:h-auto flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg sm:text-xl">
              📱 QR 스캔 (네이티브)
            </CardTitle>
            {onClose && (
              <button 
                onClick={() => {
                  stopCamera()
                  onClose()
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 -mr-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="p-4 sm:p-6 flex-1 overflow-hidden">
          {/* Video Container - Always rendered but hidden when not active */}
          <div 
            className={`relative w-full rounded-lg overflow-hidden bg-black ${
              status === 'camera_active' ? 'block' : 'hidden'
            }`} 
            style={{ minHeight: '300px', maxHeight: '400px' }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ 
                display: 'block',
                minHeight: '200px',
                maxHeight: '400px'
              }}
            />
            {/* QR Scanning Box Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-64 h-64 border-2 border-white rounded-lg border-dashed opacity-50"></div>
            </div>
          </div>

          {/* Hidden canvas for QR processing */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Permission Request State */}
          {status === 'requesting_permission' && (
            <div className="text-center space-y-4 h-full flex flex-col justify-center">
              <div className="w-48 h-48 sm:w-64 sm:h-64 bg-blue-100 rounded-lg flex items-center justify-center mx-auto relative">
                <svg className="w-12 h-12 sm:w-16 sm:h-16 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {/* Animated pulse */}
                <div className="absolute inset-0 border-2 border-blue-300 rounded-lg animate-pulse"></div>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-600 mb-2">
                  📷 카메라 권한 요청 중...
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-yellow-800 font-medium mb-1">
                    ⚠️ 브라우저 권한 대화상자가 나타났습니다!
                  </p>
                  <p className="text-xs text-yellow-700">
                    주소창 근처의 카메라 권한 요청에서 <strong>&ldquo;허용&rdquo;</strong>을 클릭하세요.
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">
                    15초 후 자동으로 시간초과됩니다.
                  </p>
                </div>
                
                {/* Debug logs */}
                {debugLogs.length > 0 && (
                  <div className="bg-gray-50 rounded p-2 text-xs text-left max-h-24 overflow-y-auto">
                    {debugLogs.map((log, index) => (
                      <div key={index} className="text-gray-600">{log}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Starting Camera State */}
          {status === 'starting_camera' && (
            <div className="text-center space-y-4 h-full flex flex-col justify-center">
              <div className="w-48 h-48 sm:w-64 sm:h-64 bg-gray-100 rounded-lg flex items-center justify-center mx-auto">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  📹 카메라를 시작하는 중...
                </p>
                
                {/* Debug logs */}
                {debugLogs.length > 0 && (
                  <div className="bg-gray-50 rounded p-2 text-xs text-left max-h-24 overflow-y-auto">
                    {debugLogs.map((log, index) => (
                      <div key={index} className="text-gray-600">{log}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Permission Denied State */}
          {status === 'permission_denied' && (
            <div className="text-center space-y-4 h-full flex flex-col justify-center">
              <div className="w-48 h-48 sm:w-64 sm:h-64 bg-red-100 rounded-lg flex items-center justify-center mx-auto">
                <svg className="w-12 h-12 sm:w-16 sm:h-16 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-red-600 mb-4">
                  🚫 카메라 접근 권한이 거부되었습니다
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  브라우저 주소창 옆의 카메라 아이콘을 클릭해서 권한을 허용해주세요.
                </p>
                <div className="space-y-2">
                  <Button onClick={handleRetry} className="w-full py-3">
                    🔄 권한 다시 요청
                  </Button>
                  {onClose && (
                    <Button variant="secondary" onClick={() => {
                      stopCamera()
                      onClose()
                    }} className="w-full py-3">
                      취소
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="text-center space-y-4 h-full flex flex-col justify-center">
              <div className="w-48 h-48 sm:w-64 sm:h-64 bg-red-50 rounded-lg flex items-center justify-center mx-auto">
                <svg className="w-12 h-12 sm:w-16 sm:h-16 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-red-600 mb-4">{error}</p>
                <div className="space-y-2">
                  <Button onClick={handleRetry} className="w-full py-3">
                    🔄 다시 시도
                  </Button>
                  {onClose && (
                    <Button variant="secondary" onClick={() => {
                      stopCamera()
                      onClose()
                    }} className="w-full py-3">
                      취소
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Camera Active State UI */}
          {status === 'camera_active' && (
            <div className="mt-4 text-center bg-green-50 rounded-lg p-4">
              <div className="mb-3">
                <p className="text-sm font-medium text-green-700 mb-1">
                  ✅ 카메라 활성화됨! QR코드를 비춰주세요
                </p>
                <p className="text-xs text-green-600 mb-2">
                  💡 QR코드가 화면 가운데 점선 박스 안에 오도록 맞춰주세요
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={handleRetry} className="py-3">
                  🔄 다시 시작
                </Button>
                {onClose && (
                  <Button variant="secondary" onClick={() => {
                    stopCamera()
                    onClose()
                  }} className="py-3">
                    ❌ 취소
                  </Button>
                )}
              </div>

              {/* Debug logs for active state */}
              {debugLogs.length > 0 && (
                <div className="mt-3 bg-white rounded p-2 text-xs text-left max-h-20 overflow-y-auto">
                  {debugLogs.map((log, index) => (
                    <div key={index} className="text-gray-600">{log}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
