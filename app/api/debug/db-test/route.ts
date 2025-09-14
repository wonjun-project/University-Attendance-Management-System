import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
import { createClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    // 기본 연결 테스트
    const { data: testConnection, error: connectionError } = await supabase
      .from('students')
      .select('count', { count: 'exact', head: true })

    if (connectionError) {
      return NextResponse.json({
        status: 'error',
        message: 'Database connection failed',
        error: connectionError.message,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

    // 테스트 계정 존재 확인
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select('student_id, name')
      .eq('student_id', 'stu001')

    const { data: professors, error: professorError } = await supabase
      .from('professors')
      .select('professor_id, name')
      .eq('professor_id', 'prof001')

    return NextResponse.json({
      status: 'success',
      connection: 'ok',
      testAccounts: {
        student: students && students.length > 0 ?
          { exists: true, data: students[0] } :
          { exists: false, error: studentError?.message },
        professor: professors && professors.length > 0 ?
          { exists: true, data: professors[0] } :
          { exists: false, error: professorError?.message }
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasJwtSecret: !!process.env.JWT_SECRET
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('DB Test Error:', error)
    return NextResponse.json({
      status: 'error',
      message: 'Database test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
