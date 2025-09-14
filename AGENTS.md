# Repository Guidelines

## Project Structure & Module Organization
- Next.js (App Router) in `app/` with API routes under `app/api/*/route.ts`.
- UI in `components/` (e.g., `components/ui`, `components/qr`, `components/location`).
- Shared code in `lib/` (auth, Supabase, QR, location).
- DB SQL in `database/migrations/` (run in Supabase SQL Editor).
- Types in `types/`. Legacy CRA app in `frontend/` (excluded from tsconfig).

## Build, Test, and Development Commands
- `npm run dev` — Start Next.js dev server.
- `npm run build` — Production build.
- `npm start` — Run built app.
- `npm run lint` — ESLint (errors ignored during build by Next config, fix locally).
- `npm run type-check` — TypeScript check.
- Playwright (if used): `npx playwright install`, `npx playwright test`.

## Coding Style & Naming Conventions
- TypeScript, 2-space indentation, strict mode.
- ESLint: `next/core-web-vitals`, `next/typescript`. Fix warnings before PR.
- Tailwind CSS for styling; prefer utility classes over custom CSS.
- File naming: components `PascalCase.tsx` (e.g., `Button.tsx`), hooks/utilities `camelCase.ts`, API routes `app/api/feature/route.ts`.
- Use path alias `@/*`. Keep changes minimal and focused.

## Testing Guidelines
- Prefer Playwright for e2e: place specs under `tests/` or `e2e/` as `*.spec.ts`.
- Include basic happy-path tests for new flows (auth, QR generate/scan, attendance check-in).
- Run `npm run type-check` and `npm run lint` before pushing.

## Commit & Pull Request Guidelines
- Commits: imperative, concise, scoped (e.g., "feat(qr): add unified scanner fallback").
- PRs: clear description, linked issues, screenshots for UI, notes on env/DB changes.
- Update docs (`README.md`, this file) and SQL migrations as needed.

## Security & Configuration Tips
- Required env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` client-side; use only in server/API routes.
- JWT stored in `auth-token` httpOnly cookie; middleware enforces role routes.
- Demo endpoints/accounts exist for MVP; replace with real DB flows for production.

## Agent-Specific Instructions
- When adding APIs, place them under `app/api/<name>/route.ts` and reuse `lib/*`.
- UI: prefer existing primitives in `components/ui`. Keep Tailwind tokens consistent.
- Do not modify `frontend/` unless explicitly requested. Avoid introducing secrets into repo.
