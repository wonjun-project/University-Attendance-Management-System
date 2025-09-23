import { test, expect } from '@playwright/test'

const PROFESSOR_EMAIL = process.env.PLAYWRIGHT_PROFESSOR_EMAIL ?? 'prof@example.com'
const PROFESSOR_PASSWORD = process.env.PLAYWRIGHT_PROFESSOR_PASSWORD ?? 'password'
const STUDENT_EMAIL = process.env.PLAYWRIGHT_STUDENT_EMAIL ?? 'student@example.com'
const STUDENT_PASSWORD = process.env.PLAYWRIGHT_STUDENT_PASSWORD ?? 'password'

/**
 * 현재 구현이 진행 중이므로 테스트는 실패 상태를 유지한다.
 * 구현 완료 후 QR 생성 → 학생 스캔 → 자동 재시도/시간 오차/중복 기기 등
 * 주요 시나리오를 실제 브라우저 환경에서 검증할 예정이다.
 */

test.describe('QR 세션 동기화 플로우', () => {
  test('교수 생성 → 학생 스캔 성공 플로우', async ({ page, context }) => {
    test.fail(true, 'QR 세션 동기화 구현 전이므로 실패가 예상됩니다.')

    await page.goto('/login')
    await page.fill('input[name="email"]', PROFESSOR_EMAIL)
    await page.fill('input[name="password"]', PROFESSOR_PASSWORD)
    await page.click('button[type="submit"]')

    await page.waitForURL('/professor/qr', { timeout: 10_000 })
    await page.click('button:has-text("QR 코드 생성")')
    const sessionId = await page.getByTestId('qr-session-id').innerText()
    expect(sessionId).not.toBe('')

    const studentPage = await context.newPage()
    await studentPage.goto('/login')
    await studentPage.fill('input[name="email"]', STUDENT_EMAIL)
    await studentPage.fill('input[name="password"]', STUDENT_PASSWORD)
    await studentPage.click('button[type="submit"]')

    await studentPage.waitForURL('/student/scan', { timeout: 10_000 })
    await studentPage.evaluate((id) => {
      window.dispatchEvent(new CustomEvent('playwright:mock-scan', { detail: { sessionId: id } }))
    }, sessionId)

    await expect(studentPage.getByText('출석 완료')).toBeVisible()
  })

  test('시간 오차 1분 초과 시 clock_skew 오류 노출', async ({ page }) => {
    test.fail(true, 'QR 세션 동기화 구현 전이므로 실패가 예상됩니다.')

    await page.goto('/student/scan')
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('playwright:mock-scan', {
        detail: {
          sessionId: '00000000-0000-0000-0000-000000000000',
          clientTimestamp: new Date(Date.now() + 120_000).toISOString()
        }
      }))
    })

    await expect(page.getByText('기기 시간을 확인하세요')).toBeVisible()
  })

  test('동일 학생 중복 기기 접근 시 차단', async ({ page }) => {
    test.fail(true, 'QR 세션 동기화 구현 전이므로 실패가 예상됩니다.')

    await page.goto('/student/scan')
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('playwright:mock-scan', {
        detail: {
          sessionId: '00000000-0000-0000-0000-000000000001'
        }
      }))
    })

    await expect(page.getByText('이미 출석 처리됨')).toBeVisible()
  })
})
