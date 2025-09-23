# Research: QR 세션 동기화 오류 복구

## 1. 세션 생성과 저장 위치 일원화
- **Decision**: 교수 QR 생성 API는 전역 `sessionStore`를 제거하고 Supabase `class_sessions` 테이블에 직접 세션을 생성·갱신한다.
- **Rationale**: 학생 체크인 API가 이미 `class_sessions`를 참조하므로 저장소를 통일해야 즉시 조회가 가능하다. Supabase는 다중 인스턴스/재배포 환경에서도 일관성을 보장한다.
- **Alternatives considered**:
  - *Vercel KV 사용*: 추가 인프라 비용과 네트워크 지연, 프로젝트 범위 외 인프라 도입이 필요하여 제외.
  - *sessionStore 유지 + 동기화 작업*: 서버 재시작 시 손실과 경쟁 조건이 남아 근본 해결이 되지 않아 기각.

## 2. 만료 시간 및 UUID 전략
- **Decision**: 세션 ID는 Supabase `uuid_generate_v4()` 활용, 기본 만료는 생성 시각 +10분으로 작성하며 교수 UI에서도 만료(Countdown) 정보를 노출한다.
- **Rationale**: 명세에서 요구한 10분 만료와 기존 헌법(30분 이하)을 모두 충족한다. UUID는 충돌 위험을 없애며 로그에서 앞 8자만 노출하여 개인정보를 보호한다.
- **Alternatives considered**:
  - *30분 유지*: 기존 구현이었지만 현장 요구(즉시 출석) 대비 너무 길고 공격 노출 시간이 증가.
  - *커스텀 난수 ID*: QR 서명·교차 검증 시 추가 해시 작업이 필요해 오버헤드 발생.

## 3. 시간 오차 검증 방법
- **Decision**: 클라이언트가 `clientTimestamp`를 ISO 문자열로 전송하고, 서버가 `Date.now()`와 비교해 60초 초과시 오류 코드를 반환한다. 서버도 응답에 현재 시각을 내려 학생 단말에서 보정 메시지를 표기한다.
- **Rationale**: 추가 네트워크 요청 없이 요청 본문 데이터만으로 검증 가능하다. 60초는 명세 상 허용치이며, 실패 시 사용자가 기기 시간을 점검하도록 안내할 수 있다.
- **Alternatives considered**:
  - *NTP 동기화 지시*: 앱에서 직접 구현하기 어렵고 권한 문제가 있음.
  - *서버-클라이언트 라운드트립 지연 측정*: 구현 복잡도가 높고 이동통신망 변동성이 커서 제외.

## 4. 자동 재시도 UX 및 접근성
- **Decision**: 학생 스캔 UI에서 첫 실패 시 3초 후 자동으로 한 번 재시도하고, 재시도 중 상태를 ARIA 라이브 영역으로 안내한다. 두 번째 실패 시 명확한 한국어 메시지와 수동 조치(새 QR 요청/새로고침)를 제시한다.
- **Rationale**: 명세 요구를 충족하며 사용자가 행동을 예상할 수 있다. 접근성 지침에 따라 화면낭독기가 변화를 전달한다.
- **Alternatives considered**:
  - *다중 자동 재시도*: 서버 부하와 중복 출석 요청 위험이 높아 제외.
  - *수동 전용*: 현장 이용 편의성을 해치고 명세 요구를 충족하지 못함.

## 5. 관측성 및 연속 실패 대응
- **Decision**: 체크인 API는 `console.log(JSON.stringify(...))` 패턴의 구조화 로그로 correlation ID, sessionId 앞 8자, studentId 앞 8자, clientTimestamp, retryAttempt, result를 기록한다. 3회 연속 실패 시 알림 대신 로그에 `failureStreak` 필드를 남기고 Supabase `attendance_attempts` 테이블(신규)에도 적재한다.
- **Rationale**: 헌법의 구조화 로그 요구를 따라가며, 명세에서 알림 없이 로그만 남기도록 결정했다. Supabase 저장은 후속 분석과 RLS 감시를 돕는다.
- **Alternatives considered**:
  - *Sentry 알림*: 명세 답변에서 제외하도록 선택.
  - *로그만 남기고 DB 추적 없음*: 추세 분석이 어려워 운영자 가시성이 낮아짐.

## 6. 중복 기기 차단 전략
- **Decision**: `attendances` 테이블에 유니크 제약(`session_id`, `student_id`)을 재검토하고, 추가 기기 요청 시 API가 `already_present` 코드를 반환하여 UI에서 "이미 출석 처리됨" 안내를 보여준다. 첫 성공 직후에는 200 OK를 유지하되 추가 시도는 409 상태로 응답한다.
- **Rationale**: 명세의 중복 차단 요구를 충족하고, REST 관례에 맞는 상태 코드를 제공한다.
- **Alternatives considered**:
  - *마지막 요청만 유지*: 출석 이력 혼동 및 감사 추적 어려움 때문에 배제.
  - *무시하고 200 응답*: 사용자에게 피드백이 없어 UX가 나빠짐.

## 7. Supabase 권한 및 마이그레이션 파악
- **Decision**: 기존 `009_fix_session_access.sql` 정책을 재확인하고, 필요한 경우 `attendance_attempts` 보조 테이블과 만료 후 정리용 함수/정책을 추가한다. 모든 마이그레이션은 `database/migrations/` 새 SQL에 기록하고 README 갱신.
- **Rationale**: 새로운 데이터 보관 정책(24시간 이내 파기)과 로그 테이블 도입을 명문화한다.
- **Alternatives considered**:
  - *기존 구조 유지*: 데이터 정합성 문제가 계속 발생.
  - *정책 수정 없이 service role만 사용*: 보안 경계가 너무 넓어짐.
