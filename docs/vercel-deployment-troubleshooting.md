# Vercel 배포 환경 로그인 문제 해결 가이드

## 🔍 문제 진단

로컬에서는 테스트 계정 로그인이 성공하지만 Vercel 배포 환경에서 실패하는 경우, 다음 순서로 문제를 진단하세요.

## 1️⃣ 환경변수 확인

### Vercel Dashboard에서 환경변수 설정 확인
1. Vercel Dashboard → 프로젝트 → Settings → Environment Variables
2. 다음 환경변수들이 모두 설정되어 있는지 확인:

```bash
# 필수 환경변수
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
JWT_SECRET=your-jwt-secret-64-chars-minimum
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NODE_ENV=production
```

### 환경변수 확인 API 사용 (개발환경에서만)
```bash
curl http://localhost:3001/api/debug/env
```

## 2️⃣ Supabase 데이터베이스 확인

### Supabase Dashboard에서 테스트 계정 확인
1. Supabase Dashboard → Table Editor
2. `students` 테이블에서 `stu001` 계정 존재 확인
3. `professors` 테이블에서 `prof001` 계정 존재 확인

### SQL Editor에서 직접 확인
```sql
-- 테스트 계정 존재 확인
SELECT 'student' as type, student_id as id, name FROM students WHERE student_id = 'stu001'
UNION ALL
SELECT 'professor' as type, professor_id as id, name FROM professors WHERE professor_id = 'prof001';
```

### 테스트 계정이 없는 경우 생성
`scripts/setup-production-db.sql` 파일의 내용을 Supabase SQL Editor에서 실행하세요.

## 3️⃣ Row Level Security (RLS) 정책 확인

현재 개발 단계에서는 모든 접근을 허용하는 정책이 설정되어 있어야 합니다:

```sql
-- 현재 정책 확인
SELECT schemaname, tablename, policyname, permissive, cmd, qual
FROM pg_policies
WHERE tablename IN ('students', 'professors');

-- 정책이 없거나 잘못된 경우 재생성
DROP POLICY IF EXISTS "Allow all students access" ON students;
DROP POLICY IF EXISTS "Allow all professors access" ON professors;

CREATE POLICY "Allow all students access" ON students FOR ALL USING (true);
CREATE POLICY "Allow all professors access" ON professors FOR ALL USING (true);
```

## 4️⃣ Vercel 함수 로그 확인

### Vercel Dashboard에서 함수 로그 확인
1. Vercel Dashboard → 프로젝트 → Functions 탭
2. `/api/auth/login` 함수의 로그 확인
3. 오류 메시지나 스택 트레이스 분석

### 브라우저 개발자 도구 확인
1. Network 탭에서 `/api/auth/login` 요청 응답 확인
2. Console 탭에서 오류 메시지 확인

## 5️⃣ 일반적인 해결 방법

### 방법 1: 환경변수 재설정
```bash
# Vercel CLI 사용
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add JWT_SECRET
vercel env add SUPABASE_SERVICE_ROLE_KEY

# 재배포
vercel --prod
```

### 방법 2: 캐시 클리어 후 재배포
```bash
# Vercel Dashboard → Deployments → 최신 배포 → Redeploy
# 또는 CLI로
vercel --prod --force
```

### 방법 3: 데이터베이스 연결 테스트
프로덕션 환경에서 다음 API를 호출하여 DB 연결 테스트:
```bash
curl https://your-app.vercel.app/api/debug/db-test
```

## 6️⃣ 테스트 스크립트 실행

### 로컬에서 프로덕션 환경변수 테스트
```bash
# 프로덕션 환경변수로 로컬 테스트
NODE_ENV=production npm run build
NODE_ENV=production npm start

# 테스트 계정 확인
node scripts/check-test-accounts.js

# 테스트 계정 재생성 (필요시)
node scripts/create-test-accounts.js
```

## 7️⃣ 단계별 디버깅

### Step 1: 기본 연결 확인
```bash
curl https://your-app.vercel.app/api/health
```

### Step 2: 인증 API 테스트
```bash
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"id":"stu001","password":"password123","userType":"student"}'
```

### Step 3: 응답 분석
- 200: 성공 ✅
- 401: 인증 실패 (계정 없음/비밀번호 틀림)
- 500: 서버 오류 (DB 연결 문제 등)

## 8️⃣ 자주 발생하는 문제들

### 문제 1: "Invalid credentials" 오류
**원인**: 테스트 계정이 프로덕션 DB에 없음
**해결**: `scripts/setup-production-db.sql` 실행

### 문제 2: "Internal server error" 오류
**원인**: 환경변수 누락 또는 DB 연결 실패
**해결**: 환경변수 재설정 후 재배포

### 문제 3: "Connection timeout" 오류
**원인**: Supabase URL이 잘못되었거나 네트워크 문제
**해결**: Supabase Dashboard에서 URL 재확인

### 문제 4: RLS 정책 오류
**원인**: Row Level Security 정책이 너무 제한적
**해결**: 개발 환경용 정책으로 임시 변경

## 9️⃣ 예방 조치

### 정기 점검 항목
- [ ] Supabase 연결 상태 확인
- [ ] 환경변수 만료일 확인 (API 키 등)
- [ ] 테스트 계정 정상 작동 확인
- [ ] 로그 정기 검토

### 모니터링 설정
```javascript
// 간단한 헬스체크 API
// /api/health/route.ts
export async function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
  })
}
```

## 🛠️ 도구 및 리소스

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://app.supabase.com/
- **Vercel CLI**: `npm i -g vercel`
- **로그 모니터링**: Vercel Functions 탭
- **실시간 디버깅**: 브라우저 개발자 도구

---

💡 **팁**: 문제 해결 시 위 순서대로 단계별로 확인하면 대부분의 배포 관련 로그인 문제를 해결할 수 있습니다.