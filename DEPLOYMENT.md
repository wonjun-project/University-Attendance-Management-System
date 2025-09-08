# 🚀 배포 가이드

이 문서는 출석관리시스템을 Vercel(프론트엔드)과 Railway(백엔드)에 배포하는 방법을 설명합니다.

## 📋 배포 아키텍처

```
사용자 브라우저
    ↓
Vercel (프론트엔드 - React)
    ↓ API 호출
Railway (백엔드 - Express.js)
    ↓ 데이터베이스 연결
Supabase (PostgreSQL 데이터베이스)
```

## 🗄️ 1. Supabase 데이터베이스 설정

### 1.1 프로덕션 데이터베이스 생성

1. [Supabase](https://supabase.com) 로그인
2. 새 프로젝트 생성 (프로덕션용)
   - Project name: `attendance-management-prod`
   - Database Password: 강한 패스워드 생성
   - Region: `Seoul (ap-northeast-1)` 선택

### 1.2 데이터베이스 스키마 생성

Supabase SQL Editor에서 실행:

```sql
-- 1. 기본 스키마 실행
-- database/schema.sql 파일 내용 전체 복사하여 실행

-- 2. 스키마 업데이트 실행  
-- database/schema-update.sql 파일 내용 실행

-- 3. 초기 데이터 생성 (선택사항)
-- database/sample-data.sql 파일 내용 실행
```

### 1.3 Row Level Security 설정

```sql
-- RLS 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- 서비스 역할 정책 (백엔드 전용)
CREATE POLICY "Service role can access all data" ON users
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all data" ON courses
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all data" ON enrollments
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all data" ON attendance_sessions
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all data" ON attendance_records
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all data" ON system_logs
FOR ALL USING (auth.role() = 'service_role');
```

## 🚂 2. Railway 백엔드 배포

### 2.1 Railway 계정 생성 및 프로젝트 생성

1. [Railway](https://railway.app) 가입/로그인
2. "New Project" → "Deploy from GitHub repo" 선택
3. GitHub 레포지토리 연결
4. `backend` 폴더를 배포 소스로 설정

### 2.2 빌드 설정

Railway에서 자동으로 감지하지만, 수동 설정이 필요한 경우:

**Build Settings:**
```bash
# Build Command
npm install && npm run build

# Start Command  
npm start

# Root Directory
backend
```

### 2.3 환경변수 설정

Railway Dashboard → Variables에서 설정:

```env
# Node 환경
NODE_ENV=production
PORT=3000

# JWT 설정 (강력한 시크릿 키 생성)
JWT_SECRET=your-production-jwt-secret-64-characters-minimum
JWT_REFRESH_SECRET=your-production-refresh-secret-64-characters-minimum

# Supabase 설정 (프로덕션 데이터베이스)
SUPABASE_URL=https://your-prod-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key

# CORS 설정 (나중에 Vercel URL로 업데이트)
CORS_ORIGIN=https://your-vercel-domain.vercel.app

# 보안 설정
BCRYPT_SALT_ROUNDS=14
QR_CODE_SECRET=your-production-qr-secret-64-characters-minimum

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 2.4 배포 확인

1. Railway에서 배포 로그 확인
2. 제공된 URL로 Health Check: `GET /health`
3. 응답 예시:
```json
{
  "status": "OK",
  "timestamp": "2024-09-08T...",
  "uptime": 123.45,
  "environment": "production"
}
```

## 🌐 3. Vercel 프론트엔드 배포

### 3.1 Vercel 계정 및 프로젝트 생성

1. [Vercel](https://vercel.com) 가입/로그인
2. "New Project" 선택
3. GitHub 레포지토리 import
4. "Root Directory" → `frontend` 폴더 선택

### 3.2 빌드 설정

**Project Settings:**
```bash
# Framework Preset
Create React App

# Build Command
npm run build

# Output Directory  
build

# Install Command
npm install --legacy-peer-deps
```

### 3.3 환경변수 설정

Vercel Dashboard → Settings → Environment Variables:

```env
# API 베이스 URL (Railway에서 제공받은 URL)
REACT_APP_API_BASE_URL=https://your-railway-app.railway.app

# 빌드 최적화
GENERATE_SOURCEMAP=false
```

### 3.4 도메인 설정

Vercel Dashboard → Settings → Domains:
- 기본 도메인: `your-project.vercel.app`
- 커스텀 도메인 설정 가능 (선택사항)

### 3.5 배포 확인

1. Vercel 제공 URL로 접속
2. 로그인/회원가입 기능 테스트
3. API 연결 상태 확인

## 🔄 4. CORS 설정 업데이트

프론트엔드 배포 완료 후 Railway 백엔드의 CORS 설정 업데이트:

```env
CORS_ORIGIN=https://your-vercel-domain.vercel.app
```

## 🔒 5. 보안 설정

### 5.1 Supabase 보안

**API Settings:**
1. Supabase → Settings → API
2. "RLS disabled" 경고가 없는지 확인
3. JWT Secret 안전하게 보관

**Network Restrictions (권장):**
1. Settings → Auth → URL Configuration
2. Site URL: `https://your-vercel-domain.vercel.app`
3. Redirect URLs 설정

### 5.2 Railway 보안

**Environment Variables:**
- 모든 시크릿 키를 강력하게 생성
- `.env` 파일을 절대 공개 저장소에 커밋하지 않음

**Network Security:**
- HTTPS 강제 사용
- CORS 정확히 설정

### 5.3 Vercel 보안

**Headers 설정:**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options", 
          "value": "nosniff"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

## 📊 6. 모니터링 및 로깅

### 6.1 Railway 모니터링

- Dashboard에서 CPU/메모리 사용량 모니터링
- 로그 실시간 확인 가능
- 알림 설정 (선택사항)

### 6.2 Vercel Analytics

- Vercel Analytics 활성화 (선택사항)
- 페이지 로딩 속도 및 사용량 추적

### 6.3 Supabase 모니터링

- Dashboard → Reports에서 DB 사용량 확인
- API 요청 횟수 모니터링
- 성능 지표 추적

## 🚀 7. CI/CD 설정 (선택사항)

### 7.1 자동 배포 설정

**GitHub Actions 워크플로우 (.github/workflows/deploy.yml):**

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd backend && npm install
      - run: cd backend && npm run test
      - run: cd backend && npm run build

  frontend-tests:
    runs-on: ubuntu-latest  
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd frontend && npm install --legacy-peer-deps
      - run: cd frontend && npm run build
```

### 7.2 브랜치 보호 설정

1. GitHub → Settings → Branches
2. `main` 브랜치 보호 규칙 생성:
   - Require status checks
   - Require pull request reviews
   - Dismiss stale reviews

## 🔧 8. 문제 해결

### 8.1 일반적인 문제들

**빌드 실패:**
```bash
# 백엔드 빌드 오류
npm run build
# TypeScript 타입 오류 확인

# 프론트엔드 빌드 오류  
npm install --legacy-peer-deps
npm run build
```

**API 연결 실패:**
1. Railway URL이 정확한지 확인
2. CORS 설정 확인
3. 환경변수 오타 확인

**데이터베이스 연결 실패:**
1. Supabase URL/Key 확인
2. RLS 정책 확인
3. 네트워크 연결 상태 확인

### 8.2 성능 최적화

**백엔드 최적화:**
- Database connection pooling
- API response caching  
- Image optimization

**프론트엔드 최적화:**
- Code splitting 구현
- Image lazy loading
- Bundle size 최적화

## 📞 9. 지원 및 문의

**배포 관련 문의:**
- Railway: [Railway 문서](https://docs.railway.app)
- Vercel: [Vercel 문서](https://vercel.com/docs)
- Supabase: [Supabase 문서](https://supabase.com/docs)

**프로젝트 관련 문의:**
- GitHub Issues 탭에 문제 상황 등록
- 로그 파일 및 스크린샷 첨부

---

**배포 성공을 축하합니다! 🎉**

이제 출석관리시스템이 프로덕션 환경에서 실행됩니다.