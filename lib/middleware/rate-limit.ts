/**
 * Rate Limiting 미들웨어
 *
 * API 엔드포인트의 무차별 대입 공격 및 남용을 방지하기 위한
 * 슬라이딩 윈도우 기반 Rate Limiting 구현
 */

import { NextRequest, NextResponse } from 'next/server'

/**
 * Rate Limit 설정 인터페이스
 */
export interface RateLimitConfig {
  /** 제한 시간 윈도우 (밀리초) */
  windowMs: number
  /** 윈도우 내 최대 요청 수 */
  maxRequests: number
  /** 사용자 식별자 추출 함수 (선택사항) */
  keyGenerator?: (request: NextRequest) => string | Promise<string>
  /** Rate limit 초과 시 메시지 */
  message?: string
  /** 헤더에 제한 정보 포함 여부 */
  standardHeaders?: boolean
  /** Legacy 헤더 포함 여부 (X-RateLimit-*) */
  legacyHeaders?: boolean
  /** Rate limit 초과 시 skip 옵션 (테스트용) */
  skip?: (request: NextRequest) => boolean | Promise<boolean>
}

/**
 * Rate Limit 요청 기록
 */
interface RequestRecord {
  /** 요청 타임스탬프 배열 (밀리초) */
  timestamps: number[]
  /** 마지막 업데이트 시간 */
  lastUpdated: number
}

/**
 * 메모리 기반 Rate Limit 스토어
 */
class MemoryStore {
  private store = new Map<string, RequestRecord>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // 5분마다 오래된 기록 정리
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  /**
   * 요청 기록 추가 및 현재 카운트 반환
   */
  hit(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now()
    const windowStart = now - windowMs

    // 기존 기록 가져오기 또는 새로 생성
    let record = this.store.get(key)
    if (!record) {
      record = { timestamps: [], lastUpdated: now }
      this.store.set(key, record)
    }

    // 윈도우 밖의 오래된 타임스탬프 제거
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart)

    // 현재 요청 타임스탬프 추가
    record.timestamps.push(now)
    record.lastUpdated = now

    // 가장 오래된 타임스탬프 + windowMs = 리셋 시간
    const oldestTimestamp = record.timestamps[0] || now
    const resetTime = oldestTimestamp + windowMs

    return {
      count: record.timestamps.length,
      resetTime,
    }
  }

  /**
   * 특정 키의 현재 요청 수 조회
   */
  get(key: string, windowMs: number): number {
    const record = this.store.get(key)
    if (!record) return 0

    const now = Date.now()
    const windowStart = now - windowMs

    // 윈도우 내 타임스탬프만 카운트
    const validTimestamps = record.timestamps.filter((ts) => ts > windowStart)
    return validTimestamps.length
  }

  /**
   * 특정 키 삭제
   */
  reset(key: string): void {
    this.store.delete(key)
  }

  /**
   * 오래된 기록 정리
   */
  private cleanup(): void {
    const now = Date.now()
    const maxAge = 15 * 60 * 1000 // 15분

    // Convert to array to avoid iterator issues with older TypeScript targets
    const entries = Array.from(this.store.entries())
    for (const [key, record] of entries) {
      if (now - record.lastUpdated > maxAge) {
        this.store.delete(key)
      }
    }
  }

  /**
   * 전체 스토어 초기화 (테스트용)
   */
  clear(): void {
    this.store.clear()
  }

  /**
   * cleanup interval 정리
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.clear()
  }
}

// 전역 메모리 스토어 인스턴스
const globalStore = new MemoryStore()

/**
 * 클라이언트 IP 주소 추출
 */
function getClientIp(request: NextRequest): string {
  // Vercel/Cloudflare/Nginx 프록시 헤더 확인
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }

  // Cloudflare
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp.trim()
  }

  // 폴백: 'unknown' (로컬 개발 환경)
  return 'unknown'
}

