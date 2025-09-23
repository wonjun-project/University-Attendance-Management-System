import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-admin'

const FALLBACK_LOCATION = {
  latitude: 36.6372,
  longitude: 127.4896,
  radius: 100,
  address: '제1자연관 501호 (무심서로 377-3)'
}

function normaliseNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }
  return fallback
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      courseId?: string
      location?: {
        lat?: number
        lng?: number
        latitude?: number
        longitude?: number
        radius?: number
        address?: string
      }
    }

    const courseId = body.courseId
    if (!courseId) {
      return NextResponse.json({ error: '강의 ID가 필요합니다.' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, name, course_code, location, location_latitude, location_longitude, location_radius')
      .eq('id', courseId)
      .maybeSingle()

    if (courseError) {
      console.error('[Session Create] 강의 조회 실패:', courseError)
      return NextResponse.json({ error: '강의 정보를 불러오는 중 오류가 발생했습니다.' }, { status: 500 })
    }

    if (!course) {
      return NextResponse.json({ error: '강의를 찾을 수 없습니다.' }, { status: 404 })
    }

    const requestLocation = body.location ?? {}
    const latitude = normaliseNumber(
      requestLocation.latitude ?? requestLocation.lat ?? course.location_latitude,
      FALLBACK_LOCATION.latitude
    )
    const longitude = normaliseNumber(
      requestLocation.longitude ?? requestLocation.lng ?? course.location_longitude,
      FALLBACK_LOCATION.longitude
    )
    const requestedRadius = normaliseNumber(
      requestLocation.radius ?? course.location_radius,
      FALLBACK_LOCATION.radius
    )
    const radius = Math.max(10, Math.min(50, requestedRadius))

    const now = new Date()
    const createdAtIso = now.toISOString()
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000)
    const expiresAtIso = expiresAt.toISOString()
    const sessionId = randomUUID()

    const baseUrl = request.nextUrl.origin
    const qrPayload = {
      sessionId,
      courseId: course.id,
      expiresAt: expiresAtIso,
      type: 'attendance' as const,
      baseUrl
    }

    const sessionInsert = {
      id: sessionId,
      course_id: course.id,
      date: createdAtIso.split('T')[0],
      status: 'active',
      qr_code: JSON.stringify(qrPayload),
      qr_code_expires_at: expiresAtIso,
      classroom_latitude: latitude,
      classroom_longitude: longitude,
      classroom_radius: radius
    }

    const { error: insertError } = await supabase
      .from('class_sessions')
      .insert(sessionInsert)

    if (insertError) {
      console.error('[Session Create] 세션 생성 실패:', insertError)
      return NextResponse.json({ error: '세션 생성에 실패했습니다.' }, { status: 500 })
    }

    const responseSession = {
      id: sessionId,
      courseId: course.id,
      courseName: course.name,
      courseCode: course.course_code,
      location: {
        lat: latitude,
        lng: longitude,
        radius,
        address: requestLocation.address ?? (typeof course.location === 'string' ? course.location : FALLBACK_LOCATION.address)
      },
      qrCode: JSON.stringify(qrPayload),
      qrCodeExpiresAt: expiresAtIso,
      expiresAt: expiresAtIso,
      isActive: true,
      createdAt: createdAtIso
    }

    console.log('[Session Create] 세션 생성 완료:', {
      sessionId,
      courseId: course.id,
      expiresAt: expiresAtIso
    })

    return NextResponse.json({ success: true, session: responseSession })
  } catch (error) {
    console.error('Session creation error:', error)
    return NextResponse.json({ error: '세션 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
