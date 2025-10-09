import { describe, test, expect } from '@jest/globals'

// Haversine 공식으로 두 좌표 간 거리 계산 (미터)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

// 위치 검증 로직 (수정된 버전)
function evaluateLocation(
  studentLat: number,
  studentLon: number,
  accuracy: number,
  classroomLat: number,
  classroomLon: number,
  allowedRadius: number
): {
  distance: number
  effectiveDistance: number
  allowedRadius: number
  isLocationValid: boolean
} {
  const distance = calculateDistance(studentLat, studentLon, classroomLat, classroomLon)
  // GPS 정확도에 관계없이 실제 거리만으로 검증
  const effectiveDistance = distance
  const isLocationValid = effectiveDistance <= allowedRadius

  return {
    distance,
    effectiveDistance,
    allowedRadius,
    isLocationValid
  }
}

// 이전 버전의 위치 검증 로직 (버그 있음)
function evaluateLocationOld(
  studentLat: number,
  studentLon: number,
  accuracy: number,
  classroomLat: number,
  classroomLon: number,
  allowedRadius: number
): {
  distance: number
  effectiveDistance: number
  allowedRadius: number
  isLocationValid: boolean
} {
  const distance = calculateDistance(studentLat, studentLon, classroomLat, classroomLon)
  // 버그: accuracy를 빼서 거리가 줄어듦
  const effectiveDistance = Math.max(0, distance - accuracy)
  const isLocationValid = effectiveDistance <= allowedRadius

  return {
    distance,
    effectiveDistance,
    allowedRadius,
    isLocationValid
  }
}

describe('거리 계산 및 위치 검증 테스트', () => {
  const CLASSROOM_LAT = 37.4607
  const CLASSROOM_LON = 126.9524
  const ALLOWED_RADIUS = 100

  test('거리 계산 정확성 검증', () => {
    // 같은 위치
    const distance0 = calculateDistance(CLASSROOM_LAT, CLASSROOM_LON, CLASSROOM_LAT, CLASSROOM_LON)
    expect(distance0).toBe(0)

    // 약 111km 떨어진 위치 (위도 1도 차이)
    const distance1 = calculateDistance(CLASSROOM_LAT, CLASSROOM_LON, CLASSROOM_LAT + 1, CLASSROOM_LON)
    expect(distance1).toBeGreaterThan(110000)
    expect(distance1).toBeLessThan(112000)
  })

  describe('수정된 위치 검증 로직', () => {
    test('정확한 강의실 위치 - 통과', () => {
      const result = evaluateLocation(
        CLASSROOM_LAT,
        CLASSROOM_LON,
        10,
        CLASSROOM_LAT,
        CLASSROOM_LON,
        ALLOWED_RADIUS
      )

      console.log('정확한 위치:', result)
      expect(result.distance).toBe(0)
      expect(result.effectiveDistance).toBe(0)
      expect(result.isLocationValid).toBe(true)
    })

    test('50m 거리 - 통과', () => {
      // 약 50m 떨어진 위치 (위도 0.00045도 차이)
      const studentLat = CLASSROOM_LAT + 0.00045
      const result = evaluateLocation(
        studentLat,
        CLASSROOM_LON,
        10,
        CLASSROOM_LAT,
        CLASSROOM_LON,
        ALLOWED_RADIUS
      )

      console.log('50m 거리:', result)
      expect(result.distance).toBeGreaterThan(45)
      expect(result.distance).toBeLessThan(55)
      expect(result.effectiveDistance).toBeGreaterThan(45)
      expect(result.effectiveDistance).toBeLessThan(55)
      expect(result.isLocationValid).toBe(true)
    })

    test('95m 거리 - 통과', () => {
      // 약 95m 떨어진 위치
      const studentLat = CLASSROOM_LAT + 0.00085
      const result = evaluateLocation(
        studentLat,
        CLASSROOM_LON,
        10,
        CLASSROOM_LAT,
        CLASSROOM_LON,
        ALLOWED_RADIUS
      )

      console.log('95m 거리:', result)
      expect(result.distance).toBeGreaterThan(90)
      expect(result.distance).toBeLessThan(100)
      expect(result.effectiveDistance).toBeGreaterThan(90)
      expect(result.effectiveDistance).toBeLessThan(100)
      expect(result.isLocationValid).toBe(true)
    })

    test('120m 거리 - 실패', () => {
      // 약 120m 떨어진 위치
      const studentLat = CLASSROOM_LAT + 0.00108
      const result = evaluateLocation(
        studentLat,
        CLASSROOM_LON,
        10,
        CLASSROOM_LAT,
        CLASSROOM_LON,
        ALLOWED_RADIUS
      )

      console.log('120m 거리:', result)
      expect(result.distance).toBeGreaterThan(115)
      expect(result.distance).toBeLessThan(125)
      expect(result.effectiveDistance).toBeGreaterThan(115)
      expect(result.effectiveDistance).toBeLessThan(125)
      expect(result.isLocationValid).toBe(false)
    })

    test('GPS 정확도가 낮아도 실제 거리로 검증', () => {
      // 80m 거리, GPS 정확도 50m
      const studentLat = CLASSROOM_LAT + 0.00072
      const result = evaluateLocation(
        studentLat,
        CLASSROOM_LON,
        50, // GPS 정확도 낮음
        CLASSROOM_LAT,
        CLASSROOM_LON,
        ALLOWED_RADIUS
      )

      console.log('80m 거리 (GPS 정확도 50m):', result)
      expect(result.distance).toBeGreaterThan(75)
      expect(result.distance).toBeLessThan(85)
      // 수정된 로직: effectiveDistance = distance (accuracy 무시)
      expect(result.effectiveDistance).toBe(result.distance)
      expect(result.isLocationValid).toBe(true)
    })
  })

  describe('이전 버그 있는 로직과 비교', () => {
    test('버그 재현: 120m 거리, GPS 정확도 50m - 잘못 통과', () => {
      const studentLat = CLASSROOM_LAT + 0.00108
      const oldResult = evaluateLocationOld(
        studentLat,
        CLASSROOM_LON,
        50,
        CLASSROOM_LAT,
        CLASSROOM_LON,
        ALLOWED_RADIUS
      )

      console.log('이전 로직 (120m, accuracy 50m):', oldResult)
      // 버그: effectiveDistance = 120 - 50 = 70m → 통과 (잘못됨)
      expect(oldResult.distance).toBeGreaterThan(115)
      expect(oldResult.effectiveDistance).toBeLessThan(oldResult.distance)
      expect(oldResult.isLocationValid).toBe(true) // 잘못 통과
    })

    test('수정된 로직: 120m 거리, GPS 정확도 50m - 올바르게 실패', () => {
      const studentLat = CLASSROOM_LAT + 0.00108
      const newResult = evaluateLocation(
        studentLat,
        CLASSROOM_LON,
        50,
        CLASSROOM_LAT,
        CLASSROOM_LON,
        ALLOWED_RADIUS
      )

      console.log('수정된 로직 (120m, accuracy 50m):', newResult)
      // 수정: effectiveDistance = 120m → 실패 (올바름)
      expect(newResult.distance).toBeGreaterThan(115)
      expect(newResult.effectiveDistance).toBe(newResult.distance)
      expect(newResult.isLocationValid).toBe(false) // 올바르게 실패
    })
  })
})
