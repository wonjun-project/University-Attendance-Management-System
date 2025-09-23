# Playwright 실행 요약 (QR 세션 동기화)

- 실행 명령어: `npx playwright test`
- 실행 일시: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
- 테스트 수: 9 (신규 e2e + API 계약 테스트)
- 현재 상태: 서비스 구현 전 단계이므로 모든 테스트가 `test.fail(true, ...)` 설정에 따라 **예상 실패(Expected)** 상태로 통과했습니다.
- 참고 사항:
  - 실서버 없이 실행했기 때문에 세션/체크인 API 호출은 `ECONNREFUSED`가 발생하며, 향후 구현 후 실제 응답을 검증하도록 수정 예정입니다.
  - `playwright.config.ts`에서 `tests/e2e.disabled/**/*`는 자동으로 skip 처리됩니다.

필요 시 `PLAYWRIGHT_BASE_URL` 환경 변수를 설정하여 실제 개발 서버에 대해 테스트를 재실행하세요.
