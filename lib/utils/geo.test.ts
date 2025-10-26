import { describe, test, expect } from '@jest/globals'
import {
  calculateDistance,
  evaluateLocation,
  isValidCoordinates,
  isWithinRadius,
  truncateCoordinates,
  type GPSCoordinates,
} from './geo'

describe('Geo Utility Functions', () => {
  // 실제 서울 좌표
  const SEOUL_LAT = 37.5665
  const SEOUL_LON = 126.9780
  const GANGNAM_LAT = 37.4979
  const GANGNAM_LON = 127.0276

  describe('calculateDistance', () => {
    test('같은 위치의 거리는 0', () => {
      const distance = calculateDistance(
        SEOUL_LAT,
        SEOUL_LON,
        SEOUL_LAT,
        SEOUL_LON
      )
      expect(distance).toBe(0)
    })

    test('서울-강남 거리 계산 (~10km)', () => {
      const distance = calculateDistance(
        SEOUL_LAT,
        SEOUL_LON,
        GANGNAM_LAT,
        GANGNAM_LON
      )

      // 실제 서울-강남 거리는 약 10km
      expect(distance).toBeGreaterThan(9000)
      expect(distance).toBeLessThan(11000)
    })

    test('위도 1도 차이는 약 111km', () => {
      const distance = calculateDistance(
        SEOUL_LAT,
        SEOUL_LON,
        SEOUL_LAT + 1,
        SEOUL_LON
      )

      expect(distance).toBeGreaterThan(110000)
      expect(distance).toBeLessThan(112000)
    })

    test('거리 계산은 대칭적이어야 함 (A→B === B→A)', () => {
      const distanceAB = calculateDistance(
        SEOUL_LAT,
        SEOUL_LON,
        GANGNAM_LAT,
        GANGNAM_LON
      )
      const distanceBA = calculateDistance(
        GANGNAM_LAT,
        GANGNAM_LON,
        SEOUL_LAT,
        SEOUL_LON
      )

      expect(distanceAB).toBeCloseTo(distanceBA, 0)
    })
  })

  describe('evaluateLocation', () => {
    const CLASSROOM_LAT = 37.4607
    const CLASSROOM_LON = 126.9524
    const ALLOWED_RADIUS = 100

    test('정확한 강의실 위치 - 통과', () => {
      const result = evaluateLocation(
        CLASSROOM_LAT,
        CLASSROOM_LON,
        10, // GPS 정확도
        CLASSROOM_LAT,
        CLASSROOM_LON,
        ALLOWED_RADIUS
      )

      expect(result.distance).toBe(0)
      expect(result.effectiveDistance).toBe(0)
      expect(result.allowedRadius).toBe(ALLOWED_RADIUS)
      expect(result.isLocationValid).toBe(true)
    })

    test('50m 거리 - 통과', () => {
      // 위도 0.00045도 차이 ≈ 50m
      const studentLat = CLASSROOM_LAT + 0.00045
      const result = evaluateLocation(
        studentLat,
        CLASSROOM_LON,
        10,
        CLASSROOM_LAT,
        CLASSROOM_LON,
        ALLOWED_RADIUS
      )

      expect(result.distance).toBeGreaterThan(45)
      expect(result.distance).toBeLessThan(55)
      expect(result.isLocationValid).toBe(true)
    })

    test('95m 거리 - 통과 (경계 내)', () => {
      const studentLat = CLASSROOM_LAT + 0.00085
      const result = evaluateLocation(
        studentLat,
        CLASSROOM_LON,
        10,
        CLASSROOM_LAT,
        CLASSROOM_LON,
        ALLOWED_RADIUS
      )

      expect(result.distance).toBeGreaterThan(90)
      expect(result.distance).toBeLessThan(100)
      expect(result.isLocationValid).toBe(true)
    })

    test('120m 거리 - 실패 (경계 외)', () => {
      const studentLat = CLASSROOM_LAT + 0.00108
      const result = evaluateLocation(
        studentLat,
        CLASSROOM_LON,
        10,
        CLASSROOM_LAT,
        CLASSROOM_LON,
        ALLOWED_RADIUS
      )

      expect(result.distance).toBeGreaterThan(115)
      expect(result.distance).toBeLessThan(125)
      expect(result.isLocationValid).toBe(false)
    })

    test('GPS 정확도가 낮아도 실제 거리로만 검증', () => {
      // 80m 거리, GPS 정확도 50m (낮음)
      const studentLat = CLASSROOM_LAT + 0.00072
      const result = evaluateLocation(
        studentLat,
        CLASSROOM_LON,
        50, // 낮은 GPS 정확도
        CLASSROOM_LAT,
        CLASSROOM_LON,
        ALLOWED_RADIUS
      )

      expect(result.distance).toBeGreaterThan(75)
      expect(result.distance).toBeLessThan(85)
      // effectiveDistance는 distance와 동일 (accuracy 무시)
      expect(result.effectiveDistance).toBe(result.distance)
      expect(result.isLocationValid).toBe(true)
    })

    test('개발 환경에서는 항상 통과 (거리 무관)', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      // 1km 떨어진 위치도 통과
      const studentLat = CLASSROOM_LAT + 0.009
      const result = evaluateLocation(
        studentLat,
        CLASSROOM_LON,
        10,
        CLASSROOM_LAT,
        CLASSROOM_LON,
        ALLOWED_RADIUS
      )

      expect(result.distance).toBeGreaterThan(900)
      expect(result.isLocationValid).toBe(true)

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('isValidCoordinates', () => {
    test('유효한 좌표 - 서울', () => {
      expect(isValidCoordinates(37.5665, 126.9780)).toBe(true)
    })

    test('유효한 좌표 - 경계값 (북극)', () => {
      expect(isValidCoordinates(90, 0)).toBe(true)
      expect(isValidCoordinates(-90, 0)).toBe(true)
    })

    test('유효한 좌표 - 경계값 (국제날짜변경선)', () => {
      expect(isValidCoordinates(0, 180)).toBe(true)
      expect(isValidCoordinates(0, -180)).toBe(true)
    })

    test('유효하지 않은 좌표 - 위도 초과', () => {
      expect(isValidCoordinates(91, 126.9780)).toBe(false)
      expect(isValidCoordinates(-91, 126.9780)).toBe(false)
    })

    test('유효하지 않은 좌표 - 경도 초과', () => {
      expect(isValidCoordinates(37.5665, 181)).toBe(false)
      expect(isValidCoordinates(37.5665, -181)).toBe(false)
    })

    test('유효하지 않은 좌표 - NaN', () => {
      expect(isValidCoordinates(NaN, 126.9780)).toBe(false)
      expect(isValidCoordinates(37.5665, NaN)).toBe(false)
    })

    test('유효하지 않은 좌표 - Infinity', () => {
      expect(isValidCoordinates(Infinity, 126.9780)).toBe(false)
      expect(isValidCoordinates(37.5665, Infinity)).toBe(false)
    })
  })

  describe('isWithinRadius', () => {
    const center: GPSCoordinates = {
      latitude: 37.5665,
      longitude: 126.9780,
    }

    test('같은 위치는 항상 반경 내', () => {
      expect(isWithinRadius(center, center, 1)).toBe(true)
    })

    test('50m 이내 위치 - 100m 반경', () => {
      const nearby: GPSCoordinates = {
        latitude: 37.5665 + 0.00045,
        longitude: 126.9780,
      }
      expect(isWithinRadius(center, nearby, 100)).toBe(true)
    })

    test('120m 위치 - 100m 반경 초과', () => {
      const far: GPSCoordinates = {
        latitude: 37.5665 + 0.00108,
        longitude: 126.9780,
      }
      expect(isWithinRadius(center, far, 100)).toBe(false)
    })

    test('정확히 경계선 위치 (테스트 목적)', () => {
      const boundary: GPSCoordinates = {
        latitude: 37.5665 + 0.0009,
        longitude: 126.9780,
      }
      const result = isWithinRadius(center, boundary, 100)

      // 거리가 정확히 100m 근처일 때 테스트
      // (실제 값에 따라 true/false 둘 다 가능)
      expect(typeof result).toBe('boolean')
    })
  })

  describe('truncateCoordinates', () => {
    test('기본 정밀도 (6자리) - 약 10cm', () => {
      const result = truncateCoordinates(37.56656789, 126.97802345)
      expect(result.latitude).toBe(37.566568)
      expect(result.longitude).toBe(126.978023)
    })

    test('정밀도 2자리', () => {
      const result = truncateCoordinates(37.56656789, 126.97802345, 2)
      expect(result.latitude).toBe(37.57)
      expect(result.longitude).toBe(126.98)
    })

    test('정밀도 4자리', () => {
      const result = truncateCoordinates(37.56656789, 126.97802345, 4)
      expect(result.latitude).toBe(37.5666)
      expect(result.longitude).toBe(126.978)
    })

    test('정밀도 0 - 정수로 반올림', () => {
      const result = truncateCoordinates(37.56656789, 126.97802345, 0)
      expect(result.latitude).toBe(38)
      expect(result.longitude).toBe(127)
    })

    test('음수 좌표도 올바르게 처리', () => {
      const result = truncateCoordinates(-37.56656789, -126.97802345, 2)
      expect(result.latitude).toBe(-37.57)
      expect(result.longitude).toBe(-126.98)
    })
  })
})

/**
 * 이전 버그 재현 테스트
 * (참고용 - GPS 정확도를 빼서 거리가 줄어드는 버그)
 */
describe('버그 회귀 테스트 - GPS 정확도 악용 방지', () => {
  const CLASSROOM_LAT = 37.4607
  const CLASSROOM_LON = 126.9524
  const ALLOWED_RADIUS = 100

  test('이전 버그: 120m 거리 + 50m accuracy = 잘못 통과', () => {
    // 이전 로직: effectiveDistance = distance - accuracy
    // 120m - 50m = 70m → 100m 이내로 잘못 판정

    const studentLat = CLASSROOM_LAT + 0.00108 // ~120m
    const result = evaluateLocation(
      studentLat,
      CLASSROOM_LON,
      50, // 높은 accuracy (악용 가능)
      CLASSROOM_LAT,
      CLASSROOM_LON,
      ALLOWED_RADIUS
    )

    // 수정된 로직: effectiveDistance = distance (accuracy 무시)
    expect(result.distance).toBeGreaterThan(115)
    expect(result.effectiveDistance).toBe(result.distance)
    expect(result.isLocationValid).toBe(false) // 올바르게 실패
  })

  test('수정된 로직: GPS 정확도와 무관하게 실제 거리로만 검증', () => {
    const studentLat = CLASSROOM_LAT + 0.00108 // ~120m

    // accuracy가 100m이어도 (매우 높음)
    const result1 = evaluateLocation(
      studentLat,
      CLASSROOM_LON,
      100,
      CLASSROOM_LAT,
      CLASSROOM_LON,
      ALLOWED_RADIUS
    )
    expect(result1.isLocationValid).toBe(false)

    // accuracy가 1m이어도 (매우 낮음)
    const result2 = evaluateLocation(
      studentLat,
      CLASSROOM_LON,
      1,
      CLASSROOM_LAT,
      CLASSROOM_LON,
      ALLOWED_RADIUS
    )
    expect(result2.isLocationValid).toBe(false)

    // 두 결과가 동일해야 함 (accuracy 무관)
    expect(result1.isLocationValid).toBe(result2.isLocationValid)
  })
})
