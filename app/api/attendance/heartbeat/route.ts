import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { autoEndSessionIfNeeded } from '@/lib/session/session-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface HeartbeatRequest {
  attendanceId: string;
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  isBackground: boolean;
  source: 'foreground' | 'background' | 'page-hidden';
}

export async function POST(request: NextRequest) {
  try {
    console.log('💓 Heartbeat API 호출됨');

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

    // 학생만 heartbeat 전송 가능
    if (user.userType !== 'student') {
      return NextResponse.json({ error: 'Only students can send heartbeat' }, { status: 403 });
    }

    const body: HeartbeatRequest = await request.json();
    const {
      attendanceId,
      sessionId,
      latitude,
      longitude,
      accuracy = 0,
      timestamp,
      isBackground,
      source
    } = body;

    // 필수 파라미터 검증
    if (!attendanceId || !sessionId || latitude === undefined || longitude === undefined) {
      return NextResponse.json({
        error: 'Attendance ID, session ID, latitude, and longitude are required'
      }, { status: 400 });
    }

    console.log(`💓 Heartbeat [${source}]: ${user.name} (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`);

    // 1. 출석 기록 검증 및 세션 정보 확인
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendances')
      .select(`
        student_id,
        status,
        session_id,
        class_sessions!session_id (
          id,
          created_at,
          updated_at,
          status,
          course_id,
          courses!course_id (
            classroom_location
          )
        )
      `)
      .eq('id', attendanceId)
      .eq('student_id', user.userId)
      .eq('session_id', sessionId)
      .single();

    if (attendanceError || !attendanceData) {
      console.error('출석 기록 조회 실패:', attendanceError);
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
    }

    // 2. 세션 상태 확인
    const session = Array.isArray(attendanceData.class_sessions)
      ? attendanceData.class_sessions[0]
      : attendanceData.class_sessions;

    const autoEndResult = session
      ? await autoEndSessionIfNeeded(supabase, {
          id: session.id,
          status: session.status,
          created_at: session.created_at ?? null,
          updated_at: session.updated_at ?? null,
          course_id: session.course_id
        })
      : { session, autoEnded: false, autoEndAt: null }

    if (!session || autoEndResult.session.status === 'ended') {
      console.log('🏁 수업이 종료되어 heartbeat 중지');
      return NextResponse.json({
        success: true,
        sessionEnded: true,
        autoEnded: autoEndResult.autoEnded,
        message: '수업이 종료되었습니다.'
      });
    }

    const normalizedSession = {
      ...session,
      status: autoEndResult.session.status,
      updated_at: autoEndResult.session.updated_at
    }

    // 3. 출석 상태 확인 (present가 아니면 heartbeat 중지)
    if (attendanceData.status !== 'present') {
      return NextResponse.json({
        success: false,
        error: `출석 상태가 '${attendanceData.status}'이므로 위치 추적이 중지됩니다.`
      }, { status: 400 });
    }

    // 4. 강의실 위치 정보 추출
    const course = Array.isArray(normalizedSession.courses) ? normalizedSession.courses[0] : normalizedSession.courses;
    const classroomLocation = course?.classroom_location as {
      latitude: number;
      longitude: number;
      radius: number;
    };

    if (!classroomLocation) {
      return NextResponse.json({ error: 'Classroom location not configured' }, { status: 500 });
    }

    // 5. 거리 계산 (Haversine 공식)
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371000; // 지구 반지름 (미터)
      const φ1 = lat1 * Math.PI/180;
      const φ2 = lat2 * Math.PI/180;
      const Δφ = (lat2-lat1) * Math.PI/180;
      const Δλ = (lon2-lon1) * Math.PI/180;

      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

      return R * c;
    };

    const distance = calculateDistance(
      latitude,
      longitude,
      classroomLocation.latitude,
      classroomLocation.longitude
    );

    const locationValid = distance <= classroomLocation.radius;

    // 6. 위치 로그 기록
    const { error: locationLogError } = await supabase
      .from('location_logs')
      .insert({
        attendance_id: attendanceId,
        latitude: latitude,
        longitude: longitude,
        accuracy: accuracy,
        timestamp: new Date(timestamp).toISOString(),
        is_valid: locationValid
      });

    if (locationLogError) {
      console.error('위치 로그 기록 실패:', locationLogError);
      // 로그 실패는 치명적이지 않으므로 계속 진행
    }

    // 7. attendances 테이블의 last_heartbeat 업데이트
    const { error: heartbeatUpdateError } = await supabase
      .from('attendances')
      .update({
        updated_at: new Date().toISOString(),
        // last_heartbeat 컬럼이 있다면 업데이트
        // last_heartbeat: new Date().toISOString()
      })
      .eq('id', attendanceId);

    if (heartbeatUpdateError) {
      console.error('Heartbeat 업데이트 실패:', heartbeatUpdateError);
    }

    // 8. 위치 이탈 시 처리
    if (!locationValid) {
      console.warn(`⚠️ 위치 이탈 감지: ${user.name} - ${Math.round(distance)}m (허용: ${classroomLocation.radius}m)`);

      // 즉시 조퇴 처리하지 않고 경고만 전송
      // 추후 5분간 지속 이탈 시 조퇴 처리하는 로직은 별도 구현
    }

    // 9. 성공 응답
    const responseMessage = locationValid
      ? `위치 추적 성공 - 강의실 범위 내 (거리: ${Math.round(distance)}m)`
      : `⚠️ 강의실 범위 이탈 - 거리: ${Math.round(distance)}m (허용: ${classroomLocation.radius}m)`;

    console.log(`✅ Heartbeat 처리 완료: ${responseMessage}`);

    return NextResponse.json({
      success: true,
      locationValid: locationValid,
      distance: Math.round(distance),
      allowedRadius: classroomLocation.radius,
      sessionEnded: false,
      message: responseMessage,
      metadata: {
        source,
        isBackground,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Heartbeat API 오류:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
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
