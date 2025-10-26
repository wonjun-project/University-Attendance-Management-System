/**
 * 입력 새니타이제이션 유틸리티
 *
 * XSS(Cross-Site Scripting) 공격을 방지하기 위한
 * 사용자 입력 검증 및 새니타이제이션 함수
 */

import { createLogger } from '@/lib/logger'

const logger = createLogger('sanitize')

/**
 * HTML 특수 문자 이스케이프 맵
 */
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
}

/**
 * HTML 문자열을 안전하게 이스케이프
 *
 * @param text - 이스케이프할 텍스트
 * @returns 이스케이프된 텍스트
 *
 * @example
 * ```typescript
 * escapeHTML('<script>alert("XSS")</script>')
 * // => '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
 * ```
 */
export function escapeHTML(text: string): string {
  return text.replace(/[&<>"'/]/g, (char) => HTML_ESCAPE_MAP[char] || char)
}

/**
 * 위험한 HTML 태그 제거
 *
 * @param text - 새니타이즈할 텍스트
 * @returns 위험한 태그가 제거된 텍스트
 *
 * @example
 * ```typescript
 * stripDangerousHTML('Hello <script>alert("XSS")</script> World')
 * // => 'Hello  World'
 * ```
 */
export function stripDangerousHTML(text: string): string {
  // 위험한 태그 목록
  const dangerousTags = [
    'script',
    'iframe',
    'object',
    'embed',
    'link',
    'style',
    'form',
    'input',
    'button',
    'textarea',
    'select',
    'option',
  ]

  let result = text

  for (const tag of dangerousTags) {
    // 여는 태그와 닫는 태그 모두 제거 (대소문자 무시, 속성 포함)
    const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gis')
    result = result.replace(regex, '')

    // 자체 닫힘 태그 제거
    const selfClosingRegex = new RegExp(`<${tag}[^>]*/>`, 'gi')
    result = result.replace(selfClosingRegex, '')

    // 닫히지 않은 태그 제거
    const openTagRegex = new RegExp(`<${tag}[^>]*>`, 'gi')
    result = result.replace(openTagRegex, '')
  }

  return result
}

/**
 * JavaScript 이벤트 핸들러 속성 제거
 *
 * @param text - 새니타이즈할 텍스트
 * @returns 이벤트 핸들러가 제거된 텍스트
 *
 * @example
 * ```typescript
 * stripEventHandlers('<div onclick="alert(\'XSS\')">Click me</div>')
 * // => '<div >Click me</div>'
 * ```
 */
export function stripEventHandlers(text: string): string {
  // on으로 시작하는 이벤트 핸들러 속성 제거
  return text.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
}

/**
 * JavaScript URL 제거
 *
 * @param text - 새니타이즈할 텍스트
 * @returns javascript: URL이 제거된 텍스트
 *
 * @example
 * ```typescript
 * stripJavaScriptURLs('<a href="javascript:alert(\'XSS\')">Click</a>')
 * // => '<a href="">Click</a>'
 * ```
 */
export function stripJavaScriptURLs(text: string): string {
  return text.replace(/javascript:\s*/gi, '')
}

/**
 * 포괄적인 XSS 새니타이제이션
 *
 * 여러 XSS 방어 기법을 조합하여 텍스트를 안전하게 만듭니다.
 *
 * @param text - 새니타이즈할 텍스트
 * @returns 새니타이즈된 텍스트
 *
 * @example
 * ```typescript
 * sanitizeForHTML('<script>alert("XSS")</script><div onclick="hack()">Text</div>')
 * // => 'Text'
 * ```
 */
export function sanitizeForHTML(text: string): string {
  let result = text

  // 1. 위험한 태그 제거
  result = stripDangerousHTML(result)

  // 2. 이벤트 핸들러 제거
  result = stripEventHandlers(result)

  // 3. JavaScript URL 제거
  result = stripJavaScriptURLs(result)

  // 4. 나머지 HTML 특수 문자 이스케이프
  result = escapeHTML(result)

  return result
}

/**
 * SQL Injection 방지를 위한 입력 검증
 *
 * @param text - 검증할 텍스트
 * @returns 의심스러운 SQL 키워드 포함 여부
 */
export function containsSQLInjection(text: string): boolean {
  const sqlKeywords = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /(--|\*\/|\/\*|;|'|")/g,
    /(\bOR\b.*=.*\bOR\b)/gi,
    /(\bAND\b.*=.*\bAND\b)/gi,
    /(1=1|1='1'|'=')/gi,
  ]

  for (const pattern of sqlKeywords) {
    if (pattern.test(text)) {
      logger.warn('SQL Injection 시도 감지', {
        text: text.substring(0, 100), // 처음 100자만 로그
        pattern: pattern.source,
      })
      return true
    }
  }

  return false
}

/**
 * 안전한 이름 검증 (한글, 영문, 공백만 허용)
 *
 * @param name - 검증할 이름
 * @returns 유효성 여부
 *
 * @example
 * ```typescript
 * isValidName('홍길동') // true
 * isValidName('John Doe') // true
 * isValidName('<script>alert()</script>') // false
 * ```
 */
export function isValidName(name: string): boolean {
  // 한글, 영문, 공백만 허용 (1-50자)
  return /^[가-힣a-zA-Z\s]{1,50}$/.test(name)
}

/**
 * 안전한 숫자 문자열 검증
 *
 * @param value - 검증할 값
 * @returns 숫자 문자열 여부
 */
export function isNumericString(value: string): boolean {
  return /^\d+$/.test(value)
}

/**
 * URL 안전성 검증
 *
 * @param url - 검증할 URL
 * @returns URL 안전성 여부
 */
export function isSafeURL(url: string): boolean {
  try {
    const parsed = new URL(url)

    // HTTP(S) 프로토콜만 허용
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      logger.warn('안전하지 않은 URL 프로토콜', {
        protocol: parsed.protocol,
        url: url.substring(0, 100),
      })
      return false
    }

    // javascript:, data:, vbscript: 등 차단
    if (/^(javascript|data|vbscript|file|about):/i.test(url)) {
      logger.warn('위험한 URL 스킴 감지', {
        url: url.substring(0, 100),
      })
      return false
    }

    return true
  } catch (error) {
    logger.warn('URL 파싱 실패', {
      url: url.substring(0, 100),
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

/**
 * 파일 이름 새니타이제이션
 *
 * @param filename - 새니타이즈할 파일 이름
 * @returns 안전한 파일 이름
 *
 * @example
 * ```typescript
 * sanitizeFilename('../../../etc/passwd')
 * // => 'passwd'
 *
 * sanitizeFilename('file<script>.txt')
 * // => 'filescript.txt'
 * ```
 */
export function sanitizeFilename(filename: string): string {
  return (
    filename
      // 경로 구분자 제거
      .replace(/[\/\\]/g, '')
      // 특수 문자 제거
      .replace(/[^a-zA-Z0-9._-]/g, '')
      // 연속된 점 제거 (경로 탐색 방지)
      .replace(/\.{2,}/g, '.')
      // 앞뒤 점 제거
      .replace(/^\.+|\.+$/g, '')
      // 길이 제한 (255자)
      .substring(0, 255)
  )
}

/**
 * 이메일 주소 검증 (간단한 형식 검증)
 *
 * @param email - 검증할 이메일
 * @returns 유효성 여부
 */
export function isValidEmailFormat(email: string): boolean {
  // RFC 5322 간소화 버전
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

/**
 * 전화번호 검증 (한국 형식)
 *
 * @param phone - 검증할 전화번호
 * @returns 유효성 여부
 *
 * @example
 * ```typescript
 * isValidPhoneNumber('010-1234-5678') // true
 * isValidPhoneNumber('01012345678') // true
 * isValidPhoneNumber('not-a-phone') // false
 * ```
 */
export function isValidPhoneNumber(phone: string): boolean {
  // 한국 휴대폰 번호 형식
  return /^01[0-9]-?\d{3,4}-?\d{4}$/.test(phone)
}

/**
 * JSON 문자열 안전성 검증
 *
 * @param jsonString - 검증할 JSON 문자열
 * @returns 파싱 가능 여부 및 파싱된 객체
 */
export function safeJSONParse<T = unknown>(
  jsonString: string
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = JSON.parse(jsonString) as T
    return { success: true, data }
  } catch (error) {
    logger.warn('JSON 파싱 실패', {
      error: error instanceof Error ? error.message : String(error),
      jsonPreview: jsonString.substring(0, 100),
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 문자열 길이 제한
 *
 * @param text - 제한할 텍스트
 * @param maxLength - 최대 길이
 * @returns 길이가 제한된 텍스트
 */
export function limitLength(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }

  logger.debug('문자열 길이 제한 적용', {
    originalLength: text.length,
    maxLength,
  })

  return text.substring(0, maxLength)
}

/**
 * 앞뒤 공백 제거 및 중복 공백 정규화
 *
 * @param text - 정규화할 텍스트
 * @returns 정규화된 텍스트
 */
export function normalizeWhitespace(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}
