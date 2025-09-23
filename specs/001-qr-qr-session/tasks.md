# Tasks: QR 세션 동기화 오류 복구

**Input**: Design documents from `/specs/001-qr-qr-session/`
**Prerequisites**: plan.md (completed), research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   -> If not found: ERROR "No implementation plan found"
   -> Extract: tech stack, libraries, structure, constitutional obligations
2. Load design documents:
   -> data-model.md: Extract entities -> model and validation tasks
   -> contracts/: Each file -> contract/API task pair
   -> research.md: Extract decisions -> setup/observability/privacy tasks
   -> quickstart.md: Extract test scenarios -> Playwright/integration tasks
3. Generate tasks by category:
   -> Setup: env vars, migrations, sessionStore 정리
   -> Tests: Playwright, integration, unit (MUST precede implementation)
   -> Core: Supabase 세션 생성, 체크인 검증, UI 재시도, 로그 구조화
   -> Integration: 마이그레이션 적용, RLS 정책, 관측성 수단
   -> Polish: 문서/README, 정리 작업, 한국어 메시지 재검토
4. Apply task rules:
   -> Different files = mark [P] for parallel
   -> Same file = sequential (no [P])
   -> Tests before implementation (TDD + quality gates)
   -> Include explicit tasks for Constitution principles (privacy, integrity, observability, accessibility, 한국어 커뮤니케이션)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   -> All principles satisfied with concrete work items
   -> Tests cover every requirement
   -> Quality gates (lint, type-check, Playwright) present
