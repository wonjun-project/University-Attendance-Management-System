/**
 * CSRF 토큰 관리 훅
 *
 * 클라이언트에서 CSRF 토큰을 관리하고 fetch 요청에 포함시킵니다.
 */

'use client'

import { useEffect, useState } from 'react'
import { getCSRFTokenFromCookie, withCSRFHeaders } from '@/lib/middleware/csrf'

/**
 * CSRF 토큰 훅
 *
 * @returns CSRF 토큰과 CSRF 헤더가 포함된 fetch 함수
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { csrfToken, fetchWithCSRF } = useCSRF()
 *
 *   const handleSubmit = async () => {
 *     const response = await fetchWithCSRF('/api/data', {
 *       method: 'POST',
 *       body: JSON.stringify({ value: 'data' })
 *     })
 *   }
 * }
 * ```
 */
export function useCSRF() {
  const [csrfToken, setCSRFToken] = useState<string | null>(null)

  // 컴포넌트 마운트 시 CSRF 토큰 로드
  useEffect(() => {
    const token = getCSRFTokenFromCookie()
    setCSRFToken(token)

    // 토큰이 없으면 서버에서 가져오기
    if (!token) {
      fetch('/api/csrf', { method: 'GET' })
        .then((res) => res.json())
        .then(() => {
          // 응답 후 쿠키에서 토큰 다시 읽기
          const newToken = getCSRFTokenFromCookie()
          setCSRFToken(newToken)
        })
        .catch((error) => {
          console.error('CSRF 토큰 로드 실패:', error)
        })
    }
  }, [])

  /**
   * CSRF 헤더가 자동으로 포함된 fetch 함수
   */
  const fetchWithCSRF = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    return fetch(input, withCSRFHeaders(init))
  }

  return {
    csrfToken,
    fetchWithCSRF,
    hasCSRFToken: !!csrfToken,
  }
}
