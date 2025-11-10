/**
 * Web Vitals 성능 모니터링
 *
 * Next.js 내장 Web Vitals를 활용하여
 * 실제 사용자 경험 지표를 수집합니다.
 */

import { createLogger } from '@/lib/logger'

const logger = createLogger('web-vitals')

/**
 * Web Vitals 메트릭 타입
 */
export type WebVitalsMetric = {
  id: string
  name: 'FCP' | 'LCP' | 'CLS' | 'FID' | 'TTFB' | 'INP'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  navigationType: 'navigate' | 'reload' | 'back-forward' | 'prerender'
}

/**
 * Web Vitals 임계값 (Google 권장 기준)
 */
const THRESHOLDS = {
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  CLS: { good: 0.1, poor: 0.25 },
  FID: { good: 100, poor: 300 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 200, poor: 500 },
} as const

/**
 * 메트릭 등급 계산
 */
function getRating(
  name: WebVitalsMetric['name'],
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name]
  if (value <= threshold.good) return 'good'
  if (value <= threshold.poor) return 'needs-improvement'
  return 'poor'
}

/**
 * Web Vitals 리포터
 *
 * Next.js의 reportWebVitals에서 호출되어
 * 성능 메트릭을 로그에 기록합니다.
 *
 * @example
 * ```typescript
 * // app/layout.tsx
 * export function reportWebVitals(metric: NextWebVitalsMetric) {
 *   reportWebVitals(metric)
 * }
 * ```
 */
export function reportWebVitals(metric: WebVitalsMetric): void {
  const { id, name, value, delta, navigationType } = metric
  const rating = getRating(name, value)

  // 'poor' 등급인 경우 경고 로그
  if (rating === 'poor') {
    logger.warn(`Web Vitals 성능 저하: ${name}`, {
      id,
      value: Math.round(value),
      rating,
      delta: Math.round(delta),
      navigationType,
      threshold: THRESHOLDS[name],
    })
  } else {
    // 정상 범위는 디버그 로그
    logger.debug(`Web Vitals: ${name}`, {
      id,
      value: Math.round(value),
      rating,
      delta: Math.round(delta),
      navigationType,
    })
  }
}

/**
 * 페이지 로드 완료 시간 측정
 *
 * @example
 * ```typescript
 * // 페이지 컴포넌트에서
 * useEffect(() => {
 *   measurePageLoad('student-dashboard')
 * }, [])
 * ```
 */
export function measurePageLoad(pageName: string): void {
  if (typeof window === 'undefined') return

  const navigationTiming = performance.getEntriesByType(
    'navigation'
  )[0] as PerformanceNavigationTiming

  if (!navigationTiming) {
    logger.warn('Navigation Timing API를 사용할 수 없습니다')
    return
  }

  const pageLoadTime = navigationTiming.loadEventEnd - navigationTiming.fetchStart
  const domContentLoaded =
    navigationTiming.domContentLoadedEventEnd - navigationTiming.fetchStart
  const timeToInteractive = navigationTiming.domInteractive - navigationTiming.fetchStart

  logger.info(`페이지 로드 완료: ${pageName}`, {
    pageLoadTime: Math.round(pageLoadTime),
    domContentLoaded: Math.round(domContentLoaded),
    timeToInteractive: Math.round(timeToInteractive),
  })
}

/**
 * 사용자 인터랙션 측정
 *
 * @example
 * ```typescript
 * const endMeasure = measureInteraction('qr-scan')
 * // ... QR 스캔 로직
 * endMeasure() // 측정 종료
 * ```
 */
export function measureInteraction(interactionName: string): () => void {
  const startTime = performance.now()

  logger.debug(`인터랙션 시작: ${interactionName}`)

  return () => {
    const duration = performance.now() - startTime

    logger.info(`인터랙션 완료: ${interactionName}`, {
      duration: Math.round(duration),
    })

    // 느린 인터랙션 경고 (300ms 이상)
    if (duration > 300) {
      logger.warn(`느린 인터랙션: ${interactionName}`, {
        duration: Math.round(duration),
        threshold: 300,
      })
    }
  }
}

/**
 * API 호출 시간 측정
 *
 * @example
 * ```typescript
 * const endMeasure = measureAPICall('POST', '/api/attendance/checkin')
 * const response = await fetch('/api/attendance/checkin', { method: 'POST', ... })
 * endMeasure(response.ok ? 'success' : 'error')
 * ```
 */
export function measureAPICall(
  method: string,
  endpoint: string
): (status: 'success' | 'error') => void {
  const startTime = performance.now()

  return (status: 'success' | 'error') => {
    const duration = performance.now() - startTime

    logger.info(`API 호출 완료: ${method} ${endpoint}`, {
      duration: Math.round(duration),
      status,
    })

    // 느린 API 경고 (2초 이상)
    if (duration > 2000) {
      logger.warn(`느린 API 응답: ${method} ${endpoint}`, {
        duration: Math.round(duration),
        threshold: 2000,
        status,
      })
    }

    // 에러 상태 추적
    if (status === 'error') {
      logger.error(`API 에러: ${method} ${endpoint}`, {
        duration: Math.round(duration),
      })
    }
  }
}
