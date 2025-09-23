import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { autoEndSessionIfNeeded, calculateAutoEndAt } from './session-service'
import type { SupabaseClient } from '@supabase/supabase-js'

const mockSupabase = {
  from() {
    throw new Error('Supabase mock not implemented yet')
  }
} as unknown as SupabaseClient

test('calculateAutoEndAt returns overdue for past sessions', () => {
  const { autoEndAt, isOverdue } = calculateAutoEndAt(new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
  assert.ok(autoEndAt)
  assert.strictEqual(isOverdue, true)
})

test('autoEndSessionIfNeeded marks overdue sessions as ended', async () => {
  await test.todo('Supabase mock을 구현하고 autoEndSessionIfNeeded가 끝난 세션을 종료하는지 검증한다')

  await autoEndSessionIfNeeded(mockSupabase, {
    id: '00000000-0000-0000-0000-000000000000',
    status: 'active',
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    course_id: '00000000-0000-0000-0000-000000000001'
  })
})
