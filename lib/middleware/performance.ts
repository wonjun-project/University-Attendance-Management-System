/**
 * API 성능 측정 미들웨어
 *
 * API 라우트의 응답 시간을 측정하고 느린 응답을 감지합니다.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api-performance')

/**
 * 성능 측정 설정
 */
export interface PerformanceConfig {
  /**
   * 경고 임계값 (밀리초)
   * 이 시간을 초과하면 경고 로그 기록
   */
  warningThreshold?: number

  /**
   * 에러 임계값 (밀리초)
   * 이 시간을 초과하면 에러 로그 기록
   */
  errorThreshold?: number

  /**
   * 엔드포인트 이름 (로깅용)
   */
  endpointName?: string
}

/**
 * 기본 설정
 */
const DEFAULT_CONFIG: Required<PerformanceConfig> = {
  warningThreshold: 1000, // 1초
  errorThreshold: 3000, // 3초
  endpointName: 'unknown',
}

/**
 * API 핸들러의 타입
 */
type APIHandler = (
  request: NextRequest,
  context?: any
) => Promise<NextResponse> | NextResponse

/**
 * API 성능 측정 미들웨어
 *
 * API 라우트 핸들러를 래핑하여 응답 시간을 측정합니다.
 *
 * @param handler - API 라우트 핸들러
 * @param config - 성능 측정 설정
 * @returns 래핑된 핸들러
 *
 * @example
 * ```typescript
 * export const POST = withPerformance(
 *   async (request: NextRequest) => {
 *     // ... API 로직
 *     return NextResponse.json({ success: true })
 *   },
 *   {
 *     endpointName: '/api/attendance/checkin',
 *     warningThreshold: 500,
 *     errorThreshold: 2000
 *   }
 * )
 * ```
 */
export function withPerformance(
  handler: APIHandler,
  config: PerformanceConfig = {}
): APIHandler {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const startTime = performance.now()
    const method = request.method
    const url = request.url
    const endpointName = finalConfig.endpointName || url

    // 요청 ID 생성 (추적용)
    const requestId = crypto.randomUUID()

    logger.debug(`API 요청 시작: ${method} ${endpointName}`, {
      requestId,
      method,
      url,
    })

    let response: NextResponse
    let error: unknown = null
    let statusCode = 0

    try {
      // 핸들러 실행
      response = await handler(request, context)
      statusCode = response.status
    } catch (err) {
      error = err
      statusCode = 500

      logger.error(`API 요청 중 에러 발생: ${method} ${endpointName}`, {
        requestId,
        errorMessage: err instanceof Error ? err.message : String(err),
      })

      // 에러를 다시 던져서 Next.js의 에러 처리가 작동하도록 함
      throw err
    } finally {
      // 응답 시간 계산
      const duration = performance.now() - startTime
      const durationMs = Math.round(duration)

      // 성공/실패 판단
      const success = !error && statusCode >= 200 && statusCode < 400

      // 로그 레벨 결정
      let logLevel: 'debug' | 'info' | 'warn' | 'error' = 'debug'
      if (error || !success) {
        logLevel = 'error'
      } else if (durationMs >= finalConfig.errorThreshold) {
        logLevel = 'error'
      } else if (durationMs >= finalConfig.warningThreshold) {
        logLevel = 'warn'
      } else {
        logLevel = 'info'
      }

      // 로그 메시지 생성
      const logMessage = `API 요청 완료: ${method} ${endpointName}`
      const logMetadata = {
        requestId,
        method,
        statusCode,
        duration: durationMs,
        success,
        slow: durationMs >= finalConfig.warningThreshold,
      }

      // 로그 기록
      if (logLevel === 'error') {
        logger.error(logMessage, logMetadata)
      } else if (logLevel === 'warn') {
        logger.warn(logMessage, logMetadata)
      } else if (logLevel === 'info') {
        logger.info(logMessage, logMetadata)
      } else {
        logger.debug(logMessage, logMetadata)
      }

      // 응답 헤더에 성능 정보 추가 (디버깅용)
      if (response!) {
        response.headers.set('X-Response-Time', `${durationMs}ms`)
        response.headers.set('X-Request-ID', requestId)
      }
    }

    return response!
  }
}

/**
 * 프리셋: 빠른 API용 (500ms 경고, 1.5초 에러)
 */
export const withFastAPIPerformance = (handler: APIHandler, endpointName: string) =>
  withPerformance(handler, {
    endpointName,
    warningThreshold: 500,
    errorThreshold: 1500,
  })

/**
 * 프리셋: 일반 API용 (1초 경고, 3초 에러)
 */
export const withStandardAPIPerformance = (handler: APIHandler, endpointName: string) =>
  withPerformance(handler, {
    endpointName,
    warningThreshold: 1000,
    errorThreshold: 3000,
  })

/**
 * 프리셋: 느린 API용 (2초 경고, 5초 에러)
 */
export const withSlowAPIPerformance = (handler: APIHandler, endpointName: string) =>
  withPerformance(handler, {
    endpointName,
    warningThreshold: 2000,
    errorThreshold: 5000,
  })

/**
 * 엔드포인트별 성능 통계 추적
 *
 * 메모리 기반 통계 (재시작 시 초기화)
 */
class PerformanceStats {
  private stats = new Map<
    string,
    {
      count: number
      totalDuration: number
      minDuration: number
      maxDuration: number
      errorCount: number
    }
  >()

  /**
   * 통계 기록
   */
  record(endpoint: string, duration: number, isError: boolean): void {
    const existing = this.stats.get(endpoint)

    if (!existing) {
      this.stats.set(endpoint, {
        count: 1,
        totalDuration: duration,
        minDuration: duration,
        maxDuration: duration,
        errorCount: isError ? 1 : 0,
      })
    } else {
      existing.count++
      existing.totalDuration += duration
      existing.minDuration = Math.min(existing.minDuration, duration)
      existing.maxDuration = Math.max(existing.maxDuration, duration)
      if (isError) existing.errorCount++
    }
  }

  /**
   * 통계 조회
   */
  get(endpoint: string) {
    const stat = this.stats.get(endpoint)
    if (!stat) return null

    return {
      ...stat,
      avgDuration: Math.round(stat.totalDuration / stat.count),
      errorRate: stat.errorCount / stat.count,
    }
  }

  /**
   * 전체 통계 조회
   */
  getAll() {
    const result: Record<string, ReturnType<typeof this.get>> = {}
    const entries = Array.from(this.stats.entries())
    for (const [endpoint, _] of entries) {
      result[endpoint] = this.get(endpoint)
    }
    return result
  }

  /**
   * 통계 초기화
   */
  reset(): void {
    this.stats.clear()
  }
}

/**
 * 전역 성능 통계 인스턴스
 */
export const performanceStats = new PerformanceStats()
