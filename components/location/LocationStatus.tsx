'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, Badge } from '@/components/ui'
import { LocationTracker, LocationData } from '@/lib/location/location-tracker'

interface LocationStatusProps {
  attendanceId: string
  classroomLocation: {
    latitude: number
    longitude: number
    radius: number
  }
  onLocationStatusChange?: (isValid: boolean) => void
  onLocationUpdate?: (location: LocationData) => void
}

export function LocationStatus({ 
  attendanceId, 
  classroomLocation, 
  onLocationStatusChange,
  onLocationUpdate 
}: LocationStatusProps) {
  const [locationTracker, setLocationTracker] = useState<LocationTracker | null>(null)
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null)
  const [isLocationValid, setIsLocationValid] = useState<boolean>(true)
  const [trackingStatus, setTrackingStatus] = useState<'starting' | 'active' | 'error' | 'stopped'>('starting')
  const [error, setError] = useState<string>('')
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now())

  useEffect(() => {
    const handleLocationUpdate = async (location: LocationData) => {
      setCurrentLocation(location)
      setLastUpdateTime(Date.now())

      // Check if location is valid
      const isValid = LocationTracker.isLocationValid(
        location.latitude,
        location.longitude,
        classroomLocation.latitude,
        classroomLocation.longitude,
        classroomLocation.radius
      )

      setIsLocationValid(isValid)
      onLocationStatusChange?.(isValid)
      onLocationUpdate?.(location)

      // Send location update to server
      try {
        await fetch('/api/location/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            attendanceId,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy
          })
        })
      } catch (error) {
        console.error('Failed to send location update:', error)
      }
    }

    const handleLocationError = (errorMessage: string) => {
      setError(errorMessage)
      setTrackingStatus('error')
    }

    const tracker = new LocationTracker(
      handleLocationUpdate,
      handleLocationError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
        trackingInterval: 5 * 60 * 1000 // 5 minutes
      }
    )

    setLocationTracker(tracker)

    // Start tracking
    tracker.startTracking().then(() => {
      setTrackingStatus('active')
    }).catch(() => {
      setTrackingStatus('error')
    })

    return () => {
      tracker.stopTracking()
      setTrackingStatus('stopped')
    }
  }, [attendanceId, classroomLocation, onLocationStatusChange, onLocationUpdate])

  const getStatusColor = () => {
    if (trackingStatus === 'error') return 'error'
    if (trackingStatus === 'starting') return 'warning'
    if (!isLocationValid) return 'error'
    return 'success'
  }

  const getStatusText = () => {
    if (trackingStatus === 'error') return '위치 추적 오류'
    if (trackingStatus === 'starting') return '위치 추적 시작 중...'
    if (trackingStatus === 'stopped') return '위치 추적 중지됨'
    if (!isLocationValid) return '강의실 외부'
    return '강의실 내부'
  }

  const formatLastUpdate = () => {
    const diff = Date.now() - lastUpdateTime
    const minutes = Math.floor(diff / (1000 * 60))
    
    if (minutes < 1) return '방금 전'
    if (minutes === 1) return '1분 전'
    return `${minutes}분 전`
  }

  const distance = currentLocation ? LocationTracker.calculateDistance(
    currentLocation.latitude,
    currentLocation.longitude,
    classroomLocation.latitude,
    classroomLocation.longitude
  ) : null

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Status Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                getStatusColor() === 'success' ? 'bg-success-500' :
                getStatusColor() === 'warning' ? 'bg-warning-500' :
                'bg-error-500'
              } ${trackingStatus === 'active' ? 'animate-pulse' : ''}`}></div>
              <span className="text-sm font-medium text-gray-900">
                위치 상태
              </span>
            </div>
            <Badge variant={getStatusColor()}>
              {getStatusText()}
            </Badge>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-error-50 border border-error-200 text-error-800 px-3 py-2 rounded-lg text-xs">
              {error}
            </div>
          )}

          {/* Location Details */}
          {currentLocation && trackingStatus === 'active' && (
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>거리:</span>
                <span className={isLocationValid ? 'text-success-600' : 'text-error-600'}>
                  {distance ? `${Math.round(distance)}m` : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>정확도:</span>
                <span>{Math.round(currentLocation.accuracy)}m</span>
              </div>
              <div className="flex justify-between">
                <span>마지막 업데이트:</span>
                <span>{formatLastUpdate()}</span>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="text-xs text-gray-500 space-y-1">
            {trackingStatus === 'active' && isLocationValid && (
              <>
                <div className="flex items-center space-x-1">
                  <svg className="w-3 h-3 text-success-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>수업 시간 동안 이 위치를 유지해주세요</span>
                </div>
              </>
            )}
            {trackingStatus === 'active' && !isLocationValid && (
              <>
                <div className="flex items-center space-x-1">
                  <svg className="w-3 h-3 text-error-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>강의실로 돌아가거나 출석이 취소될 수 있습니다</span>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}