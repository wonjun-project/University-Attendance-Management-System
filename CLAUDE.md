# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개발 환경 설정

모든 응답은 한국어로 작성해주세요. 코드 주석도 한국어로 작성해주세요.

### 환경 구성
이 프로젝트는 모노레포 구조로 되어 있습니다:
- `backend/` - Express.js + TypeScript 백엔드
- `frontend/` - React + TypeScript 프론트엔드  
- `database/` - PostgreSQL 스키마 및 Supabase 설정

### 데이터베이스 설정
Supabase를 사용합니다. 개발 시작 전에:
1. `database/schema.sql` 실행하여 기본 스키마 생성
2. `database/schema-update.sql` 실행하여 추가 필드/함수 생성
3. `.env.development` 파일에 Supabase URL과 SERVICE_ROLE_KEY 설정

## 공통 명령어

### 백엔드 개발
```bash
cd backend
npm install                    # 의존성 설치
npm run dev                    # 개발 서버 실행 (포트 5000)
npm run build                  # TypeScript 빌드
npm test                       # Jest 테스트 실행
npm run test:watch             # 테스트 watch 모드
npm run lint                   # ESLint 검사
npm run lint:fix               # ESLint 자동 수정
```

### 프론트엔드 개발  
```bash
cd frontend
npm install --legacy-peer-deps # 의존성 설치 (peer deps 경고 무시)
npm start                      # 개발 서버 실행 (포트 3000)
npm run build                  # 프로덕션 빌드
npm test                       # React Testing Library 테스트
```

### 통합 테스트
```bash
# 백엔드 서버 실행 후
node test-integration.js       # 전체 API 플로우 테스트
```

### Docker 실행
```bash
docker-compose up -d           # 전체 스택 실행
docker-compose up backend      # 백엔드만 실행
docker-compose up frontend     # 프론트엔드만 실행
```

## 코드 아키텍처

### 백엔드 구조
- **Express 미들웨어 체인**: helmet → cors → morgan → rate-limit → routes
- **인증 시스템**: JWT 액세스/리프레시 토큰, bcrypt 패스워드 해싱
- **API 라우터**: `/api/auth`, `/api/courses`, `/api/attendance`로 구분
- **Supabase 클라이언트**: Service Role Key로 RLS 우회하여 서버에서 데이터 접근
- **미들웨어**: `auth.ts`에서 JWT 검증 및 역할 기반 접근 제어
- **유틸리티**: QR 코드 HMAC 서명, GPS Haversine 거리 계산

### 프론트엔드 구조
- **라우팅**: `AppRouter.tsx`에서 역할 기반 라우트 보호 (`ProtectedRoute`, `RoleProtectedRoute`)
- **상태 관리**: Context API 사용 (`AuthContext`, `ThemeContext`)
- **API 클라이언트**: `services/api.ts`에서 Axios 기반 클라이언트, 자동 토큰 갱신 구현
- **UI 컴포넌트**: Ant Design + Styled Components 조합
- **무한루프 방지**: 인증 상태 체크에서 `isLoading` 상태 활용

### 3단계 출석 인증 플로우
1. **QR 스캔** (`/api/attendance/check`) - HMAC 서명 검증
2. **GPS 위치 확인** (`/api/attendance/verify-location`) - Haversine 거리 계산
3. **인증 코드** (`/api/attendance/verify-auth-code`) - 시간 제한 숫자 코드

### 데이터베이스 설계
- **RLS (Row Level Security)** 모든 테이블에 활성화
- **역할 기반 정책**: 교수는 자신의 강의만, 학생은 자신의 기록만 접근
- **핵심 테이블**: users → courses → attendance_sessions → attendance_records
- **감사 로그**: system_logs 테이블에 모든 중요 액션 기록

### 보안 고려사항
- QR 코드는 HMAC 서명으로 위변조 방지
- JWT 토큰은 짧은 만료시간 + 리프레시 토큰 구조
- GPS 정확도에 따른 동적 반경 조정 (20m 이상 시 확대)
- Rate limiting으로 API 남용 방지 (15분에 100회)

### 환경변수 관리
- 개발환경: `backend/.env.development`, `frontend/.env`
- 백엔드는 개발환경 파일을 우선 로드 (`src/index.ts` 참조)
- Supabase URL/키, JWT Secret 등 민감 정보 환경변수로 관리

### 테스트 전략
- 백엔드: Jest 단위 테스트
- 프론트엔드: React Testing Library
- 통합 테스트: `test-integration.js`로 전체 API 플로우 검증
- CI/CD: GitHub Actions (`ci.yml`) 자동 테스트 및 빌드