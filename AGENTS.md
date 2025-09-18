# 저장소 가이드라인

## 프로젝트 구조 및 모듈 구성
- Next.js App Router는 `app/`에 위치하며, API 엔드포인트는 `app/api/<feature>/route.ts` 경로에 둡니다.
- 재사용 가능한 UI 프리미티브는 `components/ui`, QR 및 위치 관련 뷰는 각각 `components/qr`, `components/location`에서 관리합니다. 인증과 Supabase 클라이언트, 위치 추적기, 실시간 하트비트 등 범용 로직은 `lib/`에 두세요.
- 데이터베이스 마이그레이션과 시드 도구는 `database/migrations/` 및 `database/`에 보관하고, Playwright 시나리오는 `tests/e2e/`에 위치시킵니다. 레거시 CRA 코드는 `frontend/`에 있으므로 명시적인 지시 없이 수정하지 않습니다.
- 로컬 MVP에서 사용하는 JSON 픽스처(`data/*.json`)는 모의 인증 및 등록 흐름을 지원합니다. 실제 배포 환경에서는 Supabase 테이블 사용을 우선합니다.

## 빌드 · 테스트 · 개발 명령어
- `npm run dev` — 기본 Next.js 개발 서버를 실행합니다.
- `npm run dev:https` — `certs/dev/`의 자체 서명 인증서를 사용해 HTTPS 개발 서버를 실행합니다(모바일 카메라 접근 시 필수).
- `npm run build` / `npm start` — 프로덕션 번들을 생성하고 서빙합니다.
- `npm run lint`, `npm run type-check` — ESLint(`next/core-web-vitals`, `next/typescript`) 규칙과 TypeScript strict 모드를 강제합니다.
- `npx playwright test` — Playwright e2e 시나리오를 실행합니다. 필요 시 `npx playwright install`로 브라우저를 먼저 설치합니다.

## 코딩 스타일 및 네이밍 규칙
- TypeScript strict 모드, 2칸 들여쓰기, Tailwind 유틸리티 우선 스타일을 유지합니다.
- 파일 네이밍 규칙: 컴포넌트는 `PascalCase.tsx`, 훅/유틸은 `camelCase.ts`, API 라우트는 `app/api/feature/route.ts` 패턴을 사용합니다.
- 경로 참조 시 `@/*` 별칭을 활용하고, 불필요한 `console.log`는 제거하며 Tailwind 토큰(`tailwind.config.js`)과 일관성을 맞춥니다.

## 테스트 가이드라인
- 주요 커버리지는 `tests/e2e/*.spec.ts`에 있는 Playwright 시나리오로 확보하며, QR 생성/스캔, 위치 검증, 출석 체크 해피 패스를 포함합니다.
- 새 시나리오는 `<feature>.spec.ts` 형태로 작성하고, 테스트 결과물은 `test-results/`에 저장합니다.
- 변경 내용을 푸시하기 전 `npm run lint`와 `npm run type-check`를 실행합니다. `lib/`에 재사용 로직을 추가한다면 타깃 단위 테스트도 고려합니다.

## 커밋 및 PR 가이드라인
- 커밋 메시지는 명령형 어조와 스코프 프리픽스를 사용합니다(예: `feat(qr): refresh code countdown`).
- PR에는 변경 요약, 관련 이슈 링크, UI 변경 시 스크린샷, 환경 변수나 DB 마이그레이션 영향 등을 기재합니다.
- 스키마를 수정할 때는 `database/migrations/`에 새로운 SQL 파일을 추가하고 README 또는 AGENTS 문서를 최신 상태로 유지합니다.

## 보안 및 구성 팁
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET` 등을 `.env.local`과 배포 환경에 설정하며, 코드에 직접 노출하지 않습니다.
- Service Role 키는 서버 전용 모듈(예: API 라우트)에서만 사용합니다. JWT는 `auth-token` httpOnly 쿠키로 발급하므로 인증 관련 미들웨어를 변경할 때 동기화하세요.

## 에이전트 응답 지침
- 앞으로 사용자에게 제공하는 모든 답변은 반드시 한국어로 작성합니다.
