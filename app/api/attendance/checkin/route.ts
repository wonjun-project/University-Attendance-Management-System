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

    // 위치 값이 유효한 숫자인지 검증
    const lat = Number(latitude)
    const lon = Number(longitude)
    const acc = Number(accuracy) || 0

    if (isNaN(lat) || isNaN(lon)) {
      return NextResponse.json({
        error: '유효하지 않은 위치 정보입니다. 위도와 경도는 숫자여야 합니다.'
      }, { status: 400 })
    }

    // 위치 값이 유효한 범위인지 검증
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return NextResponse.json({
        error: '유효하지 않은 위치 범위입니다. 위도는 -90~90, 경도는 -180~180 사이여야 합니다.'
      }, { status: 400 })
    }

    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 세션 정보 조회 (강의 정보와 위치 포함)
    const { data: session, error: sessionError } = await supabase
      .from('class_sessions')
      .select(`
        id,
        course_id,
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
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    console.log('=== 출석 체크인 시도 ===')
    console.log(`학생: ${user.name} (${user.userId})`)
    console.log(`위치: (${lat}, ${lon}) ±${acc}m`)

    if (session.status !== 'active') {
      return NextResponse.json({ error: 'Session is not active' }, { status: 400 })
    }

    // 만료 시간 확인
    const expiresAt = new Date(session.qr_code_expires_at)
    const currentTime = new Date()
    console.log('QR 만료 시간 체크:')
    console.log('  - 만료 시간:', expiresAt.toISOString())
    console.log('  - 현재 시간:', currentTime.toISOString())
    console.log('  - 만료됨?:', expiresAt < currentTime)

    if (expiresAt < currentTime) {
      return NextResponse.json({
        error: 'QR code has expired',
        debug: {
          expiresAt: session.qr_code_expires_at,
          currentTime: currentTime.toISOString(),
          expired: true
        }
      }, { status: 400 })
    }

    // 수강신청 확인 (자동 등록)
    const { data: enrollment } = await supabase
      .from('course_enrollments')
      .select('id')
      .eq('course_id', session.course_id)
      .eq('student_id', user.userId)
      .single()

    if (!enrollment) {
      // 자동 등록 (MVP용)
      console.log(`자동 등록 진행: ${user.userId} -> ${session.course_id}`)
      const { error: enrollError } = await supabase
        .from('course_enrollments')
        .insert({
          course_id: session.course_id,
          student_id: user.userId,
          enrolled_at: new Date().toISOString()
        })

      if (enrollError) {
        console.error('Auto-enrollment failed:', enrollError)
        return NextResponse.json({ error: 'Failed to enroll in course' }, { status: 500 })
      }
    }

    // 강의실 위치 정보 (임시로 하드코딩, 실제로는 세션에 저장된 위치 사용)
    const classroomLocation = {
      latitude: 37.5665,
      longitude: 126.9780,
      radius: 50
    }

    console.log(`강의실: (${classroomLocation.latitude}, ${classroomLocation.longitude}) 반경 ${classroomLocation.radius}m`)

    // 학생 위치와 강의실 위치 간 거리 계산
    const distance = calculateDistance(
      lat,
      lon,
      classroomLocation.latitude,
      classroomLocation.longitude
    )

    // 거리 계산 결과가 유효한지 확인
    if (isNaN(distance)) {
      console.error('거리 계산 실패:', { lat, lon, classroomLocation })
      return NextResponse.json({
        error: '위치 검증 중 오류가 발생했습니다. 위치 정보를 확인해주세요.'
      }, { status: 400 })
    }

    // 허용 반경 내에 있는지 확인
    const isLocationValid = distance <= classroomLocation.radius

    console.log(`거리: ${Math.round(distance)}m / 허용: ${classroomLocation.radius}m → ${isLocationValid ? '✅ 승인' : '❌ 거부'}`)

    if (!isLocationValid) {
      return NextResponse.json({
        error: `위치 검증 실패: 강의실에서 ${Math.round(distance)}m 떨어져 있습니다. (허용 반경: ${classroomLocation.radius}m)`,
        distance: Math.round(distance),
        allowedRadius: classroomLocation.radius
      }, { status: 400 })
    }

    // 기존 출석 기록 확인
    const { data: existingAttendance } = await supabase
      .from('attendances')
      .select('id, status')
      .eq('session_id', sessionId)
      .eq('student_id', user.userId)
      .single()

    if (existingAttendance) {
      // 기존 기록 업데이트
      const { error: updateError } = await supabase
        .from('attendances')
        .update({
          status: 'present',
          check_in_time: new Date().toISOString(),
          location_verified: isLocationValid,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAttendance.id)

      if (updateError) {
        console.error('Attendance update failed:', updateError)
        return NextResponse.json({ error: 'Failed to update attendance' }, { status: 500 })
      }

      console.log(`✅ 출석 체크 업데이트: ${user.name} (${user.userId})`)

      return NextResponse.json({
        success: true,
        attendanceId: existingAttendance.id,
        sessionId: sessionId,
        message: 'Successfully checked in (updated)',
        locationVerified: isLocationValid,
        distance: Math.round(distance)
      })
    } else {
      // 새로운 출석 기록 생성
      const { data: newAttendance, error: insertError } = await supabase
        .from('attendances')
        .insert({
          session_id: sessionId,
          student_id: user.userId,
          status: 'present',
          check_in_time: new Date().toISOString(),
          location_verified: isLocationValid
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('Attendance creation failed:', insertError)
        return NextResponse.json({ error: 'Failed to create attendance record' }, { status: 500 })
      }

      console.log(`✅ 출석 체크 완료: ${user.name} (${user.userId})`)

      return NextResponse.json({
        success: true,
        attendanceId: newAttendance.id,
        sessionId: sessionId,
        message: 'Successfully checked in',
        locationVerified: isLocationValid,
        distance: Math.round(distance)
      })
    }
  } catch (error) {
    console.error('Check-in API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
