import { getCurrentUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Haversine 공식을 이용한 두 지점 간 거리 계산 (미터 단위)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // 지구의 반지름 (미터)
  const φ1 = lat1 * Math.PI/180; // φ, λ를 라디안으로 변환
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // 거리 (미터)
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Create supabase client with service role key for admin operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // Check authentication using JWT
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is a student
    if (user.userType !== 'student') {
      return NextResponse.json({ error: 'Only students can check in' }, { status: 403 })
    }

    const body = await request.json()
    const { sessionId, latitude, longitude, accuracy = 0 } = body

    if (!sessionId || latitude === undefined || longitude === undefined) {
      return NextResponse.json({ 
        error: 'Session ID, latitude, and longitude are required' 
      }, { status: 400 })
    }

    // 새 스키마에서는 student_id를 직접 사용 (TEXT)
    const { data: studentRecord, error: studentError } = await supabase
      .from('students')
      .select('student_id')
      .eq('student_id', user.userId)
      .single()

    if (studentError || !studentRecord) {
      console.error('Student not found:', studentError)
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 })
    }

    // 세션 정보와 강의실 위치 정보를 함께 조회
    const { data: sessionData, error: sessionError } = await supabase
      .from('class_sessions')
      .select(`
        course_id, 
        status, 
        qr_code_expires_at,
        courses!course_id (classroom_location)
      `)
      .eq('id', sessionId)
      .single()

    if (sessionError || !sessionData) {
      console.error('Session not found:', sessionError)
      return NextResponse.json({ error: 'Session not found' }, { status: 500 })
    }

    console.log('=== 출석 체크인 시도 ===')
    console.log(`학생: ${user.name} (${user.userId})`)
    console.log(`위치: (${latitude}, ${longitude}) ±${accuracy}m`)

    if (sessionData.status !== 'active') {
      return NextResponse.json({ error: 'Session is not active' }, { status: 400 })
    }

    if (new Date(sessionData.qr_code_expires_at) < new Date()) {
      return NextResponse.json({ error: 'QR code has expired' }, { status: 400 })
    }

    // Check enrollment
    const { data: enrollmentCheck } = await supabase
      .from('course_enrollments')
      .select('id')
      .eq('course_id', sessionData.course_id)
      .eq('student_id', user.userId)
      .single()

    if (!enrollmentCheck) {
      return NextResponse.json({ error: 'Student not enrolled in this course' }, { status: 400 })
    }

    // 강의실 위치 정보 추출
    const course = Array.isArray(sessionData.courses) ? sessionData.courses[0] : sessionData.courses;
    const classroomLocation = course?.classroom_location as {
      latitude: number;
      longitude: number;
      radius: number;
    };

    if (!classroomLocation) {
      return NextResponse.json({ error: 'Classroom location not configured' }, { status: 500 })
    }

    console.log(`강의실: (${classroomLocation.latitude}, ${classroomLocation.longitude}) 반경 ${classroomLocation.radius}m`)

    // 학생 위치와 강의실 위치 간 거리 계산
    const distance = calculateDistance(
      latitude,
      longitude,
      classroomLocation.latitude,
      classroomLocation.longitude
    );

    // 허용 반경 내에 있는지 확인
    const isLocationValid = distance <= classroomLocation.radius;
    
    console.log(`거리: ${Math.round(distance)}m / 허용: ${classroomLocation.radius}m → ${isLocationValid ? '✅ 승인' : '❌ 거부'}`)
    
    if (!isLocationValid) {
      return NextResponse.json({ 
        error: `위치 검증 실패: 강의실에서 ${Math.round(distance)}m 떨어져 있습니다. (허용 반경: ${classroomLocation.radius}m)`,
        distance: Math.round(distance),
        allowedRadius: classroomLocation.radius
      }, { status: 400 })
    }

    // Insert or update attendance
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendances')
      .upsert({
        session_id: sessionId,
        student_id: user.userId,
        status: 'present',
        check_in_time: new Date().toISOString(),
        location_verified: isLocationValid
      }, {
        onConflict: 'session_id,student_id'
      })
      .select('id')
      .single()

    if (attendanceError) {
      console.error('Attendance error:', attendanceError)
      return NextResponse.json({ error: 'Failed to record attendance' }, { status: 500 })
    }

    // location_logs 테이블에 위치 검증 결과 기록
    const { error: locationLogError } = await supabase
      .from('location_logs')
      .insert({
        attendance_id: attendance.id,
        latitude: latitude,
        longitude: longitude,
        accuracy: accuracy,
        timestamp: new Date().toISOString(),
        is_valid: isLocationValid
      })

    if (locationLogError) {
      console.error('Location log error:', locationLogError)
      // 위치 로그 저장 실패는 출석에 영향을 주지 않음 (경고만)
    }

    return NextResponse.json({ 
      success: true,
      attendanceId: attendance.id,
      message: 'Successfully checked in',
      locationVerified: isLocationValid,
      distance: Math.round(distance)
    })
  } catch (error) {
    console.error('Check-in API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
