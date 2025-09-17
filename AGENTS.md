# Repository Guidelines

## 프로젝트 구조 및 모듈 구성
Next.js App Router 코드는 `app/`에 있고, API 엔드포인트는 `app/api/<feature>/route.ts` 아래에 둡니다. 재사용 가능한 컴포넌트는 `components/`에 구성하며, UI 프리미티브는 `components/ui`, QR·위치 관련 뷰는 `components/qr`, `components/location`에 배치합니다. 공통 로직과 외부 연동 코드는 `lib/`에서 관리하고, 타입 선언은 `types/`에 모읍니다. Supabase용 SQL은 `database/migrations/`에 순차적으로 추가하고, 테스트 및 산출물은 `tests/`, `test-results/`, `data/`에 정리합니다. 레거시 CRA 앱은 `frontend/`에 남아 있으므로 변경 전 사전 확인이 필요합니다.

## 빌드·테스트·개발 명령어
- `npm run dev`: Next.js 개발 서버를 실행합니다.
- `npm run dev:https`: 자체 서명 인증서를 사용해 HTTPS 개발 서버를 실행합니다(초기 실행 시 `certs/dev` 인증서를 OS/브라우저에 신뢰 추가 필요).
- `npm run build`: 프로덕션 번들을 생성합니다.
- `npm start`: `next start`로 빌드 결과를 서빙합니다.
- `npm run lint`: ESLint(`next/core-web-vitals`, `next/typescript`) 규칙을 적용해 경고까지 해결합니다.
- `npm run type-check`: `tsc --noEmit`으로 정적 타입 검사를 수행합니다.
- `npx playwright test`: Playwright e2e 시나리오를 실행합니다(필요 시 `npx playwright install`).

## 코딩 스타일 및 네이밍 규칙
Strict 모드 TypeScript와 2스페이스 들여쓰기를 사용합니다. Tailwind 유틸 클래스를 우선 활용하고, 새로운 스타일은 토큰 체계를 유지합니다. 컴포넌트 파일은 `PascalCase.tsx`, 훅·유틸은 `camelCase.ts`, API 라우트는 `app/api/feature/route.ts` 패턴을 따릅니다. 경로 참조 시 `@/*` 별칭을 활용하고, 불필요한 변경이나 콘솔 로그는 최소화합니다.

## 테스트 가이드라인
Playwright를 기본 e2e 프레임워크로 사용하며 케이스는 `tests/` 또는 `e2e/` 폴더에 `*.spec.ts`로 배치합니다. QR 생성·스캔, 위치 검증, 출석 체크 등 핵심 플로우의 해피 패스를 포함해 회귀 리스크를 줄입니다. 변경 사항을 공유하기 전 `npm run lint`와 `npm run type-check`를 통과시키고, 서버 의존 기능은 Supabase 프로젝트에서 수동으로 검증합니다.

## 커밋 및 PR 가이드라인
커밋 메시지는 명령형으로 작성하며 스코프를 명확히 표시합니다(예: `feat(qr): refresh code countdown`). PR 설명에는 변경 요약, 관련 이슈 링크, UI 변경 시 스크린샷, 환경/DB 수정 사항을 포함합니다. 스키마 변경 시 `database/migrations/`에 SQL을 추가하고, 문서(`README.md`, `AGENTS.md`)를 최신 상태로 유지합니다.

## 보안 및 구성 팁
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET` 등 필수 환경 변수를 `.env.local`과 배포 환경 모두에 설정합니다. Service Role 키는 서버 전용 코드에서만 사용하고, JWT는 `auth-token` httpOnly 쿠키로 관리합니다. JSON 기반 데모 데이터(`data/`)는 동시성에 취약하므로 실제 배포에서는 Supabase 테이블을 사용하세요.

## 에이전트 작업 지침
사용자에게 응답할 때는 항상 한국어를 사용합니다. 새 API는 `app/api/<name>/route.ts`에 추가하고 `lib/` 유틸을 재활용합니다. UI 변경 시 `components/ui` 컴포넌트와 Tailwind 프리셋을 우선 고려하고, 위치·QR 관련 로직은 기존 모듈을 확장합니다. 레거시 `frontend/` 디렉터리는 지시가 없는 한 편집하지 말고, 비밀 키와 샘플 크리덴셜은 커밋에서 제외합니다.
