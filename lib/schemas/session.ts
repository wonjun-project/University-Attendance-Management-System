/**
 * 세션 관련 Zod 스키마
 */

import { z } from 'zod'

/**
 * 세션 상태 Enum
 */
export const SessionStatusSchema = z.enum(['scheduled', 'active', 'ended'])

export type SessionStatus = z.infer<typeof SessionStatusSchema>

/**
 * 세션 생성 요청 스키마
 */
export const SessionCreateRequestSchema = z.object({
  courseId: z
    .string()
    .uuid('유효하지 않은 강의 ID 형식입니다')
    .describe('강의 ID'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD 여야 합니다')
    .describe('수업 날짜'),
  duration: z
    .number()
    .int('지속 시간은 정수여야 합니다')
    .min(1, '지속 시간은 최소 1분 이상이어야 합니다')
    .max(300, '지속 시간은 최대 300분 이하여야 합니다')
    .default(10)
    .describe('세션 지속 시간 (분)'),
})

export type SessionCreateRequest = z.infer<typeof SessionCreateRequestSchema>

/**
 * 세션 응답 스키마
 */
export const SessionResponseSchema = z.object({
  id: z.string().uuid().describe('세션 ID'),
  courseId: z.string().uuid().describe('강의 ID'),
  date: z.string().describe('수업 날짜'),
  qrCode: z.string().describe('QR 코드'),
  qrCodeExpiresAt: z.string().datetime().describe('QR 코드 만료 시간'),
  status: SessionStatusSchema.describe('세션 상태'),
  createdAt: z.string().datetime().describe('생성 시간'),
})

export type SessionResponse = z.infer<typeof SessionResponseSchema>
