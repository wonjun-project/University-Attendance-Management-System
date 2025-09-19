import { getCurrentUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { autoEndSessionIfNeeded } from '@/lib/session/session-service'

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
        created_at,
        updated_at,
        qr_code_expires_at,
        status,
        classroom_latitude,
        classroom_longitude,
        classroom_radius,
        courses (
          id,
          name,
          course_code,
          classroom_location
        )
      `)
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('Session not found:', sessionError)
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const autoEndResult = await autoEndSessionIfNeeded(supabase, {
      id: session.id,
      status: session.status,
      created_at: (session as any).created_at ?? null,
      updated_at: (session as any).updated_at ?? null,
      course_id: session.course_id
    })

    const normalizedSession = {
      ...session,
      status: autoEndResult.session.status,
      updated_at: autoEndResult.session.updated_at
    }

    if (autoEndResult.autoEnded || normalizedSession.status === 'ended') {
      return NextResponse.json({
        error: 'Session has already ended.',
        sessionEnded: true,
        autoEnded: autoEndResult.autoEnded
      }, { status: 400 })
    }

    // 로컬 파일에서 위치 정보 가져오기 (개발 환경용)
    let classroomLocationData = null
    try {
      const fs = (await import('fs')).default
      const path = (await import('path')).default
      const sessionsFilePath = path.join(process.cwd(), 'data', 'sessions.json')
      const sessionsData = JSON.parse(fs.readFileSync(sessionsFilePath, 'utf-8'))
      const localSession = sessionsData.find((s: any) => s.id === sessionId)
      if (localSession?.classroomLocation) {
        classroomLocationData = localSession.classroomLocation
        console.log('로컬 파일에서 위치 정보 로드:', classroomLocationData)
      }
    } catch (err) {
      console.log('로컬 파일 읽기 실패, Supabase 데이터 사용')
    }

    console.log('=== 출석 체크인 시도 ===')
    console.log(`학생: ${user.name} (${user.userId})`)
    console.log(`위치: (${lat}, ${lon}) ±${acc}m`)

    if (normalizedSession.status !== 'active') {
      return NextResponse.json({ error: 'Session is not active' }, { status: 400 })
    }

    // 만료 시간 확인
    const expiresAt = new Date(normalizedSession.qr_code_expires_at)
    const currentTime = new Date()
    console.log('QR 만료 시간 체크:')
    console.log('  - 만료 시간:', expiresAt.toISOString())
    console.log('  - 현재 시간:', currentTime.toISOString())
    console.log('  - 만료됨?:', expiresAt < currentTime)

    if (expiresAt < currentTime) {
      return NextResponse.json({
        error: 'QR code has expired',
        debug: {
          expiresAt: normalizedSession.qr_code_expires_at,
          currentTime: currentTime.toISOString(),
          expired: true
        }
      }, { status: 400 })
    }

    // 수강신청 확인 (자동 등록)
    const { data: enrollment } = await supabase
      .from('course_enrollments')
      .select('id')
      .eq('course_id', normalizedSession.course_id)
      .eq('student_id', user.userId)
      .single()

    if (!enrollment) {
      // 자동 등록 (MVP용)
      console.log(`자동 등록 진행: ${user.userId} -> ${normalizedSession.course_id}`)
      const { error: enrollError } = await supabase
        .from('course_enrollments')
        .insert({
          course_id: normalizedSession.course_id,
          student_id: user.userId,
          enrolled_at: new Date().toISOString()
        })

      if (enrollError) {
        console.error('Auto-enrollment failed:', enrollError)
        return NextResponse.json({ error: 'Failed to enroll in course' }, { status: 500 })
      }
    }

    // 세션에 저장된 강의실 위치 정보 사용 (없으면 코스 정보 → 기본값 순으로 폴백)
    const sessionAny = normalizedSession as any

    interface ParsedClassroomLocation {
      latitude: number
      longitude: number
      radius?: number
      locationType?: 'predefined' | 'current'
      predefinedLocationId?: string | null
      displayName?: string
    }

    const parseLocation = (value: unknown): ParsedClassroomLocation | null => {
      if (!value) return null

      let rawLocation = value
      if (typeof rawLocation === 'string') {
        try {
          rawLocation = JSON.parse(rawLocation)
        } catch {
          return null
        }
      }

      if (typeof rawLocation !== 'object' || rawLocation === null) {
        return null
      }

      const candidate = rawLocation as Record<string, unknown>

      const latRaw = candidate.latitude ?? candidate.lat
      const lonRaw = candidate.longitude ?? candidate.lng ?? candidate.lon
      const radiusRaw = candidate.radius ?? candidate.radiusMeters ?? candidate.allowedRadius
      const locationTypeRaw = candidate.locationType ?? candidate.location_type ?? candidate.type
      const predefinedIdRaw = candidate.predefinedLocationId ?? candidate.predefined_location_id ?? candidate.locationId
      const displayNameRaw = candidate.displayName ?? candidate.name ?? candidate.label

      if (latRaw === null || latRaw === undefined || latRaw === '') {
        return null
      }

      if (lonRaw === null || lonRaw === undefined || lonRaw === '') {
        return null
      }

      const lat = typeof latRaw === 'number' ? latRaw : Number(latRaw)
      const lon = typeof lonRaw === 'number' ? lonRaw : Number(lonRaw)
      const radiusValue = typeof radiusRaw === 'number' ? radiusRaw : Number(radiusRaw)

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null
      }

      const radius = Number.isFinite(radiusValue) && radiusValue > 0 ? radiusValue : undefined
      const locationType = locationTypeRaw === 'current' ? 'current' : locationTypeRaw === 'predefined' ? 'predefined' : undefined
      const predefinedLocationId = typeof predefinedIdRaw === 'string' && predefinedIdRaw.length > 0 ? predefinedIdRaw : null
      const displayName = typeof displayNameRaw === 'string' && displayNameRaw.length > 0 ? displayNameRaw : undefined

      return {
        latitude: lat,
        longitude: lon,
        radius,
        locationType,
        predefinedLocationId,
        displayName
      }
    }

    let classroomLocation = classroomLocationData as ParsedClassroomLocation | null

    if (!classroomLocation) {
      classroomLocation = parseLocation({
        latitude: sessionAny.classroom_latitude ?? null,
        longitude: sessionAny.classroom_longitude ?? null,
        radius: sessionAny.classroom_radius ?? null
      })
    }

    if (!classroomLocation) {
      classroomLocation = parseLocation(sessionAny.courses?.classroom_location ?? null)
    }

    if (!classroomLocation) {
      classroomLocation = {
        latitude: 37.5665,
        longitude: 126.9780,
        radius: 100,
        locationType: 'predefined',
        predefinedLocationId: null,
        displayName: '기본 강의실 위치'
      }
    }

    const locationRadius = classroomLocation.radius ?? Math.max(150, acc * 3)
    const normalizedClassroomLocation = {
      latitude: classroomLocation.latitude,
      longitude: classroomLocation.longitude,
      radius: locationRadius,
      locationType: classroomLocation.locationType ?? 'predefined',
      predefinedLocationId: classroomLocation.predefinedLocationId ?? null,
      displayName: classroomLocation.displayName
    }

    console.log(`강의실: (${normalizedClassroomLocation.latitude}, ${normalizedClassroomLocation.longitude}) 반경 ${normalizedClassroomLocation.radius}m [${normalizedClassroomLocation.locationType}]`)
    console.log(`GPS 정확도: ${acc}m`)

    // 학생 위치와 강의실 위치 간 거리 계산
    const distance = calculateDistance(
      lat,
      lon,
      normalizedClassroomLocation.latitude,
      normalizedClassroomLocation.longitude
    )

    // GPS 정확도를 고려한 실효 거리 (GPS 오차를 빼줌)
    const effectiveDistance = Math.max(0, distance - acc)

    // 디버깅을 위해 항상 통과하도록 임시 설정 (개발 환경에서만)
    const isDevelopment = process.env.NODE_ENV === 'development'
    if (isDevelopment) {
      console.log('🔧 개발 모드: 위치 검증 항상 통과')
    }

    // 거리 계산 결과가 유효한지 확인
    if (isNaN(distance)) {
      console.error('거리 계산 실패:', { lat, lon, classroomLocation: normalizedClassroomLocation })
      return NextResponse.json({
        error: '위치 검증 중 오류가 발생했습니다. 위치 정보를 확인해주세요.'
      }, { status: 400 })
    }

    // 허용 반경 내에 있는지 확인 (GPS 정확도를 고려한 실효 거리 사용)
    // 개발 환경에서는 항상 통과
    const isLocationValid = isDevelopment ? true : (effectiveDistance <= normalizedClassroomLocation.radius)

    console.log(`거리: ${Math.round(distance)}m (실효: ${Math.round(effectiveDistance)}m) / 허용: ${normalizedClassroomLocation.radius}m → ${isLocationValid ? '✅ 승인' : '❌ 거부'}`)

    if (!isLocationValid) {
      return NextResponse.json({
        error: `위치 검증 실패: 강의실에서 ${Math.round(distance)}m 떨어져 있습니다. (허용 반경: ${normalizedClassroomLocation.radius}m, GPS 정확도: ${Math.round(acc)}m)`,
        distance: Math.round(distance),
        effectiveDistance: Math.round(effectiveDistance),
        allowedRadius: normalizedClassroomLocation.radius,
        gpsAccuracy: Math.round(acc),
        debug: {
          studentLocation: { lat, lon },
          classroomLocation: {
            latitude: normalizedClassroomLocation.latitude,
            longitude: normalizedClassroomLocation.longitude,
            radius: normalizedClassroomLocation.radius,
            locationType: normalizedClassroomLocation.locationType,
            predefinedLocationId: normalizedClassroomLocation.predefinedLocationId,
            displayName: normalizedClassroomLocation.displayName
          }
        }
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
