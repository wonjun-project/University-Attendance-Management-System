import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id

    if (!sessionId) {
      return NextResponse.json(
        { error: '세션 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // Create supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log('Fetching session from database:', sessionId)

    // 데이터베이스에서 세션 조회 (courses와 조인)
    const { data: session, error } = await supabase
      .from('class_sessions')
      .select(`
        id,
        course_id,
        date,
        qr_code,
        qr_code_expires_at,
        status,
        courses (
          id,
          name,
          course_code,
          classroom_location
        )
      `)
      .eq('id', sessionId)
      .single()

    if (error) {
      console.error('Database error:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: '세션을 찾을 수 없습니다.' },
          { status: 404 }
        )
      }
      throw error
    }

    if (!session) {
      return NextResponse.json(
        { error: '세션을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 세션 만료 확인
    if (new Date() > new Date(session.qr_code_expires_at)) {
      return NextResponse.json(
        { error: '만료된 세션입니다.' },
        { status: 410 }
      )
    }

    // 강의 정보 확인
    const course = Array.isArray(session.courses) ? session.courses[0] : session.courses
    if (!course) {
      return NextResponse.json(
        { error: '강의 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 응답 데이터 구성
    const responseData = {
      id: session.id,
      courseId: course.id,
      courseName: course.name,
      courseCode: course.course_code,
      location: {
        lat: course.classroom_location?.latitude || 0,
        lng: course.classroom_location?.longitude || 0,
        address: course.classroom_location?.displayName || '위치 정보 없음',
        radius: course.classroom_location?.radius || 100
      },
      expiresAt: session.qr_code_expires_at,
      isActive: session.status === 'active',
      date: session.date
    }

    console.log('Session found and returned:', responseData.id)

    return NextResponse.json({
      success: true,
      session: responseData
    })

  } catch (error) {
    console.error('Session retrieval error:', error)
    return NextResponse.json(
      { error: '세션 정보를 가져오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}