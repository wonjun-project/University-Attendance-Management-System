import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-admin'
import { autoEndSessionIfNeeded, calculateAutoEndAt } from '@/lib/session/session-service'
import type { SupabaseCourseRow, SupabaseSessionRow } from '@/lib/session/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ParsedClassroomLocation {
  latitude: number
  longitude: number
  radius: number
  displayName?: string
  locationType: 'predefined' | 'current'
  predefinedLocationId: string | null
}

function resolveCourse(session: SupabaseSessionRow): SupabaseCourseRow | null {
  if (!session.courses) {
    return null
  }

  return Array.isArray(session.courses) ? session.courses[0] ?? null : session.courses
}

function resolveLocation(session: SupabaseSessionRow, course: SupabaseCourseRow | null): ParsedClassroomLocation {
  if (session.classroom_latitude !== null && session.classroom_longitude !== null) {
    return {
      latitude: Number(session.classroom_latitude),
      longitude: Number(session.classroom_longitude),
      radius: session.classroom_radius ?? 100,
      displayName: course?.location ?? undefined,
      locationType: 'predefined',
      predefinedLocationId: null
    }
  }

  if (course && course.location_latitude !== null && course.location_longitude !== null) {
    return {
      latitude: Number(course.location_latitude),
      longitude: Number(course.location_longitude),
      radius: course.location_radius ?? 100,
      displayName: course.location ?? undefined,
      locationType: 'predefined',
      predefinedLocationId: null
    }
  }

  return {
    latitude: 37.5665,
    longitude: 126.9780,
    radius: 100,
    displayName: '기본 강의실 위치',
    locationType: 'predefined',
    predefinedLocationId: null
  }
}

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

    const supabase = createServiceClient()

    const { data: session, error: sessionError } = await supabase
      .from('class_sessions')
      .select(`
        id,
        course_id,
        created_at,
        updated_at,
        date,
        qr_code,
        qr_code_expires_at,
        status,
        classroom_latitude,
        classroom_longitude,
        classroom_radius,
        courses (
          id,
          name,
          course_code,
          location,
          location_latitude,
          location_longitude,
          location_radius
        )
      `)
      .eq('id', sessionId)
      .maybeSingle<SupabaseSessionRow>()

    if (sessionError || !session) {
      console.error('Session not found:', sessionError)
      return NextResponse.json(
        { error: '세션을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const sessionRow = session

    if (!sessionRow?.course_id) {
      return NextResponse.json({ error: '세션에 연결된 강의가 없습니다.' }, { status: 400 })
    }

    const autoEndResult = await autoEndSessionIfNeeded(supabase, {
      id: sessionRow.id,
      status: sessionRow.status,
      created_at: sessionRow.created_at,
      updated_at: sessionRow.updated_at,
      course_id: sessionRow.course_id
    })

    const normalizedSession: SupabaseSessionRow = {
      ...sessionRow,
      status: autoEndResult.session.status,
      updated_at: autoEndResult.session.updated_at ?? sessionRow.updated_at
    }

    const course = resolveCourse(normalizedSession)
    const classroomLocation = resolveLocation(normalizedSession, course)
    const autoEndInfo = calculateAutoEndAt(normalizedSession.created_at ?? null)

    const responseData = {
      session: {
        id: normalizedSession.id,
        courseId: normalizedSession.course_id,
        course_id: normalizedSession.course_id,
        courseName: course?.name || '데모 강의',
        courseCode: course?.course_code || 'DEMO101',
        qr_code_expires_at: normalizedSession.qr_code_expires_at,
        expiresAt: normalizedSession.qr_code_expires_at,
        status: normalizedSession.status,
        date: normalizedSession.date,
        location: {
          lat: classroomLocation.latitude,
          lng: classroomLocation.longitude,
          radius: classroomLocation.radius,
          address: classroomLocation.displayName ?? '강의실 위치',
          locationType: classroomLocation.locationType,
          predefinedLocationId: classroomLocation.predefinedLocationId
        },
        isActive: normalizedSession.status === 'active',
        autoEnded: autoEndResult.autoEnded,
        autoEndAt: autoEndInfo.autoEndAt
      }
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Session fetch error:', error)
    return NextResponse.json(
      { error: '세션 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
