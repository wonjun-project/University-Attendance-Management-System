'use client'

import { useState } from 'react'
import { Button, Input } from '@/components/ui'

interface LocationCoords {
  latitude: number
  longitude: number
  radius?: number
}

interface ManualLocationInputProps {
  onLocationUpdate: (coords: LocationCoords) => void
  disabled?: boolean
  className?: string
}

export default function ManualLocationInput({
  onLocationUpdate,
  disabled = false,
  className = ""
}: ManualLocationInputProps) {
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [radius, setRadius] = useState('100')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = () => {
    setError(null)

    const lat = parseFloat(latitude)
    const lon = parseFloat(longitude)
    const rad = parseInt(radius)

    // 유효성 검증
    if (isNaN(lat) || isNaN(lon)) {
      setError('위도와 경도는 숫자여야 합니다.')
      return
    }

    if (lat < -90 || lat > 90) {
      setError('위도는 -90 ~ 90 사이여야 합니다.')
      return
    }

    if (lon < -180 || lon > 180) {
      setError('경도는 -180 ~ 180 사이여야 합니다.')
      return
    }

    if (isNaN(rad) || rad < 50 || rad > 1000) {
      setError('반경은 50 ~ 1000m 사이여야 합니다.')
      return
    }

    console.log('📍 수동 입력 위치:', { lat, lon, rad })

    onLocationUpdate({
      latitude: lat,
      longitude: lon,
      radius: rad
    })
  }

  return (
    <div className={className}>
      <div className="space-y-3">
        <Input
          label="위도 (Latitude)"
          type="number"
          step="0.000001"
          placeholder="예: 37.4607"
          value={latitude}
          onChange={(e) => setLatitude(e.target.value)}
          disabled={disabled}
        />

        <Input
          label="경도 (Longitude)"
          type="number"
          step="0.000001"
          placeholder="예: 126.9524"
          value={longitude}
          onChange={(e) => setLongitude(e.target.value)}
          disabled={disabled}
        />

        <Input
          label="출석 인정 반경 (미터)"
          type="number"
          min="50"
          max="1000"
          placeholder="100"
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          disabled={disabled}
        />

        <Button
          type="button"
          variant="secondary"
          onClick={handleSubmit}
          disabled={disabled || !latitude || !longitude}
          className="w-full"
        >
          ✏️ 위치 설정
        </Button>

        {error && (
          <div className="p-3 bg-error-50 border border-error-200 text-error-800 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs">
          💡 <strong>위치 확인 방법:</strong>
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li>Google Maps에서 원하는 위치를 길게 누르면 좌표가 표시됩니다</li>
            <li>Naver 지도에서도 좌표를 확인할 수 있습니다</li>
            <li>GPS가 작동하지 않는 경우 대체 수단으로 사용하세요</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
