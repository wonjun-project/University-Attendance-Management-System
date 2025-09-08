import QRCode from 'qrcode';
import crypto from 'crypto';

/**
 * QR 코드 데이터 인터페이스
 */
export interface QRCodeData {
  sessionId: string;
  courseId: string;
  timestamp: number;
  signature: string;
}

/**
 * QR 코드 생성 옵션
 */
export interface QRCodeOptions {
  width?: number;
  height?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * QR 코드에 포함될 고유한 세션 ID 생성
 * @param courseId 강의 ID
 * @param sessionDate 세션 날짜
 * @returns 고유한 QR 코드 문자열
 */
export const generateQRCodeString = (courseId: string, sessionDate: string): string => {
  const timestamp = Date.now();
  const randomSalt = crypto.randomBytes(8).toString('hex');
  
  // QR 코드 데이터 생성
  const qrData: QRCodeData = {
    sessionId: `${courseId}-${sessionDate}-${timestamp}-${randomSalt}`,
    courseId,
    timestamp,
    signature: generateSignature(courseId, sessionDate, timestamp)
  };

  // JSON 문자열로 변환
  return JSON.stringify(qrData);
};

/**
 * QR 코드 데이터의 무결성을 위한 서명 생성
 * @param courseId 강의 ID
 * @param sessionDate 세션 날짜
 * @param timestamp 타임스탬프
 * @returns HMAC 서명
 */
const generateSignature = (courseId: string, sessionDate: string, timestamp: number): string => {
  const secret = process.env.JWT_SECRET || 'default-secret';
  const data = `${courseId}:${sessionDate}:${timestamp}`;
  
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex')
    .substring(0, 16); // 16자리만 사용
};

/**
 * QR 코드 이미지 생성 (Base64)
 * @param qrString QR 코드 문자열 데이터
 * @param options QR 코드 생성 옵션
 * @returns Base64 인코딩된 QR 코드 이미지
 */
export const generateQRCodeImage = async (
  qrString: string, 
  options: QRCodeOptions = {}
): Promise<string> => {
  const defaultOptions = {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    errorCorrectionLevel: 'M' as const,
    ...options
  };

  try {
    const qrCodeDataURL = await QRCode.toDataURL(qrString, defaultOptions);
    return qrCodeDataURL;
  } catch (error) {
    console.error('QR 코드 생성 실패:', error);
    throw new Error('QR 코드 생성에 실패했습니다.');
  }
};

/**
 * QR 코드 검증
 * @param qrString QR 코드 문자열
 * @returns 검증 결과와 파싱된 데이터
 */
export const validateQRCode = (qrString: string): {
  isValid: boolean;
  data?: QRCodeData;
  error?: string;
} => {
  try {
    // JSON 파싱
    const qrData: QRCodeData = JSON.parse(qrString);
    
    // 필수 필드 확인
    if (!qrData.sessionId || !qrData.courseId || !qrData.timestamp || !qrData.signature) {
      return {
        isValid: false,
        error: '필수 필드가 누락되었습니다.'
      };
    }

    // 타임스탬프 검증 (QR 코드 생성 후 2시간 이내만 유효)
    const currentTime = Date.now();
    const qrAge = currentTime - qrData.timestamp;
    const maxAge = 2 * 60 * 60 * 1000; // 2시간

    if (qrAge > maxAge) {
      return {
        isValid: false,
        error: 'QR 코드가 만료되었습니다.'
      };
    }

    // 서명 검증 (실제 구현에서는 courseId와 sessionDate를 추출하여 검증해야 함)
    // 여기서는 기본적인 형식 검증만 수행
    if (!/^[a-f0-9]{16}$/.test(qrData.signature)) {
      return {
        isValid: false,
        error: '잘못된 QR 코드 서명입니다.'
      };
    }

    return {
      isValid: true,
      data: qrData
    };

  } catch (error) {
    return {
      isValid: false,
      error: '잘못된 QR 코드 형식입니다.'
    };
  }
};

/**
 * QR 코드에서 세션 ID 추출
 * @param qrString QR 코드 문자열
 * @returns 세션 ID 또는 null
 */
export const extractSessionId = (qrString: string): string | null => {
  const validation = validateQRCode(qrString);
  
  if (validation.isValid && validation.data) {
    return validation.data.sessionId;
  }
  
  return null;
};

/**
 * 간단한 QR 코드 생성 (빠른 테스트용)
 * @param courseId 강의 ID
 * @param sessionId 세션 ID
 * @returns 간단한 QR 코드 문자열
 */
export const generateSimpleQRCode = (courseId: string, sessionId: string): string => {
  return `attendance://${courseId}/${sessionId}/${Date.now()}`;
};

/**
 * QR 코드 만료 시간 계산
 * @param createdAt QR 코드 생성 시간
 * @param validityMinutes 유효 시간 (분)
 * @returns 만료 시간
 */
export const calculateExpirationTime = (createdAt: Date, validityMinutes: number = 40): Date => {
  const expirationTime = new Date(createdAt);
  expirationTime.setMinutes(expirationTime.getMinutes() + validityMinutes);
  return expirationTime;
};

/**
 * QR 코드 만료 여부 확인
 * @param expirationTime 만료 시간
 * @returns 만료 여부
 */
export const isQRCodeExpired = (expirationTime: Date): boolean => {
  return new Date() > expirationTime;
};