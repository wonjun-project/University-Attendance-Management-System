import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // 보안을 위해 개발 환경에서만 실행
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({
      error: 'Debug endpoint disabled in production'
    }, { status: 403 })
  }

  const envCheck = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ 설정됨' : '❌ 없음',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ 설정됨' : '❌ 없음',
    JWT_SECRET: process.env.JWT_SECRET ? '✅ 설정됨' : '❌ 없음',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ 설정됨' : '❌ 없음',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    timestamp: new Date().toISOString()
  }

  return NextResponse.json(envCheck)
}