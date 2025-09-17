import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001'

test.describe('Student QR scanner - insecure context handling', () => {
  test('shows HTTPS requirement when camera starts in insecure context', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded' })

    // Ensure 학생 탭이 선택되어 있음
    await page.getByRole('button', { name: '학생' }).click()
    await page.fill('input[placeholder="202012345"]', 'stu001')
    await page.fill('input[placeholder="비밀번호를 입력하세요"]', 'password123')
    await page.getByRole('button', { name: '로그인' }).click()

    await page.waitForURL('**/student', { timeout: 15000 })

    await page.goto(`${BASE_URL}/student/scan`, { waitUntil: 'domcontentloaded' })

    await page.evaluate(() => {
      const descriptor = Object.getOwnPropertyDescriptor(window, 'isSecureContext')
      if (descriptor?.configurable) {
        Object.defineProperty(window, 'isSecureContext', {
          configurable: true,
          get() {
            return false
          }
        })
      }
    })

    await page.getByRole('button', { name: '📸 QR코드 스캔 시작' }).click()

    await expect(
      page.getByText('카메라 기능은 HTTPS 또는 localhost에서만 사용할 수 있습니다.', { exact: false })
    ).toBeVisible()

    await context.close()
  })
})
