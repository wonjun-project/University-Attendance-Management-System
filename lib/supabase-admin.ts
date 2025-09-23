import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export function createServiceClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL 환경 변수가 설정되어 있지 않습니다.')
  }

  // service role 키가 있으면 RLS를 우회할 수 있도록 설정
  if (serviceRoleKey) {
    console.log(
      JSON.stringify({
        scope: 'supabase-admin',
        role: 'service_role',
        message: 'Using service role key for Supabase (RLS bypassed)'
      })
    )
    return createClient<Database>(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }

  // service role 키가 없으면 anon 키 사용 (RLS 적용됨)
  if (anonKey) {
    console.warn(
      JSON.stringify({
        scope: 'supabase-admin',
        role: 'anon',
        message: 'Using anon key for Supabase (RLS will be applied)'
      })
    )
    return createClient<Database>(url, anonKey)
  }

  throw new Error('SUPABASE_SERVICE_ROLE_KEY 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY 중 하나는 반드시 설정되어야 합니다.')
}
