import 'dotenv/config'
import { test, expect } from '@playwright/test'
import type { BrowserContext } from '@playwright/test'
import { SignJWT } from 'jose'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001'
const HOSTNAME = new URL(BASE_URL).hostname

async function addAuthCookie(context: BrowserContext, user: { userId: string; userType: 'student' | 'professor'; name: string }) {
  const secretString = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
  const encoder = new TextEncoder()
  const token = await new SignJWT(user)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encoder.encode(secretString))

  const domain = HOSTNAME

  await context.addCookies([
    {
      name: 'auth-token',
      value: token,
      domain,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
    }
  ])
}

test.describe.skip('Student QR scanner - insecure context handling', () => {
  test('shows HTTPS requirement when camera starts in insecure context', async ({ browser }) => {
    test.skip(HOSTNAME !== 'localhost', 'E2E 테스트는 로컬 개발 서버에서만 실행됩니다.')

    const context = await browser.newContext()
    await addAuthCookie(context, {
      userId: 'stu001',
      userType: 'student',
      name: '테스트 학생'
    })

    await context.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: {
            id: 'stu001',
            name: '테스트 학생',
            type: 'student'
          }
        })
      })
    })

    const page = await context.newPage()

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
