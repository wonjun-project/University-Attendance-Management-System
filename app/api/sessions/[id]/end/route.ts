import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { finalizeAttendanceRecords, markSessionEnded } from '@/lib/session/session-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    console.log('🏁 수업 종료 API 호출됨:', params.id);

    // Supabase 클라이언트 생성 (서비스 역할 키 사용)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 사용자 인증 확인
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 교수만 세션 종료 가능
    if (user.userType !== 'professor') {
      return NextResponse.json({ error: 'Only professors can end sessions' }, { status: 403 });
    }

    const sessionId = params.id;

    if (!sessionId) {
      return NextResponse.json(
        { error: '세션 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 1. 세션 정보 조회 및 권한 확인
    const { data: session, error: sessionError } = await supabase
      .from('class_sessions')
      .select(`
        id,
        status,
        course_id,
        courses!course_id (
          professor_id,
          name
        )
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('세션 조회 실패:', sessionError);
      return NextResponse.json(
        { error: '세션을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 2. 교수 권한 확인
    const course = Array.isArray(session.courses) ? session.courses[0] : session.courses;
    if (course?.professor_id !== user.userId) {
      return NextResponse.json(
        { error: '이 세션을 종료할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 3. 이미 종료된 세션인지 확인
    if (session.status === 'ended') {
      return NextResponse.json({
        success: true,
        message: '이미 종료된 세션입니다.',
        alreadyEnded: true
      });
    }

    console.log(`🏁 세션 종료 시작: ${course.name} (${sessionId})`);

    // 4. 세션 상태를 'ended'로 변경하고 출석 데이터 정리
    const { endedAt } = await markSessionEnded(supabase, sessionId)
    const { stats } = await finalizeAttendanceRecords(supabase, sessionId)

    console.log('📊 수업 종료 통계:', stats)

    console.log(`🏁 세션 종료 완료: ${course.name} (${sessionId})`);

    // 8. 성공 응답
    return NextResponse.json({
      success: true,
      message: '수업이 성공적으로 종료되었습니다.',
      sessionId: sessionId,
      courseName: course.name,
      endedAt,
      statistics: {
        ...stats,
        attendance_rate: `${stats.attendance_rate}%`
      },
      metadata: {
        totalStudents: stats.total,
        presentStudents: stats.present + stats.late,
        heartbeatsWillStop: true
      }
    });

  } catch (error) {
    console.error('❌ 세션 종료 API 오류:', error);
    return NextResponse.json(
      {
        error: '세션 종료 중 내부 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// OPTIONS 메소드 (CORS 지원)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
