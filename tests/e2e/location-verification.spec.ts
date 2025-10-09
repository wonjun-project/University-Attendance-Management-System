import { test, expect } from '@playwright/test'

// 서울대학교 정문 좌표 (테스트용 기준점)
const CLASSROOM_LAT = 37.4607
const CLASSROOM_LON = 126.9524
const ALLOWED_RADIUS = 100 // 100미터

// Haversine 공식으로 특정 거리만큼 떨어진 좌표 계산
function calculateOffset(lat: number, lon: number, distanceMeters: number, bearing: number) {
  const R = 6371000 // 지구 반지름 (미터)
  const latRad = lat * Math.PI / 180
  const lonRad = lon * Math.PI / 180
  const bearingRad = bearing * Math.PI / 180

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(distanceMeters / R) +
    Math.cos(latRad) * Math.sin(distanceMeters / R) * Math.cos(bearingRad)
  )

  const newLonRad = lonRad + Math.atan2(
    Math.sin(bearingRad) * Math.sin(distanceMeters / R) * Math.cos(latRad),
    Math.cos(distanceMeters / R) - Math.sin(latRad) * Math.sin(newLatRad)
  )

  return {
    latitude: newLatRad * 180 / Math.PI,
    longitude: newLonRad * 180 / Math.PI
  }
}

// 크롬 브라우저 및 geolocation 권한 설정
test.use({
  permissions: ['geolocation']
})

