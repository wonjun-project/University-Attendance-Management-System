'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'
import { QRCodeGenerator, QRCodeData } from '@/lib/qr/qr-generator'

interface QRCodeScannerUnifiedProps {
  onScanSuccess: (qrData: QRCodeData) => void
  onScanError?: (error: string) => void
  onClose?: () => void
}

export function QRCodeScannerUnified({ onScanSuccess, onScanError, onClose }: QRCodeScannerUnifiedProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string>('')
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [currentMode, setCurrentMode] = useState<'advanced' | 'simple'>('advanced')
  const [logs, setLogs] = useState<string[]>([])
  const [retryCount, setRetryCount] = useState(0)
  
  const maxRetries = 2

  const addLog = useCallback((message: string) => {
    setLogs(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${message}`])
    console.log('[QR Scanner Unified]', message)
  }, [])

  const getOptimalQRBoxSize = useCallback(() => {
    const screenWidth = window.innerWidth
    const screenHeight = window.innerHeight
    const minSize = Math.min(screenWidth, screenHeight)
    const optimalSize = Math.min(Math.max(minSize * 0.7, 200), 350)
    return { width: optimalSize, height: optimalSize }
  }, [])

  const getAdvancedConfig = useCallback(() => {
    const qrboxSize = getOptimalQRBoxSize()
    return {
      fps: 15,
      qrbox: qrboxSize,
      aspectRatio: 1.0,
      disableFlip: false,
      videoConstraints: {
        facingMode: 'environment'
      }
    }
  }, [getOptimalQRBoxSize])

  const getSimpleConfig = useCallback(() => {
    return {
      fps: 10,
      qrbox: 250,
      aspectRatio: 1.0,
      disableFlip: false
    }
  }, [])

  const waitForElement = useCallback((selector: string, timeout = 5000): Promise<Element> => {
    return new Promise((resolve, reject) => {
      const element = document.getElementById(selector)
      if (element) {
        resolve(element)
        return
      }

      const observer = new MutationObserver((mutations, obs) => {
        const element = document.getElementById(selector)
        if (element) {
          obs.disconnect()
          resolve(element)
        }
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true
      })

      setTimeout(() => {
        observer.disconnect()
        reject(new Error(`Element ${selector} not found within ${timeout}ms`))
      }, timeout)
    })
  }, [])

  const initializeScanner = useCallback(async (mode: 'advanced' | 'simple') => {
    if (!document.getElementById('qr-reader-unified')) {
      addLog('DOM element not found, waiting...')
      return
    }

    setIsInitializing(true)
    setError('')
    setPermissionDenied(false)
    addLog(`Initializing scanner in ${mode} mode`)

    try {
      // DOM 요소 대기
      await waitForElement('qr-reader-unified')
      addLog('DOM element found')

      // 카메라 권한 확인
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({ 
          video: mode === 'advanced' ? { facingMode: 'environment' } : true 
        })
        testStream.getTracks().forEach(track => track.stop())
        addLog('Camera permission granted')
      } catch (permError: unknown) {
        const errorName = permError instanceof DOMException ? permError.name : 'UnknownError'
        addLog(`Camera permission error: ${errorName}`)
        if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
          setPermissionDenied(true)
          setError('📷 카메라 접근 권한이 필요합니다. 브라우저 설정에서 카메라를 허용해주세요.')
        } else if (errorName === 'NotFoundError') {
          setError('📱 카메라를 찾을 수 없습니다.')
        } else {
          setError('⚠️ 카메라 초기화 오류가 발생했습니다.')
        }
        setIsInitializing(false)
        return
      }

      const config = mode === 'advanced' ? getAdvancedConfig() : getSimpleConfig()
      addLog(`Using config: ${JSON.stringify(config)}`)

      const scanner = new Html5QrcodeScanner('qr-reader-unified', config, false)
      scannerRef.current = scanner

      const onScanSuccessHandler = (decodedText: string) => {
        try {
          addLog(`QR scan successful: ${decodedText.substring(0, 30)}...`)
          
          // 성공 피드백 (진동)
          if (navigator.vibrate) {
            navigator.vibrate(200)
          }
          
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

          // 성공적으로 스캔 완료
          scanner.clear().catch(console.error)
          setIsScanning(false)
          setIsInitializing(false)
          onScanSuccess(qrData)
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'unknown'
          addLog(`QR processing error: ${message}`)
          const errorMsg = 'QR코드 처리 중 오류가 발생했습니다.'
          setError(errorMsg)
          onScanError?.(errorMsg)
        }
      }

      const onScanErrorHandler = (errorMessage: string) => {
        // 일반적인 스캔 오류는 로그만 남기고 표시하지 않음
        if (!errorMessage.includes('NotFound') && !errorMessage.includes('NotAllowed')) {
          console.log('Scan error:', errorMessage)
        }
      }

      await scanner.render(onScanSuccessHandler, onScanErrorHandler)
      setIsScanning(true)
      setIsInitializing(false)
      setCurrentMode(mode)
      addLog(`${mode} mode scanner initialized successfully`)

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown'
      addLog(`Initialization failed in ${mode} mode: ${message}`)
      
      // 고급 모드에서 실패하면 간단 모드로 자동 전환
      if (mode === 'advanced' && retryCount < maxRetries) {
        addLog('Falling back to simple mode...')
        setRetryCount(prev => prev + 1)
        setTimeout(() => initializeScanner('simple'), 1000)
        return
      }
      
      // 간단 모드에서도 실패하면 오류 표시
      setError(`❌ 카메라 초기화 실패: ${message}`)
      setIsInitializing(false)
    }
  }, [getAdvancedConfig, getSimpleConfig, waitForElement, addLog, onScanSuccess, onScanError, retryCount])

  useEffect(() => {
    let mounted = true
    
    const timeoutId = setTimeout(() => {
      if (mounted) {
        initializeScanner('advanced')
      }
    }, 200)

    return () => {
      mounted = false
      clearTimeout(timeoutId)
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error)
      }
    }
  }, [initializeScanner])

  const handleRetry = useCallback(() => {
    setError('')
    setLogs([])
    setPermissionDenied(false)
    setRetryCount(0)
    
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error)
    }
    
    initializeScanner('advanced')
  }, [initializeScanner])

  const handlePermissionRetry = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach(track => track.stop())
      
      setPermissionDenied(false)
      setError('')
      handleRetry()
    } catch {
      setError('카메라 접근이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.')
    }
  }, [handleRetry])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-2 sm:p-4">
      <Card className="w-full max-w-sm sm:max-w-md h-full sm:h-auto flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg sm:text-xl">
              📱 QR 스캔 {currentMode === 'advanced' ? '(고급)' : '(간단)'}
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
          {permissionDenied ? (
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
                <Button onClick={handlePermissionRetry} className="w-full py-3">
                  권한 허용하기
                </Button>
              </div>
            </div>
          ) : error ? (
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
                      ❌ 취소
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : isInitializing ? (
            <div className="text-center space-y-4 h-full flex flex-col justify-center">
              <div className="w-48 h-48 sm:w-64 sm:h-64 bg-gray-100 rounded-lg flex items-center justify-center mx-auto">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  🔄 카메라를 초기화하는 중...
                </p>
                
                {logs.length > 0 && (
                  <div className="bg-gray-50 rounded p-2 text-xs text-left max-h-24 overflow-y-auto">
                    {logs.map((log, index) => (
                      <div key={index} className="text-gray-600">{log}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 h-full flex flex-col">
              {/* QR Scanner Container */}
              <div id="qr-reader-unified" className="flex-1 min-h-0 rounded-lg overflow-hidden"></div>
              
              {isScanning && (
                <div className="text-center bg-gray-50 rounded-lg p-4">
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      📱 QR코드를 카메라 앞에 위치시켜 주세요
                    </p>
                    <p className="text-xs text-gray-500 mb-2">
                      💡 밝은 곳에서 스캔하면 더 정확합니다
                    </p>
                    {currentMode === 'simple' && (
                      <p className="text-xs text-yellow-600">
                        ⚡ 간단 모드로 실행 중 (자동 전환됨)
                      </p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={handleRetry} className="py-3">
                      🔄 다시 시도
                    </Button>
                    {onClose && (
                      <Button variant="secondary" onClick={onClose} className="py-3">
                        ❌ 취소
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
