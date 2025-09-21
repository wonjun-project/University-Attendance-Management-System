import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { autoEndSessionIfNeeded, calculateAutoEndAt } from '@/lib/session/session-service'
import { SupabaseSessionRow } from '@/lib/session/types'

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
          classroom_location
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

    const sessionRow = ({
      ...session,
      courses: Array.isArray(session.courses) ? session.courses[0] ?? null : session.courses ?? null
    } as unknown) as SupabaseSessionRow

    if (!sessionRow.course_id) {
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

    const course = Array.isArray(normalizedSession.courses) ? normalizedSession.courses[0] ?? null : normalizedSession.courses

    interface ParsedClassroomLocation {
      latitude: number
      longitude: number
      radius?: number
      displayName?: string
      locationType?: 'predefined' | 'current'
      predefinedLocationId?: string | null
    }

    const parseLocation = (value: unknown): ParsedClassroomLocation | null => {
      if (!value) return null

      let raw = value
      if (typeof raw === 'string') {
        try {
          raw = JSON.parse(raw)
        } catch {
          return null
        }
      }

      if (typeof raw !== 'object' || raw === null) {
        return null
      }

      const candidate = raw as Record<string, unknown>
      const latRaw = candidate.latitude ?? candidate.lat
      const lonRaw = candidate.longitude ?? candidate.lng ?? candidate.lon
      const radiusRaw = candidate.radius ?? candidate.radiusMeters ?? candidate.allowedRadius
      const displayNameRaw = candidate.displayName ?? candidate.name ?? candidate.label
      const locationTypeRaw = candidate.locationType ?? candidate.location_type ?? candidate.type
      const predefinedRaw = candidate.predefinedLocationId ?? candidate.predefined_location_id

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
      const displayName = typeof displayNameRaw === 'string' && displayNameRaw.length > 0 ? displayNameRaw : undefined
      const locationType = locationTypeRaw === 'current' ? 'current' : locationTypeRaw === 'predefined' ? 'predefined' : undefined
      const predefinedLocationId = typeof predefinedRaw === 'string' && predefinedRaw.length > 0 ? predefinedRaw : null

      return {
        latitude: lat,
        longitude: lon,
        radius,
        displayName,
        locationType,
        predefinedLocationId
      }
    }

    let classroomLocation: ParsedClassroomLocation | null = parseLocation({
      latitude: normalizedSession.classroom_latitude ?? null,
      longitude: normalizedSession.classroom_longitude ?? null,
      radius: normalizedSession.classroom_radius ?? null,
      locationType: normalizedSession.classroom_location_type ?? undefined,
      predefinedLocationId: normalizedSession.predefined_location_id ?? null,
      displayName: normalizedSession.classroom_display_name ?? undefined
    })

    if (!classroomLocation) {
      classroomLocation = parseLocation(course?.classroom_location ?? null)
    }

    if (!classroomLocation) {
      classroomLocation = {
        latitude: 37.5665,
        longitude: 126.9780,
        radius: 100,
        displayName: '기본 강의실 위치',
        locationType: 'predefined' as const,
        predefinedLocationId: null
      }
    }

    const locationRadius = classroomLocation.radius ?? 100

    // 응답 데이터 구성 (기존 형식 호환)
    const autoEndInfo = calculateAutoEndAt(normalizedSession.created_at ?? null)

    const responseData = {
      session: {
        id: normalizedSession.id,
        courseId: normalizedSession.course_id,
        course_id: normalizedSession.course_id, // 레거시 호환성
        courseName: course?.name || '데모 강의',
        courseCode: course?.course_code || 'DEMO101',
        qr_code_expires_at: normalizedSession.qr_code_expires_at, // 레거시 호환성
        expiresAt: normalizedSession.qr_code_expires_at,
        status: normalizedSession.status,
        date: normalizedSession.date,
        location: {
          lat: classroomLocation.latitude,
          lng: classroomLocation.longitude,
          radius: locationRadius,
          address: classroomLocation.displayName ?? '강의실 위치',
          locationType: classroomLocation.locationType ?? 'predefined',
          predefinedLocationId: classroomLocation.predefinedLocationId
        },
        isActive: normalizedSession.status === 'active',
        autoEnded: autoEndResult.autoEnded,
        autoEndAt: autoEndInfo.autoEndAt
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
