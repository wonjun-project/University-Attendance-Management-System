import { test, expect, request } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

async function createRequestContext() {
  return await request.newContext({ baseURL })
}

test.describe('POST /api/attendance/checkin', () => {
  test.beforeEach(() => {
    test.fail(true, '체크인 API 신규 스펙 구현 전이라 실패가 예상됩니다.')
  })

  test('유효한 세션과 위치/시간이면 200 반환', async () => {
    const ctx = await createRequestContext()
    const response = await ctx.post('/api/attendance/checkin', {
      data: {
        sessionId: '00000000-0000-0000-0000-000000000000',
        latitude: 36.6372,
        longitude: 127.4896,
        accuracy: 5,
        clientTimestamp: new Date().toISOString()
      }
    })
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.success).toBeTruthy()
    expect(body.sessionId).toBeDefined()
  })

  test('시계 오차가 1분 초과하면 400(clock_skew)', async () => {
    const ctx = await createRequestContext()
    const response = await ctx.post('/api/attendance/checkin', {
      data: {
        sessionId: '00000000-0000-0000-0000-000000000000',
        latitude: 36.6372,
        longitude: 127.4896,
        accuracy: 5,
        clientTimestamp: new Date(Date.now() + 120_000).toISOString()
      }
    })
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.code).toBe('clock_skew')
  })

  test('존재하지 않는 세션이면 404(session_not_found)', async () => {
    const ctx = await createRequestContext()
    const response = await ctx.post('/api/attendance/checkin', {
      data: {
        sessionId: '11111111-1111-1111-1111-111111111111',
        latitude: 36.6372,
        longitude: 127.4896,
        accuracy: 5,
        clientTimestamp: new Date().toISOString()
      }
    })
    expect(response.status()).toBe(404)
    const body = await response.json()
    expect(body.code).toBe('session_not_found')
  })

  test('중복 요청이면 409(already_present)', async () => {
    const ctx = await createRequestContext()
    const response = await ctx.post('/api/attendance/checkin', {
      data: {
        sessionId: '22222222-2222-2222-2222-222222222222',
        latitude: 36.6372,
        longitude: 127.4896,
        accuracy: 5,
        clientTimestamp: new Date().toISOString()
      }
    })
    expect(response.status()).toBe(409)
    const body = await response.json()
    expect(body.code).toBe('already_present')
  })
})
