import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { autoEndSessionIfNeeded } from '@/lib/session/session-service'
import { calculateDistance } from '@/lib/utils/geo'
import type { SupabaseSessionRow, SupabaseCourseRow } from '@/lib/session/types'

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
  // PDR 융합 메타데이터 (선택적)
  trackingMode?: 'gps-only' | 'pdr-only' | 'fusion';
  environment?: 'outdoor' | 'indoor' | 'unknown';
  confidence?: number;
  gpsWeight?: number;
  pdrWeight?: number;
}

interface ResolvedLocation {
  latitude: number
  longitude: number
  radius: number
  displayName?: string
}

// Heartbeat API에서 사용할 최소 필드만 요구하는 타입
type SessionLocationData = Pick<SupabaseSessionRow, 'classroom_latitude' | 'classroom_longitude' | 'classroom_radius'>;
type CourseLocationData = Pick<SupabaseCourseRow, 'location_latitude' | 'location_longitude' | 'location_radius' | 'location'>;

function resolveClassroomLocation(
  session: SessionLocationData,
  course: CourseLocationData | CourseLocationData[] | null
): ResolvedLocation | null {
  // 1순위: 세션별 강의실 위치 (QR 생성 시 설정)
  if (session.classroom_latitude !== null && session.classroom_longitude !== null) {
    return {
      latitude: Number(session.classroom_latitude),
      longitude: Number(session.classroom_longitude),
      radius: session.classroom_radius ?? 100,
      displayName: undefined
    }
  }

  // 2순위: 강의 고정 위치
  const courseRecord = Array.isArray(course) ? course[0] ?? null : course
  if (!courseRecord) {
    return null
  }

  if (courseRecord.location_latitude !== null && courseRecord.location_longitude !== null) {
    return {
      latitude: Number(courseRecord.location_latitude),
      longitude: Number(courseRecord.location_longitude),
      radius: courseRecord.location_radius ?? 100,
      displayName: courseRecord.location ?? undefined
    }
  }

  return null
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
      source,
      // PDR 융합 메타데이터
      trackingMode,
      environment,
      confidence,
      gpsWeight,
      pdrWeight
    } = body;

    // 필수 파라미터 검증
    if (!attendanceId || !sessionId || latitude === undefined || longitude === undefined) {
      return NextResponse.json({
        error: 'Attendance ID, session ID, latitude, and longitude are required'
      }, { status: 400 });
    }

    // PDR 메타데이터 로깅
    const pdrInfo = trackingMode
      ? ` [${trackingMode}${environment ? `, ${environment}` : ''}${confidence !== undefined ? `, conf: ${confidence.toFixed(2)}` : ''}]`
      : '';
    console.log(`💓 Heartbeat [${source}]: ${user.name} (${latitude.toFixed(6)}, ${longitude.toFixed(6)})${pdrInfo}`);

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
          classroom_latitude,
          classroom_longitude,
          classroom_radius,
          courses!course_id (
            location_latitude,
            location_longitude,
            location_radius,
            location
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
      console.log(`🛑 Heartbeat 중지: 출석 상태가 '${attendanceData.status}'`);
      return NextResponse.json({
        success: true,
        locationValid: false,
        sessionEnded: true,
        message: `출석 상태가 '${attendanceData.status}'이므로 위치 추적이 중지됩니다.`
      }, { status: 200 });
    }

    // 4. 강의실 위치 정보 추출
    const course = Array.isArray(normalizedSession.courses) ? normalizedSession.courses[0] : normalizedSession.courses;
    const resolvedLocation = resolveClassroomLocation(normalizedSession, course);

    if (!resolvedLocation) {
      console.error('❌ 강의실 위치 정보가 설정되지 않음');
      return NextResponse.json({ error: 'Classroom location not configured' }, { status: 500 });
    }

    // 위치 정보 검증
    if (!Number.isFinite(resolvedLocation.latitude) ||
        !Number.isFinite(resolvedLocation.longitude) ||
        !Number.isFinite(resolvedLocation.radius)) {
      console.error('❌ 강의실 위치 정보가 올바르지 않음:', resolvedLocation);
      return NextResponse.json({ error: 'Invalid classroom location data' }, { status: 500 });
    }

    console.log('📍 강의실 위치 정보:', {
      latitude: resolvedLocation.latitude,
      longitude: resolvedLocation.longitude,
      radius: resolvedLocation.radius
    });
    console.log('📍 학생 위치:', { latitude, longitude, accuracy });

    // 5. 거리 계산 (Haversine 공식)
    const distance = calculateDistance(
      latitude,
      longitude,
      resolvedLocation.latitude,
      resolvedLocation.longitude
    );

    console.log('📏 계산된 거리:', distance, 'm');

    // 거리 검증
    if (!Number.isFinite(distance)) {
      console.error('❌ 거리 계산 실패 (NaN):', { latitude, longitude, resolvedLocation });
      return NextResponse.json({
        error: 'Failed to calculate distance',
        details: 'Invalid coordinates'
      }, { status: 500 });
    }

    const locationValid = distance <= resolvedLocation.radius;

    // 5.5. GPS 정확도 체크 (location_logs 기록 전에 먼저 검증)
    // GPS 정확도가 너무 낮으면 위치 검증 건너뜀 (실내 GPS 불안정 대응)
    if (accuracy > 100) {
      console.warn(`⚠️ GPS 정확도가 낮아 위치 검증 건너뜀 (정확도: ${Math.round(accuracy)}m)`);
      console.warn(`💡 실내 환경에서 GPS 정확도가 낮을 수 있습니다`);

      // 정확도가 낮은 GPS 데이터는 location_logs에 기록하지 않음
      return NextResponse.json({
        success: true,
        locationValid: false,
        lowAccuracy: true,
        distance: Math.round(distance),
        accuracy: Math.round(accuracy),
        allowedRadius: resolvedLocation.radius,
        sessionEnded: false,
        message: `GPS 정확도가 낮아 위치 검증을 건너뜁니다 (정확도: ${Math.round(accuracy)}m)`,
        metadata: {
          source,
          isBackground,
          timestamp: new Date().toISOString(),
          ...(trackingMode && { trackingMode }),
          ...(environment && { environment }),
          ...(confidence !== undefined && { confidence })
        }
      });
    }

    // 6. 위치 로그 기록 (PDR 메타데이터 포함) - GPS 정확도가 좋은 경우만
    const { error: locationLogError } = await supabase
      .from('location_logs')
      .insert({
        attendance_id: attendanceId,
        latitude: latitude,
        longitude: longitude,
        accuracy: accuracy,
        timestamp: new Date(timestamp).toISOString(),
        is_valid: locationValid,
        // PDR 융합 메타데이터 (선택적)
        tracking_mode: trackingMode,
        environment: environment,
        confidence: confidence,
        gps_weight: gpsWeight,
        pdr_weight: pdrWeight
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
      console.warn(`⚠️ 위치 이탈 감지: ${user.name} - ${Math.round(distance)}m (허용: ${resolvedLocation.radius}m)`);

      // 최근 location_logs 조회하여 연속 이탈 확인 (현재 기록 포함하여 4개 조회)
      // 참고: GPS 정확도가 낮은 경우는 이미 위에서 early return 되어 여기까지 오지 않음
      const { data: recentLogs, error: logsError } = await supabase
        .from('location_logs')
        .select('is_valid, accuracy')
        .eq('attendance_id', attendanceId)
        .order('created_at', { ascending: false })
        .limit(4);

      if (logsError) {
        console.error('최근 위치 로그 조회 실패:', logsError);
      }

      // 연속 3회 이상 이탈 감지 시 조퇴 처리 (2회 → 3회로 강화)
      // 단, 정확도가 좋은 GPS 데이터만 카운트
      const validLogs = recentLogs?.filter(log => (log.accuracy || 0) <= 100) || [];
      const shouldMarkEarlyLeave = validLogs.length >= 3 && validLogs.every(log => !log.is_valid);

      if (shouldMarkEarlyLeave) {
        console.warn(`🚪 조퇴 처리 시작: ${user.name} - 연속 ${validLogs.length}회 범위 이탈 감지`);

        // attendances 테이블 업데이트: 조퇴 처리
        const { error: updateError } = await supabase
          .from('attendances')
          .update({
            status: 'left_early',
            check_out_time: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', attendanceId);

        if (updateError) {
          console.error('조퇴 처리 실패:', updateError);
          return NextResponse.json({
            success: false,
            error: '조퇴 처리 중 오류가 발생했습니다.'
          }, { status: 500 });
        }

        console.log(`✅ 조퇴 처리 완료: ${user.name} - 거리: ${Math.round(distance)}m`);

        return NextResponse.json({
          success: true,
          locationValid: false,
          statusChanged: true,
          newStatus: 'left_early',
          distance: Math.round(distance),
          allowedRadius: resolvedLocation.radius,
          sessionEnded: false,
          message: `강의실 범위를 ${Math.round(distance)}m 벗어나 조퇴 처리되었습니다.`,
          metadata: {
            source,
            isBackground,
            timestamp: new Date().toISOString(),
            consecutiveViolations: validLogs.length,
            // PDR 융합 메타데이터 (있는 경우)
            ...(trackingMode && { trackingMode }),
            ...(environment && { environment }),
            ...(confidence !== undefined && { confidence }),
            ...(gpsWeight !== undefined && { gpsWeight }),
            ...(pdrWeight !== undefined && { pdrWeight })
          }
        });
      }

      // 조퇴 처리 조건 미달 - 경고만 전송
      const validLogCount = validLogs.length;
      console.warn(`⚠️ 위치 이탈 경고: ${user.name} - 유효 로그 ${validLogCount}회 (조퇴 처리: 3회 필요)`);
    }

    // 9. 성공 응답
    const responseMessage = locationValid
      ? `위치 추적 성공 - 강의실 범위 내 (거리: ${Math.round(distance)}m)`
      : `⚠️ 강의실 범위 이탈 - 거리: ${Math.round(distance)}m (허용: ${resolvedLocation.radius}m)`;

    console.log(`✅ Heartbeat 처리 완료: ${responseMessage}`);

    return NextResponse.json({
      success: true,
      locationValid: locationValid,
      distance: Math.round(distance),
      allowedRadius: resolvedLocation.radius,
      sessionEnded: false,
      message: responseMessage,
      metadata: {
        source,
        isBackground,
        timestamp: new Date().toISOString(),
        // PDR 융합 메타데이터 (있는 경우)
        ...(trackingMode && { trackingMode }),
        ...(environment && { environment }),
        ...(confidence !== undefined && { confidence }),
        ...(gpsWeight !== undefined && { gpsWeight }),
        ...(pdrWeight !== undefined && { pdrWeight })
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
