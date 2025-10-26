# 개발자 가이드

## 목차
- [개발 환경 설정](#개발-환경-설정)
- [코드 컨벤션](#코드-컨벤션)
- [새로운 API 엔드포인트 추가하기](#새로운-api-엔드포인트-추가하기)
- [미들웨어 사용하기](#미들웨어-사용하기)
- [데이터베이스 작업](#데이터베이스-작업)
- [에러 처리](#에러-처리)
- [로깅](#로깅)
- [테스팅](#테스팅)
- [보안 체크리스트](#보안-체크리스트)
- [자주 묻는 질문](#자주-묻는-질문)

---

## 개발 환경 설정

### 필수 요구사항
- **Node.js**: 20.x 이상
- **npm**: 10.x 이상
- **Git**: 최신 버전

### 초기 설정

1. **저장소 클론**
```bash
git clone <repository-url>
cd university-attendance-management-system
```

2. **의존성 설치**
```bash
npm install
```

3. **환경 변수 설정**
```bash
cp .env.example .env
```

`.env` 파일 편집:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Auth
JWT_SECRET=your-jwt-secret-minimum-32-characters
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# Sentry (선택)
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
SENTRY_DSN=your-sentry-dsn

# Logging
LOG_LEVEL=debug
```

4. **개발 서버 실행**
```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속

5. **타입 체크**
```bash
npm run type-check
```

6. **빌드 테스트**
```bash
npm run build
```

---

## 코드 컨벤션

### TypeScript 스타일 가이드

**파일 명명 규칙**
- React 컴포넌트: `PascalCase.tsx` (예: `StudentDashboard.tsx`)
- 유틸리티/서비스: `kebab-case.ts` (예: `api-response.ts`)
- API 라우트: `route.ts` (Next.js 규칙)

**변수 명명**
```typescript
// ✅ Good
const userId = 'uuid'
const isAuthenticated = true
const studentRecords = []

// ❌ Bad
const user_id = 'uuid'
const auth = true
const records = []
```

**함수 명명**
```typescript
// ✅ Good - 동사로 시작
function calculateDistance(lat1, lon1, lat2, lon2) { }
async function fetchUserData(userId) { }
function isValidEmail(email) { }

// ❌ Bad
function distance(lat1, lon1, lat2, lon2) { }
function userData(userId) { }
function emailCheck(email) { }
```

**타입 정의**
```typescript
// ✅ Good - 명확한 타입
interface AttendanceRecord {
  id: string
  sessionId: string
  studentId: string
  status: 'present' | 'late' | 'absent' | 'left_early'
  checkedInAt: string
}

// ❌ Bad - any 사용
interface AttendanceRecord {
  id: any
  data: any
}
```

### 파일 구조
```typescript
/**
 * 파일 설명
 *
 * 상세 설명 (필요 시)
 */

// 1. 외부 라이브러리 import
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// 2. 내부 모듈 import (@/ 경로)
import { createLogger } from '@/lib/logger'
import { validateSchema } from '@/lib/utils/validation'

// 3. 타입 정의
interface RequestData {
  // ...
}

// 4. 상수 정의
const MAX_RETRIES = 3

// 5. 헬퍼 함수
function helperFunction() {
  // ...
}

// 6. 메인 export
export async function POST(request: NextRequest) {
  // ...
}
```

### 주석 작성 가이드

**함수 JSDoc**
```typescript
/**
 * GPS 좌표 간 거리 계산 (Haversine 공식)
 *
 * @param lat1 - 첫 번째 지점 위도 (도)
 * @param lon1 - 첫 번째 지점 경도 (도)
 * @param lat2 - 두 번째 지점 위도 (도)
 * @param lon2 - 두 번째 지점 경도 (도)
 * @returns 두 지점 간 거리 (미터)
 *
 * @example
 * ```typescript
 * const distance = calculateDistance(37.5665, 126.9780, 37.5651, 126.9895)
 * console.log(distance) // 약 120 미터
 * ```
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // ...
}
```

**인라인 주석**
```typescript
// ✅ Good - 왜(Why)를 설명
// Haversine 공식은 구면 상의 두 점 사이 거리를 정확하게 계산
const distance = haversineFormula(...)

// ❌ Bad - 무엇(What)을 반복
// distance 변수에 haversineFormula 함수 결과 할당
const distance = haversineFormula(...)
```

---

## 새로운 API 엔드포인트 추가하기

### 1단계: API 라우트 파일 생성

```bash
# 예: /api/students/profile 엔드포인트
touch app/api/students/profile/route.ts
```

### 2단계: Zod 스키마 정의

```typescript
// lib/schemas/student.ts
import { z } from 'zod'

export const StudentProfileUpdateSchema = z.object({
  name: z.string().min(1).max(50),
  email: z.string().email().optional(),
  phoneNumber: z.string().regex(/^01[0-9]-?\d{3,4}-?\d{4}$/).optional(),
})

export type StudentProfileUpdate = z.infer<typeof StudentProfileUpdateSchema>
```

### 3단계: API 핸들러 작성

```typescript
// app/api/students/profile/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-admin'
import { validateSchema } from '@/lib/utils/validation'
import { StudentProfileUpdateSchema } from '@/lib/schemas/student'
import { createSuccessResponse, createErrorResponse, ErrorCodes } from '@/lib/utils/api-response'
import { RateLimitPresets } from '@/lib/middleware/rate-limit'
import { withStandardAPIPerformance } from '@/lib/middleware/performance'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api-student-profile')

/**
 * 학생 프로필 업데이트 핸들러
 */
async function updateProfileHandler(request: NextRequest) {
  // 1. Rate Limiting
  const rateLimitResult = await RateLimitPresets.general(request)
  if (rateLimitResult) return rateLimitResult

  try {
    // 2. 인증 확인
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse(
        ErrorCodes.UNAUTHORIZED,
        '인증이 필요합니다'
      )
    }

    if (user.userType !== 'student') {
      return createErrorResponse(
        ErrorCodes.FORBIDDEN,
        '학생만 접근 가능합니다'
      )
    }

    // 3. 요청 데이터 검증
    const body = await request.json()
    const validated = validateSchema(StudentProfileUpdateSchema, body)
    if (validated instanceof NextResponse) {
      return validated
    }

    // 4. 비즈니스 로직 실행
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('students')
      .update({
        name: validated.name,
        email: validated.email,
        phone_number: validated.phoneNumber,
      })
      .eq('id', user.userId)
      .select()
      .single()

    if (error) {
      logger.error('프로필 업데이트 실패', error, {
        userId: user.userId,
      })
      return createErrorResponse(
        ErrorCodes.DATABASE_ERROR,
        '프로필 업데이트에 실패했습니다'
      )
    }

    // 5. 성공 응답
    logger.info('프로필 업데이트 성공', {
      userId: user.userId,
    })

    return createSuccessResponse(
      {
        profile: data,
      },
      '프로필이 업데이트되었습니다'
    )
  } catch (error) {
    logger.error('예상치 못한 에러', error as Error)
    return createErrorResponse(
      ErrorCodes.INTERNAL_SERVER_ERROR,
      '서버 오류가 발생했습니다'
    )
  }
}

// 6. 성능 모니터링 미들웨어 적용
export const PUT = withStandardAPIPerformance(
  updateProfileHandler,
  '/api/students/profile'
)
```

### 4단계: 테스트

```bash
# Manual test with curl
curl -X PUT http://localhost:3000/api/students/profile \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=<your-token>" \
  -d '{"name":"홍길동","email":"hong@example.com"}'
```

---

## 미들웨어 사용하기

### Rate Limiting

```typescript
import { RateLimitPresets } from '@/lib/middleware/rate-limit'

// 프리셋 사용
export async function POST(request: NextRequest) {
  const rateLimitResult = await RateLimitPresets.auth(request)
  if (rateLimitResult) return rateLimitResult

  // ... 나머지 로직
}

// 커스텀 설정
import { rateLimit } from '@/lib/middleware/rate-limit'

const customRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  maxRequests: 50,
  message: '요청 한도를 초과했습니다',
})

export async function GET(request: NextRequest) {
  const rateLimitResult = await customRateLimit(request)
  if (rateLimitResult) return rateLimitResult

  // ... 나머지 로직
}
```

### CSRF Protection

```typescript
import { withCSRFProtection } from '@/lib/middleware/csrf'

// 래퍼 함수 사용
export const POST = withCSRFProtection(async (request: NextRequest) => {
  // CSRF 검증이 자동으로 수행됨
  // ... 비즈니스 로직
  return NextResponse.json({ success: true })
})

// 또는 수동 검증
import { validateCSRFToken } from '@/lib/middleware/csrf'

export async function POST(request: NextRequest) {
  const csrfResult = validateCSRFToken(request)
  if (csrfResult) return csrfResult

  // ... 나머지 로직
}
```

### Performance Monitoring

```typescript
import {
  withFastAPIPerformance,
  withStandardAPIPerformance,
  withSlowAPIPerformance,
} from '@/lib/middleware/performance'

// Fast API (< 500ms)
export const GET = withFastAPIPerformance(
  async (request) => { /* ... */ },
  '/api/fast-endpoint'
)

// Standard API (< 1000ms)
export const POST = withStandardAPIPerformance(
  async (request) => { /* ... */ },
  '/api/standard-endpoint'
)

// Slow API (< 2000ms) - 파일 업로드 등
export const POST = withSlowAPIPerformance(
  async (request) => { /* ... */ },
  '/api/slow-endpoint'
)
```

---

## 데이터베이스 작업

### Supabase 클라이언트 사용

```typescript
import { createServiceClient } from '@/lib/supabase-admin'

const supabase = createServiceClient()

// SELECT
const { data, error } = await supabase
  .from('students')
  .select('id, name, email')
  .eq('student_id', '202312345')
  .single()

// INSERT
const { data, error } = await supabase
  .from('attendances')
  .insert({
    session_id: sessionId,
    student_id: studentId,
    status: 'present',
    checked_in_at: new Date().toISOString(),
  })
  .select()
  .single()

// UPDATE
const { data, error } = await supabase
  .from('attendances')
  .update({ status: 'left_early' })
  .eq('id', attendanceId)

// DELETE
const { error } = await supabase
  .from('sessions')
  .delete()
  .eq('id', sessionId)
```

### JOIN 쿼리

```typescript
// 학생의 출석 기록 + 세션 정보
const { data, error } = await supabase
  .from('attendances')
  .select(`
    id,
    status,
    checked_in_at,
    sessions (
      id,
      start_time,
      courses (
        name,
        code
      )
    )
  `)
  .eq('student_id', studentId)
```

### 트랜잭션 (RPC 사용)

```sql
-- Supabase SQL Editor에서 함수 생성
CREATE OR REPLACE FUNCTION create_session_with_attendances(
  p_course_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ
)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
BEGIN
  -- 세션 생성
  INSERT INTO sessions (course_id, start_time, end_time)
  VALUES (p_course_id, p_start_time, p_end_time)
  RETURNING id INTO v_session_id;

  -- 수강생 출석 레코드 자동 생성
  INSERT INTO attendances (session_id, student_id, status)
  SELECT v_session_id, e.student_id, 'absent'
  FROM enrollments e
  WHERE e.course_id = p_course_id;

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;
```

```typescript
// TypeScript에서 호출
const { data, error } = await supabase
  .rpc('create_session_with_attendances', {
    p_course_id: courseId,
    p_start_time: startTime,
    p_end_time: endTime,
  })
```

---

## 에러 처리

### 표준 에러 응답 사용

```typescript
import {
  createErrorResponse,
  createValidationErrorResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
  createInternalErrorResponse,
  ErrorCodes,
} from '@/lib/utils/api-response'

// 일반 에러
return createErrorResponse(
  ErrorCodes.INVALID_INPUT,
  '유효하지 않은 입력입니다'
)

// 검증 에러
return createValidationErrorResponse([
  { field: 'email', message: '유효한 이메일을 입력하세요' },
  { field: 'password', message: '비밀번호는 6자 이상이어야 합니다' },
])

// 401 Unauthorized
return createUnauthorizedResponse()

// 403 Forbidden
return createForbiddenResponse('교수만 접근 가능합니다')

// 404 Not Found
return createNotFoundResponse('세션')

// 500 Internal Server Error
return createInternalErrorResponse(
  '서버 오류가 발생했습니다',
  error as Error // 개발 환경에서만 스택 포함
)
```

### Try-Catch 패턴

```typescript
export async function POST(request: NextRequest) {
  try {
    // 비즈니스 로직
    const result = await doSomething()
    return createSuccessResponse(result)
  } catch (error) {
    // 로그 기록
    logger.error('작업 실패', error as Error, {
      context: 'additional info',
    })

    // Sentry 리포팅 (자동)

    // 사용자에게 친절한 에러 메시지
    return createInternalErrorResponse(
      '작업을 완료할 수 없습니다',
      error as Error
    )
  }
}
```

---

## 로깅

### 기본 사용법

```typescript
import { createLogger } from '@/lib/logger'

const logger = createLogger('my-module')

// 레벨별 로깅
logger.debug('디버그 정보', { detail: 'value' })
logger.info('정보성 메시지', { userId: '123' })
logger.warn('경고', { reason: 'unusual activity' })
logger.error('에러 발생', error, { context: 'important' })
```

### 타이머 사용

```typescript
const endTimer = logger.startTimer()

// ... 작업 수행

const elapsed = endTimer() // 밀리초 반환
logger.info(`작업 완료`, { duration: elapsed })
```

### Child Logger

```typescript
const baseLogger = createLogger('api')
const authLogger = baseLogger.child('auth')
const loginLogger = authLogger.child('login')

loginLogger.info('로그인 시도', { userId: '123' })
// Output: [api:auth:login] 로그인 시도 {"userId":"123"}
```

### 베스트 프랙티스

```typescript
// ✅ Good - 구조화된 메타데이터
logger.info('출석 체크인 성공', {
  studentId: '202312345',
  sessionId: 'uuid',
  distance: 15.5,
  accuracy: 10.2,
})

// ❌ Bad - 문자열 연결
logger.info(`출석 체크인 성공: studentId=${studentId}, sessionId=${sessionId}`)

// ✅ Good - 민감정보 제외
logger.info('사용자 인증 성공', {
  userId: user.id,
  userType: user.type,
  // password: user.password ❌ 절대 로그하지 않기!
})
```

---

## 테스팅

### Unit Test 예제

```typescript
// lib/utils/__tests__/geo.test.ts
import { describe, it, expect } from '@jest/globals'
import { calculateDistance, isWithinRadius } from '../geo'

describe('calculateDistance', () => {
  it('같은 좌표는 거리 0', () => {
    const distance = calculateDistance(37.5665, 126.9780, 37.5665, 126.9780)
    expect(distance).toBe(0)
  })

  it('서울-부산 거리 약 325km', () => {
    const distance = calculateDistance(37.5665, 126.9780, 35.1796, 129.0756)
    expect(distance).toBeGreaterThan(320000)
    expect(distance).toBeLessThan(330000)
  })

  it('유효하지 않은 좌표는 에러', () => {
    expect(() => calculateDistance(91, 0, 0, 0)).toThrow()
    expect(() => calculateDistance(0, 181, 0, 0)).toThrow()
  })
})

describe('isWithinRadius', () => {
  it('범위 내 좌표는 true', () => {
    const coords1 = { latitude: 37.5665, longitude: 126.9780 }
    const coords2 = { latitude: 37.5666, longitude: 126.9781 }
    expect(isWithinRadius(coords1, coords2, 50)).toBe(true)
  })

  it('범위 밖 좌표는 false', () => {
    const coords1 = { latitude: 37.5665, longitude: 126.9780 }
    const coords2 = { latitude: 37.5700, longitude: 126.9900 }
    expect(isWithinRadius(coords1, coords2, 50)).toBe(false)
  })
})
```

### Integration Test 예제

```typescript
// tests/integration/auth.test.ts
import { describe, it, expect } from '@jest/globals'

describe('POST /api/auth/login', () => {
  it('유효한 인증 정보로 로그인 성공', async () => {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: '202312345',
        password: 'password123',
        userType: 'student',
      }),
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.user.type).toBe('student')

    // 쿠키 확인
    const cookies = response.headers.get('set-cookie')
    expect(cookies).toContain('auth-token')
  })

  it('잘못된 비밀번호는 401', async () => {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: '202312345',
        password: 'wrongpassword',
        userType: 'student',
      }),
    })

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('INVALID_CREDENTIALS')
  })
})
```

---

## 보안 체크리스트

새로운 API를 작성할 때 다음 사항을 확인하세요:

- [ ] **인증 확인**: `getCurrentUser()` 호출
- [ ] **권한 확인**: 학생/교수 role 체크
- [ ] **입력 검증**: Zod 스키마 사용
- [ ] **Rate Limiting**: 적절한 제한 적용
- [ ] **CSRF 보호**: 민감한 작업에 CSRF 토큰 검증
- [ ] **SQL Injection 방지**: Supabase 클라이언트 사용 (raw SQL 금지)
- [ ] **XSS 방지**: 사용자 입력 새니타이제이션
- [ ] **민감정보 로깅 금지**: 비밀번호, 토큰 등
- [ ] **에러 메시지**: 과도한 정보 노출 방지
- [ ] **HTTPS 필수**: 프로덕션에서 HTTPS 강제

---

## 자주 묻는 질문

### Q1: Service Role Key vs Anon Key 언제 사용하나요?

**Service Role Key:**
- 서버 사이드 (API Routes)에서만 사용
- RLS 우회 가능
- 절대 클라이언트에 노출 금지
- 환경 변수: `SUPABASE_SERVICE_ROLE_KEY`

**Anon Key:**
- 클라이언트/서버 모두 사용 가능
- RLS 정책 적용됨
- 공개 가능
- 환경 변수: `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Q2: 왜 console.log 대신 logger를 사용해야 하나요?

```typescript
// ❌ Bad
console.log('User logged in:', userId)

// ✅ Good
logger.info('사용자 로그인', { userId })
```

**이유:**
1. 구조화된 로그 (JSON 형식)
2. 로그 레벨 필터링 가능
3. 클라우드 로깅 시스템 호환
4. 타임스탬프, 스코프 자동 추가
5. 프로덕션에서 debug 로그 자동 제거

### Q3: Rate Limit을 어떻게 테스트하나요?

```bash
# 5번 연속 요청
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"id":"test","password":"test","userType":"student"}'
  echo "\n"
done

# 6번째 요청은 429 반환
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"id":"test","password":"test","userType":"student"}' \
  -w "%{http_code}"
```

### Q4: 환경 변수가 undefined로 나옵니다

**체크리스트:**
1. `.env` 파일 존재 확인
2. `NEXT_PUBLIC_` 접두사 확인 (클라이언트 사용 시)
3. 개발 서버 재시작 (`.env` 변경 후)
4. `.env` 파일 위치 확인 (프로젝트 루트)
5. Vercel 배포: 환경 변수 설정 확인

### Q5: CORS 에러가 발생합니다

Next.js API Routes는 기본적으로 같은 도메인만 허용합니다.

CORS 허용이 필요한 경우:
```typescript
// app/api/your-endpoint/route.ts
export async function POST(request: NextRequest) {
  // CORS 헤더 추가
  const response = NextResponse.json({ data: '...' })

  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')

  return response
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
```

---

## 유용한 명령어

```bash
# 개발 서버 실행
npm run dev

# TypeScript 타입 체크
npm run type-check

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행 (빌드 후)
npm start

# ESLint 검사
npm run lint

# 테스트 실행 (향후)
npm test

# Supabase CLI (설치 필요)
supabase db reset
supabase db push
supabase db pull
```

---

## 추가 자료

- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Zod Documentation](https://zod.dev/)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript)
- [Sentry Next.js Integration](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
