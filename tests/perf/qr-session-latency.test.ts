import { test, expect, request } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

async function createContext() {
  return await request.newContext({ baseURL })
}

test.describe('QR 세션 성능 측정 (실제 구현 후 업데이트 필요)', () => {
  test.beforeEach(() => {
    test.fail(true, '성능 측정은 구현 완료 후 실제 서버에 대해 실행해야 합니다.')
  })

  test('세션 생성 round-trip 500ms 이하', async () => {
    const ctx = await createContext()
    const startedAt = Date.now()
    const response = await ctx.post('/api/sessions/create', {
      data: {
        courseId: '00000000-0000-0000-0000-000000000000',
        location: {
          latitude: 36.6372,
          longitude: 127.4896,
          radius: 40,
          address: '제1자연관 501호'
        }
      }
    })
    const elapsed = Date.now() - startedAt
    expect(elapsed).toBeLessThanOrEqual(500)
    expect(response.ok()).toBeTruthy()
  })

  test('학생 체크인 응답 1초 이하', async () => {
    const ctx = await createContext()
    const startedAt = Date.now()
    const response = await ctx.post('/api/attendance/checkin', {
      data: {
        sessionId: '00000000-0000-0000-0000-000000000000',
        latitude: 36.6372,
        longitude: 127.4896,
        accuracy: 5,
        clientTimestamp: new Date().toISOString()
      }
    })
    const elapsed = Date.now() - startedAt
    expect(elapsed).toBeLessThanOrEqual(1000)
    expect(response.ok()).toBeTruthy()
  })
})
