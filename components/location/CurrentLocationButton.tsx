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
  const [lastLocation, setLastLocation] = useState<LocationCoords | null>(null)

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

    console.log('📍 위치 요청 시작:', {
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      userAgent: navigator.userAgent
    })

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 30000, // 30초로 증가 (네트워크 환경 고려)
            maximumAge: 5000 // 5초 캐시 허용 (성능 개선)
          }
        )
      })

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

      console.log('CurrentLocationButton: calling onLocationUpdate with coords:', coords)
      setLastLocation(coords)
      onLocationUpdate(coords)
      
    } catch (error: unknown) {
      console.error('❌ 위치 획득 실패:', error)
      if (typeof error === 'object' && error !== null && 'code' in error) {
        const geoError = error as GeolocationPositionError
        console.error('❌ Geolocation 에러 코드:', geoError.code, '메시지:', geoError.message)

        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            setError('위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.\n\n[설정 방법]\n- Chrome: 주소창 왼쪽 자물쇠 > 사이트 설정 > 위치\n- Safari: 설정 > Safari > 웹사이트 > 위치')
            break
          case geoError.POSITION_UNAVAILABLE:
            setError('위치 정보를 사용할 수 없습니다.\n\n가능한 원인:\n- GPS가 꺼져있거나 신호가 약함\n- 실내에서 GPS 신호를 받지 못함\n- 브라우저의 위치 서비스가 비활성화됨\n\n해결 방법:\n- 기기의 위치 서비스(GPS)가 켜져있는지 확인\n- 실외로 이동하거나 창가로 이동\n- 브라우저를 새로고침 후 재시도')
            break
          case geoError.TIMEOUT:
            setError('위치 정보 요청이 시간 초과되었습니다.\n\nGPS 신호가 약하거나 네트워크가 불안정합니다. 잠시 후 다시 시도해주세요.')
            break
          default:
            setError(`위치 정보를 가져오는데 실패했습니다. (에러 코드: ${geoError.code})`)
            break
        }
      } else {
        console.error('❌ 알 수 없는 에러:', error)
        setError('위치 정보를 가져오는데 실패했습니다. 브라우저 콘솔을 확인해주세요.')
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
        📍 현재 위치 가져오기
      </Button>

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
