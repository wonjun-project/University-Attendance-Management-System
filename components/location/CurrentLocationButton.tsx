'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'

interface LocationCoords {
  latitude: number
  longitude: number
  accuracy?: number
  adaptiveRadius?: number
}

interface CurrentLocationButtonProps {
  onLocationUpdate: (coords: LocationCoords) => void
  disabled?: boolean
  className?: string
}

export default function CurrentLocationButton({ 
  onLocationUpdate, 
  disabled = false,
  className = "" 
}: CurrentLocationButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingMessage, setLoadingMessage] = useState<string>('')
  const [lastLocation, setLastLocation] = useState<LocationCoords | null>(null)

  const getLocationWithOptions = async (options: PositionOptions): Promise<GeolocationPosition> => {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options)
    })
  }

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setError('브라우저에서 위치 서비스를 지원하지 않습니다.')
      return
    }

    // HTTPS 체크
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setError('위치 서비스는 HTTPS 환경에서만 사용 가능합니다. 주소가 https://로 시작하는지 확인해주세요.')
      console.error('❌ 위치 서비스 HTTPS 필수: 현재 프로토콜 =', window.location.protocol)
      return
    }

    setLoading(true)
    setError(null)
    setLoadingMessage('')

    console.log('📍 위치 요청 시작:', {
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      userAgent: navigator.userAgent
    })

    let position: GeolocationPosition | null = null

    try {
      // 1차 시도: 고정밀 모드 (GPS 사용, 15초 타임아웃)
      console.log('📍 1차 시도: 고정밀 GPS 모드')
      setLoadingMessage('📡 정확한 위치를 찾는 중... (1/3)')

      try {
        position = await getLocationWithOptions({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        })
        console.log('✅ 1차 시도 성공 (고정밀 GPS)')
      } catch (err) {
        console.warn('⚠️ 1차 시도 실패:', err)

        // 2차 시도: 일반 정확도 (Wi-Fi/네트워크 위치, 30초 타임아웃)
        console.log('📍 2차 시도: 일반 정확도 모드 (Wi-Fi/네트워크)')
        setLoadingMessage('📡 네트워크 기반 위치 확인 중... (2/3)')

        try {
          position = await getLocationWithOptions({
            enableHighAccuracy: false,
            timeout: 30000,
            maximumAge: 10000
          })
          console.log('✅ 2차 시도 성공 (네트워크 위치)')
        } catch (err2) {
          console.warn('⚠️ 2차 시도 실패:', err2)

          // 3차 시도: 캐시된 위치 사용 (60초 이내 캐시, 즉시 반환)
          console.log('📍 3차 시도: 캐시된 위치 사용')
          setLoadingMessage('📡 캐시된 위치 확인 중... (3/3)')

          try {
            position = await getLocationWithOptions({
              enableHighAccuracy: false,
              timeout: 10000,
              maximumAge: 60000 // 60초 이내 캐시 허용
            })
            console.log('✅ 3차 시도 성공 (캐시된 위치)')
          } catch (err3) {
            console.error('❌ 모든 시도 실패')
            throw err3 // 마지막 에러를 상위로 전달
          }
        }
      }

      if (!position) {
        throw new Error('위치 정보를 가져올 수 없습니다.')
      }

      // 적응형 반경 계산: 최소 100m, GPS 정확도에 따라 1.5배 확대, 최대 500m
      const MIN_RADIUS = 100
      const MAX_RADIUS = 500
      const accuracy = typeof position.coords.accuracy === 'number' && Number.isFinite(position.coords.accuracy)
        ? position.coords.accuracy
        : MIN_RADIUS
      const computedRadius = Math.round(Math.max(MIN_RADIUS, accuracy * 1.5))
      const adaptiveRadius = Math.min(computedRadius, MAX_RADIUS)

      const coords: LocationCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        adaptiveRadius
      }

      console.log('✅ 위치 획득 최종 성공:', coords)
      setLastLocation(coords)
      setError(null)
      setLoadingMessage('')
      onLocationUpdate(coords)

    } catch (error: unknown) {
      console.error('❌ 위치 획득 실패 (모든 시도 실패):', error)
      if (typeof error === 'object' && error !== null && 'code' in error) {
        const geoError = error as GeolocationPositionError
        console.error('❌ Geolocation 에러 코드:', geoError.code, '메시지:', geoError.message)

        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            setError('🚫 위치 권한이 거부되었습니다.\n\n브라우저 설정에서 위치 권한을 허용해주세요.\n\n[설정 방법]\n• Chrome: 주소창 왼쪽 자물쇠 아이콘 클릭 → 사이트 설정 → 위치 → 허용\n• Safari: 설정 → Safari → 웹사이트 → 위치 → 허용')
            break
          case geoError.POSITION_UNAVAILABLE:
            setError('📍 위치 정보를 사용할 수 없습니다.\n\n다음을 시도해보세요:\n• 기기의 위치 서비스(GPS)가 켜져있는지 확인\n• Wi-Fi 연결 확인 (네트워크 기반 위치 확인용)\n• 실외로 이동하거나 창가로 이동 (GPS 신호 개선)\n• 브라우저를 새로고침 후 재시도\n• 다른 브라우저로 시도 (Chrome, Safari 등)')
            break
          case geoError.TIMEOUT:
            setError('⏱️ 위치 정보 요청이 시간 초과되었습니다.\n\nGPS 신호가 약하거나 네트워크가 불안정합니다.\n잠시 후 다시 시도해주세요.')
            break
          default:
            setError(`❌ 위치 정보를 가져오는데 실패했습니다.\n\n에러 코드: ${geoError.code}\n\n다시 시도해주세요.`)
            break
        }
      } else {
        console.error('❌ 알 수 없는 에러:', error)
        setError('❌ 위치 정보를 가져오는데 실패했습니다.\n\n브라우저를 새로고침 후 다시 시도해주세요.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant="secondary"
        onClick={getCurrentLocation}
        disabled={disabled || loading}
        loading={loading}
        className="w-full flex items-center gap-2"
      >
        {loading ? '위치 확인 중...' : '📍 현재 위치 가져오기'}
      </Button>

      {loadingMessage && loading && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-sm">
          {loadingMessage}
        </div>
      )}

      {error && (
        <div className="mt-2 p-3 bg-error-50 border border-error-200 text-error-800 rounded-lg text-sm whitespace-pre-line">
          {error}
        </div>
      )}

      {lastLocation && !error && (
        <div className="mt-2 p-3 bg-success-50 border border-success-200 text-success-800 rounded-lg text-sm">
          ✅ 위치 획득 성공
          <div className="text-xs text-success-600 mt-1">
            위도: {lastLocation.latitude.toFixed(6)}, 
            경도: {lastLocation.longitude.toFixed(6)}
            {lastLocation.accuracy && (
              <div className="mt-1">
                GPS 정확도: {Math.round(lastLocation.accuracy)}m
                {lastLocation.adaptiveRadius && (
                  <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    적용 반경: {lastLocation.adaptiveRadius}m
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