test.describe('위치 기반 출석 검증 테스트', () => {
  let sessionId: string
  let qrCode: string

  test.beforeAll(async ({ browser }) => {
    // 교수 로그인 및 QR 코드 생성
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('http://localhost:3000/auth/login')
    await page.fill('input[name="email"]', 'prof@test.com')
    await page.fill('input[name="password"]', 'test123')
    await page.click('button[type="submit"]')

    await page.waitForURL('**/professor/**')

    // QR 코드 생성
    await page.goto('http://localhost:3000/professor/qr')

    // 강의실 위치 설정
    await page.fill('input[name="latitude"]', CLASSROOM_LAT.toString())
    await page.fill('input[name="longitude"]', CLASSROOM_LON.toString())
    await page.fill('input[name="radius"]', ALLOWED_RADIUS.toString())

    await page.click('button:has-text("QR 코드 생성")')

    // QR 코드 및 세션 ID 추출
    const qrCodeElement = await page.waitForSelector('[data-testid="qr-code"]')
    qrCode = await qrCodeElement.getAttribute('data-qr-code') || ''

    const sessionIdElement = await page.waitForSelector('[data-testid="session-id"]')
    sessionId = await sessionIdElement.textContent() || ''

    console.log('생성된 세션 ID:', sessionId)
    console.log('QR 코드:', qrCode)

    await context.close()
  })

  test('강의실 정확한 위치에서 출석 - 성공', async ({ page }) => {
    // 정확한 강의실 위치로 GPS 설정
    await page.context().setGeolocation({
      latitude: CLASSROOM_LAT,
      longitude: CLASSROOM_LON,
      accuracy: 10
    })

    await page.goto('http://localhost:3000/auth/login')
    await page.fill('input[name="email"]', 'student@test.com')
    await page.fill('input[name="password"]', 'test123')
    await page.click('button[type="submit"]')

    await page.waitForURL('**/student/**')

    // QR 스캔 페이지로 이동
    await page.goto('http://localhost:3000/student/scan')

    // QR 코드 입력
    await page.fill('input[name="qr-code"]', qrCode)
    await page.click('button:has-text("출석 체크")')

    // 성공 메시지 확인
    await expect(page.locator('text=출석이 완료되었습니다')).toBeVisible({ timeout: 10000 })

    console.log('✅ 정확한 위치 테스트 성공')
  })

  test('강의실에서 50m 떨어진 위치 - 성공', async ({ page }) => {
    // 50m 떨어진 위치 (허용 범위 내)
    const offset50m = calculateOffset(CLASSROOM_LAT, CLASSROOM_LON, 50, 0)

    await page.context().setGeolocation({
      latitude: offset50m.latitude,
      longitude: offset50m.longitude,
      accuracy: 10
    })

    await page.goto('http://localhost:3000/auth/login')
    await page.fill('input[name="email"]', 'student2@test.com')
    await page.fill('input[name="password"]', 'test123')
    await page.click('button[type="submit"]')

    await page.waitForURL('**/student/**')

    await page.goto('http://localhost:3000/student/scan')
    await page.fill('input[name="qr-code"]', qrCode)
    await page.click('button:has-text("출석 체크")')

    await expect(page.locator('text=출석이 완료되었습니다')).toBeVisible({ timeout: 10000 })

    console.log('✅ 50m 거리 테스트 성공')
  })

  test('강의실에서 95m 떨어진 위치 - 성공', async ({ page }) => {
    // 95m 떨어진 위치 (허용 범위 내)
    const offset95m = calculateOffset(CLASSROOM_LAT, CLASSROOM_LON, 95, 90)

    await page.context().setGeolocation({
      latitude: offset95m.latitude,
      longitude: offset95m.longitude,
      accuracy: 10
    })

    await page.goto('http://localhost:3000/auth/login')
    await page.fill('input[name="email"]', 'student3@test.com')
    await page.fill('input[name="password"]', 'test123')
    await page.click('button[type="submit"]')

    await page.waitForURL('**/student/**')

    await page.goto('http://localhost:3000/student/scan')
    await page.fill('input[name="qr-code"]', qrCode)
    await page.click('button:has-text("출석 체크")')

    await expect(page.locator('text=출석이 완료되었습니다')).toBeVisible({ timeout: 10000 })

    console.log('✅ 95m 거리 테스트 성공')
  })

  test('강의실에서 120m 떨어진 위치 - 실패', async ({ page }) => {
    // 120m 떨어진 위치 (허용 범위 초과)
    const offset120m = calculateOffset(CLASSROOM_LAT, CLASSROOM_LON, 120, 180)

    await page.context().setGeolocation({
      latitude: offset120m.latitude,
      longitude: offset120m.longitude,
      accuracy: 10
    })

    await page.goto('http://localhost:3000/auth/login')
    await page.fill('input[name="email"]', 'student4@test.com')
    await page.fill('input[name="password"]', 'test123')
    await page.click('button[type="submit"]')

    await page.waitForURL('**/student/**')

    await page.goto('http://localhost:3000/student/scan')
    await page.fill('input[name="qr-code"]', qrCode)
    await page.click('button:has-text("출석 체크")')

    // 실패 메시지 확인
    await expect(page.locator('text=위치 검증 실패')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=120m')).toBeVisible()

    console.log('✅ 120m 거리 테스트 성공 (출석 거부 확인)')
  })

  test('강의실에서 200m 떨어진 위치 - 실패', async ({ page }) => {
    // 200m 떨어진 위치 (허용 범위 초과)
    const offset200m = calculateOffset(CLASSROOM_LAT, CLASSROOM_LON, 200, 270)

    await page.context().setGeolocation({
      latitude: offset200m.latitude,
      longitude: offset200m.longitude,
      accuracy: 10
    })

    await page.goto('http://localhost:3000/auth/login')
    await page.fill('input[name="email"]', 'student5@test.com')
    await page.fill('input[name="password"]', 'test123')
    await page.click('button[type="submit"]')

    await page.waitForURL('**/student/**')

    await page.goto('http://localhost:3000/student/scan')
    await page.fill('input[name="qr-code"]', qrCode)
    await page.click('button:has-text("출석 체크")')

    // 실패 메시지 확인
    await expect(page.locator('text=위치 검증 실패')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=200m')).toBeVisible()

    console.log('✅ 200m 거리 테스트 성공 (출석 거부 확인)')
  })

  test('GPS 정확도가 낮아도 실제 거리로 검증', async ({ page }) => {
    // GPS 정확도 50m, 실제 거리 80m (100m 이내이므로 성공해야 함)
    const offset80m = calculateOffset(CLASSROOM_LAT, CLASSROOM_LON, 80, 45)

    await page.context().setGeolocation({
      latitude: offset80m.latitude,
      longitude: offset80m.longitude,
      accuracy: 50 // GPS 정확도가 낮음
    })

    await page.goto('http://localhost:3000/auth/login')
    await page.fill('input[name="email"]', 'student6@test.com')
    await page.fill('input[name="password"]', 'test123')
    await page.click('button[type="submit"]')

    await page.waitForURL('**/student/**')

    await page.goto('http://localhost:3000/student/scan')
    await page.fill('input[name="qr-code"]', qrCode)
    await page.click('button:has-text("출석 체크")')

    // GPS 정확도가 낮아도 실제 거리 80m이므로 성공해야 함
    await expect(page.locator('text=출석이 완료되었습니다')).toBeVisible({ timeout: 10000 })

    console.log('✅ GPS 정확도 테스트 성공')
  })
})
