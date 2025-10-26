# 대학 출석 관리 시스템 🎓

> QR 코드와 GPS를 활용한 엔터프라이즈급 대학 출석 관리 웹 애플리케이션

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.0+-black.svg)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-Educational-green.svg)](LICENSE)

## 📋 목차

- [주요 기능](#-주요-기능)
- [기술 스택](#-기술-스택)
- [빠른 시작](#-빠른-시작)
- [프로젝트 구조](#-프로젝트-구조)
- [사용 방법](#-사용-방법)
- [보안 기능](#-보안-기능)
- [성능 모니터링](#-성능-모니터링)
- [문서](#-문서)
- [배포](#-배포)
- [기여하기](#-기여하기)
- [라이선스](#-라이선스)

---

## 🌟 주요 기능

### 👨‍🎓 학생 기능
- **간편 로그인**: 학번 기반 인증 (JWT + HttpOnly Cookie)
- **QR 스캔 출석**: 카메라로 QR 코드 스캔하여 즉시 출석
- **GPS 위치 검증**: Haversine 공식 기반 정밀 거리 계산
- **3단계 GPS 재시도**: 고정밀 GPS → 네트워크 → 캐시 전략
- **실시간 위치 추적**: Heartbeat API로 30초마다 위치 모니터링
- **자동 조퇴 감지**: 연속 2회 위치 이탈 시 자동 조퇴 처리
- **출석 기록 조회**: 강의별 출석 현황 및 통계

### 👨‍🏫 교수 기능
- **QR 코드 생성**: 5분 만료 시한부 QR 코드 (Rate Limit: 20/hour)
- **실시간 대시보드**: WebSocket 기반 출석 현황 모니터링
- **세션 관리**: 강의 세션 생성/종료, 위치 설정
- **출석 통계**: 출석률, 지각률, 결석 현황 분석
- **강의 관리**: 강의 정보 및 수강생 관리

### 🔐 보안 & 성능
- **Rate Limiting**: Sliding Window 알고리즘 (로그인 5/min, 체크인 10/min)
- **CSRF Protection**: Double Submit Cookie 패턴
- **XSS Prevention**: 입력 새니타이제이션 + CSP 헤더
- **SQL Injection Prevention**: Supabase Client + RLS
- **Web Vitals 추적**: FCP, LCP, CLS, FID, TTFB 자동 측정
- **API 성능 모니터링**: 느린 API 자동 감지 및 Sentry 리포팅
- **구조화된 로깅**: JSON 로깅 (CloudWatch/Stackdriver 호환)

---

## 🛠 기술 스택

### Frontend
- **Framework**: Next.js 14 (App Router) + TypeScript 5.x
- **Styling**: Tailwind CSS 3.x
- **Fonts**: Noto Sans KR, Inter
- **QR Code**: qrcode, html5-qrcode
- **Validation**: Zod 3.x

### Backend
- **Runtime**: Node.js 20+
- **API**: Next.js API Routes (Server-side)
- **Authentication**: JWT (jose) + bcryptjs
- **Database**: PostgreSQL 15+ (Supabase)
- **Real-time**: Supabase Realtime (WebSocket)

### Security & Monitoring
- **Error Tracking**: Sentry
- **Performance**: Web Vitals, Custom Metrics
- **Security Headers**: HSTS, CSP, X-Frame-Options, etc.
- **Rate Limiting**: Memory-based Sliding Window
- **CSRF Protection**: Double Submit Cookie

### DevOps
- **Deployment**: Vercel (권장) / Docker
- **CI/CD**: GitHub Actions (옵션)
- **Logging**: Structured JSON Logs
- **Monitoring**: Sentry Performance + Custom Dashboards

---

## 🚀 빠른 시작

### 필수 요구사항
- **Node.js**: 20.x 이상
- **npm**: 10.x 이상
- **Supabase 계정**: 무료 플랜 가능

### 1단계: 저장소 클론

```bash
git clone <repository-url>
cd university-attendance-management-system
```

### 2단계: 의존성 설치

```bash
npm install
```

### 3단계: Supabase 설정

1. [Supabase](https://supabase.com) 프로젝트 생성
2. SQL Editor에서 마이그레이션 실행:
   ```bash
   # database/migrations/ 폴더의 SQL 파일 순서대로 실행
   ```
3. API 키 확인:
   - Settings > API > URL
   - Settings > API > anon public key
   - Settings > API > service_role key (중요!)

### 4단계: 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일 편집:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... # RLS 우회용

# Authentication
JWT_SECRET=your-jwt-secret-minimum-32-characters
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# Sentry (선택)
NEXT_PUBLIC_SENTRY_DSN=https://...@...ingest.sentry.io/...
SENTRY_DSN=https://...@...ingest.sentry.io/...

# Logging
LOG_LEVEL=debug
```

### 5단계: 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속

### HTTPS 개발 서버 (모바일 카메라 테스트용)

```bash
npm run dev:https
```

첫 실행 시 `certs/dev/localhost-cert.pem`을 브라우저에 신뢰하도록 추가하세요.

### 타입 체크 & 빌드

```bash
# TypeScript 타입 체크
npm run type-check

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

---

## 📁 프로젝트 구조

```
university-attendance-management/
├── app/                         # Next.js App Router
│   ├── api/                     # API Routes
│   │   ├── auth/                # 인증 (login, signup, logout)
│   │   ├── attendance/          # 출석 (checkin, heartbeat, status)
│   │   ├── sessions/            # 세션 관리
│   │   ├── qr/                  # QR 코드 생성
│   │   ├── courses/             # 강의 관리
│   │   └── csrf/                # CSRF 토큰 발급
│   ├── auth/                    # 인증 페이지
│   ├── student/                 # 학생 대시보드
│   ├── professor/               # 교수 대시보드
│   └── layout.tsx               # Root Layout
│
├── lib/                         # 핵심 비즈니스 로직
│   ├── middleware/              # 미들웨어
│   │   ├── rate-limit.ts        # Rate Limiting
│   │   ├── csrf.ts              # CSRF Protection
│   │   └── performance.ts       # 성능 측정
│   ├── monitoring/              # 모니터링
│   │   └── web-vitals.ts        # Web Vitals 추적
│   ├── schemas/                 # Zod 검증 스키마
│   ├── utils/                   # 유틸리티
│   │   ├── geo.ts               # GPS 거리 계산
│   │   ├── validation.ts        # 입력 검증
│   │   ├── sanitize.ts          # XSS 방지
│   │   ├── api-response.ts      # API 응답 표준화
│   │   └── sentry.ts            # Sentry 유틸
│   ├── logger/                  # 구조화된 로깅
│   ├── session/                 # 세션 서비스
│   ├── location/                # 위치 추적
│   ├── auth.ts                  # 인증 로직
│   └── supabase-admin.ts        # Supabase Client
│
├── components/                  # React 컴포넌트
├── hooks/                       # Custom Hooks
│   └── use-csrf.ts              # CSRF Hook
├── docs/                        # 문서
│   ├── API.md                   # API 레퍼런스
│   ├── ARCHITECTURE.md          # 아키텍처 설계
│   └── DEVELOPMENT.md           # 개발자 가이드
├── tests/                       # 테스트
├── .env.example                 # 환경 변수 예제
├── next.config.js               # Next.js 설정 (보안 헤더 포함)
└── package.json
```

---

## 📱 사용 방법

### 교수 워크플로우

1. **로그인**
   - 교수번호와 비밀번호로 로그인
   - 또는 회원가입 후 로그인

2. **세션 생성**
   - "세션 생성" 버튼 클릭
   - 강의 선택, 시작/종료 시간 설정
   - 강의실 GPS 좌표 설정 (선택)

3. **QR 코드 생성**
   - "QR 코드 생성" 버튼 클릭
   - 생성된 QR 코드를 강의실 화면에 표시
   - QR 코드는 5분 후 자동 만료

4. **실시간 모니터링**
   - 대시보드에서 학생 출석 현황 실시간 확인
   - 출석/지각/결석/조퇴 통계 조회
   - 학생별 위치 업데이트 시간 확인

### 학생 워크플로우

1. **로그인/회원가입**
   - 학번(9자리)과 비밀번호로 로그인
   - 신규 학생은 회원가입 후 로그인

2. **QR 스캔**
   - "QR 스캔" 버튼 클릭
   - 카메라 권한 허용
   - 교수님의 QR 코드 스캔

3. **GPS 위치 획득**
   - 위치 권한 허용
   - 3단계 재시도 전략:
     1. 고정밀 GPS (15초)
     2. 네트워크 기반 (Wi-Fi/셀룰러, 30초)
     3. 캐시된 위치 (60초)

4. **출석 체크인**
   - 강의실 범위 내(기본 100m)면 출석 완료
   - 범위 밖이면 에러 메시지 표시

5. **실시간 위치 추적**
   - 30초마다 자동으로 위치 업데이트
   - 연속 2회 위치 이탈 시 자동 조퇴 처리
   - 조퇴 처리되면 알림 표시 및 추적 중지

---

## 🔒 보안 기능

### 인증 & 인가
- **JWT 인증**: HS256 알고리즘, 7일 만료
- **HttpOnly Cookie**: XSS 공격 방지
- **SameSite=Lax**: 기본 CSRF 방어
- **bcrypt 해싱**: Salt rounds 10

### Rate Limiting
| 엔드포인트 | 제한 |
|-----------|------|
| `/api/auth/login` | 5 req/min |
| `/api/auth/signup` | 5 req/min |
| `/api/attendance/checkin` | 10 req/min |
| `/api/qr/generate` | 20 req/hour |

### CSRF Protection
- **Double Submit Cookie** 패턴
- POST/PUT/DELETE 요청 자동 검증
- 토큰 자동 회전 (Rotation)

### XSS Prevention
- 입력 새니타이제이션 (HTML 이스케이프)
- 위험한 태그/속성 제거
- JavaScript URL 차단
- Content-Security-Policy 헤더

### SQL Injection Prevention
- Supabase Client (파라미터화 쿼리)
- Zod 스키마 검증
- 의심스러운 SQL 패턴 자동 감지

### Row Level Security (RLS)
```sql
-- 학생은 본인 출석만 조회
CREATE POLICY "Students view own attendance"
ON attendances FOR SELECT
USING (auth.uid() = student_id);

-- 교수는 본인 강의 출석만 조회
CREATE POLICY "Professors view course attendance"
ON attendances FOR SELECT
USING (
  session_id IN (
    SELECT s.id FROM sessions s
    JOIN courses c ON s.course_id = c.id
    WHERE c.professor_id = auth.uid()
  )
);
```

### 보안 헤더
- `Strict-Transport-Security`: HTTPS 강제 (2년)
- `X-Frame-Options`: Clickjacking 방지
- `X-Content-Type-Options`: MIME Sniffing 방지
- `X-XSS-Protection`: XSS 필터 활성화
- `Content-Security-Policy`: 데이터 인젝션 방지

---

## 📊 성능 모니터링

### Web Vitals 자동 추적
| 메트릭 | 목표 |
|--------|------|
| FCP (First Contentful Paint) | < 1.8초 |
| LCP (Largest Contentful Paint) | < 2.5초 |
| CLS (Cumulative Layout Shift) | < 0.1 |
| FID (First Input Delay) | < 100ms |
| TTFB (Time to First Byte) | < 800ms |
| INP (Interaction to Next Paint) | < 200ms |

### API 성능 목표
| 프리셋 | 경고 | 에러 |
|--------|------|------|
| Fast API | 500ms | 1.5초 |
| Standard API | 1초 | 3초 |
| Slow API | 2초 | 5초 |

### 응답 헤더
- `X-Response-Time`: API 응답 시간 (ms)
- `X-Request-ID`: 요청 추적 ID

### Sentry 통합
- 자동 에러 리포팅
- 성능 메트릭 수집
- Breadcrumb 추적
- 세션 리플레이 (클라이언트)

---

## 📚 문서

### API 문서
- [API Reference](docs/API.md) - 전체 API 엔드포인트 문서

### 아키텍처
- [Architecture Guide](docs/ARCHITECTURE.md) - 시스템 아키텍처 설계

### 개발 가이드
- [Development Guide](docs/DEVELOPMENT.md) - 개발자를 위한 가이드

---

## 🚢 배포

### Vercel 배포 (권장)

#### 자동 배포

1. **Vercel 프로젝트 연결**
   ```bash
   npm i -g vercel
   vercel link
   ```

2. **환경 변수 설정**
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL production
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
   vercel env add SUPABASE_SERVICE_ROLE_KEY production
   vercel env add JWT_SECRET production
   vercel env add NEXTAUTH_SECRET production
   vercel env add NEXT_PUBLIC_SENTRY_DSN production
   vercel env add SENTRY_DSN production
   ```

3. **배포**
   ```bash
   vercel --prod
   ```

#### GitHub Actions CI/CD

1. GitHub Secrets 설정:
   - `VERCEL_TOKEN`
   - `VERCEL_PROJECT_ID`
   - `VERCEL_ORG_ID`

2. `main` 브랜치 push 시 자동 배포

### Docker 배포 (옵션)

```bash
# Docker 이미지 빌드
docker build -t attendance-system .

# 컨테이너 실행
docker run -p 3000:3000 --env-file .env attendance-system
```

---

## 🧪 테스팅

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests (향후)
```bash
npm run test:e2e
```

---

## 📊 핵심 알고리즘

### GPS 거리 계산 (Haversine 공식)
```typescript
/**
 * Haversine 공식으로 두 GPS 좌표 간 거리 계산
 *
 * @param lat1 - 첫 번째 위도 (도)
 * @param lon1 - 첫 번째 경도 (도)
 * @param lat2 - 두 번째 위도 (도)
 * @param lon2 - 두 번째 경도 (도)
 * @returns 거리 (미터)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3 // 지구 반지름 (미터)
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}
```

### 위치 검증 로직
```typescript
// 1. GPS 정확도 검증
if (accuracy > 100) {
  logger.warn('GPS 정확도 낮음', { accuracy })
}

// 2. 거리 계산
const distance = calculateDistance(
  studentLat, studentLon,
  classroomLat, classroomLon
)

// 3. 범위 확인 (정확도는 고려하지만 거리에서 빼지 않음)
const isWithinRange = distance <= allowedRadius

// 4. 보안 강화: accuracy를 distance에서 빼지 않음
// ❌ Bad: const adjustedDistance = distance - accuracy
// ✅ Good: const isWithinRange = distance <= allowedRadius
```

### 출석 상태 결정
| 상태 | 조건 |
|------|------|
| **present** | 시작 시간 내 체크인 + 위치 인증 성공 |
| **late** | 시작 15분 후 체크인 + 위치 인증 성공 |
| **left_early** | 연속 2회 위치 이탈 감지 |
| **absent** | 체크인 없음 또는 위치 인증 실패 |

---

## 🛣️ 로드맵

### Phase 1 ✅ (완료)
- [x] 코드 중복 제거 (GPS 거리 계산)
- [x] Rate Limiting 구현
- [x] 구조화된 로깅 시스템

### Phase 2 ✅ (완료)
- [x] Zod 런타임 검증
- [x] Sentry 에러 추적

### Phase 3 ✅ (완료)
- [x] Web Vitals 성능 모니터링
- [x] API 응답 시간 측정
- [x] CSRF 보호
- [x] XSS 방지 새니타이제이션
- [x] API 응답 표준화
- [x] 보안 헤더 설정

### Phase 4 ✅ (완료)
- [x] API 문서화
- [x] 아키텍처 문서
- [x] 개발자 가이드

### Phase 5 (향후)
- [ ] 강의 일정 자동 생성
- [ ] 출석 데이터 CSV 내보내기
- [ ] 푸시 알림 시스템
- [ ] 다중 강의실 지원
- [ ] 출석 통계 시각화 대시보드
- [ ] E2E 테스트 커버리지

---

## 🤝 기여하기

기여는 언제나 환영합니다!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### 코드 컨벤션
- TypeScript strict mode 사용
- ESLint + Prettier 설정 준수
- 모든 API에 JSDoc 주석 작성
- 단위 테스트 커버리지 80% 이상

---

## 📄 라이선스

이 프로젝트는 **교육용 목적**으로 개발되었습니다.

---

## 📞 문의

프로젝트 관련 문의사항이 있으시면 Issue를 생성해주세요.

---

**🎓 2025년 웹개발 프로젝트**

Made with ❤️ by the development team
