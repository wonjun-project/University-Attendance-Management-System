/**
 * 인증 관련 Zod 스키마
 */

import { z } from 'zod'

/**
 * 사용자 타입 Enum
 */
export const UserTypeSchema = z.enum(['student', 'professor'])

export type UserType = z.infer<typeof UserTypeSchema>

/**
 * 로그인 요청 스키마
 */
export const LoginRequestSchema = z.object({
  id: z
    .string()
    .min(1, 'ID를 입력해주세요')
    .describe('학번 또는 교수번호'),
  password: z
    .string()
    .min(1, '비밀번호를 입력해주세요')
    .describe('비밀번호'),
  userType: UserTypeSchema.describe('사용자 타입 (student/professor)'),
})

export type LoginRequest = z.infer<typeof LoginRequestSchema>

/**
 * 회원가입 요청 스키마
 */
export const SignupRequestSchema = z
  .object({
    name: z
      .string()
      .min(1, '이름을 입력해주세요')
      .max(50, '이름은 50자 이하여야 합니다')
      .describe('사용자 이름'),
    password: z
      .string()
      .min(6, '비밀번호는 최소 6자 이상이어야 합니다')
      .max(100, '비밀번호는 100자 이하여야 합니다')
      .describe('비밀번호'),
    userType: UserTypeSchema.describe('사용자 타입'),
    studentId: z
      .string()
      .regex(/^\d{9}$/, '학번은 9자리 숫자여야 합니다 (예: 202012345)')
      .optional()
      .describe('학번 (학생만 필수)'),
    professorId: z
      .string()
      .min(1, '교수번호를 입력해주세요')
      .optional()
      .describe('교수번호 (교수만 필수)'),
  })
  .refine(
    (data) => {
      // 학생이면 studentId 필수
      if (data.userType === 'student') {
        return !!data.studentId
      }
      // 교수이면 professorId 필수
      if (data.userType === 'professor') {
        return !!data.professorId
      }
      return false
    },
    {
      message: '학생은 학번, 교수는 교수번호가 필수입니다',
      path: ['userType'],
    }
  )

export type SignupRequest = z.infer<typeof SignupRequestSchema>

/**
 * 인증 응답 스키마
 */
export const AuthUserSchema = z.object({
  id: z.string().describe('사용자 ID'),
  name: z.string().describe('사용자 이름'),
  type: UserTypeSchema.describe('사용자 타입'),
})

export type AuthUser = z.infer<typeof AuthUserSchema>

/**
 * JWT 페이로드 스키마
 */
export const JWTPayloadSchema = z.object({
  userId: z.string().describe('사용자 ID'),
  userType: UserTypeSchema.describe('사용자 타입'),
  name: z.string().describe('사용자 이름'),
  iat: z.number().optional().describe('발급 시간'),
  exp: z.number().optional().describe('만료 시간'),
})

export type JWTPayload = z.infer<typeof JWTPayloadSchema>
