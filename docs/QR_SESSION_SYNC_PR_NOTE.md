# PR 체크리스트 (QR 세션 동기화 기능)

- [ ] `database/migrations/010_create_attendance_attempts.sql` 적용 여부 확인 (`./scripts/run-migration.sh` 또는 Supabase SQL Editor)
- [ ] `.env.local`에 `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있는지 확인
- [ ] `node scripts/purge-old-attempts.mjs`를 스케줄링하거나 수동으로 실행해 24시간 이전 `attendance_attempts`가 정리되는지 점검
- [ ] `npm run lint`
- [ ] `npm run type-check`
- [ ] `npx playwright test` (신규 계약/플로우 테스트는 현재 expected failure 상태)
- [ ] `/app/api/sessions/create/route.ts`와 `/app/api/attendance/checkin/route.ts`의 구조화 로그에 `correlationId`가 포함되는지 확인
- [ ] `/app/student/scan/page.tsx`에서 자동 재시도 메시지가 한국어로 노출되는지 확인
- [ ] `/app/professor/qr` UI에서 10분 만료 타이머가 표시되는지 확인
