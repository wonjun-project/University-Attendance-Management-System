# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   -> If not found: ERROR "No implementation plan found"
   -> Extract: tech stack, libraries, structure, constitutional obligations
2. Load optional design documents:
   -> data-model.md: Extract entities -> model and validation tasks
   -> contracts/: Each file -> contract/API task pair
   -> research.md: Extract decisions -> setup/observability/privacy tasks
3. Generate tasks by category:
   -> Setup: environment, secrets, migrations, fixtures
   -> Tests: Playwright, integration, unit (MUST precede implementation)
   -> Core: Next.js routes/server actions, Supabase access, UI components
   -> Integration: logging, monitoring, alerts, third-party hooks
   -> Polish: accessibility, docs, cleanup
4. Apply task rules:
   -> Different files = mark [P] for parallel
   -> Same file = sequential (no [P])
   -> Tests before implementation (TDD + quality gates)
   -> Include explicit tasks for Constitution principles (privacy, integrity, observability, accessibility)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   -> All principles satisfied with concrete work items
   -> Tests cover every requirement
   -> Quality gates (lint, type-check, Playwright) present
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- Next.js App Router features live under `app/` with co-located route handlers
- Reusable UI primitives: `components/ui/`, QR views: `components/qr/`, location views: `components/location/`
- Shared logic: `lib/`, types: `types/`
- Database work: `database/migrations/`, fixtures: `data/*.json`
- End-to-end tests: `tests/e2e/`, artifacts stored in `test-results/`
- Legacy CRA code in `frontend/` is read-only

## Phase 3.1: Setup
- [ ] T001 Confirm required env vars (`NEXT_PUBLIC_SUPABASE_URL`, etc.) in `.env.local` and Supabase roles for the feature
- [ ] T002 Install or update npm dependencies noted in plan.md using `npm install`
- [ ] T003 [P] Prepare migrations or fixtures in `database/migrations/` or `data/*.json`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: Playwright, unit, and integration tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T004 [P] Add or update Playwright scenario(s) in `tests/e2e/[feature].spec.ts` covering QR + location acceptance criteria
- [ ] T005 [P] Create server/unit tests for new Supabase logic in `lib/__tests__/[feature].test.ts`
- [ ] T006 [P] Add contract tests for affected API routes in `tests/api/[feature].test.ts`

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [ ] T007 [P] Implement Next.js route or server action under `app/[route]/route.ts`
- [ ] T008 [P] Extend shared logic in `lib/[feature].ts` enforcing geofence + QR validation rules
- [ ] T009 [P] Build UI components in `components/ui|qr|location` with Tailwind utilities and ARIA attributes
- [ ] T010 Wire Supabase queries and RLS checks in `lib/supabase/[feature].ts`
- [ ] T011 Implement validation and exception logging for manual overrides

## Phase 3.4: Integration
- [ ] T012 Apply database migrations or seed data via Supabase/SQL scripts
- [ ] T013 Configure structured logging and monitoring hooks for new flows
- [ ] T014 Verify HTTPS dev flow (`npm run dev:https`) for camera/location permissions when relevant

## Phase 3.5: Polish
- [ ] T015 [P] Ensure accessibility copy and translations are updated in `app` or `components`
- [ ] T016 [P] Update documentation (e.g., `README.md`, `docs/*.md`) with workflow or env changes
- [ ] T017 Capture and archive Playwright artifacts in `test-results/`
- [ ] T018 Remove temporary logs, feature flags, and dead code

## Dependencies
- Tests (T004-T006) block all core implementation work (T007-T011)
- Database changes (T012) must precede Supabase-dependent features
- Logging/monitoring (T013) requires completed core logic (T007-T011)
- Polish tasks (T015-T018) occur after integration tasks are successful

## Parallel Example
```
# Launch Playwright + test scaffolding together:
Task: "T004 [P] Add Playwright scenario in tests/e2e/[feature].spec.ts"
Task: "T005 [P] Create Supabase unit tests in lib/__tests__/[feature].test.ts"
Task: "T006 [P] Add contract tests in tests/api/[feature].test.ts"
```

## Notes
- [P] tasks = different files, no dependencies
- Document failing test evidence before implementing fixes
- Run `npm run lint`, `npm run type-check`, and `npx playwright test` before completing Phase 3.5
- Capture constitutional risks (privacy, integrity, observability, accessibility) if tasks cannot satisfy them
- 모든 Task 설명과 주석은 한국어로 작성하고 필요 시 참고 용어를 괄호로 병기한다

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**:
   - Each contract file -> contract test task [P]
   - Each endpoint -> implementation + monitoring task
2. **From Data Model**:
   - Each entity -> model/service task pair with validation rules
   - Relationships -> Supabase policy or join tasks
3. **From User Stories**:
   - Each story -> Playwright acceptance test
   - Edge cases -> additional integration test tasks
4. **From Constitution**:
   - Privacy -> tasks for data retention, secret management, RLS validation
   - Integrity -> tasks for QR expiry, geofence thresholds, exception journaling
   - Quality -> lint/type/test runs recorded as tasks
   - Observability -> logging + alert tasks
   - Accessibility -> UI compliance tasks

## Validation Checklist
*GATE: Checked by main() before returning*

- [ ] All contracts and user stories have corresponding tests
- [ ] All tests precede implementation tasks
- [ ] Quality gate tasks (`npm run lint`, `npm run type-check`, Playwright) exist
- [ ] Data stewardship and observability work items are present when relevant
- [ ] Parallel tasks target distinct files with no hidden dependencies
- [ ] Every task lists a concrete repository path
- [ ] 모든 Task 설명이 한국어로 작성되었다
