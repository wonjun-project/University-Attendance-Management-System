# Implementation Plan: QR 세션 동기화 오류 복구

**Branch**: `001-qr-qr-session` | **Date**: 2025-09-24 | **Spec**: [/specs/001-qr-qr-session/spec.md](/specs/001-qr-qr-session/spec.md)
**Input**: Feature specification from `/specs/001-qr-qr-session/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   -> If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   -> Detect Project Type from context (web=frontend+backend, mobile=app+api)
   -> Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   -> If violations exist: Document in Complexity Tracking
   -> If no justification possible: ERROR "Simplify approach first"
   -> Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 -> research.md
   -> If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 -> contracts, data-model.md, quickstart.md, and refresh the agent context file generated via `.specify/templates/agent-file-template.md`.
7. Re-evaluate Constitution Check section
   -> If new violations: Refactor design, return to Phase 1
   -> Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 -> Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
노트북에서 생성한 출석 QR 세션이 전역 `sessionStore`(메모리)에만 저장되어 모바일 학생 단말에서 Supabase `class_sessions`를 조회할 때 일치하지 않아 `session not found`가 발생한다. 본 기능은 QR 생성·검증 흐름을 Supabase 기반으로 통합하고, 세션 기본 만료 10분·시계 오차 1분·자동 재시도 1회·중복 기기 차단·연속 실패 로깅을 확정하여 교실 현장에서 즉시 재현 가능한 안정적인 출석 체크를 보장한다.

## Technical Context
**Language/Version**: TypeScript 5.6 + Next.js 14 (App Router)  
**Primary Dependencies**: `@supabase/supabase-js` 2.x (server action/service role), Next.js App Router handlers, `html5-qrcode`, `@playwright/test`, Tailwind CSS  
**Storage**: Supabase PostgreSQL (`class_sessions`, `attendances`, `course_enrollments`, `location_logs`)  
**Testing**: `npm run lint`, `npm run type-check`, `@playwright/test`(노트북·모바일 브라우저 흐름), targeted Supabase contract tests via API route integration  
**Target Platform**: Next.js 서버 액션 + Edge/Node route handlers (Vercel/Node 환경)  
**Project Type**: Web (단일 Next.js 풀스택)  
**Performance Goals**: 세션 생성/조회 round-trip 500ms 이하(75p), 학생 출석 API 응답 1초 이하(95p), 동시 200명 출석 시에도 실패율 <1%  
**Constraints**: QR 세션 기본 만료 10분, 기기-서버 시계 편차 허용 ±1분, 자동 재시도 1회(3초), Supabase RLS 유지, 민감 데이터 로그 금지, 모든 산출물 한국어 작성  
**Scale/Scope**: 동시 5개 강의·강의당 최대 200명 학생·출석 시도 400건/분 상정

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Student Data Stewardship: Supabase service role은 서버 전용 `lib/supabase-admin`에서만 사용하고, 위치 로그에 좌표는 소수점 둘째 자리까지 축약하여 저장하며 24시간 후 정리 작업을 계획한다.
- Attendance Integrity Enforcement: QR 생성 시 Supabase `class_sessions`에 UUID와 서명 토큰을 저장하고 기본 만료를 10분으로 고정, 지오펜스 50m 이하 유지, 교수 수동 수정 시 감사 로그를 남기도록 한다.
- Test-First Quality Gates: 체크인 API Playwright 플로우, Supabase 조회 실패 케이스, 시간 오차 검증 테스트를 선행 작성하고 `npm run lint`, `npm run type-check`, `npx playwright test`를 CI/로컬에서 모두 통과시킨다.
- Operational Observability: 구조화 로그에 correlation ID, 세션/단말 메타데이터, 자동 재시도 결과를 남기고 3회 연속 실패는 로그만 남기되 대시보드 필터가 가능하도록 JSON 필드를 설계한다.
- Delivery Simplicity & Accessibility: Next.js App Router 내 기존 `app/api/sessions`·`app/api/attendance/checkin`을 확장하고 UI는 Tailwind 유틸을 재사용하며 카메라 접근 안내를 한국어로 유지한다.
- 한국어 커뮤니케이션 의무: 본 계획과 후속 산출물(연구, 데이터 모델, 계약서, quickstart, 커밋/PR) 모두 한국어로 작성하고 필요한 외래어는 괄호 병기한다.

✅ Initial Constitution Check: PASS (위 계획으로 모든 원칙 준수 경로 확보)

## Project Structure

### Documentation (this feature)
```
specs/001-qr-qr-session/
├── plan.md              # 이 파일
├── research.md          # Phase 0 출력
├── data-model.md        # Phase 1 출력
├── quickstart.md        # Phase 1 출력
├── contracts/           # Phase 1 출력 (API 계층 사양)
└── tasks.md             # /tasks 명령에서 생성 (지금은 미생성)
```

### Source Code (repository root)
```
app/
├── api/attendance/checkin/route.ts        # 학생 체크인 API (수정 대상)
├── api/sessions/create/route.ts           # 교수 세션 생성 API (Supabase 통합 필요)
├── api/sessions/[id]/route.ts             # 세션 조회/검증 (실존 여부 확인)
├── professor/...                          # QR 생성 UI (동기화 개선)
├── student/scan/...                       # 학생 스캔 UI (자동 재시도)
components/qr/                             # QR 관련 UI
lib/session/                               # 세션 서비스/타입 (정합성 재사용)
lib/supabase-admin.ts                      # Service role 클라이언트
tests/e2e/                                 # Playwright 시나리오 추가 위치
```

**Structure Decision**: Option 1 (단일 Next.js 프로젝트) 유지. 별도 백엔드 분리는 필요 없음.

## Phase 0: Outline & Research
1. **세션 생성/저장소 정합성 조사**: `app/api/sessions/create`와 `lib/session-store`의 메모리 의존을 파악하고 Supabase `class_sessions` 스키마/인덱스/RLS 정책을 검토한다.
2. **Supabase 시간·만료 처리 검증**: `class_sessions.qr_code_expires_at` 업데이트 방식, 서비스 로직(`autoEndSessionIfNeeded`)과 충돌 여부, 타임존 보정 전략을 조사한다.
3. **학생 단말 시간 오차 대응**: 브라우저에서 서버 시각을 가져오거나 서버 응답 헤더를 통해 오차를 계산하는 모범 사례와 구현 난이도를 비교한다.
4. **관측성 시나리오 정의**: 구조화 로그 필드, correlation ID 생성, 3회 연속 실패 로그 축적 방식과 기존 로깅 규약을 파악한다.
5. **자동 재시도 UX 검토**: `student/scan` QR 컴포넌트 흐름을 점검하고 자동 재시도(3초 후 1회)가 UX·접근성 요구와 충돌하지 않는지 리뷰한다.

→ 위 조사 결과는 `research.md`에 결정/근거/대안으로 정리한다.

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **데이터 모델 정제** (`data-model.md`): `QRSession`, `AttendanceAttempt`, `DeviceContext`에 Supabase 컬럼, 기본키, 인덱스, 만료/정리 전략, 시계 오차 필드(`client_timestamp`)를 정의하고 상태 다이어그램을 기술한다.
2. **API 계약 수립** (`contracts/attendance-scan.openapi.yaml`): `POST /api/attendance/checkin` 요청/응답 스키마와 오류 코드(만료, 시간 오차, 중복, 재시도 후 실패)를 문서화한다.
3. **추가 계약**: 필요 시 `POST /api/sessions/create` 갱신 스키마를 같은 파일 혹은 별도 섹션으로 정의하여 교수 UI·테스트가 사용할 필드를 명확히 한다.
4. **테스트 시나리오 도출** (`quickstart.md`): 노트북-모바일 병행 시나리오, 시간 오차 모의, 자동 재시도 확인, 중복 기기 차단, 3회 실패 로그 관찰 절차를 구체화한다.
5. **에이전트 문맥 갱신**: `.specify/scripts/bash/update-agent-context.sh codex`를 실행해 최신 기술 스택/최근 변경 사항을 반영한다.
6. **계약 기반 테스트 스텁**: 계약 파일을 토대로 Playwright/통합 테스트 입력값(10분 TTL, 1분 오차, 자동 재시도)을 quickstart에 참조한다.

## Phase 2: Task Planning Approach
- `/tasks` 명령은 계약/데이터 모델/quickstart에서 파생된 작업을 생성할 때, 다음 범주를 포함해야 한다.
  - **설정**: 환경 변수(Service role), Supabase 마이그레이션/시드, 기존 sessionStore 정리.
  - **테스트 선행**: Playwright 플로우, Supabase API 통합 테스트, 시간 오차 단위 테스트.
  - **핵심 구현**: 세션 생성 API Supabase 통합, 체크인 API 시계 검증/중복 차단/재시도 응답, UI 자동 재시도/메시지.
  - **관측성**: 구조화 로그, 3회 실패 로그 확인 스크립트, correlation ID.
  - **접근성·문서**: 한국어 UX 카피, README/운영 문서 업데이트.
- 작업 순서는 테스트(실패) → 구현 → 관측성/문서 순으로 배치하고, 파일 충돌이 없는 테스트/문서 작업은 [P] 병렬 태그를 허용한다.

## Phase 3+: Future Implementation
*이후 단계는 본 계획 범위를 벗어난다.*
- Phase 3: `/tasks` 명령으로 tasks.md 생성
- Phase 4: 작업 실행 및 코드 수정
- Phase 5: 전 테스트 통과 및 릴리스 검증

## Complexity Tracking
*현재 계획은 헌법 위반이 없어 추가 복잡성 예외가 필요하지 않다.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented

---
*Based on Constitution v1.1.0 - See `/memory/constitution.md`*
