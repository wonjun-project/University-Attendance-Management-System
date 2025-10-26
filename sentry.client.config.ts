/**
 * Sentry 클라이언트 설정
 *
 * 프론트엔드(브라우저)에서 발생하는 에러를 자동으로 Sentry에 리포팅합니다.
 */

import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn: SENTRY_DSN,

  // 환경 설정
  environment: process.env.NODE_ENV || 'development',

  // 트레이스 샘플링 비율 (0.0 ~ 1.0)
  // 프로덕션: 10%, 개발: 100%
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // 세션 재생 샘플링 (사용자 행동 기록)
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // 통합 설정
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true, // 개인정보 보호
      blockAllMedia: true,
    }),
  ],

  // 에러 필터링
  beforeSend(event, hint) {
    // 개발 환경에서는 Sentry에 전송하지 않음
    if (process.env.NODE_ENV === 'development') {
      console.log('[Sentry Client]', event)
      return null
    }

    // 특정 에러 무시
    const error = hint.originalException
    if (error instanceof Error) {
      // 네트워크 에러 무시 (사용자 연결 문제)
      if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
        return null
      }
    }

    return event
  },

  // 디버그 모드 (개발 환경에서만)
  debug: process.env.NODE_ENV === 'development',
})