/**
 * Rate Limit 미들웨어 생성
 *
 * @param config - Rate Limit 설정
 * @returns Rate Limit 체크 함수
 *
 * @example
 * ```typescript
 * // API Route에서 사용
 * const limiter = rateLimit({
 *   windowMs: 60 * 1000, // 1분
 *   maxRequests: 5,
 *   message: '너무 많은 요청입니다. 잠시 후 다시 시도하세요.'
 * })
 *
 * export async function POST(request: NextRequest) {
 *   const rateLimitResult = await limiter(request)
 *   if (rateLimitResult) {
 *     return rateLimitResult // Rate limit 초과 응답 반환
 *   }
 *
 *   // 정상 처리
 *   return NextResponse.json({ success: true })
 * }
 * ```
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    keyGenerator,
    message = '너무 많은 요청입니다. 잠시 후 다시 시도하세요.',
    standardHeaders = true,
    legacyHeaders = false,
    skip,
  } = config

  return async function rateLimiter(
    request: NextRequest
  ): Promise<NextResponse | null> {
    // Skip 함수가 있고 true를 반환하면 제한 없이 통과
    if (skip && (await skip(request))) {
      return null
    }

    // 키 생성 (IP 기반 또는 커스텀)
    const key = keyGenerator
      ? await keyGenerator(request)
      : getClientIp(request)

    // Rate limit 체크 및 기록
    const { count, resetTime } = globalStore.hit(key, windowMs)

    // 헤더 설정
    const headers: Record<string, string> = {}

    if (standardHeaders) {
      headers['RateLimit-Limit'] = maxRequests.toString()
      headers['RateLimit-Remaining'] = Math.max(0, maxRequests - count).toString()
      headers['RateLimit-Reset'] = new Date(resetTime).toISOString()
    }

    if (legacyHeaders) {
      headers['X-RateLimit-Limit'] = maxRequests.toString()
      headers['X-RateLimit-Remaining'] = Math.max(
        0,
        maxRequests - count
      ).toString()
      headers['X-RateLimit-Reset'] = Math.floor(resetTime / 1000).toString()
    }

    // Rate limit 초과 여부 확인
    if (count > maxRequests) {
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000)

      return NextResponse.json(
        {
          error: message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter,
          limit: maxRequests,
          current: count,
        },
        {
          status: 429,
          headers: {
            ...headers,
            'Retry-After': retryAfter.toString(),
          },
        }
      )
    }

    // Rate limit 내: 헤더만 추가하고 null 반환 (정상 처리 계속)
    // 참고: Next.js API Route에서는 여기서 헤더를 직접 추가할 수 없으므로
    // 실제 응답에서 헤더를 추가해야 함
    return null
  }
}

/**
 * 미리 정의된 Rate Limit 프리셋
 */
export const RateLimitPresets = {
  /** 로그인 API (5 req/min) */
  auth: rateLimit({
    windowMs: 60 * 1000,
    maxRequests: 5,
    message: '로그인 시도 횟수를 초과했습니다. 1분 후 다시 시도하세요.',
  }),

  /** 출석 체크인 API (10 req/min) */
  checkin: rateLimit({
    windowMs: 60 * 1000,
    maxRequests: 10,
    message: '출석 체크 요청이 너무 많습니다. 잠시 후 다시 시도하세요.',
  }),

  /** QR 코드 생성 API (20 req/hour) */
  qrGenerate: rateLimit({
    windowMs: 60 * 60 * 1000,
    maxRequests: 20,
    message: 'QR 코드 생성 횟수를 초과했습니다. 1시간 후 다시 시도하세요.',
  }),

  /** 일반 API (100 req/min) */
  general: rateLimit({
    windowMs: 60 * 1000,
    maxRequests: 100,
    message: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.',
  }),
}

/**
 * 사용자 ID 기반 Rate Limit 키 생성기
 *
 * @example
 * ```typescript
 * const limiter = rateLimit({
 *   windowMs: 60 * 1000,
 *   maxRequests: 10,
 *   keyGenerator: createUserBasedKeyGenerator(async (req) => {
 *     const user = await getCurrentUser()
 *     return user?.userId || 'anonymous'
 *   })
 * })
 * ```
 */
export function createUserBasedKeyGenerator(
  getUserId: (request: NextRequest) => Promise<string | null>
) {
  return async function keyGenerator(request: NextRequest): Promise<string> {
    const userId = await getUserId(request)
    const ip = getClientIp(request)

    // 사용자 ID + IP로 키 생성 (이중 제한)
    return userId ? `user:${userId}:${ip}` : `ip:${ip}`
  }
}

/**
 * 스토어 초기화 (테스트용)
 */
export function resetRateLimitStore(): void {
  globalStore.clear()
}

/**
 * 스토어 정리 (앱 종료 시)
 */
export function destroyRateLimitStore(): void {
  globalStore.destroy()
}
