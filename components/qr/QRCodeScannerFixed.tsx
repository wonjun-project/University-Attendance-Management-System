'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'
import { QRCodeGenerator, QRCodeData } from '@/lib/qr/qr-generator'

interface QRCodeScannerFixedProps {
  onScanSuccess: (qrData: QRCodeData) => void
  onScanError?: (error: string) => void
  onClose?: () => void
}

type ScannerStatus = 'loading' | 'ready' | 'scanning' | 'error' | 'permission_denied'

export function QRCodeScannerFixed({ onScanSuccess, onScanError, onClose }: QRCodeScannerFixedProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const [status, setStatus] = useState<ScannerStatus>('loading')
  const [error, setError] = useState<string>('')
  const [debugLogs, setDebugLogs] = useState<string[]>([])
  
  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const logMessage = `${timestamp}: ${message}`
    setDebugLogs(prev => [...prev.slice(-3), logMessage])
    console.log('[QR Scanner Fixed]', message)
  }, [])

  const initializeScanner = useCallback(async () => {
    addLog('Starting camera initialization...')
    setStatus('loading')
    setError('')

    try {
      // Check if element exists
      const element = document.getElementById('qr-reader-fixed')
      if (!element) {
        throw new Error('QR reader element not found')
      }
      
      addLog('DOM element found, checking camera permissions...')

      // Test camera access first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        })
        addLog('Camera permission granted')
        stream.getTracks().forEach(track => track.stop())
      } catch (permError: any) {
        addLog(`Permission error: ${permError.name}`)
        if (permError.name === 'NotAllowedError' || permError.name === 'PermissionDeniedError') {
          setStatus('permission_denied')
          setError('카메라 접근 권한이 필요합니다. 브라우저 설정에서 카메라를 허용해주세요.')
          return
        } else if (permError.name === 'NotFoundError') {
          setError('카메라를 찾을 수 없습니다.')
          setStatus('error')
          return
        } else {
          // Try with basic video constraints
          try {
            const basicStream = await navigator.mediaDevices.getUserMedia({ video: true })
            addLog('Camera accessible with basic settings')
            basicStream.getTracks().forEach(track => track.stop())
          } catch {
            setError('카메라에 접근할 수 없습니다.')
            setStatus('error')
            return
          }
        }
      }

      addLog('Initializing Html5QrcodeScanner...')

      // Create scanner with optimal settings
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false
      }

      const scanner = new Html5QrcodeScanner('qr-reader-fixed', config, false)
      scannerRef.current = scanner

      const onScanSuccessHandler = (decodedText: string) => {
        addLog(`QR code detected: ${decodedText.substring(0, 30)}...`)
        
        try {
          // Parse QR data
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

          // Success - stop scanner and callback
          addLog('QR code validation successful!')
          scanner.clear().catch(console.error)
          setStatus('ready')
          
          // Vibration feedback
          if (navigator.vibrate) {
            navigator.vibrate(200)
          }
          
          onScanSuccess(qrData)
        } catch (error: any) {
          addLog(`QR processing error: ${error.message}`)
          const errorMsg = 'QR코드 처리 중 오류가 발생했습니다.'
          setError(errorMsg)
          onScanError?.(errorMsg)
        }
      }

      const onScanErrorHandler = (errorMessage: string) => {
        // Ignore common scanning errors that are expected during scanning
        if (!errorMessage.includes('NotFound')) {
          console.log('Scan error (ignored):', errorMessage)
        }
      }

      // Start scanner
      await scanner.render(onScanSuccessHandler, onScanErrorHandler)
      addLog('Scanner initialized successfully!')
      setStatus('scanning')

    } catch (error: any) {
      addLog(`Scanner initialization failed: ${error.message}`)
      setError(`카메라 초기화 실패: ${error.message}`)
      setStatus('error')
    }
  }, [addLog, onScanSuccess, onScanError])

  const handleRetry = useCallback(() => {
    addLog('Retrying scanner initialization...')
    setError('')
    setDebugLogs([])
    
    // Clear existing scanner
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error)
      scannerRef.current = null
    }
    
    // Wait a moment then retry
    setTimeout(() => {
      initializeScanner()
    }, 500)
  }, [initializeScanner])

  const handlePermissionRetry = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach(track => track.stop())
      
      setStatus('loading')
      setError('')
      initializeScanner()
    } catch (error: any) {
      setError('카메라 접근이 여전히 거부되었습니다. 브라우저 설정을 확인해주세요.')
    }
  }, [initializeScanner])

  // Initialize scanner on mount
  useEffect(() => {
    let mounted = true
    
    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      if (mounted) {
        initializeScanner()
      }
    }, 100)

    return () => {
      mounted = false
      clearTimeout(timeoutId)
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error)
      }
    }
  }, [initializeScanner])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-2 sm:p-4">
      <Card className="w-full max-w-sm sm:max-w-md h-full sm:h-auto flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg sm:text-xl">
              📱 QR 스캔
            </CardTitle>
            {onClose && (
              <button 
                onClick={onClose}
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
          {/* QR Reader Container - Always rendered */}
          <div 
            id="qr-reader-fixed" 
            className={`w-full rounded-lg overflow-hidden ${
              status === 'scanning' ? 'block' : 'hidden'
            }`}
            style={{ minHeight: '300px' }}
          />

          {/* Loading State */}
          {status === 'loading' && (
            <div className="text-center space-y-4 h-full flex flex-col justify-center">
              <div className="w-48 h-48 sm:w-64 sm:h-64 bg-gray-100 rounded-lg flex items-center justify-center mx-auto">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  🔄 카메라를 초기화하는 중...
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
              <div className="w-48 h-48 sm:w-64 sm:h-64 bg-gray-100 rounded-lg flex items-center justify-center mx-auto">
                <svg className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-error-600 mb-4">
                  📷 카메라 접근 권한이 필요합니다
                </p>
                <div className="space-y-2">
                  <Button onClick={handlePermissionRetry} className="w-full py-3">
                    권한 허용하기
                  </Button>
                  {onClose && (
                    <Button variant="secondary" onClick={onClose} className="w-full py-3">
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
              <div className="w-48 h-48 sm:w-64 sm:h-64 bg-error-50 rounded-lg flex items-center justify-center mx-auto">
                <svg className="w-12 h-12 sm:w-16 sm:h-16 text-error-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-error-600 mb-4">{error}</p>
                <div className="space-y-2">
                  <Button onClick={handleRetry} className="w-full py-3">
                    🔄 다시 시도
                  </Button>
                  {onClose && (
                    <Button variant="secondary" onClick={onClose} className="w-full py-3">
                      취소
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Scanning State UI Overlay */}
          {status === 'scanning' && (
            <div className="mt-4 text-center bg-gray-50 rounded-lg p-4">
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-700 mb-1">
                  📱 QR코드를 카메라 앞에 위치시켜 주세요
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  💡 밝은 곳에서 스캔하면 더 정확합니다
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={handleRetry} className="py-3">
                  🔄 다시 시작
                </Button>
                {onClose && (
                  <Button variant="secondary" onClick={onClose} className="py-3">
                    ❌ 취소
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}