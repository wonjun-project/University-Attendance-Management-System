/**
 * CSRF (Cross-Site Request Forgery) 보호 미들웨어
 *
 * Double Submit Cookie 패턴을 사용하여 CSRF 공격을 방지합니다.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'

const logger = createLogger('csrf')

/**
 * CSRF 토큰 쿠키 이름
 */
const CSRF_COOKIE_NAME = 'csrf-token'

/**
 * CSRF 토큰 헤더 이름
 */
const CSRF_HEADER_NAME = 'x-csrf-token'

/**
 * CSRF 토큰 생성
 *
 * @returns 랜덤 CSRF 토큰
 */
export function generateCSRFToken(): string {
  // 128비트 (16바이트) 랜덤 토큰 생성
  const buffer = new Uint8Array(16)
  crypto.getRandomValues(buffer)

  // base64url 인코딩 (URL-safe)
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * CSRF 토큰 검증 미들웨어
 *
 * Double Submit Cookie 패턴:
 * 1. 쿠키에 저장된 CSRF 토큰
 * 2. 요청 헤더에 포함된 CSRF 토큰
 * 두 토큰이 일치해야 요청 허용
 *
 * @param request - Next.js 요청 객체
 * @returns 검증 실패 시 NextResponse, 성공 시 null
 *
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const csrfResult = validateCSRFToken(request)
 *   if (csrfResult) return csrfResult
 *
 *   // ... API 로직
 * }
 * ```
 */
export function validateCSRFToken(request: NextRequest): NextResponse | null {
  // GET, HEAD, OPTIONS 요청은 CSRF 검증 불필요
  // (읽기 전용 작업이므로 CSRF 공격 대상이 아님)
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return null
  }

  // 쿠키에서 CSRF 토큰 가져오기
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value

  // 헤더에서 CSRF 토큰 가져오기
  const headerToken = request.headers.get(CSRF_HEADER_NAME)

  // 토큰이 없는 경우
  if (!cookieToken || !headerToken) {
    logger.warn('CSRF 토큰 누락', {
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
      method: request.method,
      url: request.url,
    })

    return NextResponse.json(
      {
        error: 'CSRF 토큰이 누락되었습니다',
        code: 'CSRF_TOKEN_MISSING',
      },
      { status: 403 }
    )
  }

  // 토큰이 일치하지 않는 경우
  if (cookieToken !== headerToken) {
    logger.warn('CSRF 토큰 불일치', {
      method: request.method,
      url: request.url,
      cookieTokenLength: cookieToken.length,
      headerTokenLength: headerToken.length,
    })

    return NextResponse.json(
      {
        error: 'CSRF 토큰이 유효하지 않습니다',
        code: 'CSRF_TOKEN_INVALID',
      },
      { status: 403 }
    )
  }

  // 검증 성공
  logger.debug('CSRF 토큰 검증 성공', {
    method: request.method,
    url: request.url,
  })

  return null
}

/**
 * CSRF 토큰을 응답에 설정
 *
 * 새로운 CSRF 토큰을 생성하여 쿠키에 저장하고
 * 응답 헤더에도 포함시킵니다.
 *
 * @param response - Next.js 응답 객체
 * @returns CSRF 토큰이 설정된 응답 객체
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const response = NextResponse.json({ success: true })
 *   return setCSRFToken(response)
 * }
 * ```
 */
export function setCSRFToken(response: NextResponse): NextResponse {
  const token = generateCSRFToken()

  // 쿠키에 CSRF 토큰 저장
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // JavaScript에서 읽을 수 있어야 함
    sameSite: 'strict', // CSRF 방지
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24, // 24시간
  })

  // 응답 헤더에도 CSRF 토큰 포함 (클라이언트가 사용)
  response.headers.set(CSRF_HEADER_NAME, token)

  logger.debug('CSRF 토큰 생성 및 설정 완료', {
    tokenLength: token.length,
  })

  return response
}

/**
 * CSRF 보호가 적용된 API 핸들러 래퍼
 *
 * @param handler - API 라우트 핸들러
 * @returns CSRF 검증이 적용된 핸들러
 *
 * @example
 * ```typescript
 * export const POST = withCSRFProtection(async (request: NextRequest) => {
 *   // ... API 로직
 *   return NextResponse.json({ success: true })
 * })
 * ```
 */
export function withCSRFProtection(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
): (request: NextRequest, context?: any) => Promise<NextResponse> {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    // CSRF 토큰 검증
    const csrfResult = validateCSRFToken(request)
    if (csrfResult) {
      return csrfResult
    }

    // 핸들러 실행
    const response = await handler(request, context)

    // 응답에 새로운 CSRF 토큰 설정 (토큰 회전)
    return setCSRFToken(response)
  }
}

/**
 * CSRF 토큰을 가져오는 클라이언트 유틸리티
 *
 * 브라우저에서 쿠키에 저장된 CSRF 토큰을 읽습니다.
 *
 * @returns CSRF 토큰 또는 null
 */
export function getCSRFTokenFromCookie(): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === CSRF_COOKIE_NAME) {
      return decodeURIComponent(value)
    }
  }

  return null
}

/**
 * CSRF 토큰이 포함된 fetch 옵션 생성
 *
 * @param options - 기존 fetch 옵션
 * @returns CSRF 토큰이 포함된 fetch 옵션
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/data', withCSRFHeaders({
 *   method: 'POST',
 *   body: JSON.stringify({ data: 'value' })
 * }))
 * ```
 */
export function withCSRFHeaders(options: RequestInit = {}): RequestInit {
  const token = getCSRFTokenFromCookie()

  if (!token) {
    console.warn('CSRF 토큰을 찾을 수 없습니다. 요청이 실패할 수 있습니다.')
  }

  return {
    ...options,
    headers: {
      ...options.headers,
      [CSRF_HEADER_NAME]: token || '',
    },
  }
}
