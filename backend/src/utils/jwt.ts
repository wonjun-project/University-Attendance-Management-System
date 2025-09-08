import jwt from 'jsonwebtoken';

// JWT 토큰 페이로드 타입 정의
export interface JwtPayload {
  userId: string;
  email: string;
  role: 'student' | 'professor';
  name: string;
  studentId?: string;
}

// JWT 토큰 생성 옵션 타입 정의
interface TokenOptions {
  expiresIn?: string;
}

// 환경변수 검증
const jwtSecret = process.env.JWT_SECRET;
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다.');
}

if (!jwtRefreshSecret) {
  throw new Error('JWT_REFRESH_SECRET 환경변수가 설정되지 않았습니다.');
}

/**
 * Access Token 생성
 * @param payload JWT 페이로드
 * @returns Access Token 문자열
 */
export const generateAccessToken = (payload: JwtPayload): string => {
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
  
  return jwt.sign(payload, jwtSecret, {
    expiresIn,
    issuer: 'attendance-management-system',
    audience: 'attendance-users',
  });
};

/**
 * Refresh Token 생성
 * @param payload JWT 페이로드
 * @returns Refresh Token 문자열
 */
export const generateRefreshToken = (payload: JwtPayload): string => {
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  
  return jwt.sign(payload, jwtRefreshSecret, {
    expiresIn,
    issuer: 'attendance-management-system',
    audience: 'attendance-users',
  });
};

/**
 * Access Token 검증
 * @param token 검증할 토큰
 * @returns 디코딩된 페이로드 또는 null
 */
export const verifyAccessToken = (token: string): JwtPayload | null => {
  try {
    const decoded = jwt.verify(token, jwtSecret, {
      issuer: 'attendance-management-system',
      audience: 'attendance-users',
    }) as JwtPayload;
    
    return decoded;
  } catch (error) {
    console.warn('⚠️ Access Token 검증 실패:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
};

/**
 * Refresh Token 검증
 * @param token 검증할 토큰
 * @returns 디코딩된 페이로드 또는 null
 */
export const verifyRefreshToken = (token: string): JwtPayload | null => {
  try {
    const decoded = jwt.verify(token, jwtRefreshSecret, {
      issuer: 'attendance-management-system',
      audience: 'attendance-users',
    }) as JwtPayload;
    
    return decoded;
  } catch (error) {
    console.warn('⚠️ Refresh Token 검증 실패:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
};

/**
 * 토큰 페어 생성 (Access + Refresh Token)
 * @param payload JWT 페이로드
 * @returns 토큰 페어 객체
 */
export const generateTokenPair = (payload: JwtPayload) => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
    tokenType: 'Bearer',
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  };
};

/**
 * Authorization 헤더에서 토큰 추출
 * @param authHeader Authorization 헤더 값
 * @returns 추출된 토큰 또는 null
 */
export const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};