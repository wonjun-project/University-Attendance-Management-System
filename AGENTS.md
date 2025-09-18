# Repository Guidelines

## Project Structure & Module Organization
- Next.js App Router lives in `app/`, with API entrypoints under `app/api/<feature>/route.ts`.
- Shared UI primitives reside in `components/ui`, QR and location views in `components/qr` and `components/location`, and cross-cutting logic in `lib/` (auth, Supabase clients, location trackers, realtime heartbeat).
- Database migrations and seed helpers are stored in `database/migrations/` and `database/`, while Playwright specs live in `tests/e2e/`. Legacy CRA code remains in `frontend/`—leave it untouched unless explicitly required.
- JSON fixtures for the local MVP (`data/*.json`) power the mock auth and enrollment flows; prefer Supabase tables for production data.

## Build, Test, and Development Commands
- `npm run dev` — start the default Next.js dev server.
- `npm run dev:https` — launch the dev server with the self-signed certs in `certs/dev/` (required for camera access on mobile).
- `npm run build` / `npm start` — create and serve the production bundle.
- `npm run lint` and `npm run type-check` — enforce ESLint (`next/core-web-vitals`, `next/typescript`) and TypeScript strictness.
- `npx playwright test` — execute Playwright e2e suites (install browsers first with `npx playwright install`).

## Coding Style & Naming Conventions
- TypeScript strict mode, 2-space indentation, and Tailwind utility-first styling are mandatory.
- Follow filename patterns: components `PascalCase.tsx`, hooks/utilities `camelCase.ts`, API routes `app/api/feature/route.ts`.
- Use the `@/*` path alias, avoid stray console logs, and keep UI tokens aligned with `tailwind.config.js`.

## Testing Guidelines
- Primary coverage comes from Playwright specs in `tests/e2e/*.spec.ts`; aim to cover QR generation/scanning, location validation, and attendance happy paths.
- Name new specs `<feature>.spec.ts` and store media artifacts under `test-results/`.
- Run `npm run lint` and `npm run type-check` before pushing; add targeted unit tests when introducing reusable logic in `lib/`.

## Commit & Pull Request Guidelines
- Write imperative commit messages with scoped prefixes (e.g., `feat(qr): refresh code countdown`).
- Pull requests should summarize changes, link relevant issues, attach updated screenshots for UI tweaks, and call out environment or DB migration impacts.
- When altering schema, append a new SQL file to `database/migrations/` and update README/AGENTS as needed.

## Security & Configuration Tips
- Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `JWT_SECRET` in `.env.local` and deployment targets; never embed secrets in code.
- Service Role keys belong in server-only modules (e.g., API routes). JWTs are issued as `auth-token` httpOnly cookies—keep middleware in sync with auth changes.

## 에이전트 응답 지침
- 앞으로 사용자에게 제공하는 모든 답변은 반드시 한국어로 작성합니다.
