import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-admin'
import { autoEndSessionIfNeeded } from '@/lib/session/session-service'
import type { SupabaseSessionRow, SupabaseCourseRow } from '@/lib/session/types'

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

interface ResolvedLocation {
  latitude: number
  longitude: number
  radius: number
  displayName?: string
}

function resolveClassroomLocation(session: SupabaseSessionRow, course: SupabaseCourseRow | SupabaseCourseRow[] | null): ResolvedLocation | null {
  if (session.classroom_latitude !== null && session.classroom_longitude !== null) {
    return {
      latitude: Number(session.classroom_latitude),
      longitude: Number(session.classroom_longitude),
      radius: session.classroom_radius ?? 100,
      displayName: undefined
    }
  }

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

interface LocationEvaluation {
  distance: number
  effectiveDistance: number
  allowedRadius: number
  isLocationValid: boolean
}

function evaluateLocation(studentLat: number, studentLon: number, accuracy: number, classroom: ResolvedLocation): LocationEvaluation {
  const distance = calculateDistance(studentLat, studentLon, classroom.latitude, classroom.longitude)
  const effectiveDistance = Math.max(0, distance - accuracy)
  const allowedRadius = classroom.radius
  const isDevelopment = process.env.NODE_ENV === 'development'
  const isLocationValid = isDevelopment || effectiveDistance <= allowedRadius

  return {
    distance,
    effectiveDistance,
    allowedRadius,
    isLocationValid
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface CheckInRequest {
  sessionId: string
  latitude: number
  longitude: number
  accuracy?: number
  clientTimestamp?: string
  correlationId?: string
  attemptNumber?: number
}

const MAX_CLOCK_SKEW_MS = 60 * 1000

function logCheckin(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ scope: 'attendance-checkin', event, ...data }))
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'student') {
      return NextResponse.json({ error: 'Only students can check in' }, { status: 403 })
    }

    const body = (await request.json()) as Partial<CheckInRequest>
    const { sessionId } = body
    const latitude = Number(body.latitude)
    const longitude = Number(body.longitude)
    const accuracy = Number(body.accuracy ?? 0)
    const clientTimestampRaw = body.clientTimestamp
    const clientTimestamp = typeof clientTimestampRaw === 'string' ? clientTimestampRaw : undefined
    const attemptNumber = Number.isFinite(Number(body.attemptNumber)) ? Number(body.attemptNumber) : 0
    const correlationId = typeof body.correlationId === 'string' && body.correlationId.length > 0 ? body.correlationId : randomUUID()
    let parsedClientTimestamp: Date | null = null

    if (!clientTimestamp) {
      return NextResponse.json(
        { error: 'clientTimestamp is required', code: 'clock_skew', allowedSkewSeconds: MAX_CLOCK_SKEW_MS / 1000 },
        { status: 400 }
      )
    }

    const candidate = new Date(clientTimestamp)
    if (Number.isNaN(candidate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid clientTimestamp format', code: 'clock_skew', allowedSkewSeconds: MAX_CLOCK_SKEW_MS / 1000 },
        { status: 400 }
      )
    }
    parsedClientTimestamp = candidate

    console.log('🎯 [CheckIn] 요청 수신:', {
      sessionId,
      sessionIdType: typeof sessionId,
      sessionIdLength: sessionId?.length,
      sessionIdValid: sessionId && typeof sessionId === 'string' && sessionId.length === 36,
      latitude,
      longitude,
      accuracy,
      clientTimestamp,
      timestamp: new Date().toISOString(),
      correlationId
    })

    if (!sessionId || typeof sessionId !== 'string' || sessionId.length === 0) {
      console.error('❌ [CheckIn] 잘못된 sessionId:', {
        sessionId,
        type: typeof sessionId,
        length: sessionId?.length
      })
      return NextResponse.json({ error: '유효한 세션 ID가 필요합니다.' }, { status: 400 })
    }

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      console.error('❌ [CheckIn] 잘못된 위치 데이터:', { latitude, longitude })
      return NextResponse.json({ error: '유효한 위도와 경도가 필요합니다.' }, { status: 400 })
    }

    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return NextResponse.json({ error: '유효하지 않은 위치 범위입니다. 위도는 -90~90, 경도는 -180~180 사이여야 합니다.' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const serverNow = new Date()
    const skew = Math.abs(serverNow.getTime() - parsedClientTimestamp.getTime())
    const clockSkewSeconds = Math.round(skew / 1000)
    if (skew > MAX_CLOCK_SKEW_MS) {
      console.warn('⚠️ [CheckIn] clock skew detected', { skewMs: skew, correlationId })
      logCheckin('clock_skew', {
        correlationId,
        sessionId: sessionId?.slice(0, 8),
        studentId: user.userId.slice(0, 8),
        attemptNumber,
        clockSkewSeconds
      })
      await supabase
        .from('attendance_attempts')
        .insert({
          session_id: sessionId,
          student_id: user.userId,
          attempt_number: attemptNumber,
          client_timestamp: parsedClientTimestamp.toISOString(),
          clock_skew_seconds: clockSkewSeconds,
          result: 'clock_skew',
          failure_reason: 'client_clock_skew',
          correlation_id: correlationId
        })
      return NextResponse.json(
        {
          error: '기기 시간이 서버 기준과 1분 이상 차이납니다. 기기 시간을 맞춘 후 다시 시도하세요.',
          code: 'clock_skew',
          allowedSkewSeconds: MAX_CLOCK_SKEW_MS / 1000
        },
        { status: 400 }
      )
    }

    console.log('🔧 [CheckIn] Supabase 클라이언트 생성 완료')

    console.log('🔍 [CheckIn] 세션 조회 시작...', {
      targetSessionId: sessionId,
      sessionIdType: typeof sessionId,
      sessionIdLength: sessionId.length,
      isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)
    })

    // 먼저 해당 세션이 존재하는지 확인 (status 조건 없이)
    const { data: sessionExists, error: existsError } = await supabase
      .from('class_sessions')
      .select('id, status, qr_code_expires_at')
      .eq('id', sessionId)
      .single()

    if (existsError || !sessionExists) {
      console.error('❌ [CheckIn] 세션 존재 확인 실패:', {
        sessionId,
        error: existsError?.message,
        errorCode: existsError?.code
      })
      logCheckin('session_not_found_precheck', {
        correlationId,
        sessionId: sessionId?.slice(0, 8),
        studentId: user.userId.slice(0, 8),
        attemptNumber
      })

      await supabase
        .from('attendance_attempts')
        .insert({
          session_id: sessionId,
          student_id: user.userId,
          attempt_number: attemptNumber,
          client_timestamp: parsedClientTimestamp.toISOString(),
          clock_skew_seconds: clockSkewSeconds,
          result: 'expired',
          failure_reason: 'session_not_found_precheck',
          correlation_id: correlationId,
          device_lat: Number.isFinite(latitude) ? Number(latitude.toFixed(2)) : null,
          device_lng: Number.isFinite(longitude) ? Number(longitude.toFixed(2)) : null,
          device_accuracy: Number.isFinite(accuracy) ? accuracy : null
        })

      // 모든 세션 목록 확인
      const { data: allSessions } = await supabase
        .from('class_sessions')
        .select('id, status')
        .order('created_at', { ascending: false })
        .limit(10)

      console.log('📋 [CheckIn] 전체 세션 목록:', allSessions?.map(s => ({
        id: s.id.substring(0, 8),
        status: s.status,
        matches: s.id === sessionId
      })))
    } else {
      console.log('✅ [CheckIn] 세션 존재 확인:', {
        id: sessionExists.id,
        status: sessionExists.status,
        expiresAt: sessionExists.qr_code_expires_at
      })
    }

    console.log('🎯 [CheckIn] 세션 상세 조회 시작...')

    const { data: session, error: sessionError } = await supabase
      .from('class_sessions')
      .select(`
        id,
        course_id,
        created_at,
        updated_at,
        qr_code,
        qr_code_expires_at,
        status,
        classroom_latitude,
        classroom_longitude,
        classroom_radius,
        courses ( id, name, course_code, location, location_latitude, location_longitude, location_radius )
      `)
      .eq('id', sessionId)
      .maybeSingle<SupabaseSessionRow>()

    console.log('🔍 [CheckIn] 세션 상세 조회 결과:', {
      found: !!session,
      sessionId: session?.id,
      status: session?.status,
      error: sessionError?.message
    })

    if (sessionError) {
      console.error('❌ [CheckIn] 세션 조회 에러:', {
        sessionId,
        errorCode: sessionError.code,
        errorMessage: sessionError.message,
        errorDetails: sessionError.details
      })

      // 세션이 다른 상태인지 확인
      const { data: anySession } = await supabase
        .from('class_sessions')
        .select('id, status, qr_code_expires_at')
        .eq('id', sessionId)
        .maybeSingle()

      if (anySession) {
        console.error('⚠️ [CheckIn] 세션은 존재하지만 조건 불일치:', {
          id: anySession.id,
          status: anySession.status,
          expires_at: anySession.qr_code_expires_at,
          isExpired: new Date(anySession.qr_code_expires_at) < new Date()
        })
      } else {
        console.error('⚠️ [CheckIn] 세션 자체가 존재하지 않음:', sessionId)
      }

      await supabase
        .from('attendance_attempts')
        .insert({
          session_id: sessionId,
          student_id: user.userId,
          attempt_number: attemptNumber,
          client_timestamp: parsedClientTimestamp.toISOString(),
          clock_skew_seconds: clockSkewSeconds,
          result: 'expired',
          failure_reason: 'session_not_found',
          correlation_id: correlationId,
          device_lat: Number.isFinite(latitude) ? Number(latitude.toFixed(2)) : null,
          device_lng: Number.isFinite(longitude) ? Number(longitude.toFixed(2)) : null,
          device_accuracy: Number.isFinite(accuracy) ? accuracy : null
        })
      logCheckin('session_not_found', {
        stage: 'detail_query',
        correlationId,
        sessionId: sessionId?.slice(0, 8),
        studentId: user.userId.slice(0, 8),
        attemptNumber
      })
      return NextResponse.json(
        { error: '세션을 찾을 수 없습니다.', code: 'session_not_found' },
        { status: 404 }
      )
    }

    if (!session) {
      console.error('❌ [CheckIn] 세션 데이터가 null')
      await supabase
        .from('attendance_attempts')
        .insert({
          session_id: sessionId,
          student_id: user.userId,
          attempt_number: attemptNumber,
          client_timestamp: parsedClientTimestamp.toISOString(),
          clock_skew_seconds: clockSkewSeconds,
          result: 'expired',
          failure_reason: 'session_data_null',
          correlation_id: correlationId,
          device_lat: Number.isFinite(latitude) ? Number(latitude.toFixed(2)) : null,
          device_lng: Number.isFinite(longitude) ? Number(longitude.toFixed(2)) : null,
          device_accuracy: Number.isFinite(accuracy) ? accuracy : null
        })
      logCheckin('session_not_found', {
        stage: 'data_null',
        correlationId,
        sessionId: sessionId?.slice(0, 8),
        studentId: user.userId.slice(0, 8),
        attemptNumber
      })
      return NextResponse.json(
        { error: '세션을 찾을 수 없습니다.', code: 'session_not_found' },
        { status: 404 }
      )
    }

    console.log('✅ [CheckIn] 세션 조회 성공:', {
      sessionId: session.id,
      courseId: session.course_id,
      status: session.status,
      expires_at: session.qr_code_expires_at
    })

    const sessionRow = session

    const courseId = sessionRow?.course_id

    if (!courseId) {
      return NextResponse.json({ error: 'Session has no linked course.' }, { status: 500 })
    }

    const autoEndResult = await autoEndSessionIfNeeded(supabase, {
      id: sessionRow.id,
      status: sessionRow.status,
      created_at: sessionRow.created_at,
      updated_at: sessionRow.updated_at,
      course_id: courseId
    })

    const normalizedSession: SupabaseSessionRow = {
      ...sessionRow,
      status: autoEndResult.session.status,
      updated_at: autoEndResult.session.updated_at ?? sessionRow.updated_at
    }

    if (autoEndResult.autoEnded || normalizedSession.status === 'ended') {
      await supabase
        .from('attendance_attempts')
        .insert({
          session_id: sessionId,
          student_id: user.userId,
          attempt_number: attemptNumber,
          client_timestamp: parsedClientTimestamp.toISOString(),
          clock_skew_seconds: clockSkewSeconds,
          result: 'expired',
          failure_reason: 'session_ended',
          correlation_id: correlationId,
          device_lat: Number.isFinite(latitude) ? Number(latitude.toFixed(2)) : null,
          device_lng: Number.isFinite(longitude) ? Number(longitude.toFixed(2)) : null,
          device_accuracy: Number.isFinite(accuracy) ? accuracy : null
        })
      logCheckin('session_ended', {
        correlationId,
        sessionId: sessionId.slice(0, 8),
        studentId: user.userId.slice(0, 8),
        attemptNumber
      })
      return NextResponse.json(
        { error: '세션이 종료되었습니다.', code: 'expired', sessionEnded: true, autoEnded: autoEndResult.autoEnded },
        { status: 400 }
      )
    }

    const expiresAt = new Date(normalizedSession.qr_code_expires_at)
    if (expiresAt < new Date()) {
      await supabase
        .from('attendance_attempts')
        .insert({
          session_id: sessionId,
          student_id: user.userId,
          attempt_number: attemptNumber,
          client_timestamp: parsedClientTimestamp.toISOString(),
          clock_skew_seconds: clockSkewSeconds,
          result: 'expired',
          failure_reason: 'qr_expired',
          correlation_id: correlationId,
          device_lat: Number.isFinite(latitude) ? Number(latitude.toFixed(2)) : null,
          device_lng: Number.isFinite(longitude) ? Number(longitude.toFixed(2)) : null,
          device_accuracy: Number.isFinite(accuracy) ? accuracy : null
        })
      logCheckin('session_expired', {
        correlationId,
        sessionId: sessionId.slice(0, 8),
        studentId: user.userId.slice(0, 8),
        attemptNumber
      })
      return NextResponse.json(
        { error: 'QR 코드가 만료되었습니다.', code: 'expired', sessionEnded: true },
        { status: 400 }
      )
    }

    const resolvedLocation = resolveClassroomLocation(normalizedSession, normalizedSession.courses)
    if (!resolvedLocation) {
      await supabase
        .from('attendance_attempts')
        .insert({
          session_id: sessionId,
          student_id: user.userId,
          attempt_number: attemptNumber,
          client_timestamp: parsedClientTimestamp.toISOString(),
          clock_skew_seconds: clockSkewSeconds,
          result: 'error',
          failure_reason: 'missing_location',
          correlation_id: correlationId,
          device_lat: Number.isFinite(latitude) ? Number(latitude.toFixed(2)) : null,
          device_lng: Number.isFinite(longitude) ? Number(longitude.toFixed(2)) : null,
          device_accuracy: Number.isFinite(accuracy) ? accuracy : null
        })
      logCheckin('invalid_location', {
        reason: 'missing_location',
        correlationId,
        sessionId: sessionId.slice(0, 8),
        studentId: user.userId.slice(0, 8),
        attemptNumber
      })
      return NextResponse.json(
        { error: '강의실 위치 정보가 설정되어 있지 않습니다.', code: 'invalid_location' },
        { status: 400 }
      )
    }

    const evaluation = evaluateLocation(latitude, longitude, accuracy, resolvedLocation)

    if (!Number.isFinite(evaluation.distance)) {
      await supabase
        .from('attendance_attempts')
        .insert({
          session_id: sessionId,
          student_id: user.userId,
          attempt_number: attemptNumber,
          client_timestamp: parsedClientTimestamp.toISOString(),
          clock_skew_seconds: clockSkewSeconds,
          result: 'error',
          failure_reason: 'distance_not_finite',
          correlation_id: correlationId,
          device_lat: Number.isFinite(latitude) ? Number(latitude.toFixed(2)) : null,
          device_lng: Number.isFinite(longitude) ? Number(longitude.toFixed(2)) : null,
          device_accuracy: Number.isFinite(accuracy) ? accuracy : null
        })
      logCheckin('invalid_location', {
        reason: 'distance_not_finite',
        correlationId,
        sessionId: sessionId.slice(0, 8),
        studentId: user.userId.slice(0, 8),
        attemptNumber
      })
      return NextResponse.json(
        { error: '위치 검증 중 오류가 발생했습니다. 위치 정보를 확인해주세요.', code: 'invalid_location' },
        { status: 400 }
      )
    }

    if (!evaluation.isLocationValid) {
      await supabase
        .from('attendance_attempts')
        .insert({
          session_id: sessionId,
          student_id: user.userId,
          attempt_number: attemptNumber,
          client_timestamp: parsedClientTimestamp.toISOString(),
          clock_skew_seconds: clockSkewSeconds,
          result: 'error',
          failure_reason: 'location_out_of_range',
          correlation_id: correlationId,
          device_lat: Number(latitude.toFixed(2)),
          device_lng: Number(longitude.toFixed(2)),
          device_accuracy: Number.isFinite(accuracy) ? accuracy : null
        })
      logCheckin('invalid_location', {
        reason: 'out_of_range',
        correlationId,
        sessionId: sessionId.slice(0, 8),
        studentId: user.userId.slice(0, 8),
        attemptNumber,
        distance: Math.round(evaluation.distance)
      })
      return NextResponse.json({
        error: `위치 검증 실패: 강의실에서 ${Math.round(evaluation.distance)}m 떨어져 있습니다. (허용 반경: ${resolvedLocation.radius}m, GPS 정확도: ${Math.round(accuracy)}m)`,
        code: 'invalid_location',
        distance: Math.round(evaluation.distance),
        effectiveDistance: Math.round(evaluation.effectiveDistance),
        allowedRadius: resolvedLocation.radius,
        gpsAccuracy: Math.round(accuracy),
        retryAfterSeconds: attemptNumber === 0 ? 3 : undefined
      }, { status: 400 })
    }

    const { data: existingEnrollment, error: enrollmentError } = await supabase
      .from('course_enrollments')
      .select('id')
      .eq('course_id', courseId)
      .eq('student_id', user.userId)
      .maybeSingle()

    if (enrollmentError) {
      console.error('Enrollment lookup error:', enrollmentError)
      return NextResponse.json({ error: 'Failed to verify enrollment.' }, { status: 500 })
    }

    if (!existingEnrollment) {
      const { error: enrollmentInsertError } = await supabase
        .from('course_enrollments')
        .insert({
          course_id: courseId,
          student_id: user.userId,
          enrolled_at: new Date().toISOString()
        })

      if (enrollmentInsertError) {
        console.error('Enrollment insert error:', enrollmentInsertError)
        return NextResponse.json({ error: 'Failed to enroll in course' }, { status: 500 })
      }
    }

    const { data: existingAttendance, error: attendanceLookupError } = await supabase
      .from('attendances')
      .select('id, status')
      .eq('session_id', sessionId)
      .eq('student_id', user.userId)
      .maybeSingle()

    if (attendanceLookupError) {
      console.error('Attendance lookup error:', attendanceLookupError)
      return NextResponse.json({ error: 'Failed to verify attendance record' }, { status: 500 })
    }

    const nowIso = new Date().toISOString()
    let attendanceId: string

    if (existingAttendance) {
      await supabase
        .from('attendance_attempts')
        .insert({
          session_id: sessionId,
          student_id: user.userId,
          attempt_number: attemptNumber,
          client_timestamp: parsedClientTimestamp.toISOString(),
          clock_skew_seconds: clockSkewSeconds,
          result: 'duplicate',
          failure_reason: 'already_present',
          correlation_id: correlationId,
          device_lat: Number(latitude.toFixed(2)),
          device_lng: Number(longitude.toFixed(2)),
          device_accuracy: Number.isFinite(accuracy) ? accuracy : null
        })
      logCheckin('duplicate', {
        correlationId,
        sessionId: sessionId.slice(0, 8),
        studentId: user.userId.slice(0, 8),
        attemptNumber
      })
      return NextResponse.json(
        { error: '이미 출석 처리되었습니다.', code: 'already_present' },
        { status: 409 }
      )
    } else {
      const { data: insertedAttendance, error: insertAttendanceError } = await supabase
        .from('attendances')
        .insert({
          session_id: sessionId,
          student_id: user.userId,
          status: 'present',
          check_in_time: nowIso,
          location_verified: true
        })
        .select('id')
        .single()

      if (insertAttendanceError || !insertedAttendance) {
        console.error('Attendance insert failed:', insertAttendanceError)
        return NextResponse.json({ error: 'Failed to create attendance record' }, { status: 500 })
      }

      attendanceId = insertedAttendance.id
    }

    const truncatedLatitude = Number(latitude.toFixed(2))
    const truncatedLongitude = Number(longitude.toFixed(2))
    const truncatedAccuracy = Number.isFinite(accuracy) ? Number(accuracy.toFixed(2)) : 0

    const { error: logError } = await supabase
      .from('location_logs')
      .insert({
        attendance_id: attendanceId,
        latitude: truncatedLatitude,
        longitude: truncatedLongitude,
        accuracy: truncatedAccuracy,
        is_valid: true
      })

    if (logError) {
      console.warn('Failed to insert location log:', logError)
    }

    await supabase
      .from('attendance_attempts')
      .insert({
        session_id: sessionId,
        student_id: user.userId,
        attempt_number: attemptNumber,
        client_timestamp: parsedClientTimestamp.toISOString(),
        clock_skew_seconds: clockSkewSeconds,
        result: 'success',
        failure_reason: null,
        correlation_id: correlationId,
        device_lat: Number(latitude.toFixed(2)),
        device_lng: Number(longitude.toFixed(2)),
        device_accuracy: Number.isFinite(accuracy) ? accuracy : null
      })

    logCheckin('success', {
      correlationId,
      sessionId: sessionId.slice(0, 8),
      studentId: user.userId.slice(0, 8),
      attemptNumber,
      distance: Math.round(evaluation.distance)
    })

    return NextResponse.json({
      success: true,
      attendanceId,
      sessionId,
      message: '출석이 완료되었습니다.',
      locationVerified: true,
      distance: Math.round(evaluation.distance),
      retryAttempt: attemptNumber,
      serverTimestamp: serverNow.toISOString(),
      correlationId
    })
  } catch (error) {
    console.error('Check-in API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
