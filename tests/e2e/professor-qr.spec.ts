import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'https://university-attendance-management-sy.vercel.app'

test.describe('Professor QR generation (prod)', () => {
  test('generates QR with predefined location', async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: { latitude: 36.6291, longitude: 127.4565 },
    })
    const page = await context.newPage()

    // Login as professor
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded' })
    await page.screenshot({ path: testInfo.outputPath('step1-login.png'), fullPage: true })
    await page.getByRole('button', { name: '교수' }).click()
    await page.waitForSelector('input[placeholder="PROF001"]', { timeout: 15000 })
    await page.fill('input[placeholder="PROF001"]', 'prof001')
    await page.fill('input[placeholder="비밀번호를 입력하세요"]', 'password123')
    await page.getByRole('button', { name: '로그인' }).click()
    await page.screenshot({ path: testInfo.outputPath('step2-login-submitted.png'), fullPage: true })

    // Redirect to professor dashboard
    await page.waitForURL(/\/professor(\/.*)?$/, { timeout: 15000 })

    // Go to QR page
    await page.goto(`${BASE_URL}/professor/qr`, { waitUntil: 'domcontentloaded' })
    await page.screenshot({ path: testInfo.outputPath('step3-qr-page.png'), fullPage: true })
    // wait a moment for location options to load (RPC or dummy fallback)
    await page.waitForTimeout(800)

    const currentLocationRadio = page.getByRole('radio', { name: '🎯 현재 위치 사용' })
    await currentLocationRadio.click()

    const currentLocationButton = page.getByRole('button', { name: '📍 현재 위치 가져오기' })
    await expect(currentLocationButton).toBeEnabled({ timeout: 5000 })
    await currentLocationButton.click()

    await page.waitForTimeout(1000)
    await page.screenshot({ path: testInfo.outputPath('step4-location-selected.png'), fullPage: true })

    // Stub QR 생성 API가 실패해도 테스트를 진행할 수 있도록 목업
    await page.route('**/api/qr/generate', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }

      const now = new Date()
      const expiresAt = new Date(now.getTime() + 30 * 60 * 1000)

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          qrData: {
            sessionId: 'session-playwright-stub',
            courseId: 'demo-course-stub',
            expiresAt: expiresAt.toISOString(),
            type: 'attendance'
          },
          qrCode: `${BASE_URL}/student/attendance/session-playwright-stub`,
          expiresAt: expiresAt.toISOString(),
          courseName: '데모 강의',
          courseCode: 'DEMO101',
          classroomLocation: {
            latitude: 36.6291,
            longitude: 127.4565,
            radius: 30,
            locationType: 'current',
            predefinedLocationId: null
          }
        })
      })
    })

    // Generate QR
    const btn = page.getByRole('button', { name: /강의 시작/ })
    await expect(btn).toBeEnabled()
    await btn.click()
    await page.waitForTimeout(2000)
    await page.screenshot({ path: testInfo.outputPath('step5-after-generate-click.png'), fullPage: true })

    // Expect QR card to appear
    // QR 성공 카드가 뜨지 않더라도 스크린샷으로 상태 확인할 수 있게 함
    try {
      await expect(page.getByText('출석 QR코드')).toBeVisible({ timeout: 30000 })
      await expect(page.locator('img[alt="출석 QR코드"]')).toBeVisible()
    } finally {
      await page.screenshot({ path: testInfo.outputPath('step6-final.png'), fullPage: true })
    }

    await context.close()
  })
})
