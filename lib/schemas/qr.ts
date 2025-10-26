/**
 * QR 코드 관련 Zod 스키마
 */

import { z } from 'zod'

/**
 * QR 코드 데이터 스키마
 */
export const QRCodeDataSchema = z.object({
  sessionId: z
    .string()
    .uuid('유효하지 않은 세션 ID 형식입니다')
    .describe('수업 세션 ID'),
  courseId: z
    .string()
    .uuid('유효하지 않은 강의 ID 형식입니다')
    .describe('강의 ID'),
  expiresAt: z
    .string()
    .datetime('유효하지 않은 ISO 8601 날짜 형식입니다')
    .describe('QR 코드 만료 시간'),
  type: z
    .literal('attendance')
    .default('attendance')
    .describe('QR 코드 타입'),
  baseUrl: z
    .string()
    .url('유효하지 않은 URL 형식입니다')
    .optional()
    .describe('베이스 URL'),
})

export type QRCodeData = z.infer<typeof QRCodeDataSchema>

/**
 * QR 코드 생성 요청 스키마
 */
export const QRCodeGenerateRequestSchema = z.object({
  courseId: z
    .string()
    .uuid('유효하지 않은 강의 ID 형식입니다')
    .describe('강의 ID'),
  duration: z
    .number()
    .int('지속 시간은 정수여야 합니다')
    .min(1, '지속 시간은 최소 1분 이상이어야 합니다')
    .max(180, '지속 시간은 최대 180분 이하여야 합니다')
    .default(10)
    .describe('QR 코드 유효 시간 (분)'),
})

export type QRCodeGenerateRequest = z.infer<typeof QRCodeGenerateRequestSchema>

/**
 * QR 코드 생성 응답 스키마
 */
export const QRCodeGenerateResponseSchema = z.object({
  sessionId: z.string().uuid().describe('생성된 세션 ID'),
  qrCode: z.string().describe('QR 코드 문자열 (JSON)'),
  qrCodeUrl: z.string().url().optional().describe('QR 코드 URL'),
  expiresAt: z.string().datetime().describe('만료 시간'),
})

export type QRCodeGenerateResponse = z.infer<typeof QRCodeGenerateResponseSchema>
