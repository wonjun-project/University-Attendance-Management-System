# 시스템 아키텍처 문서

## 목차
- [전체 아키텍처](#전체-아키텍처)
- [기술 스택](#기술-스택)
- [디렉토리 구조](#디렉토리-구조)
- [데이터베이스 스키마](#데이터베이스-스키마)
- [인증 플로우](#인증-플로우)
- [출석 체크인 플로우](#출석-체크인-플로우)
- [보안 아키텍처](#보안-아키텍처)
- [성능 모니터링](#성능-모니터링)
- [배포 아키텍처](#배포-아키텍처)

---

## 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                      클라이언트 (브라우저)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Student App  │  │Professor App │  │  QR Scanner  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS / WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Next.js 14 (App Router)                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Middleware Layer                   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │Rate Limit│  │   CSRF   │  │   Auth   │          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    API Routes                        │   │
│  │  /api/auth/*  /api/attendance/*  /api/sessions/*    │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 Business Logic Layer                 │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │   Auth   │  │Attendance│  │ Location │          │   │
│  │  │ Service  │  │ Service  │  │  Tracker │          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Data Access Layer                  │   │
│  │              Supabase Client (Service Role)          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ PostgreSQL Protocol
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Supabase (Backend)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              PostgreSQL Database                     │   │
│  │    ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐         │   │
│  │    │Users │  │Course│  │Session│  │ Attend│         │   │
│  │    │      │  │      │  │       │  │ ance  │         │   │
│  │    └──────┘  └──────┘  └──────┘  └──────┘         │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Row Level Security (RLS) Policies          │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                Real-time Subscriptions               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
┌─────────────────────────────────────────────────────────────┐
│                    External Services                        │
│  ┌──────────────┐            ┌──────────────┐              │
│  │    Sentry    │            │  GPS Service │              │
│  │ (Monitoring) │            │  (Browser)   │              │
│  └──────────────┘            └──────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

---

## 기술 스택

### Frontend
- **프레임워크**: Next.js 14 (App Router)
- **언어**: TypeScript 5.x
- **스타일링**: Tailwind CSS 3.x
- **폰트**: Noto Sans KR, Inter
- **QR 코드**: qrcode 라이브러리
- **GPS**: Browser Geolocation API

### Backend
- **런타임**: Node.js 20+
- **API**: Next.js API Routes
- **인증**: JWT (jose 라이브러리)
- **암호화**: bcryptjs
- **검증**: Zod 3.x

### Database
- **DBMS**: PostgreSQL 15+ (Supabase)
- **ORM/Client**: Supabase JS Client v2
- **보안**: Row Level Security (RLS)
- **실시간**: Supabase Realtime

### DevOps & Monitoring
- **에러 추적**: Sentry
- **로깅**: 구조화된 JSON 로깅
- **성능 모니터링**: Web Vitals, Sentry Performance
- **배포**: Vercel (권장)

### 보안
- **Rate Limiting**: 메모리 기반 Sliding Window
- **CSRF Protection**: Double Submit Cookie
- **XSS Prevention**: 입력 새니타이제이션 + CSP
- **HTTPS**: Strict-Transport-Security 헤더

---

## 디렉토리 구조

```
university-attendance-management/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── auth/                 # 인증 API
│   │   │   ├── login/route.ts
│   │   │   ├── signup/route.ts
│   │   │   ├── logout/route.ts
│   │   │   └── session/route.ts
│   │   ├── attendance/           # 출석 API
│   │   │   ├── checkin/route.ts
│   │   │   ├── heartbeat/route.ts
│   │   │   ├── status/route.ts
│   │   │   └── professor/
│   │   ├── sessions/             # 세션 관리 API
│   │   ├── qr/                   # QR 코드 API
│   │   └── courses/              # 강의 API
│   ├── auth/                     # 인증 페이지
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── student/                  # 학생 페이지
│   │   ├── page.tsx              # 대시보드
│   │   ├── scan/page.tsx         # QR 스캔
│   │   └── attendance/page.tsx   # 출석 기록
│   ├── professor/                # 교수 페이지
│   │   ├── page.tsx              # 대시보드
│   │   ├── qr/page.tsx           # QR 생성
│   │   ├── dashboard/[sessionId]/page.tsx
│   │   └── statistics/page.tsx
│   ├── layout.tsx                # Root Layout
│   └── globals.css               # Global Styles
│
├── lib/                          # 핵심 비즈니스 로직
│   ├── auth.ts                   # 인증 로직
│   ├── auth-context.tsx          # 인증 Context
│   ├── supabase-admin.ts         # Supabase Service Client
│   ├── logger/                   # 로깅 시스템
│   │   └── index.ts
│   ├── middleware/               # 미들웨어
│   │   ├── rate-limit.ts         # Rate Limiting
│   │   ├── csrf.ts               # CSRF 보호
│   │   └── performance.ts        # 성능 측정
│   ├── monitoring/               # 모니터링
│   │   └── web-vitals.ts         # Web Vitals 추적
│   ├── schemas/                  # Zod 스키마
│   │   ├── auth.ts
│   │   ├── attendance.ts
│   │   ├── qr.ts
│   │   ├── session.ts
│   │   └── index.ts
│   ├── utils/                    # 유틸리티 함수
│   │   ├── geo.ts                # GPS 거리 계산
│   │   ├── validation.ts         # 입력 검증
│   │   ├── sanitize.ts           # XSS 방지
│   │   ├── api-response.ts       # API 응답 표준화
│   │   └── sentry.ts             # Sentry 유틸
│   ├── location/                 # 위치 추적
│   │   └── location-tracker.ts
│   └── session/                  # 세션 관리
│       ├── session-service.ts
│       └── types.ts
│
├── components/                   # React 컴포넌트
│   ├── web-vitals-reporter.tsx
│   └── ... (기타 UI 컴포넌트)
│
├── hooks/                        # Custom React Hooks
│   └── use-csrf.ts
│
├── tests/                        # 테스트
│   ├── unit/
│   └── integration/
│
├── docs/                         # 문서
│   ├── API.md                    # API 문서
│   ├── ARCHITECTURE.md           # 아키텍처 문서
│   └── DEVELOPMENT.md            # 개발 가이드
│
├── .env.example                  # 환경 변수 예제
├── next.config.js                # Next.js 설정
├── tsconfig.json                 # TypeScript 설정
├── tailwind.config.ts            # Tailwind 설정
├── sentry.client.config.ts       # Sentry 클라이언트 설정
├── sentry.server.config.ts       # Sentry 서버 설정
├── sentry.edge.config.ts         # Sentry Edge 설정
└── package.json
```

---

## 데이터베이스 스키마

### ERD 다이어그램

```
┌─────────────────┐         ┌─────────────────┐
│   professors    │         │    students     │
├─────────────────┤         ├─────────────────┤
│ id (PK)         │         │ id (PK)         │
│ professor_id    │         │ student_id      │
│ name            │         │ name            │
│ password_hash   │         │ password_hash   │
│ email           │         │ email           │
│ created_at      │         │ created_at      │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │ 1                         │ N
         │                           │
         ▼ N                         │
┌─────────────────┐                  │
│     courses     │                  │
├─────────────────┤                  │
│ id (PK)         │                  │
│ professor_id(FK)│                  │
│ name            │                  │
│ code            │                  │
│ location        │                  │
│ location_lat    │                  │
│ location_lon    │                  │
│ location_radius │                  │
│ created_at      │                  │
└────────┬────────┘                  │
         │                           │
         │ 1                         │
         │                           │
         ▼ N                         │
┌─────────────────┐                  │
│    sessions     │                  │
├─────────────────┤                  │
│ id (PK)         │                  │
│ course_id (FK)  │                  │
│ start_time      │                  │
│ end_time        │                  │
│ is_active       │                  │
│ classroom_lat   │                  │
│ classroom_lon   │                  │
│ classroom_radius│                  │
│ created_at      │                  │
└────────┬────────┘                  │
         │                           │
         │ 1                         │
         │                           │
         ▼ N                         │
┌─────────────────┐                  │
│   attendances   │◄─────────────────┘
├─────────────────┤         N
│ id (PK)         │
│ session_id (FK) │
│ student_id (FK) │
│ status          │ -- 'present', 'late', 'absent', 'left_early'
│ checked_in_at   │
│ latitude        │
│ longitude       │
│ accuracy        │
│ created_at      │
└────────┬────────┘
         │
         │ 1
         │
         ▼ N
┌─────────────────┐
│ location_logs   │
├─────────────────┤
│ id (PK)         │
│ attendance_id(FK)│
│ latitude        │
│ longitude       │
│ accuracy        │
│ distance_from_  │
│  classroom      │
│ within_range    │
│ timestamp       │
│ created_at      │
└─────────────────┘

         ┌──────────────────┐
         │   enrollments    │
         ├──────────────────┤
         │ id (PK)          │
         │ student_id (FK)  │
         │ course_id (FK)   │
         │ enrolled_at      │
         └──────────────────┘
```

### 주요 테이블 설명

#### `students`
- 학생 정보
- `student_id`: 9자리 학번 (unique)
- `password_hash`: bcrypt 해시
- RLS: 본인 정보만 조회 가능

#### `professors`
- 교수 정보
- `professor_id`: 교수번호 (unique)
- RLS: 본인 정보만 조회 가능

#### `courses`
- 강의 정보
- `location_*`: GPS 좌표 및 허용 반경
- RLS: 교수는 본인 강의만, 학생은 수강 중인 강의만

#### `sessions`
- 출석 세션 (강의 회차)
- `is_active`: 세션 활성화 상태
- `classroom_*`: 세션별 위치 (없으면 course 위치 사용)
- RLS: 교수는 본인 강의 세션만, 학생은 수강 중인 강의 세션만

#### `attendances`
- 출석 기록
- `status`: present, late, absent, left_early
- `checked_in_at`: 체크인 시각
- `latitude/longitude/accuracy`: 체크인 시 GPS 정보
- RLS: 학생은 본인 출석만, 교수는 본인 강의 출석만

#### `location_logs`
- 실시간 위치 추적 로그
- heartbeat API에서 기록
- 위치 이탈 감지에 사용
- RLS: 학생은 본인 로그만, 교수는 본인 강의 학생 로그만

#### `enrollments`
- 수강 신청 정보
- 학생-강의 다대다 관계
- RLS: 학생은 본인 수강 정보만, 교수는 본인 강의 수강생만

---

## 인증 플로우

### 회원가입 플로우
```
1. 클라이언트: POST /api/auth/signup
   {
     name, password, userType, studentId/professorId
   }

2. 서버:
   a. Rate Limit 체크 (5 req/min)
   b. Zod 스키마 검증
   c. 중복 확인 (students/professors 테이블)
   d. bcrypt 해싱
   e. DB 삽입
   f. JWT 토큰 생성 (HS256, 7일)
   g. HttpOnly 쿠키 설정

3. 클라이언트: 리다이렉트 (/student 또는 /professor)
```

### 로그인 플로우
```
1. 클라이언트: POST /api/auth/login
   {
     id, password, userType
   }

2. 서버:
   a. Rate Limit 체크 (5 req/min)
   b. Zod 스키마 검증
   c. DB에서 사용자 조회
   d. bcrypt 검증
   e. JWT 토큰 생성
   f. HttpOnly 쿠키 설정

3. 클라이언트: 리다이렉트
```

### 인증 검증 플로우
```
1. 클라이언트: API 요청 (쿠키 자동 포함)

2. Middleware:
   a. 쿠키에서 auth-token 추출
   b. JWT 검증 (jose 라이브러리)
   c. 만료 체크
   d. 페이로드 추출 { userId, userType, name }

3. API Route:
   a. getCurrentUser() 호출
   b. 권한 체크 (학생/교수)
   c. 비즈니스 로직 실행
```

---

## 출석 체크인 플로우

### QR 생성 플로우 (교수)
```
1. 교수: POST /api/qr/generate
   { sessionId }

2. 서버:
   a. Rate Limit 체크 (20 req/hour)
   b. 세션 조회 및 권한 확인
   c. QR 토큰 생성 (UUID)
   d. QR 데이터 구성:
      {
        sessionId,
        token,
        timestamp,
        expiresAt (5분 후)
      }
   e. QR 이미지 생성 (base64)

3. 교수: QR 코드 화면 표시
```

### QR 스캔 및 출석 체크인 플로우 (학생)
```
1. 학생: QR 코드 스캔
   - Camera API로 QR 읽기
   - JSON 파싱
   - 만료 시간 확인

2. 학생: GPS 위치 획득
   - Geolocation API
   - 3단계 재시도 전략:
     a. 고정밀 GPS (15초)
     b. 네트워크 기반 (30초)
     c. 캐시된 위치 (60초)

3. 학생: POST /api/attendance/checkin
   {
     sessionId,
     latitude,
     longitude,
     accuracy,
     clientTimestamp
   }

4. 서버:
   a. Rate Limit 체크 (10 req/min)
   b. 인증 확인 (학생만)
   c. 세션 확인:
      - 존재 여부
      - 시작/종료 시간 내인지
      - 이미 출석했는지
   d. 위치 검증:
      - Haversine 공식으로 거리 계산
      - accuracy 고려하여 범위 내 확인
      - 보안: accuracy를 거리에서 빼지 않음
   e. DB 기록:
      - attendances 테이블 INSERT
      - status: 'present' or 'late'
      - GPS 정보 저장
   f. 응답:
      {
        attendanceId,
        status,
        checkedInAt,
        location: { distance, allowed }
      }

5. 학생: Heartbeat 시작 (30초마다)
```

### 실시간 위치 추적 플로우
```
1. 학생: 30초마다 POST /api/attendance/heartbeat
   {
     sessionId,
     latitude,
     longitude,
     accuracy,
     timestamp
   }

2. 서버:
   a. 출석 기록 조회
   b. 거리 계산
   c. location_logs 테이블에 기록
   d. 연속 위치 이탈 체크:
      - 최근 2개 로그 조회
      - 모두 범위 밖이면 조퇴 처리
      - attendances.status = 'left_early'
   e. 응답:
      {
        distance,
        withinRange,
        statusChanged,
        newStatus
      }

3. 학생:
   - statusChanged=true면 알림 표시
   - heartbeat 중지
```

---

## 보안 아키텍처

### 계층별 보안 조치

#### 1. Transport Layer
- **HTTPS 강제**: Strict-Transport-Security 헤더
- **HSTS Preload**: 브라우저 내장 HTTPS 목록

#### 2. Application Layer

**인증 & 인가**
- JWT 기반 인증 (HS256, 7일 만료)
- HttpOnly 쿠키 (XSS 방지)
- SameSite=Lax (CSRF 기본 방어)

**Rate Limiting**
- Sliding Window 알고리즘
- 메모리 기반 저장소
- 엔드포인트별 제한:
  - 로그인/회원가입: 5 req/min
  - 출석 체크인: 10 req/min
  - QR 생성: 20 req/hour

**CSRF Protection**
- Double Submit Cookie 패턴
- GET/HEAD/OPTIONS 자동 스킵
- 토큰 회전 (Rotation)

**XSS Prevention**
- 입력 새니타이제이션
- HTML 이스케이프
- 위험한 태그/속성 제거
- CSP 헤더:
  ```
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  connect-src 'self' https://*.supabase.co;
  ```

**SQL Injection Prevention**
- Supabase Client 사용 (파라미터화 쿼리)
- 입력 검증 (Zod 스키마)
- 의심스러운 SQL 패턴 감지

#### 3. Database Layer

**Row Level Security (RLS)**
```sql
-- 학생: 본인 출석만 조회
CREATE POLICY "Students can view own attendance"
ON attendances FOR SELECT
USING (auth.uid() = student_id);

-- 교수: 본인 강의 출석만 조회
CREATE POLICY "Professors can view course attendance"
ON attendances FOR SELECT
USING (
  course_id IN (
    SELECT id FROM courses WHERE professor_id = auth.uid()
  )
);
```

**암호화**
- 비밀번호: bcrypt (salt rounds: 10)
- JWT Secret: 환경 변수 (최소 32자)

#### 4. Client Layer

**GPS 보안**
- Geolocation Permissions API
- HTTPS 필수
- 정확도 검증 (100m 초과 시 경고)
- 위치 이탈 감지 (연속 2회)

---

## 성능 모니터링

### Web Vitals 추적
```typescript
// lib/monitoring/web-vitals.ts
- FCP (First Contentful Paint): < 1.8초
- LCP (Largest Contentful Paint): < 2.5초
- CLS (Cumulative Layout Shift): < 0.1
- FID (First Input Delay): < 100ms
- TTFB (Time to First Byte): < 800ms
- INP (Interaction to Next Paint): < 200ms
```

### API 성능 측정
```typescript
// lib/middleware/performance.ts
- Fast API: 경고 500ms, 에러 1.5초
- Standard API: 경고 1초, 에러 3초
- Slow API: 경고 2초, 에러 5초
```

**응답 헤더**
- `X-Response-Time`: 응답 시간 (ms)
- `X-Request-ID`: 요청 추적 ID

### Sentry 통합
- 에러 자동 리포팅
- 성능 메트릭 수집
- Breadcrumb 추적
- 세션 리플레이 (클라이언트)

### 로깅
```typescript
// lib/logger/index.ts
- JSON 구조화 로깅
- 레벨: error, warn, info, debug
- 메타데이터: timestamp, scope, context
- 클라우드 호환 (CloudWatch, Stackdriver)
```

---

## 배포 아키텍처

### Vercel 배포 (권장)

```
┌─────────────────────────────────────────────┐
│           Vercel Edge Network               │
│  ┌────────────┐  ┌────────────┐            │
│  │  CDN Cache │  │ Edge Func  │            │
│  │  (Static)  │  │(Middleware)│            │
│  └────────────┘  └────────────┘            │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│        Vercel Serverless Functions          │
│         (Next.js API Routes)                │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│              Supabase Cloud                 │
│  ┌──────────────┐  ┌──────────────┐        │
│  │  PostgreSQL  │  │   Realtime   │        │
│  └──────────────┘  └──────────────┘        │
└─────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│               Sentry Cloud                  │
│         (Error & Performance)               │
└─────────────────────────────────────────────┘
```

### 환경 변수 설정

**Vercel 환경 변수**
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (Service Role)

# Auth
JWT_SECRET=your-jwt-secret-32-chars-minimum
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=https://your-domain.vercel.app

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Logging
LOG_LEVEL=info
```

### Build 설정
```json
// package.json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "type-check": "tsc --noEmit",
    "lint": "next lint"
  }
}
```

### CI/CD
```yaml
# .github/workflows/ci.yml (예제)
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run type-check
      - run: npm run build
```

---

## 확장성 고려사항

### 수평 확장
- Vercel Serverless Functions: 자동 스케일링
- Supabase: 수평 확장 가능 (엔터프라이즈 플랜)

### 캐싱 전략
- Static Pages: Vercel CDN 캐싱
- API Routes: ISR (Incremental Static Regeneration)
- 클라이언트: React Query (향후 도입 고려)

### 데이터베이스 최적화
- 인덱스: session_id, student_id, course_id
- Connection Pooling: Supabase 내장
- 쿼리 최적화: JOIN 최소화, SELECT 필드 제한

### 실시간 성능
- Supabase Realtime: WebSocket 기반
- 교수 대시보드: 출석 현황 실시간 업데이트
- Heartbeat: 30초 폴링 (향후 WebSocket 고려)

---

## 트러블슈팅 가이드

### 일반적인 문제

**1. GPS 위치 획득 실패**
- 원인: 실내 GPS 신호 약함
- 해결: 3단계 재시도 전략 (고정밀 → 네트워크 → 캐시)

**2. 위치 이탈 오탐지**
- 원인: GPS 정확도 낮음
- 해결: 연속 2회 이탈 확인 (단일 이탈 무시)

**3. Rate Limit 초과**
- 원인: 짧은 시간에 과도한 요청
- 해결: 클라이언트 디바운싱, Retry-After 헤더 준수

**4. CSRF 토큰 에러**
- 원인: 쿠키 누락 또는 토큰 불일치
- 해결: `/api/csrf` 호출하여 토큰 재발급

**5. Supabase RLS 에러**
- 원인: Service Role Key 미설정
- 해결: `.env`에 SUPABASE_SERVICE_ROLE_KEY 추가

---

## 참고 자료

- [Next.js 14 Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Sentry Next.js Guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [OWASP Security Cheat Sheet](https://cheatsheetseries.owasp.org/)