9. Return: SUCCESS (tasks ready for execution)
```

## Task List

### Phase 3.1: Setup
- [X] **T001** `.env.local`에 `SUPABASE_SERVICE_ROLE_KEY` 존재 여부 확인하고, 없으면 예시 값과 보안 주석을 추가한다. (`.env.example`, README.md)
- [X] **T002** `database/migrations/`에 `attendance_attempts` 테이블 생성 및 24시간 파기 정책, `attendances` 유니크 제약 보강 SQL 작성 후 `./scripts/run-migration.sh` 실행한다. (새 SQL 파일)
- [X] **T003** `lib/session-store.ts`와 관련 API(`app/api/sessions/create`, `app/api/attendance/submit`)에서 메모리 기반 로직을 제거하고 Supabase `class_sessions` 연동만 남기도록 리팩터링한다.

### Phase 3.2: Tests First (TDD)
- [X] **T004 [P]** `tests/e2e/qr-session-sync.spec.ts` 작성: 노트북 생성 → 학생 스캔 성공 → 자동 재시도 → 시계 오차/중복/만료 실패 시나리오 포함, 현재는 실패 상태로 둔다.
- [X] **T005 [P]** `tests/api/attendance-checkin.spec.ts`에서 `POST /api/attendance/checkin` 계약 기반 응답 코드(200,400(clock_skew),404,409) 검증 테스트를 추가한다.
- [X] **T006 [P]** `tests/api/session-create.spec.ts`에 `POST /api/sessions/create` 10분 만료/UUID 응답 검증 테스트를 작성한다.
- [X] **T007** `lib/session/session-service.test.ts`에 `autoEndSessionIfNeeded`와 새 만료 정책(10분 기본, 3초 자동 재시도 로그 등) 단위 테스트를 추가한다.

### Phase 3.3: Core Implementation
- [X] **T008** `app/api/sessions/create/route.ts`를 Supabase insert 기반으로 리팩터링하여 `class_sessions`에 UUID, 10분 만료, QR 토큰을 저장하고 응답 스키마에 맞춘다.
- [X] **T009** `app/api/attendance/checkin/route.ts`에서 세션 조회를 Supabase 단일 쿼리로 정리하고, `clientTimestamp` 기반 시계 오차(±1분) 검증 및 재시도 시나리오를 구현한다.
- [X] **T010** `app/api/attendance/checkin/route.ts`에 `attendance_attempts` 기록 로직, 자동 재시도(1회 3초), 중복 기기 차단(409) 처리, 구조화 로그(JSON.stringify) 작성 기능을 추가한다.
- [X] **T011** `app/student/scan/page.tsx` 및 관련 컴포넌트에서 실패 시 한국어 메시지 + 자동 재시도 1회(3초 후) UX와 ARIA 라이브 영역 안내를 구현한다.
- [X] **T012** `app/professor/qr` UI에서 세션 만료 카운트다운(10분)과 Supabase 세션 생성 응답을 반영하여 상태 표시를 업데이트한다.
- [X] **T013** `lib/supabase-admin.ts` 및 관련 서버 모듈에서 service role 사용 여부 로그와 RLS 적합성을 재점검하고, 위치 좌표 소수점 둘째 자리로 축약 후 저장하도록 수정한다.

### Phase 3.4: Integration & Observatory
- [X] **T014** Supabase RLS 정책을 검토/업데이트하여 학생이 `attendance_attempts`에서 자신의 기록만 조회하고, 교수는 강의 기반으로 접근할 수 있도록 SQL 정책을 작성한다. (새 SQL 또는 기존 수정)
- [X] **T015** `scripts/` 또는 `app/api/debug`에 만료된 세션/시도 정리 Cron(24시간)을 실행하거나 수동 명령을 추가한다.
- [X] **T016** 서버 로그에 correlation ID, sessionId·studentId 앞 8자, result, failureStreak를 포함하도록 로깅 포맷을 일관화한다 (체크인/세션 API 모두).
- [X] **T017** `README.md` 및 `docs/QR_SCAN_FIX.md`를 업데이트하여 새로운 만료 시간, 자동 재시도, 시계 오차 안내, 로그 확인 절차를 문서화한다.

### Phase 3.5: Polish & Verification
- [X] **T018 [P]** `npm run lint`, `npm run type-check`, `npx playwright test`를 실행하고 실패가 없도록 수정한다 (결과를 기록).
- [X] **T019 [P]** `test-results/`에 Playwright 결과 스냅샷을 정리하고 PR에 첨부할 요약을 작성한다.
- [X] **T020 [P]** UI/문구가 모두 한국어인지 재검수하고, 새 메시지(오류/안내)에 국문 번역을 적용한다. (app/student, app/professor, locale 파일)
- [X] **T021** 변경된 SQL/환경/테스트 절차를 PR 설명 초안과 체크리스트에 정리한다.
- [X] **T022 [P]** `tests/perf/qr-session-latency.test.ts`를 작성해 세션 생성/체크인 round-trip 500ms(75p)·응답 1초(95p) 목표를 계측하고 결과를 로그로 남긴다.
- [X] **T023** 성능 계측 결과와 운영 수치를 `docs/QR_SCAN_FIX.md`/`quickstart.md`에 추가하고, 회귀 시 참고할 KPI 기록 절차를 문서화한다.

## Dependencies
- T001 → T002 → (T008~T017) : 환경/DB 준비 후 구현 진행
- T003은 sessionStore 제거를 포함하므로 T008~T012보다 앞서 완료해야 한다.
- 테스트 선행: T004~T007이 실패 상태여야 T008 이후 구현
- T008이 T009, T010, T012에 선행 / T009가 T010, T011에 선행
- T010 완료 후 T014~T016, T015 의존
- 문서/폴리시(T017~T023)는 모든 핵심 작업 완료 후 진행하며, T022 결과를 T023에서 문서화한다.

## Parallel Execution Examples
```
# 초기 테스트 작업 동시 수행
/specs/001-qr-qr-session/tasks T004
/specs/001-qr-qr-session/tasks T005
/specs/001-qr-qr-session/tasks T006

# 구현 후 품질 보증 병렬 실행
/specs/001-qr-qr-session/tasks T018
/specs/001-qr-qr-session/tasks T019
/specs/001-qr-qr-session/tasks T020
```

## Notes
- 모든 커밋 메시지, PR 템플릿, 문서화는 한국어로 작성한다.
- 출석 기록/시도 로그에는 전체 UUID를 남기지 말고 앞 8자만 로깅한다.
- 자동 재시도는 1회로 제한되고, 추가 재시도 시 사용자가 수동 조치를 취하도록 안내한다.
- DB 마이그레이션 실행 후 Supabase 대시보드에서 RLS 정책과 인덱스를 검증한다.
- 테스트는 HTTPS 모드(`npm run dev:https`)에서 실행하여 카메라/위치 권한을 확보한다.
