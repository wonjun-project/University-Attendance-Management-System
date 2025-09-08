import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('❌ 에러 발생:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // 기본 에러 상태코드와 메시지 설정
  let statusCode = err.statusCode || 500;
  let message = err.message || '서버 내부 오류가 발생했습니다.';

  // 개발 환경과 프로덕션 환경에 따른 에러 응답 분기
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Supabase/PostgreSQL 에러 처리
  if (err.message?.includes('duplicate key value violates unique constraint')) {
    statusCode = 409;
    message = '중복된 데이터입니다.';
  } else if (err.message?.includes('invalid input syntax')) {
    statusCode = 400;
    message = '잘못된 입력 형식입니다.';
  } else if (err.message?.includes('JWT')) {
    statusCode = 401;
    message = '인증 토큰이 유효하지 않습니다.';
  } else if (err.message?.includes('Permission denied')) {
    statusCode = 403;
    message = '권한이 없습니다.';
  }

  // 에러 응답 객체
  const errorResponse: any = {
    success: false,
    error: {
      message,
      statusCode,
    },
    timestamp: new Date().toISOString(),
    path: req.url,
    method: req.method
  };

  // 개발 환경에서는 스택 트레이스도 포함
  if (isDevelopment) {
    errorResponse.error.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};