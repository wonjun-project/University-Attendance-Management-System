# QR 스캔 "Session Not Found" 문제 해결 문서

## 문제 설명
교수 노트북에서 생성한 QR을 학생 단말이 스캔했을 때 `session not found` 오류가 발생하여 출석이 기록되지 않는 문제가 있었다. 최신 구조에서는 QR 세션을 Supabase `class_sessions`에 직접 기록하고, 학생 단말이 제출한 `clientTimestamp`・위치 정보・재시도 이력을 `attendance_attempts` 테이블에 저장해 실시간 추적과 문제 분석이 가능하다.

## 원인 분석 (기존 문제)

1. **RLS 정책과 등록 시점 불일치**: 학생이 아직 강의에 등록되지 않은 상태로 QR을 스캔하면 RLS에 의해 세션을 조회하지 못했다.
2. **Service role 키 미설정**: 서버가 anon 키만 사용할 경우 RLS를 우회하지 못해 `session not found`가 발생했다.
3. **세션 저장소 이중화**: `sessionStore`(메모리)와 Supabase가 따로 운영돼 싱크가 깨지면 모바일 단말이 세션을 찾지 못했다.
4. **관측성 부족**: 실패 원인을 한눈에 파악할 수 있는 구조화 로그나 시도 이력이 없었다.

## 해결 방법

### 1. Supabase 기반 세션 통합 ✅
- `/app/api/sessions/create/route.ts`: 세션을 Supabase `class_sessions`에 UUID로 생성하고 기본 만료 시간을 10분으로 고정.
- `/app/professor/qr/QRCodePageContent.tsx`: 새 API 응답을 사용하고 만료 카운트다운을 UI에 표시.

### 2. 학생 체크인 흐름 개선 ✅
- `/app/api/attendance/checkin/route.ts`: `clientTimestamp` 기반 시간 오차(±1분) 검증, `attendance_attempts` 기록, 3초 자동 재시도 안내, 구조화 로그(`scope: "attendance-checkin"`).
- `/app/student/scan/page.tsx`: 실패 시 3초 후 1회 자동 재시도, 한국어 안내 메시지, ARIA 라이브 영역으로 접근성 강화.

### 3. 관측성과 개인정보 최소화 ✅
- `database/migrations/010_create_attendance_attempts.sql`: `attendance_attempts` 테이블, 학생/교수 RLS 정책, 24시간 정리용 함수 `purge_old_attendance_attempts` 추가.
- `scripts/purge-old-attempts.mjs`: cron 또는 수동 실행으로 시도 이력을 24시간 단위로 삭제.
- 위치 로그/시도 로그는 좌표를 소수점 둘째 자리까지 축약해 저장.

### 4. Supabase 클라이언트 및 환경 변수 정비 ✅
- `/lib/supabase-admin.ts`: service roleㆍanon 사용 여부를 JSON 로그로 기록.
- `.env.example` 및 README: `SUPABASE_SERVICE_ROLE_KEY` 필수 설정 강조.

## 적용 방법

1. **환경 변수 설정**
   ```bash
   # .env.local
   NEXT_PUBLIC_SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

2. **마이그레이션 실행**
   ```bash
   ./scripts/run-migration.sh   # supabase CLI 사용
   # 또는 Supabase SQL Editor에서 database/migrations/010_create_attendance_attempts.sql 실행
   ```

3. **정리 스크립트(옵션)**
   ```bash
   node scripts/purge-old-attempts.mjs   # 24시간 지난 attendance_attempts 삭제
   ```

4. **서버 재시작**
   ```bash
   npm run dev:https
   ```

## 테스트 시나리오

1. **교수 QR 생성**
   - `/professor/qr`에서 위치를 선택하고 "QR코드 생성" 클릭
   - 카운트다운 배지로 10분 만료가 표시되는지 확인

2. **학생 출석 성공 경로**
   - `/student/scan`에서 QR 스캔 → "출석 완료" 메시지 → `/student/attendance/{sessionId}` 이동
   - 콘솔에 `{"scope":"attendance-checkin","event":"success"...}` 로그가 남는지 확인

3. **자동 재시도 및 시간 오차**
   - 첫 요청이 실패하도록 세션 ID를 의도적으로 비워두면 3초 후 재시도 로그가 남는지 확인
   - 기기 시간을 2분 이상 틀리게 설정하면 `clock_skew` 오류와 안내 메시지가 노출되는지 확인

4. **중복 기기 차단**
   - 동일 계정으로 다른 브라우저에서 반복 스캔 시 409(`already_present`)와 안내 메시지가 뜨는지 확인

## 주요 변경 사항 요약

1. 세션 생성/저장을 Supabase로 일원화하고 QR 만료 시간을 10분으로 제한
2. 학생 체크인 API가 시간 오차 검증, 자동 재시도, 구조화 로그, `attendance_attempts` 기록을 수행
3. 학생 UI는 자동 재시도 1회, 한국어 접근성 메시지, ARIA 라이브 영역을 제공
4. `scripts/purge-old-attempts.mjs`로 출석 시도 데이터를 24시간 뒤 정리해 개인정보를 최소화

## 추가 고려 사항

- 서비스 role 키는 서버 전용 코드에서만 사용하고, 로그에는 구조화 JSON만 남긴다.
- `attendance_attempts`는 24시간 보존을 기본으로 하되, 감사 목적이 있을 경우 보존 기간을 조정한다.
- 성능 검증(`tests/perf/qr-session-latency.test.ts`)을 통해 세션 생성/체크인 응답 시간이 목표(500ms/1초)를 만족하는지 확인한다.
