/**
 * GPS 위치 검증 유틸리티
 * Haversine 공식을 사용한 정확한 거리 계산
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationValidationResult {
  isValid: boolean;
  distance: number;
  allowedRadius: number;
  accuracy?: number;
  error?: string;
}

/**
 * 지구 반지름 (킬로미터)
 */
const EARTH_RADIUS_KM = 6371;

/**
 * 도(degree)를 라디안(radian)으로 변환
 * @param degrees 도
 * @returns 라디안
 */
const toRadians = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

/**
 * Haversine 공식을 사용하여 두 GPS 좌표 간의 거리 계산
 * @param coord1 첫 번째 좌표
 * @param coord2 두 번째 좌표
 * @returns 거리 (미터)
 */
export const calculateDistance = (coord1: Coordinates, coord2: Coordinates): number => {
  const lat1Rad = toRadians(coord1.latitude);
  const lat2Rad = toRadians(coord2.latitude);
  const deltaLatRad = toRadians(coord2.latitude - coord1.latitude);
  const deltaLngRad = toRadians(coord2.longitude - coord1.longitude);

  const a = 
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  // 킬로미터를 미터로 변환
  return distance * 1000;
};

/**
 * GPS 좌표 유효성 검사
 * @param coordinates 검사할 좌표
 * @returns 유효성 여부
 */
export const validateCoordinates = (coordinates: Coordinates): boolean => {
  const { latitude, longitude } = coordinates;
  
  // 위도는 -90 ~ 90도 사이여야 함
  if (latitude < -90 || latitude > 90) {
    return false;
  }
  
  // 경도는 -180 ~ 180도 사이여야 함
  if (longitude < -180 || longitude > 180) {
    return false;
  }
  
  // 0,0 좌표는 유효하지 않은 것으로 간주 (GPS 오류 가능성)
  if (latitude === 0 && longitude === 0) {
    return false;
  }
  
  return true;
};

/**
 * 학생의 위치가 강의실 범위 내에 있는지 확인
 * @param studentLocation 학생의 현재 위치
 * @param classroomLocation 강의실 위치
 * @param allowedRadius 허용 반경 (미터)
 * @param accuracy GPS 정확도 (미터, 선택사항)
 * @returns 위치 검증 결과
 */
export const validateStudentLocation = (
  studentLocation: Coordinates,
  classroomLocation: Coordinates,
  allowedRadius: number,
  accuracy?: number
): LocationValidationResult => {
  // 좌표 유효성 검사
  if (!validateCoordinates(studentLocation)) {
    return {
      isValid: false,
      distance: 0,
      allowedRadius,
      error: '학생 위치 좌표가 유효하지 않습니다.'
    };
  }

  if (!validateCoordinates(classroomLocation)) {
    return {
      isValid: false,
      distance: 0,
      allowedRadius,
      error: '강의실 위치 좌표가 유효하지 않습니다.'
    };
  }

  // 거리 계산
  const distance = calculateDistance(studentLocation, classroomLocation);

  // GPS 정확도를 고려한 동적 반경 조정
  let effectiveRadius = allowedRadius;
  
  if (accuracy) {
    // GPS 정확도가 떨어질 경우 허용 반경을 조정
    // 정확도가 20m 이상이면 추가 여유를 둠
    if (accuracy > 20) {
      effectiveRadius = Math.max(allowedRadius, accuracy * 1.5);
    }
    
    // 최대 허용 반경 제한 (남용 방지)
    effectiveRadius = Math.min(effectiveRadius, 200);
  }

  const isValid = distance <= effectiveRadius;

  return {
    isValid,
    distance: Math.round(distance * 100) / 100, // 소수점 2자리로 반올림
    allowedRadius: effectiveRadius,
    accuracy,
  };
};

/**
 * GPS 정확도 등급 계산
 * @param accuracy GPS 정확도 (미터)
 * @returns 정확도 등급 문자열
 */
export const getAccuracyGrade = (accuracy?: number): string => {
  if (!accuracy) return 'unknown';
  
  if (accuracy <= 5) return 'excellent';
  if (accuracy <= 10) return 'good';
  if (accuracy <= 20) return 'fair';
  if (accuracy <= 50) return 'poor';
  return 'very_poor';
};

/**
 * GPS 정확도에 따른 권장 사항 제공
 * @param accuracy GPS 정확도 (미터)
 * @returns 권장 사항 문자열
 */
export const getLocationRecommendation = (accuracy?: number): string => {
  if (!accuracy) {
    return '위치 정보를 가져올 수 없습니다. 위치 권한을 확인해주세요.';
  }
  
  if (accuracy <= 10) {
    return '위치 정확도가 우수합니다.';
  }
  
  if (accuracy <= 20) {
    return '위치 정확도가 양호합니다. 출석 체크가 가능합니다.';
  }
  
  if (accuracy <= 50) {
    return '위치 정확도가 낮습니다. 창문 근처로 이동하거나 잠시 후 다시 시도해주세요.';
  }
  
  return '위치 정확도가 매우 낮습니다. 실외로 나가서 GPS 신호를 받은 후 다시 시도해주세요.';
};

/**
 * 한국의 일반적인 대학교 캠퍼스 좌표인지 확인
 * @param coordinates 확인할 좌표
 * @returns 한국 내 위치 여부
 */
export const isInKorea = (coordinates: Coordinates): boolean => {
  const { latitude, longitude } = coordinates;
  
  // 대한민국 대략적인 경계
  const koreaMinLat = 33.0;
  const koreaMaxLat = 38.6;
  const koreaMinLng = 125.0;
  const koreaMaxLng = 129.6;
  
  return latitude >= koreaMinLat && 
         latitude <= koreaMaxLat && 
         longitude >= koreaMinLng && 
         longitude <= koreaMaxLng;
};

/**
 * 거리를 사용자 친화적인 문자열로 변환
 * @param distance 거리 (미터)
 * @returns 포맷된 거리 문자열
 */
export const formatDistance = (distance: number): string => {
  if (distance < 1) {
    return `${Math.round(distance * 100)}cm`;
  }
  
  if (distance < 1000) {
    return `${Math.round(distance)}m`;
  }
  
  return `${(distance / 1000).toFixed(1)}km`;
};

/**
 * 위치 검증 로그를 위한 메타데이터 생성
 * @param validation 검증 결과
 * @param studentLocation 학생 위치
 * @param classroomLocation 강의실 위치
 * @returns 로그 메타데이터
 */
export const createLocationLogMetadata = (
  validation: LocationValidationResult,
  studentLocation: Coordinates,
  classroomLocation: Coordinates
) => {
  return {
    studentLocation,
    classroomLocation,
    distance: validation.distance,
    allowedRadius: validation.allowedRadius,
    accuracy: validation.accuracy,
    accuracyGrade: getAccuracyGrade(validation.accuracy),
    isValid: validation.isValid,
    isInKorea: isInKorea(studentLocation),
    timestamp: new Date().toISOString()
  };
};