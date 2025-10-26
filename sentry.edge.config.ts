/**
 * Sentry Edge Runtime 설정
 *
 * Edge Runtime (Middleware 등)에서 발생하는 에러를 자동으로 Sentry에 리포팅합니다.
 */

import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN

Sentry.init({
  dsn: SENTRY_DSN,

  // 환경 설정
  environment: process.env.NODE_ENV || 'development',

  // 트레이스 샘플링 비율
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // 디버그 모드
  debug: process.env.NODE_ENV === 'development',
})
