# Database Setup

## Supabase 프로젝트 설정

1. [Supabase](https://supabase.com) 계정 생성 및 새 프로젝트 생성
2. Database → SQL Editor에서 migration 파일들을 순서대로 실행:
   - `001_initial_schema.sql`
   - `002_functions.sql`

## 환경변수 설정

`.env.local` 파일 생성 후 Supabase 프로젝트 설정 값들 입력:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

## Authentication 설정

1. Supabase Dashboard → Authentication → Settings
2. Site URL에 `http://localhost:3000` 추가
3. Redirect URLs에 `http://localhost:3000/auth/callback` 추가

## Row Level Security (RLS)

모든 테이블에 RLS가 적용되어 있습니다:

- **Users**: 본인 데이터만 조회/수정 가능
- **Courses**: 교수는 본인 강의만 관리, 학생은 등록 강의만 조회
- **Class Sessions**: 교수는 본인 강의 세션 관리, 학생은 활성 세션만 조회
- **Attendances**: 학생은 본인 출석만 관리, 교수는 강의 출석 현황 조회
- **Location Logs**: 학생은 본인 위치 로그만 관리

## 주요 함수들

### `check_in_attendance()`
학생 출석 체크인 처리
- QR 코드 유효성 검증
- 위치 기반 출석 확인
- 출석 기록 생성/업데이트

### `track_student_location()`
실시간 위치 추적
- 지속적인 위치 로그 기록
- 위치 이탈시 조기퇴실 처리

### `generate_qr_code()`
교수용 QR 코드 생성
- 고유한 QR 코드 생성
- 만료 시간 설정

### `validate_student_location()`
학생 위치 검증
- GPS 좌표를 이용한 거리 계산
- 강의실 반경 내 위치 확인