import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-admin'
import type { Database } from '@/types/supabase'

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
    const user = await getCurrentUser()
    if (!user || user.userType !== 'professor') {
      return NextResponse.json({ error: '교수 계정으로 로그인해야 합니다.' }, { status: 401 })
    }

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
    const requestLocation = body.location ?? {}

    // ensure professor profile exists (fallback for seed 환경)
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', user.userId)
      .maybeSingle()

    if (!existingProfile) {
      const placeholderEmail = `${user.userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}@example.com`
      const insertProfile = await supabase
        .from('user_profiles')
        .insert({
          id: user.userId,
          email: placeholderEmail,
          name: user.name ?? '교수',
          role: 'professor'
        })
        .select('id')
        .maybeSingle()

      if (insertProfile.error) {
        console.error('[Session Create] 교수 프로필 생성 실패:', insertProfile.error)
      }
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(courseId)
    let course = null as
      | {
          id: string
          name: string
          course_code: string
          location?: string | null
          location_latitude?: number | null
          location_longitude?: number | null
          location_radius?: number | null
        }
      | null

    if (isUuid) {
      const { data: existingCourse, error: courseError } = await supabase
        .from('courses')
        .select('id, name, course_code, location, location_latitude, location_longitude, location_radius, professor_id')
        .eq('id', courseId)
        .maybeSingle()

      if (courseError) {
        console.error('[Session Create] 강의 조회 실패:', courseError)
        console.error('[Session Create] 강의 조회 상세 오류:', {
          courseId,
          error: courseError.message,
          details: courseError.details
        })
      } else if (existingCourse && (!existingCourse.professor_id || existingCourse.professor_id === user.userId)) {
        course = existingCourse
      }
    }

    if (!course) {
      const { data: professorCourse, error: professorCourseError } = await supabase
        .from('courses')
        .select('id, name, course_code, location, location_latitude, location_longitude, location_radius')
        .eq('professor_id', user.userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (professorCourseError) {
        console.error('[Session Create] 담당 강의 조회 실패:', professorCourseError)
      } else {
        course = professorCourse
      }
    }

    if (!course) {
      const { data: fallbackCourse, error: fallbackCourseError } = await supabase
        .from('courses')
        .select('id, name, course_code, location, location_latitude, location_longitude, location_radius')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (fallbackCourseError) {
        console.error('[Session Create] 전체 강의 조회 실패:', fallbackCourseError)
      } else {
        course = fallbackCourse
      }
    }

    if (!course) {
      const newCourseId = randomUUID()
      const fallbackName = courseId.startsWith('demo-course') ? '데모 강의' : '임시 강의'
      const fallbackCode = courseId.startsWith('demo-course') ? 'DEMO101' : `TEMP-${newCourseId.slice(0, 4).toUpperCase()}`
      const fallbackLatitude = normaliseNumber(requestLocation.latitude ?? requestLocation.lat, FALLBACK_LOCATION.latitude)
      const fallbackLongitude = normaliseNumber(requestLocation.longitude ?? requestLocation.lng, FALLBACK_LOCATION.longitude)
      const fallbackRadius = normaliseNumber(requestLocation.radius, FALLBACK_LOCATION.radius)

      const classroomLocation = {
        latitude: fallbackLatitude,
        longitude: fallbackLongitude,
        radius: fallbackRadius,
        address: requestLocation.address ?? FALLBACK_LOCATION.address
      }

      const { data: insertedCourse, error: insertCourseError } = await supabase
        .from('courses')
        .insert({
          id: newCourseId,
          name: fallbackName,
          course_code: fallbackCode,
          professor_id: user.userId,
          classroom_location: classroomLocation as unknown as Database['public']['Tables']['courses']['Insert']['classroom_location'], // 필수 JSONB 필드
          schedule: [] as unknown as Database['public']['Tables']['courses']['Insert']['schedule'], // 빈 스케줄 배열
          location: classroomLocation.address,
          location_latitude: classroomLocation.latitude,
          location_longitude: classroomLocation.longitude,
          location_radius: classroomLocation.radius
        })
        .select('id, name, course_code, location, location_latitude, location_longitude, location_radius')
        .single()

      if (insertCourseError || !insertedCourse) {
        console.error('[Session Create] 임시 강의 생성 실패:', insertCourseError)
        console.error('[Session Create] 상세 오류:', {
          error: insertCourseError?.message,
          details: insertCourseError?.details,
          hint: insertCourseError?.hint,
          code: insertCourseError?.code
        })
        return NextResponse.json({
          error: '강의를 찾을 수 없습니다. 관리자에게 문의하세요.',
          details: insertCourseError?.message || '알 수 없는 오류'
        }, { status: 404 })
      }

      course = insertedCourse
      console.log('[Session Create] Fallback 교수용 강의 생성:', { id: course.id, name: course.name })
    }

    const fallbackLatitude = normaliseNumber(
      requestLocation.latitude ?? requestLocation.lat ?? course.location_latitude,
      course.location_latitude ?? FALLBACK_LOCATION.latitude
    )
    const fallbackLongitude = normaliseNumber(
      requestLocation.longitude ?? requestLocation.lng ?? course.location_longitude,
      course.location_longitude ?? FALLBACK_LOCATION.longitude
    )
    const fallbackRadius = normaliseNumber(
      requestLocation.radius ?? course.location_radius,
      course.location_radius ?? FALLBACK_LOCATION.radius
    )

    const latitude = normaliseNumber(
      requestLocation.latitude ?? requestLocation.lat ?? course.location_latitude ?? fallbackLatitude,
      course.location_latitude ?? fallbackLatitude
    )
    const longitude = normaliseNumber(
      requestLocation.longitude ?? requestLocation.lng ?? course.location_longitude ?? fallbackLongitude,
      course.location_longitude ?? fallbackLongitude
    )
    const requestedRadius = normaliseNumber(
      requestLocation.radius ?? course.location_radius ?? fallbackRadius,
      course.location_radius ?? fallbackRadius
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
