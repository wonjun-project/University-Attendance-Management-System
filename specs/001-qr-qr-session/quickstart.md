# Quickstart: QR 세션 동기화 오류 복구 검증

## 1. 준비
1. `.env.local`에 `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있는지 확인한다.
2. 최신 마이그레이션을 실행한다.
   ```bash
   npm install
   ./scripts/run-migration.sh
   ```
3. 개발 서버를 HTTPS 모드로 실행한다 (카메라 권한 필요 시).
   ```bash
   npm run dev:https
   ```
4. 노트북 브라우저에서 교수 계정, 스마트폰(또는 모바일 에뮬레이터)에서 학생 계정으로 로그인한다.

## 2. 세션 생성 및 만료 시간 확인
1. `/professor/qr` 페이지에서 강의를 선택하고 QR 코드를 생성한다.
2. 개발자 도구 네트워크 탭으로 `POST /api/sessions/create` 응답을 열어 `qr_code_expires_at`이 현재 시각 +10분인지 확인한다.
3. Supabase 대시보드 또는 SQL 콘솔에서 `select id, qr_code_expires_at from class_sessions order by created_at desc limit 1;` 로 실제 저장 여부를 검증한다.

## 3. 학생 체크인 흐름 (성공 경로)
1. 학생 기기로 `/student/scan` 페이지에 접속해 생성된 QR을 스캔한다.
2. 첫 요청이 성공하면 "출석 완료" 메시지와 동시에 API 응답 200, 로그에 `result: success`가 남는지 확인한다.
3. 데이터베이스에서 `attendances`에 해당 학생 레코드가 생성·업데이트 되었는지 확인한다.

## 4. 자동 재시도 확인 (네트워크 지연 시나리오)
1. 네트워크 탭에서 `POST /api/attendance/checkin` 요청을 강제로 실패시키기 위해 첫 요청에 대한 응답을 차단하거나 네트워크를 offline으로 전환한다.
2. 3초 후 자동 재시도 1회가 발생하는지, 시각장애인 보조 기술을 위해 상태 메시지가 ARIA 라이브 영역에 출력되는지 확인한다.
3. 두 번째 요청이 성공하면 UI에 성공 메시지가 노출되고, `attendance_attempts`에 `attempt_number=1` 기록이 남는지 확인한다.

## 5. 시간 오차 검증
1. 학생 기기의 시스템 시간을 2분 뒤로 조정한다.
2. 다시 QR을 스캔하면 서버가 `clock_skew` 오류(HTTP 400)와 한국어 안내 메시지를 반환하는지 확인한다.
3. UI가 "기기 시간을 확인하세요"와 같은 보정 안내를 표시하는지 확인한다.
4. 기기 시간을 실제 시각으로 복구한 뒤 다시 출석하면 정상 처리된다.

## 6. 중복 기기 차단
1. 동일 학생 계정으로 다른 브라우저/기기에서 방금 생성한 세션을 스캔한다.
2. 첫 성공 이후 추가 요청은 HTTP 409와 "이미 출석 처리됨" 메시지를 반환하는지 확인한다.
3. `attendance_attempts`에 `result='duplicate'` 로그가 생기고 `attendances` 레코드는 변경되지 않아야 한다.

## 7. 연속 실패 로그 확인
1. 의도적으로 만료된 QR(10분이 지난 세션)을 스캔하여 3회 연속 실패를 발생시킨다 (자동 재시도 포함 총 3회).
2. 서버 로그에서 `failureStreak` 또는 `result: expired` 항목이 연속으로 기록되고, Supabase `attendance_attempts`에도 결과가 누적되는지 확인한다.
3. 별도 알림이 발송되지 않았음을 확인한다.

## 8. 회귀 테스트 자동화
1. Playwright 테스트를 실행한다.
   ```bash
   npx playwright test tests/e2e/qr-session-sync.spec.ts
   ```
2. `test-results/`에 성공/실패 스크린샷이 저장되는지 확인한다.
3. 마무리로 정적 점검을 수행한다.
   ```bash
   npm run lint
   npm run type-check
   ```

## 9. 성능 지표 확인
1. 성능 테스트 템플릿을 실행해 현재 응답 시간을 기록한다.
   ```bash
   npx playwright test tests/perf/qr-session-latency.test.ts
   ```
2. 현재는 구현 전 단계이므로 실패가 예상되지만, 실제 서버에서 재측정해  
   - 세션 생성 round-trip ≤ 500ms (75p)  
   - 학생 체크인 응답 ≤ 1초 (95p)  
   목표를 충족하는지 확인한다.
3. 결과를 `test-results/README.md` 또는 PR 템플릿에 기록한다.

## 10. 정리
- 테스트를 마치면 개발 서버를 종료한다.
- 필요 시 Supabase에서 테스트로 생성된 세션/출석 데이터를 삭제한다.
