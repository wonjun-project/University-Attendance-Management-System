import { test, expect, request } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

async function createRequestContext() {
  return await request.newContext({ baseURL })
}

test.describe('POST /api/sessions/create', () => {
  test.beforeEach(() => {
    test.fail(true, '세션 생성 API가 Supabase로 완전 전환되기 전이므로 실패가 예상됩니다.')
  })

  test('정상 생성 시 200과 UUID, 10분 만료 값을 반환한다', async () => {
    const ctx = await createRequestContext()
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
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.success).toBeTruthy()
    expect(body.session.id).toMatch(/[0-9a-fA-F-]{36}/)
    expect(new Date(body.session.expiresAt).getTime() - Date.now()).toBeGreaterThan(9 * 60 * 1000)
  })

  test('강의 ID가 없으면 400을 반환한다', async () => {
    const ctx = await createRequestContext()
    const response = await ctx.post('/api/sessions/create', {
      data: {
        location: {
          latitude: 36.6372,
          longitude: 127.4896,
          radius: 40
        }
      }
    })
    expect(response.status()).toBe(400)
  })
})
