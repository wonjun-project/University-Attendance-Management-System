'use client'

import { useState, useEffect } from 'react'
import CurrentLocationButton from './CurrentLocationButton'
import PredefinedLocations, { type LocationOption as PredefinedLocationOption } from './PredefinedLocations'
import { Input } from '@/components/ui'

export type LocationType = 'predefined' | 'current'

export interface LocationData {
  latitude: number
  longitude: number
  radius: number
  displayName?: string
  locationType: LocationType
  predefinedLocationId?: string
}

interface LocationSelectorProps {
  value?: LocationData | null
  onChange: (location: LocationData | null) => void
  disabled?: boolean
  className?: string
}

function LocationSelector({
  value = null,
  onChange,
  disabled = false,
  className = ""
}: LocationSelectorProps) {
  // selectedType을 독립적인 state로 관리하여 UI 상호작용 허용
  const [selectedType, setSelectedType] = useState<LocationType>(() => {
    return value?.locationType || 'predefined'
  })
  const [radius, setRadius] = useState('100')
  
  // value가 변경될 때 selectedType 동기화
  useEffect(() => {
    if (value?.locationType) {
      setSelectedType(value.locationType)
    }
  }, [value?.locationType])

  // Initialize radius from existing value
  useEffect(() => {
    if (value?.radius) {
      setRadius(value.radius.toString())
    }
  }, [value?.radius])

  // handleTypeChange 함수 제거 - 라디오 버튼에서 직접 setSelectedType 사용

  const handlePredefinedLocationSelect = (location: PredefinedLocationOption | null) => {
    console.log('🏢 Predefined location selected:', location)
    
    if (location) {
      const locationData: LocationData = {
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        radius: location.radius || Number(radius) || 100,
        displayName: location.display_name,
        locationType: 'predefined',
        predefinedLocationId: location.id
      }
      console.log('🏢 Calling onChange with predefined location:', locationData)
      onChange(locationData)
    } else {
      console.log('🏢 Clearing predefined location')
      onChange(null)
    }
  }

  const handleCurrentLocationUpdate = (coords: { latitude: number; longitude: number; accuracy?: number; adaptiveRadius?: number }) => {
    console.log('🎯 Current location update:', coords)
    console.log('🎯 Current selectedType:', selectedType)
    console.log('🎯 Current value:', value)
    
    // 현재 위치 버튼이 활성화되어 있을 때만 호출되므로 selectedType 체크 없이 진행
    // React 상태 업데이트는 비동기이므로 setSelectedType('current') 후 즉시 체크하면 이전 값일 수 있음
    console.log('🎯 Processing current location (bypassing selectedType check due to React async state)')
    
    // 적응형 반경 사용 (GPS 정확도 기반으로 자동 계산된 값)
    const adaptiveRadius = coords.adaptiveRadius || Number(radius) || 100
    
    const locationData: LocationData = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      radius: adaptiveRadius,
      displayName: coords.adaptiveRadius 
        ? `현재 위치 (적응형 반경 ${adaptiveRadius}m)` 
        : '현재 위치',
      locationType: 'current'
    }
    
    console.log('🎯 Calling onChange with current location:', locationData)
    onChange(locationData)
  }

  const handleRadiusChange = (newRadius: string) => {
    setRadius(newRadius)
    
    // 현재 위치가 설정되어 있고 반경을 변경하는 경우 즉시 업데이트
    if (value?.locationType === 'current') {
      const updatedLocation: LocationData = {
        ...value,
        radius: Number(newRadius) || 100,
      }
      onChange(updatedLocation)
    }
  }

  return (
    <div className={className}>
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          📍 강의실 위치 설정
        </h3>

        {/* Location Type Selection */}
        <div className="space-y-4">
          {/* Predefined Locations Option */}
          <div className="flex items-start gap-3">
            <input
              type="radio"
              id="predefined"
              name="locationType"
              checked={selectedType === 'predefined'}
              onChange={(e) => {
                console.log('📻 Predefined radio clicked:', e.target.checked)
                if (e.target.checked) {
                  console.log('🏢 Switching to predefined location mode')
                  setSelectedType('predefined')
                  // 미리 설정된 강의실 모드로 전환할 때 현재 위치 데이터가 있다면 초기화
                  if (value && value.locationType !== 'predefined') {
                    onChange(null)
                  }
                }
              }}
              disabled={disabled}
              className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500"
            />
            <div className="flex-1 min-w-0">
              <label htmlFor="predefined" className="block text-sm font-medium text-gray-700 mb-2">
                🏢 미리 설정된 강의실
              </label>
              <div className={selectedType !== 'predefined' ? 'opacity-50 pointer-events-none' : ''}>
                <PredefinedLocations
                  onLocationSelect={handlePredefinedLocationSelect}
                  disabled={disabled || selectedType !== 'predefined'}
                />
              </div>
            </div>
          </div>

          {/* Current Location Option */}
          <div className="flex items-start gap-3">
            <input
              type="radio"
              id="current"
              name="locationType"
              checked={selectedType === 'current'}
              onChange={(e) => {
                console.log('📻 Current radio clicked:', e.target.checked)
                if (e.target.checked) {
                  console.log('🎯 Switching to current location mode - BEFORE setSelectedType:', selectedType)
                  setSelectedType('current')
                  console.log('🎯 Switching to current location mode - AFTER setSelectedType: current')
                  // 현재 위치 모드로 전환할 때 미리 설정된 강의실 데이터가 있다면 초기화
                  if (value && value.locationType !== 'current') {
                    console.log('🎯 Clearing previous location data')
                    onChange(null)
                  }
                }
              }}
              disabled={disabled}
              className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500"
            />
            <div className="flex-1 min-w-0">
              <label htmlFor="current" className="block text-sm font-medium text-gray-700 mb-2">
                🎯 현재 위치 사용
              </label>
              <div className={selectedType !== 'current' ? 'opacity-50 pointer-events-none' : ''}>
                <CurrentLocationButton
                  onLocationUpdate={handleCurrentLocationUpdate}
                  disabled={disabled || selectedType !== 'current'}
                />
              </div>
            </div>
          </div>

          {/* Radius Setting (For Current Location) */}
          {selectedType === 'current' && (
            <div className="ml-7 pt-2 border-t border-gray-200">
              <Input
                label="출석 인정 반경 (미터)"
                type="number"
                min="100"
                max="500"
                placeholder="100"
                value={radius}
                onChange={(e) => handleRadiusChange(e.target.value)}
                disabled={disabled}
                className="max-w-xs"
              />
            </div>
          )}

          {/* Location Preview */}
          {value && (
            <div className="mt-4 p-3 bg-success-50 border border-success-200 rounded-lg">
              <div className="text-sm text-success-800">
                ✅ 설정된 위치: {value.displayName}
                <div className="text-xs text-success-600 mt-1">
                  위도: {value.latitude.toFixed(6)}, 
                  경도: {value.longitude.toFixed(6)}, 
                  반경: {value.radius}m
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LocationSelector
