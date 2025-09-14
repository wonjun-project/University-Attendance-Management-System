import { test, expect } from '@playwright/test'

const BASE_URL = process.env.DEPLOY_URL || 'https://university-attendance-management-sy.vercel.app'

test.describe('Professor QR generation (prod)', () => {
  test('generates QR with predefined location', async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: { latitude: 36.6291, longitude: 127.4565 },
    })
    const page = await context.newPage()

    // Login as professor
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: '교수' }).click()
    await page.waitForSelector('input[placeholder="PROF001"]', { timeout: 15000 })
    await page.fill('input[placeholder="PROF001"]', 'prof001')
    await page.fill('input[placeholder="비밀번호를 입력하세요"]', 'password123')
    await page.getByRole('button', { name: '로그인' }).click()

    // Redirect to professor dashboard
    await page.waitForURL(/\/professor(\/.*)?$/, { timeout: 15000 })

    // Go to QR page
    await page.goto(`${BASE_URL}/professor/qr`, { waitUntil: 'domcontentloaded' })
    // wait a moment for location options to load (RPC or dummy fallback)
    await page.waitForTimeout(800)

    // ensure selects exist
    await expect(page.locator('select').first()).toBeVisible()

    // Select predefined building/room
    const selects = page.locator('select')
    // Wait until building select has our option
    await page.waitForFunction(() => {
      const sel = document.querySelectorAll('select')[0] as HTMLSelectElement | undefined
      return !!sel && Array.from(sel.options).some(o => o.label.includes('제1자연관'))
    })
    await selects.nth(0).selectOption({ label: '제1자연관' })

    // Wait until room select populated
    await page.waitForFunction(() => {
      const sel = document.querySelectorAll('select')[1] as HTMLSelectElement | undefined
      return !!sel && Array.from(sel.options).some(o => o.label.includes('501'))
    })
    await selects.nth(1).selectOption({ label: '제1자연관 501호' })

    // Generate QR
    const btn = page.getByRole('button', { name: /QR코드 생성하기|생성 중/ })
    await expect(btn).toBeEnabled()
    await btn.click()

    // Expect QR card to appear
    await expect(page.getByText('출석 QR코드')).toBeVisible({ timeout: 30000 })
    await expect(page.locator('img[alt="출석 QR코드"]')).toBeVisible()

    await context.close()
  })
})
