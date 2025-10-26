/**
 * CSRF 토큰 발급 API
 *
 * 클라이언트가 CSRF 토큰을 요청할 때 사용합니다.
 */

import { NextRequest, NextResponse } from 'next/server'
import { setCSRFToken } from '@/lib/middleware/csrf'

/**
 * CSRF 토큰 발급
 *
 * GET 요청으로 새로운 CSRF 토큰을 생성하여
 * 쿠키와 응답 헤더에 포함시킵니다.
 */
export async function GET(request: NextRequest) {
  const response = NextResponse.json({
    success: true,
    message: 'CSRF token generated',
  })

  return setCSRFToken(response)
}
