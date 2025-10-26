/**
 * 구조화된 로깅 시스템
 *
 * JSON 형식의 구조화된 로그를 제공하며,
 * Cloud Logging (Google Cloud, AWS CloudWatch 등)과 호환됩니다.
 */

/**
 * 로그 레벨
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

/**
 * 로그 메타데이터 인터페이스
 */
export interface LogMetadata {
  [key: string]: unknown
  correlationId?: string
  userId?: string
  sessionId?: string
  scope?: string
  duration?: number
  statusCode?: number
  error?: Error | string
}

/**
 * 로그 엔트리 인터페이스
 */
interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  metadata?: LogMetadata
  environment: string
  service: string
}

/**
 * Logger 클래스
 */
class Logger {
  private service: string
  private environment: string
  private minLevel: LogLevel

  constructor(service: string = 'attendance-system') {
    this.service = service
    this.environment = process.env.NODE_ENV || 'development'

    // 환경별 로그 레벨 설정
    this.minLevel = this.getMinLogLevel()
  }

  /**
   * 환경별 최소 로그 레벨 결정
   */
  private getMinLogLevel(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase()

    switch (envLevel) {
      case 'error':
        return LogLevel.ERROR
      case 'warn':
        return LogLevel.WARN
      case 'info':
        return LogLevel.INFO
      case 'debug':
        return LogLevel.DEBUG
      default:
        // 프로덕션은 INFO, 개발은 DEBUG
        return this.environment === 'production' ? LogLevel.INFO : LogLevel.DEBUG
    }
  }

  /**
   * 로그 레벨 우선순위 확인
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      [LogLevel.ERROR]: 3,
      [LogLevel.WARN]: 2,
      [LogLevel.INFO]: 1,
      [LogLevel.DEBUG]: 0,
    }

    return levels[level] >= levels[this.minLevel]
  }

  /**
   * 로그 엔트리 생성 및 출력
   */
  log(level: LogLevel, message: string, metadata?: LogMetadata): void {
    if (!this.shouldLog(level)) {
      return
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      environment: this.environment,
      service: this.service,
    }

    if (metadata && Object.keys(metadata).length > 0) {
      // Error 객체를 직렬화 가능한 형태로 변환
      const cleanMetadata = { ...metadata }
      if (cleanMetadata.error instanceof Error) {
        cleanMetadata.error = {
          name: cleanMetadata.error.name,
          message: cleanMetadata.error.message,
          stack: cleanMetadata.error.stack,
        }
      }
      entry.metadata = cleanMetadata
    }

    // JSON 형식으로 출력
    if (level === LogLevel.ERROR) {
      console.error(JSON.stringify(entry))
    } else if (level === LogLevel.WARN) {
      console.warn(JSON.stringify(entry))
    } else {
      console.log(JSON.stringify(entry))
    }
  }

  /**
   * ERROR 레벨 로그
   */
  error(message: string, metadata?: LogMetadata): void
  error(message: string, error: Error, metadata?: LogMetadata): void
  error(
    message: string,
    errorOrMetadata?: Error | LogMetadata,
    maybeMetadata?: LogMetadata
  ): void {
    let metadata: LogMetadata = {}

    if (errorOrMetadata instanceof Error) {
      metadata.error = errorOrMetadata
      if (maybeMetadata) {
        metadata = { ...metadata, ...maybeMetadata }
      }
    } else if (errorOrMetadata) {
      metadata = errorOrMetadata
    }

    this.log(LogLevel.ERROR, message, metadata)
  }

