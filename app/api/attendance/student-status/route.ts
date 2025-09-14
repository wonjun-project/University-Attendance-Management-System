import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Create supabase client with service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // JWT 기반 인증 확인 (학생용)
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (user.userType !== 'student') {
      return NextResponse.json({ error: 'Only students can access this endpoint' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    // 해당 세션이 존재하는지 확인
    const { data: session, error: sessionError } = await supabase
      .from('class_sessions')
      .select('id, course_id, status, qr_code_expires_at')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // 학생이 해당 강의에 수강신청했는지 확인
    const { data: enrollment } = await supabase
      .from('course_enrollments')
      .select('id')
      .eq('course_id', session.course_id)
      .eq('student_id', user.userId)
      .single()

    if (!enrollment) {
      return NextResponse.json({ error: 'Student not enrolled in this course' }, { status: 403 })
    }

    // 학생의 출석 정보 조회
    const { data: attendance } = await supabase
      .from('attendances')
      .select(`
        id,
        status,
        check_in_time,
        check_out_time,
        location_verified,
        created_at,
        updated_at
      `)
      .eq('session_id', sessionId)
      .eq('student_id', user.userId)
      .single()

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        isActive: session.status === 'active',
        isExpired: new Date() > new Date(session.qr_code_expires_at)
      },
      attendance: attendance ? {
        id: attendance.id,
        status: attendance.status,
        checkInTime: attendance.check_in_time,
        checkOutTime: attendance.check_out_time,
        locationVerified: attendance.location_verified,
        lastUpdated: attendance.updated_at
      } : null
    })

  } catch (error) {
    console.error('Student attendance status API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}