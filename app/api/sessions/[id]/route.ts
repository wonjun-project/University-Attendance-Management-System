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

    console.log('Fetching session from Supabase:', sessionId)

    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Supabase에서 세션 데이터 조회 (강의 정보 포함)
    const { data: session, error: sessionError } = await supabase
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
          course_code
        )
      `)
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('Session not found:', sessionError)
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

    const course = session.courses as any

    // 응답 데이터 구성 (기존 형식 호환)
    const responseData = {
      session: {
        id: session.id,
        courseId: session.course_id,
        course_id: session.course_id, // 레거시 호환성
        courseName: course?.name || '데모 강의',
        courseCode: course?.course_code || 'DEMO101',
        qr_code_expires_at: session.qr_code_expires_at, // 레거시 호환성
        expiresAt: session.qr_code_expires_at,
        status: session.status,
        date: session.date,
        location: {
          lat: 37.5665, // 기본값 - 실제로는 세션 생성 시 저장된 위치 사용
          lng: 126.9780,
          address: '강의실 위치',
          radius: 50
        },
        isActive: session.status === 'active'
      }
    }

    console.log('Session found and returned:', responseData.session.id)

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Session retrieval error:', error)
    return NextResponse.json(
      { error: '세션 정보를 가져오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
