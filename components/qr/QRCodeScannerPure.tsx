'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'
import { QRCodeGenerator, QRCodeData } from '@/lib/qr/qr-generator'

interface QRCodeScannerPureProps {
  onScanSuccess: (qrData: QRCodeData) => void
  onScanError?: (error: string) => void
  onClose?: () => void
}

type ScannerStatus = 'requesting_permission' | 'starting_camera' | 'camera_active' | 'scanning' | 'error' | 'permission_denied'

export function QRCodeScannerPure({ onScanSuccess, onScanError, onClose }: QRCodeScannerPureProps) {
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const [status, setStatus] = useState<ScannerStatus>('requesting_permission')
  const [error, setError] = useState<string>('')
  const [debugLogs, setDebugLogs] = useState<string[]>([])
  
  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const logMessage = `${timestamp}: ${message}`
    setDebugLogs(prev => [...prev.slice(-4), logMessage])
    console.log('[QR Scanner Pure]', message)
  }, [])

  const startCamera = useCallback(async () => {
    addLog('Requesting camera permission...')
    setStatus('requesting_permission')
    setError('')

    try {
      // Step 1: Check if element exists
      const element = document.getElementById('qr-reader-pure')
      if (!element) {
        throw new Error('QR reader element not found')
      }

      // Step 2: Request camera permission manually
      addLog('Testing camera access...')
      let stream: MediaStream
      try {
        // Try with back camera first
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        })
        addLog('Back camera access granted')
      } catch {
        addLog('Back camera not available, trying front camera...')
        try {
          // Fallback to any camera
          stream = await navigator.mediaDevices.getUserMedia({ video: true })
          addLog('Front camera access granted')
        } catch (frontCameraError: unknown) {
          const name = frontCameraError instanceof DOMException ? frontCameraError.name : 'UnknownError'
          addLog(`Camera access denied: ${name}`)
          if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
            setStatus('permission_denied')
            setError('카메라 접근 권한이 필요합니다. 브라우저에서 카메라를 허용해주세요.')
            return
          } else {
            throw frontCameraError
          }
        }
      }

      // Stop test stream
      stream.getTracks().forEach(track => track.stop())
      
      // Step 3: Initialize Html5Qrcode
      addLog('Initializing QR scanner...')
      setStatus('starting_camera')
      
      const html5QrCode = new Html5Qrcode('qr-reader-pure')
      html5QrCodeRef.current = html5QrCode

      // Step 4: Start scanning with optimized config
      const qrCodeSuccessCallback = (decodedText: string) => {
        addLog(`QR detected: ${decodedText.substring(0, 30)}...`)
        
        try {
          // Parse and validate QR data
          const qrData = QRCodeGenerator.parseQRData(decodedText)
          
          if (!qrData) {
            const errorMsg = '유효하지 않은 QR코드입니다.'
            setError(errorMsg)
            onScanError?.(errorMsg)
            return
          }

          if (QRCodeGenerator.isExpired(qrData)) {
            const errorMsg = 'QR코드가 만료되었습니다. 교수님께 새로운 QR코드를 요청하세요.'
            setError(errorMsg)
            onScanError?.(errorMsg)
            return
          }

          // Success - stop camera and callback
          addLog('QR validation successful!')
          
          // Vibration feedback
          if (navigator.vibrate) {
            navigator.vibrate(200)
          }
          
          // Stop camera before calling success
          html5QrCode.stop().then(() => {
            setStatus('scanning')
            onScanSuccess(qrData)
          }).catch(console.error)
          
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'unknown'
          addLog(`QR processing error: ${message}`)
          const errorMsg = 'QR코드 처리 중 오류가 발생했습니다.'
          setError(errorMsg)
          onScanError?.(errorMsg)
        }
      }

      const qrCodeErrorCallback = (errorMessage: string) => {
        // Only log significant errors, ignore scanning noise
        if (errorMessage && !errorMessage.includes('NotFound') && !errorMessage.includes('No MultiFormat')) {
          console.log('QR scan error (ignored):', errorMessage)
        }
      }

      // Configuration for optimal scanning
      const config = {
        fps: 10,    // 10 FPS for good performance
        qrbox: { width: 250, height: 250 },  // QR box size
        aspectRatio: 1.0,
        disableFlip: false,
        videoConstraints: {
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 }
        }
      }

      // Camera constraints with fallback
      const cameraConstraints = { 
        facingMode: 'environment',
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 480, ideal: 720, max: 1080 }
      }

      // Start camera
      await html5QrCode.start(
        cameraConstraints, // Camera constraints  
        config, // Scanning config
        qrCodeSuccessCallback,
        qrCodeErrorCallback
      )

      addLog('Camera started successfully!')
      
      // Force video element styling after camera start
      setTimeout(() => {
        const videoElement = document.querySelector('#qr-reader-pure video') as HTMLVideoElement
        if (videoElement) {
          addLog('Video element found, applying styles...')
          videoElement.style.width = '100%'
          videoElement.style.height = 'auto'
          videoElement.style.maxHeight = '400px'
          videoElement.style.display = 'block'
          videoElement.style.visibility = 'visible'
          videoElement.style.objectFit = 'cover'
          videoElement.style.borderRadius = '8px'
          videoElement.style.minHeight = '200px'
          
          // Force container styling too
          const container = document.getElementById('qr-reader-pure')
          if (container) {
            container.style.minHeight = '300px'
            container.style.background = '#000'
            container.style.borderRadius = '8px'
            addLog('Container and video styling applied successfully')
          }
        } else {
          addLog('Video element not found in DOM')
        }
      }, 1000)
      
      setStatus('camera_active')

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown'
      addLog(`Camera initialization failed: ${message}`)
      setStatus('error')
      setError(`카메라 시작 실패: ${message}`)
    }
  }, [addLog, onScanSuccess, onScanError])

  const stopCamera = useCallback(() => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().then(() => {
        addLog('Camera stopped')
        html5QrCodeRef.current = null
      }).catch((err) => {
        addLog(`Camera stop error: ${err}`)
        html5QrCodeRef.current = null
      })
    }
  }, [addLog])

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

  // Initialize on mount
  useEffect(() => {
    let mounted = true
    
    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      if (mounted) {
        startCamera()
      }
    }, 500)

    return () => {
      mounted = false
      clearTimeout(timeoutId)
      stopCamera()
    }
  }, [startCamera, stopCamera])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-2 sm:p-4">
      <Card className="w-full max-w-sm sm:max-w-md h-full sm:h-auto flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg sm:text-xl">
              📱 QR 스캔 (순수)
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
          {/* Camera Container - Always rendered */}
          <div 
            id="qr-reader-pure" 
            className={`w-full rounded-lg overflow-hidden bg-black ${
              status === 'camera_active' ? 'block' : 'hidden'
            }`}
            style={{ minHeight: '300px', maxHeight: '400px' }}
          />

          {/* Permission Request State */}
          {status === 'requesting_permission' && (
            <div className="text-center space-y-4 h-full flex flex-col justify-center">
              <div className="w-48 h-48 sm:w-64 sm:h-64 bg-blue-100 rounded-lg flex items-center justify-center mx-auto">
                <svg className="w-12 h-12 sm:w-16 sm:h-16 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-blue-600 mb-4">
                  📷 카메라 권한을 확인하는 중...
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
                  💡 QR코드가 화면 가운데 오도록 맞춰주세요
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
