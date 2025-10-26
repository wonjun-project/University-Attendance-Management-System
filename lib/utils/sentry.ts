/**
 * Sentry 에러 리포팅 유틸리티
 *
 * API 라우트 및 서버 컴포넌트에서 사용하는 Sentry 헬퍼 함수
 */

import * as Sentry from '@sentry/nextjs'
import { createLogger } from '@/lib/logger'

const logger = createLogger('sentry')

/**
 * 에러를 Sentry에 리포팅하고 로그 기록
 *
 * @param error - 리포팅할 에러
 * @param context - 추가 컨텍스트 정보
 *
 * @example
 * ```typescript
 * try {
 *   // ... 작업
 * } catch (error) {
 *   captureError(error, {
 *     userId: user.id,
 *     endpoint: '/api/attendance/checkin',
 *     sessionId: '123'
 *   })
 *   return NextResponse.json({ error: '오류 발생' }, { status: 500 })
 * }
 * ```
 */
export function captureError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  // 로그 기록
  if (error instanceof Error) {
    logger.error('에러 발생', error, context)
  } else {
    logger.error('에러 발생', { errorMessage: String(error), ...context })
  }

  // Sentry에 리포팅
  if (error instanceof Error) {
    Sentry.captureException(error, {
      extra: context,
      level: 'error',
    })
  } else {
    Sentry.captureMessage(String(error), {
      extra: context,
      level: 'error',
    })
  }
}

/**
 * 사용자 정보 설정
 *
 * @param user - 사용자 정보
 *
 * @example
 * ```typescript
 * setUser({
 *   id: user.userId,
 *   email: user.email,
 *   username: user.name
 * })
 * ```
 */
export function setUser(user: {
  id: string
  email?: string
  username?: string
}): void {
  Sentry.setUser(user)
}

/**
 * 사용자 정보 제거 (로그아웃 시)
 */
export function clearUser(): void {
  Sentry.setUser(null)
}

/**
 * 커스텀 메시지 리포팅
 *
 * @param message - 메시지
 * @param level - 심각도 레벨
 * @param context - 추가 컨텍스트
 *
 * @example
 * ```typescript
 * captureMessage('비정상적인 GPS 정확도', 'warning', {
 *   accuracy: 500,
 *   userId: user.id
 * })
 * ```
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: Record<string, unknown>
): void {
  logger.info(message, context)

  Sentry.captureMessage(message, {
    level,
    extra: context,
  })
}

/**
 * Span 시작 (성능 모니터링)
 *
 * Note: Sentry v8+에서는 startTransaction이 deprecated되어 startSpan을 사용합니다.
 * 현재는 기능 비활성화 상태입니다. 필요 시 Sentry.startSpan()을 직접 사용하세요.
 *
 * @example
 * ```typescript
 * // Sentry.startSpan 직접 사용
 * await Sentry.startSpan({
 *   name: 'attendance-checkin',
 *   op: 'http.request'
 * }, async (span) => {
 *   // ... 작업
 * })
 * ```
 */
export function startPerformanceMonitoring(name: string, op: string) {
  // Placeholder - Sentry v8+ 마이그레이션 필요
  logger.debug('성능 모니터링 시작', { name, op })
  return {
    finish: () => logger.debug('성능 모니터링 종료', { name, op }),
  }
}

/**
 * 태그 설정 (이벤트 분류용)
 *
 * @param tags - 태그 객체
 *
 * @example
 * ```typescript
 * setTags({
 *   'user.type': 'student',
 *   'api.endpoint': '/api/attendance/checkin'
 * })
 * ```
 */
export function setTags(tags: Record<string, string>): void {
  Sentry.setTags(tags)
}

/**
 * Breadcrumb 추가 (이벤트 추적 경로)
 *
 * @param category - 카테고리
 * @param message - 메시지
 * @param level - 심각도
 * @param data - 추가 데이터
 *
 * @example
 * ```typescript
 * addBreadcrumb('auth', 'User logged in', 'info', { userId: '123' })
 * addBreadcrumb('location', 'GPS location acquired', 'debug', { accuracy: 10 })
 * ```
 */
export function addBreadcrumb(
  category: string,
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    level,
    data,
  })
}
