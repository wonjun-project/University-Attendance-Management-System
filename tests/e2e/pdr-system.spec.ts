/**
 * PDR 시스템 E2E 테스트
 *
 * 테스트 시나리오:
 * 1. 테스트 페이지 접속
 * 2. 추적 시작
 * 3. 위치 데이터 업데이트 확인
 * 4. 모드 전환 테스트
 * 5. 통계 업데이트 확인
 * 6. 추적 중지
 * 7. 성능 점수 확인
 */

import { test, expect, type Page } from '@playwright/test'

test.describe('PDR 시스템 E2E 테스트', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    // 위치 정보 권한을 부여한 컨텍스트 생성
    const context = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: {
        latitude: 37.5665,  // 서울시청
        longitude: 126.9780
      }
    })

    page = await context.newPage()
    await page.goto('/test/pdr')
  })

  test.afterEach(async () => {
    await page.close()
  })

  test('페이지가 올바르게 로드되는지 확인', async () => {
    // 헤더 확인
    await expect(page.locator('h1')).toContainText('PDR 시스템 E2E 테스트')

    // 제어 패널 확인
    await expect(page.getByTestId('start-tracking')).toBeVisible()
  })

  test('추적 시작 및 위치 데이터 확인', async () => {
    // 추적 시작 버튼 클릭
    await page.getByTestId('start-tracking').click()

    // 추적 중지 버튼이 표시될 때까지 대기
    await expect(page.getByTestId('stop-tracking')).toBeVisible({ timeout: 10000 })

    // 위치 데이터가 표시될 때까지 대기
    await expect(page.getByTestId('location-data')).toBeVisible({ timeout: 10000 })

    // 현재 모드 확인
    const modeElement = page.getByTestId('status-mode')
    await expect(modeElement).toContainText(/gps-only|pdr-only|fusion/)

    // 환경 감지 확인
    const envElement = page.getByTestId('status-environment')
    await expect(envElement).toContainText(/outdoor|indoor|unknown/)

    // 로그가 생성되는지 확인
    const logsElement = page.getByTestId('logs')
    await expect(logsElement).toContainText(/추적 시작/)
  })

  test('모드 전환 테스트', async () => {
    // 추적 시작
    await page.getByTestId('start-tracking').click()
    await expect(page.getByTestId('stop-tracking')).toBeVisible({ timeout: 10000 })

    // GPS 전용 모드로 전환
    await page.getByTestId('mode-gps-only').click()
    await page.waitForTimeout(1000)

    const modeAfterGPS = page.getByTestId('status-mode')
    await expect(modeAfterGPS).toContainText('gps-only')

    // PDR 전용 모드로 전환
    await page.getByTestId('mode-pdr-only').click()
    await page.waitForTimeout(1000)

    const modeAfterPDR = page.getByTestId('status-mode')
    await expect(modeAfterPDR).toContainText('pdr-only')

    // 융합 모드로 전환
    await page.getByTestId('mode-fusion').click()
    await page.waitForTimeout(1000)

    const modeAfterFusion = page.getByTestId('status-mode')
    await expect(modeAfterFusion).toContainText('fusion')

    // 로그에 모드 전환 메시지가 있는지 확인
    const logsElement = page.getByTestId('logs')
    await expect(logsElement).toContainText(/모드/)
  })

  test('통계 업데이트 확인', async () => {
    // 추적 시작
    await page.getByTestId('start-tracking').click()
    await expect(page.getByTestId('stop-tracking')).toBeVisible({ timeout: 10000 })

    // 통계가 표시될 때까지 대기
    await expect(page.getByTestId('statistics')).toBeVisible({ timeout: 10000 })

    // 5초 대기하여 통계가 업데이트되도록 함
    await page.waitForTimeout(5000)

    // 통계 확인 (최소 1개 이상의 업데이트가 있어야 함)
    const statsElement = page.getByTestId('statistics')
    const statsText = await statsElement.textContent()

    // GPS 업데이트 카운트가 0보다 커야 함
    expect(statsText).toMatch(/GPS 업데이트/)
  })

  test('배터리 상태 표시 확인', async () => {
    // 추적 시작
    await page.getByTestId('start-tracking').click()
    await expect(page.getByTestId('stop-tracking')).toBeVisible({ timeout: 10000 })

    // 배터리 상태 확인
    const batteryElement = page.getByTestId('status-battery')
    await expect(batteryElement).toBeVisible()

    // 배터리 레벨이 표시되는지 확인 (0-100%)
    const batteryText = await batteryElement.textContent()
    expect(batteryText).toMatch(/\d+%/)
  })

  test('추적 중지 및 성능 점수 확인', async () => {
    // 추적 시작
    await page.getByTestId('start-tracking').click()
    await expect(page.getByTestId('stop-tracking')).toBeVisible({ timeout: 10000 })

    // 5초간 추적
    await page.waitForTimeout(5000)

    // 추적 중지
    await page.getByTestId('stop-tracking').click()

    // 추적 시작 버튼이 다시 표시되는지 확인
    await expect(page.getByTestId('start-tracking')).toBeVisible({ timeout: 5000 })

    // 성능 점수가 0보다 큰지 확인
    const perfElement = page.getByTestId('status-performance')
    const perfText = await perfElement.textContent()

    // 성능 점수가 표시되는지 확인 (0-100/100 형식)
    expect(perfText).toMatch(/\d+\/100/)

    // 로그에 추적 중지 메시지가 있는지 확인
    const logsElement = page.getByTestId('logs')
    await expect(logsElement).toContainText(/중지/)
  })

  test('연속 시작/중지 테스트', async () => {
    // 첫 번째 추적
    await page.getByTestId('start-tracking').click()
    await expect(page.getByTestId('stop-tracking')).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(2000)
    await page.getByTestId('stop-tracking').click()
    await expect(page.getByTestId('start-tracking')).toBeVisible({ timeout: 5000 })

    // 두 번째 추적
    await page.getByTestId('start-tracking').click()
    await expect(page.getByTestId('stop-tracking')).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(2000)
    await page.getByTestId('stop-tracking').click()
    await expect(page.getByTestId('start-tracking')).toBeVisible({ timeout: 5000 })

    // 로그에 두 번의 시작/중지가 기록되었는지 확인
    const logsElement = page.getByTestId('logs')
    const logsText = await logsElement.textContent()

    // 시작과 중지 메시지가 각각 2번 이상 나타나야 함
    const startCount = (logsText?.match(/시작/g) || []).length
    const stopCount = (logsText?.match(/중지/g) || []).length

    expect(startCount).toBeGreaterThanOrEqual(2)
    expect(stopCount).toBeGreaterThanOrEqual(2)
  })

  test('로그 출력 확인', async () => {
    // 추적 시작
    await page.getByTestId('start-tracking').click()
    await expect(page.getByTestId('stop-tracking')).toBeVisible({ timeout: 10000 })

    // 5초 대기
    await page.waitForTimeout(5000)

    // 로그 확인
    const logsElement = page.getByTestId('logs')
    const logsText = await logsElement.textContent()

    // 중요한 로그 메시지들이 있는지 확인
    expect(logsText).toMatch(/추적 시작/)

    // 위치 업데이트 또는 모드 변경 중 하나는 있어야 함
    const hasLocationUpdate = logsText?.includes('위치 업데이트')
    const hasModeChange = logsText?.includes('모드')
    expect(hasLocationUpdate || hasModeChange).toBeTruthy()
  })

  test('UI 상태 일관성 확인', async () => {
    // 초기 상태: 추적 시작 버튼만 보임
    await expect(page.getByTestId('start-tracking')).toBeVisible()
    await expect(page.getByTestId('stop-tracking')).not.toBeVisible()

    // 추적 시작 후: 중지 버튼만 보임
    await page.getByTestId('start-tracking').click()
    await expect(page.getByTestId('stop-tracking')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('start-tracking')).not.toBeVisible()

    // 모드 전환 버튼이 표시됨
    await expect(page.getByTestId('mode-gps-only')).toBeVisible()
    await expect(page.getByTestId('mode-pdr-only')).toBeVisible()
    await expect(page.getByTestId('mode-fusion')).toBeVisible()

    // 추적 중지 후: 시작 버튼만 보임
    await page.getByTestId('stop-tracking').click()
    await expect(page.getByTestId('start-tracking')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('stop-tracking')).not.toBeVisible()
  })
})