  /**
   * WARN 레벨 로그
   */
  warn(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.WARN, message, metadata)
  }

  /**
   * INFO 레벨 로그
   */
  info(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.INFO, message, metadata)
  }

  /**
   * DEBUG 레벨 로그
   */
  debug(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.DEBUG, message, metadata)
  }

  /**
   * 성능 측정 시작
   *
   * @returns 경과 시간을 반환하는 함수
   *
   * @example
   * ```typescript
   * const timer = logger.startTimer()
   * // ... 작업 수행
   * logger.info('작업 완료', { duration: timer() })
   * ```
   */
  startTimer(): () => number {
    const start = Date.now()
    return () => Date.now() - start
  }

  /**
   * 특정 스코프를 가진 자식 로거 생성
   *
   * @param scope - 로거 스코프 (예: 'attendance-api', 'qr-service')
   * @returns 스코프가 설정된 자식 로거
   *
   * @example
   * ```typescript
   * const attendanceLogger = logger.child('attendance-api')
   * attendanceLogger.info('출석 체크 시작') // scope: 'attendance-api' 포함
   * ```
   */
  child(scope: string): ScopedLogger {
    return new ScopedLogger(this, scope)
  }
}

/**
 * 스코프가 설정된 로거
 */
class ScopedLogger {
  constructor(
    private parent: Logger,
    private scope: string
  ) {}

  private addScope(metadata?: LogMetadata): LogMetadata {
    return {
      ...metadata,
      scope: this.scope,
    }
  }

  error(message: string, metadata?: LogMetadata): void
  error(message: string, error: Error, metadata?: LogMetadata): void
  error(
    message: string,
    errorOrMetadata?: Error | LogMetadata,
    maybeMetadata?: LogMetadata
  ): void {
    if (errorOrMetadata instanceof Error) {
      this.parent.error(message, errorOrMetadata, this.addScope(maybeMetadata))
    } else {
      this.parent.error(message, this.addScope(errorOrMetadata))
    }
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.parent.warn(message, this.addScope(metadata))
  }

  info(message: string, metadata?: LogMetadata): void {
    this.parent.info(message, this.addScope(metadata))
  }

  debug(message: string, metadata?: LogMetadata): void {
    this.parent.debug(message, this.addScope(metadata))
  }

  startTimer(): () => number {
    return this.parent.startTimer()
  }

  child(subScope: string): ScopedLogger {
    return new ScopedLogger(this.parent, `${this.scope}:${subScope}`)
  }
}

/**
 * 전역 로거 인스턴스
 */
export const logger = new Logger()

/**
 * 특정 스코프를 위한 로거 생성 헬퍼
 *
 * @example
 * ```typescript
 * const authLogger = createLogger('auth-service')
 * authLogger.info('사용자 로그인 성공', { userId: '123' })
 * ```
 */
export function createLogger(scope: string): ScopedLogger {
  return logger.child(scope)
}

/**
 * HTTP 요청 로깅 헬퍼
 *
 * @example
 * ```typescript
 * import { NextRequest } from 'next/server'
 *
 * export async function POST(request: NextRequest) {
 *   const timer = logger.startTimer()
 *
 *   try {
 *     // ... 처리
 *     logHttpRequest(request, 200, timer())
 *     return NextResponse.json({ success: true })
 *   } catch (error) {
 *     logHttpRequest(request, 500, timer(), error)
 *     return NextResponse.json({ error: 'Internal error' }, { status: 500 })
 *   }
 * }
 * ```
 */
export function logHttpRequest(
  request: Request,
  statusCode: number,
  duration: number,
  error?: Error | unknown
): void {
  const metadata: LogMetadata = {
    method: request.method,
    url: request.url,
    statusCode,
    duration,
  }

  if (error) {
    metadata.error = error instanceof Error ? error : String(error)
  }

  const level = statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO

  logger.log(level, `HTTP ${request.method} ${request.url}`, metadata)
}

/**
 * 기존 console.log 스타일을 구조화된 로그로 변환하는 헬퍼
 *
 * @deprecated 새 코드에서는 logger.info() 등을 직접 사용하세요
 *
 * @example
 * ```typescript
 * // 기존 코드
 * console.log(JSON.stringify({ scope: 'auth', event: 'login', userId: '123' }))
 *
 * // 변환 후
 * legacyLog({ scope: 'auth', event: 'login', userId: '123' })
 * ```
 */
export function legacyLog(data: Record<string, unknown>): void {
  const { scope, event, ...metadata } = data
  const message = event ? String(event) : 'log'
  const scopeLogger = scope ? logger.child(String(scope)) : logger

  scopeLogger.info(message, metadata)
}
