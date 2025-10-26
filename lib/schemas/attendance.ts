/**
 * 출석 관련 Zod 스키마
 *
 * API 요청/응답의 런타임 검증을 위한 스키마 정의
 */

import { z } from 'zod'

/**
 * GPS 좌표 스키마
 */
export const GPSCoordinatesSchema = z.object({
  latitude: z
    .number()
    .min(-90, '위도는 -90 이상이어야 합니다')
    .max(90, '위도는 90 이하여야 합니다'),
  longitude: z
    .number()
    .min(-180, '경도는 -180 이상이어야 합니다')
    .max(180, '경도는 180 이하여야 합니다'),
  accuracy: z
    .number()
    .nonnegative('정확도는 음수일 수 없습니다')
    .optional(),
})

/**
 * 출석 체크인 요청 스키마
 */
export const AttendanceCheckInSchema = z.object({
  sessionId: z
    .string()
    .uuid('유효하지 않은 세션 ID 형식입니다')
    .describe('출석할 수업 세션 ID'),
  latitude: z
    .number()
    .min(-90, '위도는 -90 이상이어야 합니다')
    .max(90, '위도는 90 이하여야 합니다')
    .describe('학생의 현재 위도'),
  longitude: z
    .number()
    .min(-180, '경도는 -180 이상이어야 합니다')
    .max(180, '경도는 180 이하여야 합니다')
    .describe('학생의 현재 경도'),
  accuracy: z
    .number()
    .nonnegative('정확도는 음수일 수 없습니다')
    .default(0)
    .describe('GPS 정확도 (미터)'),
  clientTimestamp: z
    .string()
    .datetime('유효하지 않은 ISO 8601 날짜 형식입니다')
    .describe('클라이언트 타임스탬프 (시계 동기화 검증용)'),
  correlationId: z
    .string()
    .uuid('유효하지 않은 correlation ID 형식입니다')
    .optional()
    .describe('요청 추적용 correlation ID'),
  attemptNumber: z
    .number()
    .int('시도 횟수는 정수여야 합니다')
    .nonnegative('시도 횟수는 음수일 수 없습니다')
    .default(0)
    .describe('재시도 횟수'),
})

export type AttendanceCheckInRequest = z.infer<typeof AttendanceCheckInSchema>

/**
 * Heartbeat 요청 스키마
 */
export const HeartbeatRequestSchema = z.object({
  attendanceId: z
    .string()
    .uuid('유효하지 않은 출석 ID 형식입니다')
    .describe('출석 기록 ID'),
  latitude: z
    .number()
    .min(-90, '위도는 -90 이상이어야 합니다')
    .max(90, '위도는 90 이하여야 합니다')
    .describe('현재 위도'),
  longitude: z
    .number()
    .min(-180, '경도는 -180 이상이어야 합니다')
    .max(180, '경도는 180 이하여야 합니다')
    .describe('현재 경도'),
  accuracy: z
    .number()
    .nonnegative('정확도는 음수일 수 없습니다')
    .default(0)
    .describe('GPS 정확도 (미터)'),
})

export type HeartbeatRequest = z.infer<typeof HeartbeatRequestSchema>

/**
 * Heartbeat 응답 스키마
 */
export const HeartbeatResponseSchema = z.object({
  success: z.boolean(),
  locationValid: z.boolean().describe('현재 위치가 강의실 범위 내인지 여부'),
  distance: z.number().describe('강의실까지의 거리 (미터)'),
  allowedRadius: z.number().describe('허용 반경 (미터)'),
  message: z.string().optional(),
  statusChanged: z.boolean().optional().describe('출석 상태가 변경되었는지 여부'),
  newStatus: z
    .enum(['present', 'absent', 'late', 'left_early'])
    .optional()
    .describe('변경된 출석 상태'),
})

export type HeartbeatResponse = z.infer<typeof HeartbeatResponseSchema>

/**
 * 위치 추적 요청 스키마
 */
export const LocationTrackRequestSchema = z.object({
  attendanceId: z
    .string()
    .uuid('유효하지 않은 출석 ID 형식입니다')
    .describe('출석 기록 ID'),
  latitude: z
    .number()
    .min(-90, '위도는 -90 이상이어야 합니다')
    .max(90, '위도는 90 이하여야 합니다'),
  longitude: z
    .number()
    .min(-180, '경도는 -180 이상이어야 합니다')
    .max(180, '경도는 180 이하여야 합니다'),
  accuracy: z
    .number()
    .nonnegative('정확도는 음수일 수 없습니다')
    .default(0),
})

export type LocationTrackRequest = z.infer<typeof LocationTrackRequestSchema>

/**
 * 출석 상태 Enum
 */
export const AttendanceStatusSchema = z.enum([
  'present',
  'absent',
  'late',
  'left_early',
])

export type AttendanceStatus = z.infer<typeof AttendanceStatusSchema>

/**
 * 출석 제출 요청 스키마
 */
export const AttendanceSubmitSchema = z.object({
  sessionId: z.string().uuid('유효하지 않은 세션 ID 형식입니다'),
  studentId: z.string().min(1, '학생 ID는 필수입니다'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().default(0),
})

export type AttendanceSubmitRequest = z.infer<typeof AttendanceSubmitSchema>
