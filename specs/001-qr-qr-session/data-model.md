# Data Model: QR 세션 동기화 오류 복구

## 개요
- QR 세션 생성과 학생 체크인을 Supabase `class_sessions`, `attendances`, 신규 `attendance_attempts` 테이블을 중심으로 일관되게 관리한다.
- 10분 세션 만료, 1분 시계 오차 허용, 자동 재시도 1회, 중복 기기 차단 시나리오를 저장 계층에서 지원한다.

## 엔터티 상세

### QRSession (`class_sessions`)
| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | `uuid` | PK | QR 세션 ID (UUID v4) |
| `course_id` | `uuid` | FK -> `courses.id` | 세션이 속한 강의 |
| `qr_code_token` | `text` | NOT NULL | 서명된 QR payload (학생 단말 검증용) |
| `qr_code_expires_at` | `timestamptz` | NOT NULL | 생성 시각 + 10분, 체크인 시 검증 |
| `status` | `text` | CHECK (`active`,`ended`) | 세션 상태 |
| `created_at` | `timestamptz` | DEFAULT now() | 생성 시각 |
| `updated_at` | `timestamptz` | | 최근 변경 시각 |
| `classroom_latitude` | `numeric` | | 지오펜스 중심 |
| `classroom_longitude` | `numeric` | | 지오펜스 중심 |
| `classroom_radius` | `numeric` | DEFAULT 50 | 지오펜스 반경 (m) |

**Derived Rules**
- 세션 생성 시 `qr_code_expires_at = now() + interval '10 minutes'`.
- 만료 또는 강의 종료 시 `status = 'ended'`로 전환하고 `autoEndSessionIfNeeded`가 후처리.
- Index: `(course_id, status)`, `qr_code_expires_at`(만료 정리), `created_at`.

### Attendance (`attendances` 기존)
| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | `uuid` | PK | 출석 기록 |
| `session_id` | `uuid` | FK -> `class_sessions.id` | 대상 세션 |
| `student_id` | `uuid` | FK -> `profiles.id` | 학생 |
| `status` | `text` | CHECK (`present`,`late`,`absent`,`left_early`) | 현재 출석 상태 |
| `check_in_time` | `timestamptz` | | 출석 확정 시각 |
| `location_verified` | `boolean` | DEFAULT false | 위치 인증 성공 여부 |
| `created_at` | `timestamptz` | DEFAULT now() | |
| `updated_at` | `timestamptz` | | |

**Derived Rules**
- 유니크 제약 `uniq_attendance_session_student (session_id, student_id)`로 동일 학생 중복을 차단.
- 중복 요청 발생 시 API는 이 제약 위반을 잡아 409 응답과 "이미 출석 처리됨" 메시지를 전달.

### AttendanceAttempt (`attendance_attempts` 신규)
| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | `uuid` | PK | 시도 기록 ID |
| `session_id` | `uuid` | FK -> `class_sessions.id` | 시도 대상 세션 |
| `student_id` | `uuid` | FK -> `profiles.id` | 학생 |
| `attempt_number` | `integer` | | 동일 요청 내 재시도 횟수 (0=최초) |
| `client_timestamp` | `timestamptz` | | 단말에서 제출한 시각 |
| `server_timestamp` | `timestamptz` | DEFAULT now() | 서버 수신 시각 |
| `clock_skew_seconds` | `integer` | | 서버-단말 시각 차이(초) |
| `result` | `text` | CHECK (`success`,`retry`,`duplicate`,`expired`,`clock_skew`,`error`) | 시도 결과 |
| `failure_reason` | `text` | | 오류 세부 코드 |
| `device_lat` / `device_lng` | `numeric` | | 위치 (두 자리 precision) |
| `device_accuracy` | `numeric` | | 위치 정확도 (m) |
| `device_type` | `text` | | `ios`,`android`,`web` 등 |
| `network_type` | `text` | | `wifi`,`lte` 등 |
| `correlation_id` | `uuid` | | 로그 상호 참조 키 |
| `created_at` | `timestamptz` | DEFAULT now() | 기록 시각 |

**Derived Rules**
- 24시간 이상 된 행은 cron/서버리스 작업으로 삭제하여 개인정보 최소화.
- `session_id`, `student_id`, `created_at` 인덱스로 빠른 조회/추세 분석 지원.

### DeviceContext (논리 엔터티)
- 별도 테이블 생성 없이 `attendance_attempts`에 포함.
- 프론트엔드에서 수집 가능한 메타데이터(브라우저 UA, OS, 네트워크)를 가공해 저장.

## 상태/흐름 요약
1. 교수 세션 생성 → `class_sessions`에 `status='active'`, `qr_code_expires_at = now()+10분` 기록.
2. 학생 체크인 요청 → `attendance_attempts`에 기록, 시계 오차 60초 초과 시 즉시 `clock_skew` 처리.
3. 성공 시 → `attendances` upsert 후 `result='success'`. 추가 기기 시도는 `duplicate`로 기록하고 API 409 반환.
4. 자동 재시도(3초) → `attempt_number=1`, 결과에 따라 `retry` 혹은 성공.
5. 세션 만료 → `autoEndSessionIfNeeded` 또는 만료 스케줄러가 `status='ended'` 전환 및 잔여 만료된 시도 정리.

## 데이터 보존 및 정리 전략
- `attendance_attempts`: 24시간 보존 후 삭제, 단 감사 용도로 7일 보존 필요 시 별도 플래그 고려.
- `location_logs`: 기존 정책과 동일(필요 시 정리 작업 재사용).
- 로그 출력 시 `session_id`, `student_id`는 앞 8자만 노출하고 전체 UUID는 DB에서만 조회 가능.

## 마이그레이션 계획(초안)
1. `attendance_attempts` 테이블 생성 + RLS 정책(학생은 자신의 시도만 조회 가능, 교수/관리자는 course 기반 접근).
2. `attendances` 유니크 제약 보장 (`session_id`, `student_id`).
3. `class_sessions`에 10분 만료 기본값을 설정하는 trigger 혹은 API 로직으로 enforced.
4. 만료된 세션/시도 정리용 SQL 함수 및 스케줄(서버리스 cron) 정의.
