/**
 * 지리적 위치 계산 및 검증 유틸리티
 *
 * Haversine 공식을 사용한 거리 계산 및
 * GPS 정확도 기반 위치 검증 기능 제공
 */

/**
 * GPS 좌표 인터페이스
 */
export interface GPSCoordinates {
  latitude: number
  longitude: number
  accuracy?: number
}

/**
 * 위치 검증 결과 인터페이스
 */
export interface LocationEvaluationResult {
  /** 실제 거리 (미터) */
  distance: number
  /** 유효 거리 (GPS 정확도 고려, 현재는 distance와 동일) */
  effectiveDistance: number
  /** 허용 반경 (미터) */
  allowedRadius: number
  /** 위치 유효성 여부 */
  isLocationValid: boolean
}

/**
 * Haversine 공식을 사용하여 두 GPS 좌표 간의 거리를 계산
 *
 * @param lat1 - 첫 번째 위치의 위도 (도)
 * @param lon1 - 첫 번째 위치의 경도 (도)
 * @param lat2 - 두 번째 위치의 위도 (도)
 * @param lon2 - 두 번째 위치의 경도 (도)
 * @returns 두 지점 간의 거리 (미터)
 *
 * @example
 * ```typescript
 * const distance = calculateDistance(37.5665, 126.9780, 37.5651, 126.9895)
 * console.log(distance) // 약 900m
 * ```
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // 지구 반지름 (미터)
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * 학생 위치가 강의실 허용 반경 내에 있는지 검증
 *
 * @param studentLat - 학생 위치의 위도
 * @param studentLon - 학생 위치의 경도
 * @param accuracy - GPS 정확도 (미터, 선택사항)
 * @param classroomLat - 강의실 위치의 위도
 * @param classroomLon - 강의실 위치의 경도
 * @param allowedRadius - 허용 반경 (미터)
 * @returns 위치 검증 결과 객체
 *
 * @remarks
 * GPS 정확도(accuracy)는 참고용으로만 기록하며,
 * 실제 검증은 정확한 거리(distance)만으로 수행합니다.
 * 이는 GPS 정확도를 악용한 부정 출석을 방지하기 위함입니다.
 *
 * @example
 * ```typescript
 * const result = evaluateLocation(
 *   37.5665, 126.9780, // 학생 위치
 *   10,                 // GPS 정확도
 *   37.5661, 126.9785, // 강의실 위치
 *   100                 // 허용 반경 100m
 * )
 *
 * if (result.isLocationValid) {
 *   console.log(`출석 허용: ${result.distance}m 거리`)
 * } else {
 *   console.log(`출석 거부: ${result.distance}m 초과`)
 * }
 * ```
 */
export function evaluateLocation(
  studentLat: number,
  studentLon: number,
  accuracy: number,
  classroomLat: number,
  classroomLon: number,
  allowedRadius: number
): LocationEvaluationResult {
  const distance = calculateDistance(
    studentLat,
    studentLon,
    classroomLat,
    classroomLon
  )

  // GPS 정확도에 관계없이 실제 거리만으로 검증 (정확한 거리 기반 검증)
  // accuracy는 참고용으로만 기록하고, 실제 검증은 distance로만 수행
  const effectiveDistance = distance

  // 개발 환경에서는 항상 통과, 프로덕션에서는 거리 검증
  // Next.js는 'development' 또는 'production' 값을 사용
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_ENV === 'development'

  console.log('🔍 [Location Validation]', {
    distance: Math.round(distance),
    allowedRadius,
    accuracy: Math.round(accuracy),
    isDevelopment,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
    isLocationValid: isDevelopment || effectiveDistance <= allowedRadius
  })

  const isLocationValid = isDevelopment || effectiveDistance <= allowedRadius

  return {
    distance,
    effectiveDistance,
    allowedRadius,
    isLocationValid,
  }
}

/**
 * GPS 좌표의 유효성 검증
 *
 * @param latitude - 위도
 * @param longitude - 경도
 * @returns 유효한 좌표 여부
 *
 * @example
 * ```typescript
 * if (!isValidCoordinates(37.5665, 126.9780)) {
 *   throw new Error('Invalid GPS coordinates')
 * }
 * ```
 */
export function isValidCoordinates(
  latitude: number,
  longitude: number
): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  )
}

/**
 * 두 위치가 지정된 반경 내에 있는지 확인
 *
 * @param coords1 - 첫 번째 GPS 좌표
 * @param coords2 - 두 번째 GPS 좌표
 * @param radiusMeters - 반경 (미터)
 * @returns 반경 내 위치 여부
 *
 * @example
 * ```typescript
 * const isNearby = isWithinRadius(
 *   { latitude: 37.5665, longitude: 126.9780 },
 *   { latitude: 37.5661, longitude: 126.9785 },
 *   100 // 100m 이내
 * )
 * ```
 */
export function isWithinRadius(
  coords1: GPSCoordinates,
  coords2: GPSCoordinates,
  radiusMeters: number
): boolean {
  const distance = calculateDistance(
    coords1.latitude,
    coords1.longitude,
    coords2.latitude,
    coords2.longitude
  )

  return distance <= radiusMeters
}

/**
 * GPS 좌표를 소수점 자리수 제한하여 정밀도 조정
 * (로그 저장 시 데이터 크기 감소 목적)
 *
 * @param latitude - 위도
 * @param longitude - 경도
 * @param precision - 소수점 자리수 (기본값: 6, 약 10cm 정밀도)
 * @returns 정밀도 조정된 좌표
 *
 * @example
 * ```typescript
 * const truncated = truncateCoordinates(37.56656789, 126.97802345, 2)
 * console.log(truncated) // { latitude: 37.57, longitude: 126.98 }
 * ```
 */
export function truncateCoordinates(
  latitude: number,
  longitude: number,
  precision: number = 6
): GPSCoordinates {
  const factor = Math.pow(10, precision)
  return {
    latitude: Math.round(latitude * factor) / factor,
    longitude: Math.round(longitude * factor) / factor,
  }
}
