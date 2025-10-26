/**
 * Web Vitals Reporter 클라이언트 컴포넌트
 *
 * Next.js의 useReportWebVitals 훅을 사용하여
 * 실시간으로 성능 메트릭을 수집합니다.
 */

'use client'

import { useReportWebVitals } from 'next/web-vitals'
import { reportWebVitals } from '@/lib/monitoring/web-vitals'

/**
 * Web Vitals 리포터 컴포넌트
 *
 * 루트 레이아웃에 추가하여 전역적으로 성능 메트릭을 수집합니다.
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    reportWebVitals(metric as any)
  })

  return null
}
