# QR 스캔 "Session Not Found" 문제 해결 문서

## 문제 설명
학생이 QR 코드를 스캔할 때 "session not found" 오류가 발생하여 출석 처리가 되지 않는 문제

## 원인 분석

### 1. RLS (Row Level Security) 정책 문제
- `class_sessions` 테이블에 RLS가 활성화되어 있음
- 기존 정책: 학생은 자신이 등록된 과목의 활성 세션만 조회 가능
- 문제: QR 스캔 시점에 학생이 아직 과목에 등록되지 않았을 수 있음

### 2. Service Role 키 부재
- `createServiceClient()`가 service role 키 없이 anon 키를 사용할 경우 RLS 정책 적용됨
- Service role 키가 있어야 RLS를 우회하여 모든 세션 조회 가능

## 해결 방법

### 1. 디버깅 로그 추가 ✅
다음 파일들에 상세한 로그를 추가하여 문제 추적:
- `/app/api/attendance/checkin/route.ts`
- `/app/api/sessions/[id]/route.ts`
- `/app/api/qr/generate/route.ts`
- `/components/qr/QRCodeScannerNative.tsx`
- `/app/student/scan/page.tsx`

### 2. Supabase 클라이언트 개선 ✅
`/lib/supabase-admin.ts` 수정:
- Service role 키 사용 시 RLS 우회 명시적 설정
- 로그 추가로 어떤 키가 사용되는지 확인

### 3. RLS 정책 수정 ✅
`/database/migrations/009_fix_session_access.sql` 생성:
- 활성 세션은 모든 인증된 사용자가 조회 가능 (QR 스캔용)
- 만료되지 않은 QR 코드를 가진 세션만 공개 조회 허용

### 4. 환경 변수 설정 안내 ✅
`.env.example` 업데이트:
- `SUPABASE_SERVICE_ROLE_KEY` 필수 설정 강조
- 설정 방법 상세 설명 추가

## 적용 방법

### 1. 환경 변수 설정
```bash
# .env.local 파일에 추가
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. 데이터베이스 마이그레이션 실행
```bash
# 방법 1: 스크립트 사용
./scripts/run-migration.sh

# 방법 2: Supabase 대시보드에서 직접 실행
# SQL Editor에서 database/migrations/009_fix_session_access.sql 내용 실행
```

### 3. 서버 재시작
```bash
npm run dev
```

## 테스트 방법

1. **교수 계정으로 로그인**
   - /professor/qr 페이지에서 QR 코드 생성
   - 콘솔에서 "✅ Session created successfully with ID: ..." 로그 확인

2. **학생 계정으로 QR 스캔**
   - /student/scan 페이지에서 QR 코드 스캔
   - 콘솔 로그 확인:
     - "✅ QR code parsed as JSON: ..."
     - "📍 Sending check-in request with data: ..."
     - "✅ Session found: ..."

3. **출석 확인**
   - 출석이 정상적으로 처리되면 성공
   - 실패 시 콘솔의 에러 로그 확인

## 주요 변경사항

1. **로그 추가**: 문제 추적을 위한 상세 로그
2. **RLS 정책 완화**: QR 스캔을 위한 세션 조회 허용
3. **Service Role 키 우선 사용**: RLS 우회를 위한 권한 상승
4. **환경 변수 문서화**: 필수 설정 명확화

## 추가 고려사항

- Service role 키는 서버 사이드에서만 사용 (보안)
- 프로덕션 환경에서는 더 엄격한 RLS 정책 고려
- QR 코드 만료 시간 검증 추가됨

## 문제가 지속될 경우

1. `SUPABASE_SERVICE_ROLE_KEY`가 올바르게 설정되었는지 확인
2. 데이터베이스 마이그레이션이 성공적으로 실행되었는지 확인
3. 콘솔 로그에서 "✅ Using service role key for Supabase" 메시지 확인
4. Supabase 대시보드에서 class_sessions 테이블의 RLS 정책 확인