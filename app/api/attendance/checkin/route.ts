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

    console.log('📍 Check-in request received:', { sessionId, latitude, longitude, accuracy })

    if (!sessionId || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      console.error('❌ Invalid request parameters:', { sessionId, latitude, longitude })
      return NextResponse.json({ error: 'Session ID, latitude, and longitude are required' }, { status: 400 })
    }

    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return NextResponse.json({ error: '유효하지 않은 위치 범위입니다. 위도는 -90~90, 경도는 -180~180 사이여야 합니다.' }, { status: 400 })
    }

    const supabase = createServiceClient()

    console.log('🔍 Looking up session with ID:', sessionId)

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

    if (sessionError) {
      console.error('❌ Session lookup error:', sessionError)
      console.error('❌ Failed to find session with ID:', sessionId)
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (!session) {
      console.error('❌ No session found with ID:', sessionId)
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    console.log('✅ Session found:', { id: session.id, courseId: session.course_id, status: session.status })

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
      return NextResponse.json({ error: 'Session has already ended.', sessionEnded: true, autoEnded: autoEndResult.autoEnded }, { status: 400 })
    }

    const expiresAt = new Date(normalizedSession.qr_code_expires_at)
    if (expiresAt < new Date()) {
      return NextResponse.json({ error: 'QR code has expired', sessionEnded: true }, { status: 400 })
    }

    const resolvedLocation = resolveClassroomLocation(normalizedSession, normalizedSession.courses)
    if (!resolvedLocation) {
      return NextResponse.json({ error: '강의실 위치 정보가 설정되어 있지 않습니다.' }, { status: 400 })
    }

    const evaluation = evaluateLocation(latitude, longitude, accuracy, resolvedLocation)

    if (!Number.isFinite(evaluation.distance)) {
      return NextResponse.json({ error: '위치 검증 중 오류가 발생했습니다. 위치 정보를 확인해주세요.' }, { status: 400 })
    }

    if (!evaluation.isLocationValid) {
      return NextResponse.json({
        error: `위치 검증 실패: 강의실에서 ${Math.round(evaluation.distance)}m 떨어져 있습니다. (허용 반경: ${resolvedLocation.radius}m, GPS 정확도: ${Math.round(accuracy)}m)`,
        distance: Math.round(evaluation.distance),
        effectiveDistance: Math.round(evaluation.effectiveDistance),
        allowedRadius: resolvedLocation.radius,
        gpsAccuracy: Math.round(accuracy)
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
      const { error: updateError } = await supabase
        .from('attendances')
        .update({
          status: 'present',
          check_in_time: nowIso,
          location_verified: true,
          updated_at: nowIso
        })
        .eq('id', existingAttendance.id)

      if (updateError) {
        console.error('Attendance update failed:', updateError)
        return NextResponse.json({ error: 'Failed to update attendance' }, { status: 500 })
      }

      attendanceId = existingAttendance.id
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

    const { error: logError } = await supabase
      .from('location_logs')
      .insert({
        attendance_id: attendanceId,
        latitude,
        longitude,
        accuracy,
        is_valid: true
      })

    if (logError) {
      console.warn('Failed to insert location log:', logError)
    }

    return NextResponse.json({
      success: true,
      attendanceId,
      sessionId,
      message: 'Successfully checked in',
      locationVerified: true,
      distance: Math.round(evaluation.distance)
    })
  } catch (error) {
    console.error('Check-in API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
