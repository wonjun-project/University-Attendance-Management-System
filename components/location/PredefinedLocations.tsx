'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface LocationOption {
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
  className = ''
}: PredefinedLocationsProps) {
  const [buildings, setBuildings] = useState<BuildingOption[]>([])
  const [rooms, setRooms] = useState<LocationOption[]>([])
  const [selectedBuilding, setSelectedBuilding] = useState<string>('')
  const [selectedRoom, setSelectedRoom] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getDummyRooms = useCallback((buildingName: string): LocationOption[] => {
    const baseId = `dummy-${buildingName.toLowerCase().replace(/\s/g, '')}`

    if (buildingName === '제1자연관') {
      return [
        {
          id: `${baseId}-501`,
          building_name: '제1자연관',
          room_number: '501호',
          display_name: '제1자연관 501호',
          latitude: 36.6291,
          longitude: 127.4565,
          radius: 100,
        },
      ]
    }

    return []
  }, [])

  const loadBuildings = useCallback(async () => {
    try {
      setError(null)
      const { data, error } = await supabase.rpc('get_buildings')

      if (error) {
        console.warn('미리 정의된 건물 RPC가 없어 더미 데이터를 사용합니다.', error.message)
        setBuildings([{ building_name: '제1자연관', room_count: 1 }])
        return
      }

      setBuildings(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('건물 목록 로드 실패:', err)
      setBuildings([{ building_name: '제1자연관', room_count: 1 }])
      setError(null)
    }
  }, [])

  const loadRooms = useCallback(
    async (buildingName: string) => {
      try {
        setLoading(true)
        setError(null)

        const { data, error } = await supabase.rpc('get_rooms_by_building', {
          p_building_name: buildingName,
        })

        if (error) {
          console.warn('강의실 RPC가 없어 더미 데이터를 사용합니다.', error.message)
          setRooms(getDummyRooms(buildingName))
          setSelectedRoom('')
          return
        }

        if (Array.isArray(data)) {
          setRooms(data as LocationOption[])
          setSelectedRoom('')
        } else {
          setRooms([])
          setSelectedRoom('')
        }
      } catch (err) {
        console.error('강의실 목록 로드 실패:', err)
        setRooms(getDummyRooms(buildingName))
        setSelectedRoom('')
        setError(null)
      } finally {
        setLoading(false)
      }
    },
    [getDummyRooms]
  )

  useEffect(() => {
    loadBuildings()
  }, [loadBuildings])

  useEffect(() => {
    if (selectedBuilding) {
      loadRooms(selectedBuilding)
    } else {
      setRooms([])
      setSelectedRoom('')
    }
  }, [selectedBuilding, loadRooms])

  useEffect(() => {
    if (selectedRoom) {
      const location = rooms.find(room => room.id === selectedRoom) || null
      onLocationSelect(location)
    } else {
      onLocationSelect(null)
    }
  }, [selectedRoom, rooms, onLocationSelect])

  useEffect(() => {
    if (!selectedLocationId || selectedLocationId === selectedRoom) {
      return
    }

    const resolveLocation = async () => {
      try {
        const { data, error } = await supabase
          .from('predefined_locations')
          .select('*')
          .eq('id', selectedLocationId)
          .maybeSingle()

        if (error) {
          console.warn('미리 정의된 위치를 찾지 못해 더미 값을 사용합니다.', error.message)
          const dummy = getDummyRooms(selectedBuilding || '제1자연관').find(room => room.id === selectedLocationId)
          if (dummy) {
            setSelectedBuilding(dummy.building_name)
            setSelectedRoom(dummy.id)
            onLocationSelect(dummy)
          }
          return
        }

        if (data) {
          const location = data as LocationOption
          setSelectedBuilding(location.building_name)
          setSelectedRoom(location.id)
          onLocationSelect(location)
        }
      } catch (err) {
        console.warn('선택된 위치 로드 실패:', err)
      }
    }

    void resolveLocation()
  }, [selectedLocationId, selectedRoom, selectedBuilding, getDummyRooms, onLocationSelect])

  const handleBuildingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBuilding(e.target.value)
  }

  const handleRoomChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRoom(e.target.value)
  }

  return (
    <div className={className}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">건물 선택</label>
          <select
            value={selectedBuilding}
            onChange={handleBuildingChange}
            disabled={disabled || buildings.length === 0}
            className="input-field"
          >
            <option value="">건물을 선택하세요</option>
            {buildings.map(building => (
              <option key={building.building_name} value={building.building_name}>
                {building.building_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">강의실 선택</label>
          <select
            value={selectedRoom}
            onChange={handleRoomChange}
            disabled={disabled || !selectedBuilding || loading || rooms.length === 0}
            className="input-field"
          >
            <option value="">
              {loading
                ? '강의실 로딩 중...'
                : !selectedBuilding
                ? '먼저 건물을 선택하세요'
                : '강의실을 선택하세요'}
            </option>
            {rooms.map(room => (
              <option key={room.id} value={room.id}>
                {room.display_name}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="text-sm text-error-600 bg-error-50 border border-error-200 rounded-lg p-3">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
