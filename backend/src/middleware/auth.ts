import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, extractTokenFromHeader, JwtPayload } from '../utils/jwt';
import { supabase } from '../config/supabase';

// Request 객체에 사용자 정보 추가를 위한 타입 확장
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * JWT 토큰 기반 인증 미들웨어
 * @param req Express Request
 * @param res Express Response  
 * @param next Express NextFunction
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Authorization 헤더에서 토큰 추출
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          message: '인증 토큰이 필요합니다.',
          statusCode: 401,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // JWT 토큰 검증
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: {
          message: '유효하지 않은 토큰입니다.',
          statusCode: 401,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 데이터베이스에서 사용자 존재 여부 확인
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, role, student_id')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      console.warn('⚠️ 토큰은 유효하지만 사용자를 찾을 수 없음:', decoded.userId);
      return res.status(401).json({
        success: false,
        error: {
          message: '사용자 정보를 찾을 수 없습니다.',
          statusCode: 401,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 토큰의 사용자 정보와 DB의 사용자 정보 일치 여부 확인
    if (user.email !== decoded.email || user.role !== decoded.role) {
      console.warn('⚠️ 토큰 정보와 DB 정보가 일치하지 않음:', {
        tokenEmail: decoded.email,
        dbEmail: user.email,
        tokenRole: decoded.role,
        dbRole: user.role
      });
      return res.status(401).json({
        success: false,
        error: {
          message: '토큰 정보가 일치하지 않습니다.',
          statusCode: 401,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Request 객체에 사용자 정보 추가
    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role as 'student' | 'professor',
      name: user.name,
      studentId: user.student_id
    };

    next();
  } catch (error) {
    console.error('❌ 인증 미들웨어 에러:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: '인증 처리 중 오류가 발생했습니다.',
        statusCode: 500,
      },
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * 역할 기반 권한 확인 미들웨어 생성 함수
 * @param allowedRoles 허용된 역할 배열
 * @returns Express 미들웨어 함수
 */
export const requireRole = (allowedRoles: ('student' | 'professor')[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: '인증이 필요합니다.',
          statusCode: 401,
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          message: '접근 권한이 없습니다.',
          statusCode: 403,
        },
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
};

/**
 * 학생 전용 미들웨어
 */
export const requireStudent = requireRole(['student']);

/**
 * 교수 전용 미들웨어
 */
export const requireProfessor = requireRole(['professor']);

/**
 * 학생 또는 교수 (모든 인증된 사용자) 미들웨어
 */
export const requireAuth = requireRole(['student', 'professor']);