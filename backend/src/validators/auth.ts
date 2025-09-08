import { z } from 'zod';

// 로그인 요청 스키마
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, '이메일을 입력해주세요.')
    .email('올바른 이메일 형식을 입력해주세요.')
    .max(255, '이메일은 255자 이내로 입력해주세요.'),
  password: z
    .string()
    .min(1, '비밀번호를 입력해주세요.')
    .min(8, '비밀번호는 최소 8자 이상이어야 합니다.')
    .max(100, '비밀번호는 100자 이내로 입력해주세요.')
});

// 회원가입 요청 스키마
export const registerSchema = z.object({
  email: z
    .string()
    .min(1, '이메일을 입력해주세요.')
    .email('올바른 이메일 형식을 입력해주세요.')
    .max(255, '이메일은 255자 이내로 입력해주세요.')
    .refine(
      (email) => email.includes('@university.ac.kr') || email.includes('@univ.ac.kr'),
      '대학 이메일 주소만 사용 가능합니다. (@university.ac.kr 또는 @univ.ac.kr)'
    ),
  password: z
    .string()
    .min(8, '비밀번호는 최소 8자 이상이어야 합니다.')
    .max(100, '비밀번호는 100자 이내로 입력해주세요.')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      '비밀번호는 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다.'
    ),
  confirmPassword: z
    .string()
    .min(1, '비밀번호 확인을 입력해주세요.'),
  name: z
    .string()
    .min(1, '이름을 입력해주세요.')
    .max(100, '이름은 100자 이내로 입력해주세요.')
    .regex(/^[가-힣a-zA-Z\s]+$/, '이름은 한글, 영문만 입력 가능합니다.'),
  role: z
    .enum(['student', 'professor'], {
      errorMap: () => ({ message: '역할은 student 또는 professor만 가능합니다.' })
    }),
  studentId: z
    .string()
    .optional()
    .refine((val, ctx) => {
      const role = ctx.parent?.role;
      // 학생인 경우 학번이 필수
      if (role === 'student') {
        if (!val) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: '학생은 학번을 입력해주세요.',
          });
          return false;
        }
        // 학번 형식 검증 (예: 2024001)
        if (!/^\d{7}$/.test(val)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: '학번은 7자리 숫자여야 합니다.',
          });
          return false;
        }
      }
      // 교수인 경우 학번이 있으면 안됨
      if (role === 'professor' && val) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '교수는 학번을 입력할 수 없습니다.',
        });
        return false;
      }
      return true;
    }),
  phone: z
    .string()
    .optional()
    .refine((val) => {
      if (!val) return true; // 선택사항이므로 빈 값은 허용
      return /^010-\d{4}-\d{4}$/.test(val);
    }, '휴대폰 번호는 010-0000-0000 형식으로 입력해주세요.')
}).refine((data) => data.password === data.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다.',
  path: ['confirmPassword'],
});

// 비밀번호 재설정 요청 스키마
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, '이메일을 입력해주세요.')
    .email('올바른 이메일 형식을 입력해주세요.')
});

// 비밀번호 변경 스키마
export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, '현재 비밀번호를 입력해주세요.'),
  newPassword: z
    .string()
    .min(8, '새 비밀번호는 최소 8자 이상이어야 합니다.')
    .max(100, '새 비밀번호는 100자 이내로 입력해주세요.')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      '새 비밀번호는 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다.'
    ),
  confirmNewPassword: z
    .string()
    .min(1, '새 비밀번호 확인을 입력해주세요.'),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: '새 비밀번호가 일치하지 않습니다.',
  path: ['confirmNewPassword'],
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: '현재 비밀번호와 새 비밀번호가 같습니다.',
  path: ['newPassword'],
});

// 토큰 갱신 스키마
export const refreshTokenSchema = z.object({
  refreshToken: z
    .string()
    .min(1, '리프레시 토큰을 입력해주세요.')
});

// 프로필 업데이트 스키마
export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, '이름을 입력해주세요.')
    .max(100, '이름은 100자 이내로 입력해주세요.')
    .regex(/^[가-힣a-zA-Z\s]+$/, '이름은 한글, 영문만 입력 가능합니다.')
    .optional(),
  phone: z
    .string()
    .refine((val) => {
      if (!val) return true;
      return /^010-\d{4}-\d{4}$/.test(val);
    }, '휴대폰 번호는 010-0000-0000 형식으로 입력해주세요.')
    .optional()
});

// 타입 추출
export type LoginRequest = z.infer<typeof loginSchema>;
export type RegisterRequest = z.infer<typeof registerSchema>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
export type RefreshTokenRequest = z.infer<typeof refreshTokenSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;