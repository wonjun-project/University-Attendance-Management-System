/**
 * API 응답 표준화 유틸리티
 *
 * 일관된 API 응답 형식을 제공하여
 * 클라이언트 에러 처리를 단순화합니다.
 */

import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api-response')

/**
 * 표준 성공 응답 인터페이스
 */
export interface SuccessResponse<T = unknown> {
  success: true
  data: T
  message?: string
  meta?: {
    timestamp: string
    requestId?: string
    [key: string]: unknown
  }
}

/**
 * 표준 에러 응답 인터페이스
 */
export interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
    field?: string
  }
  meta?: {
    timestamp: string
    requestId?: string
    [key: string]: unknown
  }
}

/**
 * API 응답 타입
 */
export type APIResponse<T = unknown> = SuccessResponse<T> | ErrorResponse

/**
 * 표준 에러 코드
 */
export const ErrorCodes = {
  // 인증/인가 에러 (400번대)
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // 요청 에러 (400번대)
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_INPUT: 'INVALID_INPUT',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',

  // 비즈니스 로직 에러
  ATTENDANCE_ALREADY_RECORDED: 'ATTENDANCE_ALREADY_RECORDED',
  LOCATION_OUT_OF_RANGE: 'LOCATION_OUT_OF_RANGE',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_NOT_STARTED: 'SESSION_NOT_STARTED',
  QR_CODE_EXPIRED: 'QR_CODE_EXPIRED',
  QR_CODE_INVALID: 'QR_CODE_INVALID',

  // 보안 에러
  CSRF_TOKEN_MISSING: 'CSRF_TOKEN_MISSING',
  CSRF_TOKEN_INVALID: 'CSRF_TOKEN_INVALID',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // 서버 에러 (500번대)
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const

/**
 * 에러 코드에 대응하는 HTTP 상태 코드 맵
 */
const ERROR_STATUS_MAP: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INVALID_CREDENTIALS: 401,
  TOKEN_EXPIRED: 401,
  INVALID_TOKEN: 401,

  BAD_REQUEST: 400,
  VALIDATION_ERROR: 400,
  MISSING_REQUIRED_FIELD: 400,
  INVALID_INPUT: 400,
  RESOURCE_NOT_FOUND: 404,
  DUPLICATE_RESOURCE: 409,

  ATTENDANCE_ALREADY_RECORDED: 409,
  LOCATION_OUT_OF_RANGE: 400,
  SESSION_EXPIRED: 410,
  SESSION_NOT_STARTED: 400,
  QR_CODE_EXPIRED: 410,
  QR_CODE_INVALID: 400,

  CSRF_TOKEN_MISSING: 403,
  CSRF_TOKEN_INVALID: 403,
  RATE_LIMIT_EXCEEDED: 429,

  INTERNAL_SERVER_ERROR: 500,
  DATABASE_ERROR: 500,
  EXTERNAL_SERVICE_ERROR: 502,
}

/**
 * 성공 응답 생성
 *
 * @param data - 응답 데이터
 * @param message - 성공 메시지 (선택)
 * @param meta - 메타데이터 (선택)
 * @returns 표준 성공 응답
 *
 * @example
 * ```typescript
 * return createSuccessResponse({ userId: '123' }, '로그인 성공')
 * ```
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  meta?: Record<string, unknown>
): NextResponse<SuccessResponse<T>> {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  }

  logger.debug('성공 응답 생성', {
    message,
    hasData: !!data,
  })

  return NextResponse.json(response, { status: 200 })
}

/**
 * 생성 성공 응답 (201 Created)
 *
 * @param data - 생성된 리소스 데이터
 * @param message - 성공 메시지 (선택)
 * @returns 201 상태 코드와 함께 생성 응답
 */
export function createCreatedResponse<T>(
  data: T,
  message?: string
): NextResponse<SuccessResponse<T>> {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
    meta: {
      timestamp: new Date().toISOString(),
    },
  }

  logger.info('리소스 생성 성공', { message })

  return NextResponse.json(response, { status: 201 })
}

