# Supabase 설정 가이드

## 1. Supabase 프로젝트 생성

1. [Supabase 웹사이트](https://supabase.com)에 접속하여 로그인
2. "New project" 클릭
3. 프로젝트 정보 입력:
   - **Organization**: 개인 또는 팀 조직 선택
   - **Name**: `attendance-management`
   - **Database Password**: 강력한 비밀번호 설정 (기록 필수!)
   - **Region**: `Singapore (Southeast Asia)` (한국과 가장 가까운 지역)
4. "Create new project" 클릭하고 프로젝트 생성 완료까지 대기

## 2. 데이터베이스 스키마 설정

### 2.1 SQL Editor 접속
1. Supabase 대시보드에서 `SQL Editor` 메뉴 클릭
2. "New query" 버튼 클릭

### 2.2 스키마 생성
1. `database/schema.sql` 파일의 내용 전체 복사
2. SQL Editor에 붙여넣기
3. "RUN" 버튼 클릭하여 실행
4. 오류 없이 완료되면 성공

### 2.3 초기 데이터 입력 (선택사항)
1. `database/seed.sql` 파일의 내용 전체 복사
2. 새로운 쿼리 탭에서 붙여넣기
3. "RUN" 버튼 클릭하여 실행

## 3. API 키 및 URL 확인

### 3.1 프로젝트 설정 페이지 접속
1. Supabase 대시보드에서 `Settings` > `API` 메뉴 클릭

### 3.2 필요한 정보 복사
다음 정보들을 복사하여 `.env` 파일에 설정:

```env
# Project URL
SUPABASE_URL=https://your-project-ref.supabase.co

# Anon public key (클라이언트에서 사용)
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Service role key (서버에서만 사용, 보안 중요!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **주의**: Service role key는 절대 클라이언트 코드에 노출하면 안 됩니다!

## 4. Row Level Security (RLS) 확인

### 4.1 Authentication 설정
1. `Authentication` > `Policies` 메뉴에서 각 테이블의 정책이 올바르게 생성되었는지 확인
2. 다음 테이블들에 RLS가 활성화되어 있어야 함:
   - `users`
   - `courses` 
   - `enrollments`
   - `attendance_sessions`
   - `attendance_records`
   - `system_logs`

### 4.2 정책 확인
각 테이블별로 다음과 같은 정책들이 생성되어 있어야 함:
- **users**: 본인 정보만 조회/수정 가능
- **courses**: 교수는 자신의 강의만 관리, 학생은 수강 강의만 조회
- **enrollments**: 관련된 사용자만 접근 가능
- **attendance_sessions**: 교수는 관리, 학생은 활성 세션만 조회
- **attendance_records**: 본인 출석기록만 관리, 교수는 해당 강의 조회만
- **system_logs**: 본인 로그만 조회 가능

## 5. 환경변수 설정

### 5.1 백엔드 환경변수
`backend/.env` 파일 생성 (`.env.example` 참고):

```env
# Supabase
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# JWT (Supabase에서 자동 처리되므로 별도 설정 불필요할 수도 있음)
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
JWT_REFRESH_SECRET=your-super-secret-refresh-jwt-key

# 기타 설정...
```

### 5.2 프론트엔드 환경변수
`frontend/.env` 파일 생성:

```env
REACT_APP_SUPABASE_URL=https://your-project-ref.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
REACT_APP_API_BASE_URL=http://localhost:5000
```

⚠️ **보안 주의사항**:
- `.env` 파일들은 `.gitignore`에 포함되어 있어 Git에 커밋되지 않음
- Service role key는 백엔드에서만 사용
- 프론트엔드에서는 anon key만 사용

## 6. 데이터베이스 연결 테스트

### 6.1 백엔드에서 연결 테스트
```javascript
// backend/src/config/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseServiceKey)

// 연결 테스트
supabase
  .from('users')
  .select('count', { count: 'exact', head: true })
  .then(({ count, error }) => {
    if (error) {
      console.error('Supabase 연결 실패:', error)
    } else {
      console.log('Supabase 연결 성공! 사용자 수:', count)
    }
  })
```

### 6.2 프론트엔드에서 연결 테스트
```javascript
// frontend/src/services/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL!
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

## 7. 백업 및 관리

### 7.1 데이터베이스 백업
1. Supabase 대시보드 > `Settings` > `Database` 
2. "Create backup" 옵션 사용
3. 중요한 변경 사항 전에 백업 권장

### 7.2 모니터링
1. `Logs` 메뉴에서 실시간 로그 확인
2. `Database` > `Logs` 에서 쿼리 성능 모니터링
3. `API` > `Logs` 에서 API 호출 현황 확인

## 8. 트러블슈팅

### 8.1 일반적인 문제들

**Q: RLS 정책 때문에 데이터 조회가 안 됨**
A: SQL Editor에서 다음 명령어로 정책 비활성화 후 디버깅:
```sql
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
```

**Q: Connection timeout 에러**
A: 
1. API 키가 올바른지 확인
2. Supabase 프로젝트가 일시정지 상태인지 확인
3. 네트워크 연결 상태 확인

**Q: 테이블 생성 실패**
A:
1. 기존 테이블이 있는지 확인
2. SQL 문법 오류 확인
3. 권한 문제 확인 (Service role key 사용)

### 8.2 성능 최적화

1. **인덱스 확인**: 자주 조회하는 컬럼에 인덱스가 있는지 확인
2. **쿼리 최적화**: `EXPLAIN ANALYZE` 를 사용하여 쿼리 성능 분석
3. **Connection pooling**: 백엔드에서 연결 풀링 사용

## 9. 보안 체크리스트

- [ ] Service role key가 환경변수에 안전하게 저장됨
- [ ] RLS 정책이 모든 테이블에 올바르게 적용됨
- [ ] 민감한 정보가 Git에 커밋되지 않음
- [ ] API 키가 클라이언트 코드에 노출되지 않음
- [ ] 데이터베이스 비밀번호가 강력함
- [ ] 백업이 정기적으로 생성됨

이 가이드를 따라 설정하면 대학 출결관리시스템을 위한 Supabase 환경이 완료됩니다.