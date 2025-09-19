import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // 세션 만료 확인
    if (new Date() > new Date(session.qr_code_expires_at)) {
      return NextResponse.json(
        { error: '만료된 세션입니다.' },
        { status: 410 }
      )
    }

    const course = session.courses as any

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
      latitude: (session as any).classroom_latitude ?? null,
      longitude: (session as any).classroom_longitude ?? null,
      radius: (session as any).classroom_radius ?? null,
      locationType: (session as any).classroom_location_type ?? undefined,
      predefinedLocationId: (session as any).predefined_location_id ?? null,
      displayName: (session as any).classroom_display_name ?? undefined
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
    const responseData = {
      session: {
        id: session.id,
        courseId: session.course_id,
        course_id: session.course_id, // 레거시 호환성
        courseName: course?.name || '데모 강의',
        courseCode: course?.course_code || 'DEMO101',
        qr_code_expires_at: session.qr_code_expires_at, // 레거시 호환성
        expiresAt: session.qr_code_expires_at,
        status: session.status,
        date: session.date,
        location: {
          lat: classroomLocation.latitude,
          lng: classroomLocation.longitude,
          radius: locationRadius,
          address: classroomLocation.displayName ?? '강의실 위치',
          locationType: classroomLocation.locationType ?? 'predefined',
          predefinedLocationId: classroomLocation.predefinedLocationId
        },
        isActive: session.status === 'active'
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