/**
 * 에러 응답 생성
 *
 * @param code - 에러 코드
 * @param message - 에러 메시지
 * @param details - 추가 에러 상세 정보 (선택)
 * @param field - 에러가 발생한 필드 (선택)
 * @returns 표준 에러 응답
 *
 * @example
 * ```typescript
 * return createErrorResponse(
 *   ErrorCodes.INVALID_CREDENTIALS,
 *   '아이디 또는 비밀번호가 올바르지 않습니다'
 * )
 * ```
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: unknown,
  field?: string
): NextResponse<ErrorResponse> {
  const statusCode = ERROR_STATUS_MAP[code] || 500

  const errorObject: ErrorResponse['error'] = {
    code,
    message,
  }

  if (details !== undefined) {
    errorObject.details = details
  }

  if (field !== undefined) {
    errorObject.field = field
  }

  const response: ErrorResponse = {
    success: false,
    error: errorObject,
    meta: {
      timestamp: new Date().toISOString(),
    },
  }

  logger.warn('에러 응답 생성', {
    code,
    message,
    statusCode,
    field,
  })

  return NextResponse.json(response, { status: statusCode })
}

/**
 * 검증 에러 응답 생성
 *
 * @param errors - 검증 에러 목록
 * @returns 검증 에러 응답 (400)
 *
 * @example
 * ```typescript
 * return createValidationErrorResponse([
 *   { field: 'email', message: '유효한 이메일을 입력하세요' },
 *   { field: 'password', message: '비밀번호는 6자 이상이어야 합니다' }
 * ])
 * ```
 */
export function createValidationErrorResponse(
  errors: Array<{ field: string; message: string }>
): NextResponse<ErrorResponse> {
  const response: ErrorResponse = {
    success: false,
    error: {
      code: ErrorCodes.VALIDATION_ERROR,
      message: '입력 데이터가 유효하지 않습니다',
      details: errors,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  }

  logger.warn('검증 에러 발생', {
    errorCount: errors.length,
    fields: errors.map((e) => e.field),
  })

  return NextResponse.json(response, { status: 400 })
}

/**
 * 인증 에러 응답 (401)
 *
 * @param message - 에러 메시지
 * @returns 인증 에러 응답
 */
export function createUnauthorizedResponse(
  message: string = '인증이 필요합니다'
): NextResponse<ErrorResponse> {
  return createErrorResponse(ErrorCodes.UNAUTHORIZED, message)
}

/**
 * 권한 에러 응답 (403)
 *
 * @param message - 에러 메시지
 * @returns 권한 에러 응답
 */
export function createForbiddenResponse(
  message: string = '접근 권한이 없습니다'
): NextResponse<ErrorResponse> {
  return createErrorResponse(ErrorCodes.FORBIDDEN, message)
}

/**
 * 리소스 없음 에러 응답 (404)
 *
 * @param resource - 찾지 못한 리소스 이름
 * @returns 리소스 없음 에러 응답
 */
export function createNotFoundResponse(
  resource: string = '리소스'
): NextResponse<ErrorResponse> {
  return createErrorResponse(
    ErrorCodes.RESOURCE_NOT_FOUND,
    `${resource}를 찾을 수 없습니다`
  )
}

/**
 * Rate Limit 초과 에러 응답 (429)
 *
 * @param retryAfterSeconds - 재시도 가능 시간 (초)
 * @returns Rate Limit 에러 응답
 */
export function createRateLimitResponse(
  retryAfterSeconds?: number
): NextResponse<ErrorResponse> {
  const response = createErrorResponse(
    ErrorCodes.RATE_LIMIT_EXCEEDED,
    '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요',
    retryAfterSeconds ? { retryAfter: retryAfterSeconds } : undefined
  )

  if (retryAfterSeconds) {
    response.headers.set('Retry-After', String(retryAfterSeconds))
  }

  return response
}

/**
 * 서버 에러 응답 (500)
 *
 * @param message - 에러 메시지
 * @param error - 원본 에러 객체 (개발 환경에서만 포함)
 * @returns 서버 에러 응답
 */
export function createInternalErrorResponse(
  message: string = '서버 내부 오류가 발생했습니다',
  error?: Error
): NextResponse<ErrorResponse> {
  const details =
    process.env.NODE_ENV === 'development' && error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : undefined

  logger.error('서버 내부 에러', {
    message,
    error: error ? error.message : undefined,
  })

  return createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR, message, details)
}

/**
 * 페이지네이션 메타데이터
 */
export interface PaginationMeta {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

/**
 * 페이지네이션 응답 생성
 *
 * @param data - 페이지 데이터
 * @param pagination - 페이지네이션 정보
 * @returns 페이지네이션이 포함된 성공 응답
 *
 * @example
 * ```typescript
 * return createPaginatedResponse(
 *   attendanceRecords,
 *   { page: 1, pageSize: 20, totalItems: 150, totalPages: 8 }
 * )
 * ```
 */
export function createPaginatedResponse<T>(
  data: T[],
  pagination: Omit<PaginationMeta, 'hasNextPage' | 'hasPreviousPage'>
): NextResponse<SuccessResponse<T[]>> {
  const { page, totalPages } = pagination

  const paginationMeta: PaginationMeta = {
    ...pagination,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  }

  return createSuccessResponse(data, undefined, {
    pagination: paginationMeta,
  })
}
