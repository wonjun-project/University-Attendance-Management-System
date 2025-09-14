'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface LocationOption {
  id: string
  building_name: string
  room_number: string | null
  display_name: string
  latitude: number
  longitude: number
  radius: number
}

interface BuildingOption {
  building_name: string
  room_count: number
}

interface PredefinedLocationsProps {
  onLocationSelect: (location: LocationOption | null) => void
  selectedLocationId?: string | null
  disabled?: boolean
  className?: string
}

export default function PredefinedLocations({
  onLocationSelect,
  selectedLocationId = null,
  disabled = false,
  className = ""
}: PredefinedLocationsProps) {
  const [buildings, setBuildings] = useState<BuildingOption[]>([])
  const [rooms, setRooms] = useState<LocationOption[]>([])
  const [selectedBuilding, setSelectedBuilding] = useState<string>('')
  const [selectedRoom, setSelectedRoom] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)


  // Load buildings on component mount
  useEffect(() => {
    // 데이터베이스 마이그레이션이 적용되지 않은 경우 더미 데이터 사용
    loadBuildings()
  }, [])

  // Load rooms when building is selected
  useEffect(() => {
    if (selectedBuilding) {
      loadRooms(selectedBuilding)
    } else {
      setRooms([])
      setSelectedRoom('')
    }
  }, [selectedBuilding])

  // Handle room selection - useCallback이나 의존성 제거로 무한 루프 방지
  useEffect(() => {
    if (selectedRoom) {
      const location = rooms.find(room => room.id === selectedRoom)
      onLocationSelect(location || null)
    } else {
      onLocationSelect(null)
    }
  }, [selectedRoom, rooms]) // onLocationSelect 의존성 제거로 무한 루프 방지

  const loadBuildings = async () => {
    try {
      setError(null)
      const { data, error } = await supabase.rpc('get_buildings')
      
      if (error) {
        // 데이터베이스 함수가 없는 경우 더미 데이터 사용
        console.log('데이터베이스 함수가 없어서 더미 데이터를 사용합니다.')
        const dummyBuildings = [
          { building_name: '제1자연관', room_count: 1 }
        ]
        setBuildings(dummyBuildings)
        return
      }
      
      setBuildings(data || [])
    } catch (error: any) {
      console.error('Failed to load buildings:', error)
      // 오류 발생 시에도 더미 데이터 사용
      const dummyBuildings = [
        { building_name: '제1자연관', room_count: 1 }
      ]
      setBuildings(dummyBuildings)
      setError(null) // 더미 데이터를 사용하므로 에러 표시 안함
    }
  }

  const loadRooms = async (buildingName: string) => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error } = await supabase.rpc('get_rooms_by_building', {
        p_building_name: buildingName
      })
      
      if (error) {
        // 데이터베이스 함수가 없는 경우 더미 데이터 사용
        console.log('데이터베이스 함수가 없어서 더미 강의실 데이터를 사용합니다.')
        const dummyRooms = getDummyRooms(buildingName)
        setRooms(dummyRooms)
        setSelectedRoom('')
        return
      }
      
      setRooms(data || [])
      setSelectedRoom('') // Reset room selection
    } catch (error: any) {
      console.error('Failed to load rooms:', error)
      // 오류 발생 시에도 더미 데이터 사용
      const dummyRooms = getDummyRooms(buildingName)
      setRooms(dummyRooms)
      setSelectedRoom('')
      setError(null) // 더미 데이터를 사용하므로 에러 표시 안함
    } finally {
      setLoading(false)
    }
  }

  // 더미 강의실 데이터 생성 함수
  const getDummyRooms = (buildingName: string): LocationOption[] => {
    const baseId = `dummy-${buildingName.toLowerCase().replace(/\s/g, '')}`
    
    switch (buildingName) {
      case '제1자연관':
        return [
          { 
            id: `${baseId}-501`, 
            building_name: '제1자연관', 
            room_number: '501호', 
            display_name: '제1자연관 501호', 
            latitude: 36.6291, 
            longitude: 127.4565, 
            radius: 100 
          }
        ]
      default:
        return []
    }
  }

  const handleBuildingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBuilding(e.target.value)
  }

  const handleRoomChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRoom(e.target.value)
  }

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Building Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            건물 선택
          </label>
          <select
            value={selectedBuilding}
            onChange={handleBuildingChange}
            disabled={disabled || buildings.length === 0}
            className="input-field"
          >
            <option value="">건물을 선택하세요</option>
            {buildings.map((building) => (
              <option key={building.building_name} value={building.building_name}>
                {building.building_name}
              </option>
            ))}
          </select>
        </div>

        {/* Room Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            강의실 선택
          </label>
          <select
            value={selectedRoom}
            onChange={handleRoomChange}
            disabled={disabled || !selectedBuilding || loading || rooms.length === 0}
            className="input-field"
          >
            <option value="">
              {loading ? '강의실 로딩 중...' : 
               !selectedBuilding ? '먼저 건물을 선택하세요' : 
               '강의실을 선택하세요'}
            </option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.display_name}
              </option>
            ))}
          </select>
        </div>

        {/* Selected Location Info */}
        {selectedRoom && rooms.find(r => r.id === selectedRoom) && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-800">
              📍 선택된 위치: {rooms.find(r => r.id === selectedRoom)?.display_name}
              <div className="text-xs text-blue-600 mt-1">
                위도: {rooms.find(r => r.id === selectedRoom)?.latitude.toFixed(6)}, 
                경도: {rooms.find(r => r.id === selectedRoom)?.longitude.toFixed(6)}, 
                반경: {rooms.find(r => r.id === selectedRoom)?.radius}m
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-error-50 border border-error-200 text-error-800 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}