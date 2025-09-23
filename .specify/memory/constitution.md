<!--
Sync Impact Report
Version change: 1.0.0 -> 1.1.0
Modified principles:
- (new) -> 한국어 커뮤니케이션 의무
Added sections:
- None
Removed sections:
- None
Templates requiring updates:
- UPDATED .specify/templates/plan-template.md
- UPDATED .specify/templates/spec-template.md
- UPDATED .specify/templates/tasks-template.md
Follow-up TODOs:
- None
-->

# University Attendance Management System Constitution

## Core Principles

### Student Data Stewardship
- Personal and location data MUST remain protected by Supabase Row Level Security and only be accessed through vetted server-side modules.
- Location telemetry MUST be purged or anonymized within 24 hours and MUST NOT be logged verbatim to client consoles or third-party services.
- Secrets (including Supabase keys and JWT material) MUST live in environment variables or secure secret stores; service-role keys stay in server-only files.
Rationale: We process sensitive student information and geolocation signals; mishandling this data violates privacy laws and destroys institutional trust.

### Attendance Integrity Enforcement
- Attendance writes MUST validate a signed QR payload and a geofence radius of 50 meters or less; any adjustment requires a recorded justification in the plan and PR.
- QR codes MUST expire in 30 minutes or less, with salts and signing keys rotated at least every release and never exposed to the client bundle.
- Manual overrides of attendance status MUST create an immutable audit event capturing actor, reason, and timestamp before the record changes.
Rationale: Academic records are high stakes; cryptographic and procedural controls are required to prevent tampering or spoofing.

### Test-First Quality Gates
- New behavior MUST start with failing automated tests (unit, integration, or Playwright) before implementation and demonstrate the red-green cycle in commits or PR notes.
- `npm run lint`, `npm run type-check`, and relevant test suites (`npx playwright test`, API/unit tests) MUST pass locally and in CI before merge.
- Flaky or skipped tests are prohibited; identify root causes or halt the release until reliability is restored.
Rationale: Only rigorously tested code protects attendance integrity and keeps regressions from reaching faculty or students.

### Operational Observability
- Server actions and API routes MUST emit structured JSON logs containing correlation IDs, actor context, and result codes while truncating raw coordinates beyond two decimal places.
- Supabase errors, timeout paths, and QR issuance metrics MUST feed an alerting or monitoring channel (Sentry, logging pipeline, or dashboards) within the same release.
- Each new metric, alert, or log stream MUST include an owner and a playbook entry in project docs or inline comments.
Rationale: Fast detection and recovery prevent false attendance status propagation and maintain service credibility during incidents.

### Delivery Simplicity & Accessibility
- All new frontend work MUST live within the Next.js App Router structure (`app/`) and reuse the established component directories (`components/ui`, `components/qr`, `components/location`).
- Interfaces MUST follow Tailwind utility-first styling, retain strict TypeScript typing, and ship with accessible camera/location prompts (labels, ARIA, reduced-motion fallbacks).
- Complex enhancements MUST be decomposed into iterative feature tickets, with trade-offs captured in docs or PR descriptions instead of rushed into a single release.
Rationale: A focused stack and accessible UX keep the MVP maintainable, mobile-friendly, and inclusive for every participant.

### 한국어 커뮤니케이션 의무
- 모든 프로젝트 산출물(계획, 명세, PR 설명, 커밋 메시지, 코드 주석, 사용자 문서, 자동화된 도구 출력)은 명확한 한국어로 작성해야 한다.
- 외부 고유명사나 표준 용어는 병기할 수 있으나 핵심 설명과 결론은 한국어를 기본으로 제공한다.
- 리뷰 과정에서 한국어 표현의 모호함이 발견되면 즉시 수정하고, 참고 번역이 필요할 경우 각주나 부록으로 제공한다.
Rationale: 일관된 한국어 커뮤니케이션은 팀 의사소통 효율과 학내 이해관계자의 접근성을 높인다.

## Stack Constraints & Architecture

- Next.js 14 with strict TypeScript is the canonical runtime; server actions and API routes live under `app/` and share types from `types/`.
- Supabase is the source of truth for persistence and auth; schema changes go through SQL migrations in `database/migrations/` and seeds in `data/*.json`.
- Shared logic (Supabase clients, trackers, heartbeats) resides in `lib/`; reusable primitives stay in `components/ui`, while QR and location flows live in their dedicated folders.
- HTTPS development (`npm run dev:https`) is required for camera and geolocation testing; commits MUST not modify the legacy CRA code in `frontend/`.
- Sensitive configuration stays in `.env.local` (uncommitted) and deployment secrets; no secrets are hard-coded or checked into version control.

## Execution Rituals

- Run `npm run lint`, `npm run type-check`, and targeted tests (Jest/unit, integration, `npx playwright test`) before requesting review; attach failure evidence if any gate is temporarily blocked.
- Capture Playwright artifacts in `test-results/` and document manual QA steps for camera/location flows when automation cannot cover them.
- Record environment variable additions, Supabase policy changes, and migration impacts in the PR description and update docs as needed.
- Use HTTPS dev mode when implementing or validating features that touch camera or geolocation permissions and note browser trust steps in docs.
- Flag any unavoidable constitution deviation in the plan and PR, including mitigation timeline and responsible owner.
- 모든 산출물과 리뷰 코멘트가 한국어로 작성되었는지 확인하고, 다른 언어 혼용 시 사유와 번역을 명시한다.

## Governance

- Authority: This constitution supersedes ad-hoc practices for this repository; all plans, tasks, and PR reviews MUST reference it when evaluating work.
- Amendment Process: Propose changes via PR referencing the impacted sections, include a Sync Impact Report update, secure approval from at least two maintainers (engineering + product/lead), and document rollout actions.
- Versioning Policy: Use semantic versioning—MAJOR for principle removal or redefinition, MINOR for new principles or sections, PATCH for clarifications—and update linked templates during the same change.
- Compliance Reviews: `/plan` and `/tasks` outputs MUST document a Constitution Check; reviewers block merges when gates fail. Conduct a quarterly audit to confirm principles remain enforceable.
- Enforcement: Violations require a tracked remediation ticket with deadline and owner; unresolved issues prevent release tagging.

**Version**: 1.1.0 | **Ratified**: 2025-09-24 | **Last Amended**: 2025-09-24
