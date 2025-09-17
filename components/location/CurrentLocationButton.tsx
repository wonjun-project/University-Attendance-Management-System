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

    setLoading(true)
    setError(null)

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0 // 캐시 사용 안함 - 항상 새로운 위치 요청
          }
        )
      })

      // 적응형 반경 계산: max(기본반경 30m, GPS정확도 × 1.5)
      const baseRadius = 30 // 기본 반경 30m
      const adaptiveRadius = Math.max(
        baseRadius, 
        position.coords.accuracy ? Math.round(position.coords.accuracy * 1.5) : baseRadius
      )

      const coords: LocationCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        adaptiveRadius: adaptiveRadius
      }

      console.log('CurrentLocationButton: calling onLocationUpdate with coords:', coords)
      setLastLocation(coords)
      onLocationUpdate(coords)
      
    } catch (error: unknown) {
      console.error('위치 획득 실패:', error)
      if (typeof error === 'object' && error !== null && 'code' in error) {
        const geoError = error as GeolocationPositionError
        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            setError('위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.')
            break
          case geoError.POSITION_UNAVAILABLE:
            setError('위치 정보를 사용할 수 없습니다.')
            break
          case geoError.TIMEOUT:
            setError('위치 정보 요청이 시간 초과되었습니다.')
            break
          default:
            setError('위치 정보를 가져오는데 실패했습니다.')
            break
        }
      } else {
        setError('위치 정보를 가져오는데 실패했습니다.')
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
        <div className="mt-2 p-3 bg-error-50 border border-error-200 text-error-800 rounded-lg text-sm">
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
