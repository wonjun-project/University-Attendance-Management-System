#!/usr/bin/env node
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되어 있지 않습니다.')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function purge() {
  console.log('🧹 attendance_attempts 정리 함수를 호출합니다 (보존 기간 24시간)...')
  const { data, error } = await supabase.rpc('purge_old_attendance_attempts', { max_age: '24 hours' })

  if (error) {
    console.error('❌ 정리 작업 실패:', error)
    process.exit(1)
  }

  console.log(`✅ 정리 완료: ${data ?? 0}건 삭제됨`)
}

purge()
