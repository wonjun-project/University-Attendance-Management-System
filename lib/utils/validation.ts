/**
 * Zod 기반 검증 유틸리티
 *
 * API 요청/응답의 런타임 검증 헬퍼 함수
 */

import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { createLogger } from '@/lib/logger'

const logger = createLogger('validation')

/**
 * 검증 에러 응답 인터페이스
 */
export interface ValidationErrorResponse {
  error: string
  code: 'VALIDATION_ERROR'
  details: Array<{
    path: string
    message: string
  }>
}

/**
 * Zod 스키마로 데이터 검증
 *
 * @param schema - Zod 스키마
 * @param data - 검증할 데이터
 * @returns 검증 성공 시 파싱된 데이터, 실패 시 NextResponse (400)
 *
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const body = await request.json()
 *   const result = validateSchema(LoginRequestSchema, body)
 *
 *   if (result instanceof NextResponse) {
 *     return result // 검증 실패 응답 반환
 *   }
 *
 *   // result는 타입 안전한 LoginRequest
 *   const { id, password, userType } = result
 * }
 * ```
 */
export function validateSchema<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): z.infer<T> | NextResponse<ValidationErrorResponse> {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }))

      logger.warn('요청 검증 실패', {
        errorCount: details.length,
        details,
      })

      return NextResponse.json<ValidationErrorResponse>(
        {
          error: '요청 데이터가 유효하지 않습니다',
          code: 'VALIDATION_ERROR',
          details,
        },
        { status: 400 }
      )
    }

    // Zod 에러가 아닌 경우
    if (error instanceof Error) {
      logger.error('예상치 못한 검증 에러', error)
    } else {
      logger.error('예상치 못한 검증 에러', { errorMessage: String(error) })
    }
    return NextResponse.json<ValidationErrorResponse>(
      {
        error: '검증 중 오류가 발생했습니다',
        code: 'VALIDATION_ERROR',
        details: [],
      },
      { status: 500 }
    )
  }
}

/**
 * Zod 스키마로 데이터 검증 (안전 버전)
 *
 * @param schema - Zod 스키마
 * @param data - 검증할 데이터
 * @returns 성공 시 { success: true, data }, 실패 시 { success: false, error }
 *
 * @example
 * ```typescript
 * const result = safeValidate(LoginRequestSchema, body)
 *
 * if (!result.success) {
 *   console.error(result.error)
 *   return NextResponse.json({ error: result.error }, { status: 400 })
 * }
 *
 * const { id, password } = result.data
 * ```
 */
export function safeValidate<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
):
  | { success: true; data: z.infer<T> }
  | { success: false; error: ValidationErrorResponse } {
  try {
    const parsed = schema.parse(data)
    return { success: true, data: parsed }
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }))

      return {
        success: false,
        error: {
          error: '요청 데이터가 유효하지 않습니다',
          code: 'VALIDATION_ERROR',
          details,
        },
      }
    }

    return {
      success: false,
      error: {
        error: '검증 중 오류가 발생했습니다',
        code: 'VALIDATION_ERROR',
        details: [],
      },
    }
  }
}

/**
 * 타입 가드: UUID 검증
 */
export function isValidUUID(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(value)
}

/**
 * 타입 가드: 이메일 검증
 */
export function isValidEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(value)
}

/**
 * 타입 가드: 학번 검증 (9자리 숫자)
 */
export function isValidStudentId(value: unknown): value is string {
  if (typeof value !== 'string') return false
  return /^\d{9}$/.test(value)
}

/**
 * 타입 가드: 날짜 형식 검증 (YYYY-MM-DD)
 */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/**
 * 타입 가드: ISO 8601 datetime 검증
 */
export function isValidISO8601(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const date = new Date(value)
    return !isNaN(date.getTime()) && value === date.toISOString()
  } catch {
    return false
  }
}

/**
 * 객체가 특정 키를 가지고 있는지 타입 안전하게 확인
 */
export function hasKey<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj
}

/**
 * 에러 객체인지 확인하는 타입 가드
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error
}

/**
 * 문자열 배열인지 확인하는 타입 가드
 */
export function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  )
}
