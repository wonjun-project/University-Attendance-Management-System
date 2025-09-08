# 🚀 개발환경 설정 가이드

이 문서는 출석관리시스템 개발환경 설정에 대한 상세한 가이드입니다.

## 📋 필수 요구사항

- **Node.js**: 18.0.0 이상
- **npm**: 8.0.0 이상  
- **Git**: 2.30.0 이상
- **Supabase 계정** (무료 사용 가능)

## 🏗️ 1. 프로젝트 클론 및 설치

```bash
# 프로젝트 클론
git clone <repository-url>
cd attendance-management

# 백엔드 의존성 설치
cd backend
npm install

# 프론트엔드 의존성 설치  
cd ../frontend
npm install --legacy-peer-deps
```

## 🗄️ 2. Supabase 설정

### 2.1 Supabase 프로젝트 생성

1. [Supabase](https://supabase.com) 접속 후 회원가입/로그인
2. "New Project" 클릭
3. 프로젝트 이름 입력 (예: attendance-management)
4. 데이터베이스 패스워드 설정
5. 지역 선택 (Korea 권장)

### 2.2 데이터베이스 스키마 생성

Supabase 대시보드 → SQL Editor에서 다음 실행:

```sql
-- database/schema.sql 파일의 내용 복사해서 실행
-- (파일에 있는 전체 스키마를 복사하여 실행)
```

### 2.3 테스트 데이터 생성

```sql
-- database/sample-data.sql 파일의 내용 실행
-- (선택사항 - 개발용 테스트 데이터)
```

## ⚙️ 3. 환경변수 설정

### 3.1 백엔드 환경변수

`backend/.env.development` 파일 생성:

```env
# 서버 설정
PORT=5000
NODE_ENV=development

# JWT 설정 (개발용)
JWT_SECRET=your-development-jwt-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-development-refresh-secret-key-min-32-chars

# Supabase 설정 (본인 프로젝트 정보로 변경)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# CORS 설정
CORS_ORIGIN=http://localhost:3000

# 추가 설정
BCRYPT_SALT_ROUNDS=12
QR_CODE_SECRET=your-qr-code-secret-32-chars-minimum
```

#### Supabase 키 찾기:

1. Supabase 대시보드 → Settings → API
2. **Project URL**: `SUPABASE_URL`에 복사
3. **service_role secret**: `SUPABASE_SERVICE_ROLE_KEY`에 복사

### 3.2 프론트엔드 환경변수

`frontend/.env` 파일 생성:

```env
REACT_APP_API_BASE_URL=http://localhost:5000
```

## 🚀 4. 개발 서버 실행

### 4.1 백엔드 서버 실행

```bash
cd backend
npm run dev
```

성공시 출력:
```
📝 개발 환경 변수 파일(.env.development)을 로드했습니다.
🚀 서버가 포트 5000에서 실행 중입니다.
📊 환경: development
🌐 CORS 허용: http://localhost:3000
✅ Supabase 연결 성공! 사용자 수: 0
```

### 4.2 프론트엔드 서버 실행

```bash
cd frontend
npm start
```

브라우저에서 `http://localhost:3000` 접속

## 🧪 5. 기능 테스트

### 5.1 회원가입 테스트

1. `http://localhost:3000/register` 접속
2. 교수 계정 생성:
   - 이메일: `professor@test.com`
   - 비밀번호: `password123`
   - 이름: `김교수`
   - 역할: `교수`

3. 학생 계정 생성:
   - 이메일: `student@test.com`
   - 비밀번호: `password123`
   - 이름: `홍학생`
   - 역할: `학생`
   - 학번: `2024001`

### 5.2 로그인 및 대시보드 테스트

1. 교수 계정으로 로그인
2. 대시보드에서 "QR 코드 생성" 버튼 확인
3. 학생 계정으로 로그인  
4. 대시보드에서 "출석 체크" 버튼 확인

### 5.3 강의 생성 테스트 (교수)

1. 교수로 로그인
2. "강의 관리" → "새 강의 추가"
3. 강의 정보 입력 및 GPS 위치 설정
4. 강의 생성 확인

### 5.4 QR 코드 생성 테스트 (교수)

1. "QR 코드 생성기" 접속
2. 강의 선택 및 세션 생성
3. QR 코드 생성 및 활성화
4. QR 코드 이미지 확인

### 5.5 출석 체크 테스트 (학생)

1. 학생으로 로그인
2. "출석 체크" 접속  
3. QR 코드 스캔 또는 수동 입력
4. GPS 위치 인증
5. 인증 코드 입력
6. 출석 완료 확인

## 🐛 6. 문제 해결

### 6.1 백엔드 서버가 시작되지 않는 경우

**증상**: `SUPABASE_URL 환경변수가 설정되지 않았습니다.`

**해결방법**:
1. `.env.development` 파일이 `backend/` 폴더에 있는지 확인
2. Supabase URL과 Service Role Key가 올바른지 확인
3. 파일 내용에 공백이나 따옴표가 없는지 확인

### 6.2 프론트엔드 패키지 설치 오류

**증상**: `peer dependency` 관련 오류

**해결방법**:
```bash
npm install --legacy-peer-deps
```

### 6.3 Supabase 연결 실패

**증상**: `Supabase 연결 테스트 실패`

**해결방법**:
1. Supabase 프로젝트가 활성화되어 있는지 확인
2. Service Role Key가 올바른지 확인 
3. 네트워크 연결 상태 확인

### 6.4 CORS 오류

**증상**: 프론트엔드에서 API 호출 시 CORS 오류

**해결방법**:
1. 백엔드 `.env.development`에서 `CORS_ORIGIN=http://localhost:3000` 확인
2. 프론트엔드가 3000 포트에서 실행되는지 확인

## 📝 7. 개발 팁

### 7.1 실시간 로그 확인

백엔드 로그 확인:
```bash
cd backend
npm run dev
# 또는 더 상세한 로그
DEBUG=* npm run dev
```

### 7.2 데이터베이스 직접 확인

Supabase 대시보드 → Table Editor에서 데이터 확인 가능

### 7.3 API 테스트

Postman 또는 Thunder Client로 API 테스트:
- Base URL: `http://localhost:5000`
- Health Check: `GET /health`

### 7.4 코드 자동 포맷팅

```bash
# 백엔드
cd backend
npm run lint

# 프론트엔드  
cd frontend
npm run lint
```

## 🔧 8. 추가 도구

### 8.1 데이터베이스 GUI 도구

- [pgAdmin](https://www.pgadmin.org/) - PostgreSQL 관리
- [DBeaver](https://dbeaver.io/) - 범용 데이터베이스 도구

### 8.2 API 테스트 도구

- [Postman](https://www.postman.com/)
- [Thunder Client](https://www.thunderclient.com/) (VS Code 확장)
- [Insomnia](https://insomnia.rest/)

### 8.3 개발 도구 추천

- **VS Code 확장**:
  - Thunder Client (API 테스트)
  - PostgreSQL (SQL 지원)
  - ES7+ React/Redux/React-Native snippets
  - Prettier (코드 포맷팅)

## ❓ 도움이 필요한 경우

1. 이슈 등록: GitHub Issues 탭에 문제 상황 상세히 기록
2. 로그 첨부: 백엔드/프론트엔드 콘솔 로그 스크린샷
3. 환경 정보: OS, Node.js 버전, npm 버전 명시

---

**개발 즐기세요! 🎉**