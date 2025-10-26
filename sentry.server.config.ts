/**
 * Sentry 서버 설정
 *
 * 서버 사이드(API Routes, SSR)에서 발생하는 에러를 자동으로 Sentry에 리포팅합니다.
 */

import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN

Sentry.init({
  dsn: SENTRY_DSN,

  // 환경 설정
  environment: process.env.NODE_ENV || 'development',

  // 트레이스 샘플링 비율
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // 에러 필터링
  beforeSend(event, hint) {
    // 개발 환경에서는 Sentry에 전송하지 않음 (콘솔 로그만)
    if (process.env.NODE_ENV === 'development') {
      console.log('[Sentry Server]', event)
      return null
    }

    // 특정 에러 무시
    const error = hint.originalException
    if (error instanceof Error) {
      // Supabase 연결 에러 중 일시적인 에러는 무시
      if (error.message.includes('ETIMEDOUT') || error.message.includes('ECONNREFUSED')) {
        return null
      }
    }

    return event
  },

  // 디버그 모드
  debug: process.env.NODE_ENV === 'development',
})
