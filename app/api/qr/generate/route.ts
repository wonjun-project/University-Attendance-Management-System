import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import {
  hasAdvancedCourseLocationColumns,
  hasCourseDescriptionColumn,
  hasCourseScheduleColumn
} from '@/lib/courses/schemaSupport'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type LocationType = 'predefined' | 'current'

interface QRGenerateRequest {
  courseId: string
  expiresInMinutes?: number
  classroomLocation: {
    latitude?: number | string | null
    longitude?: number | string | null
    radius?: number | string | null
    locationType?: LocationType
    predefinedLocationId?: string | null
    displayName?: string | null
  }
}

interface NormalizedLocation {
  latitude: number
  longitude: number
  radius: number
  displayName?: string
  locationType: LocationType
  predefinedLocationId: string | null
}

const MIN_ALLOWED_RADIUS = 100
const MAX_ALLOWED_RADIUS = 500

interface ResolvedCourse {
  id: string
  name: string
  courseCode: string
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function buildBaseUrl(request: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_BASE_URL
  if (env) {
    return env.replace(/\/$/, '')
  }

  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, '')
  }

  const origin = request.nextUrl?.origin
  if (origin) {
    return origin.replace(/\/$/, '')
  }

  return 'http://localhost:3000'
}

async function resolvePredefinedLocation(
  supabase: SupabaseClient<Database>,
  predefinedLocationId: string,
  locationType: LocationType
) {
  const { data, error } = await supabase
    .from('predefined_locations')
    .select('id, latitude, longitude, radius, display_name, is_active')
    .eq('id', predefinedLocationId)
    .maybeSingle<Database['public']['Tables']['predefined_locations']['Row']>()

  if (error) {
    console.warn('⚠️ Failed to resolve predefined location:', error)
    return null
  }

  if (!data || data.is_active === false) {
    return null
  }

  const lat = toNumber(data.latitude)
  const lon = toNumber(data.longitude)
  const rad = toNumber(data.radius)

  if (lat === null || lon === null) {
    return null
  }

  const normalizedRadius = Math.min(
    MAX_ALLOWED_RADIUS,
    Math.max(MIN_ALLOWED_RADIUS, Math.round(rad ?? MIN_ALLOWED_RADIUS))
  )

  return {
    latitude: lat,
    longitude: lon,
    radius: normalizedRadius,
    displayName: data.display_name ?? undefined,
    locationType,
    predefinedLocationId
  } satisfies NormalizedLocation
}

async function resolveCourse(
  supabase: SupabaseClient<Database>,
  courseId: string,
  professorId: string,
  location: NormalizedLocation
): Promise<ResolvedCourse> {
  const supportsAdvancedLocation = await hasAdvancedCourseLocationColumns(supabase)

  if (courseId.startsWith('demo-course-')) {
    const { data: demoCandidates, error: demoLookupError } = await supabase
      .from('courses')
      .select('id, name, course_code, created_at')
      .eq('professor_id', professorId)
      .eq('course_code', 'DEMO101')
      .order('created_at', { ascending: false })
      .limit(1)

    const existingDemo = Array.isArray(demoCandidates) ? demoCandidates[0] : demoCandidates ?? null

    if (demoLookupError) {
      console.warn('Demo course lookup failed:', demoLookupError)
    }

    if (existingDemo) {
      const updatePayload: Database['public']['Tables']['courses']['Update'] = {}

      if (supportsAdvancedLocation) {
        updatePayload.location = location.displayName ?? '임시 강의실'
        updatePayload.location_latitude = location.latitude
        updatePayload.location_longitude = location.longitude
        updatePayload.location_radius = location.radius
      } else {
        updatePayload.classroom_location = {
          latitude: location.latitude,
          longitude: location.longitude,
          radius: location.radius,
          displayName: location.displayName ?? '임시 강의실',
          locationType: location.locationType,
          predefinedLocationId: location.predefinedLocationId
        } as unknown as Database['public']['Tables']['courses']['Update']['classroom_location']
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error: updateError } = await supabase
          .from('courses')
          .update(updatePayload)
          .eq('id', existingDemo.id)

        if (updateError) {
          console.warn('Demo course update failed:', updateError)
        }
      }

      return {
        id: existingDemo.id,
        name: existingDemo.name ?? '데모 강의',
        courseCode: existingDemo.course_code ?? 'DEMO101'
      }
    }

    const [supportsScheduleColumn, supportsDescriptionColumn] = await Promise.all([
      hasCourseScheduleColumn(supabase),
      hasCourseDescriptionColumn(supabase)
    ])

    const insertPayload: Database['public']['Tables']['courses']['Insert'] = {
      name: '데모 강의',
      course_code: 'DEMO101',
      professor_id: professorId,
      schedule: [] as unknown as Database['public']['Tables']['courses']['Insert']['schedule'],
      classroom_location: {
        latitude: location.latitude,
        longitude: location.longitude,
        radius: location.radius,
        displayName: location.displayName ?? '임시 강의실',
        locationType: location.locationType,
        predefinedLocationId: location.predefinedLocationId
      } as Database['public']['Tables']['courses']['Insert']['classroom_location']
    }

    if (!supportsScheduleColumn) {
      delete (insertPayload as Record<string, unknown>).schedule
    }

    if (supportsDescriptionColumn) {
      insertPayload.description = 'QR 테스트용 데모 강의'
    }

    if (supportsAdvancedLocation) {
      insertPayload.location = location.displayName ?? '임시 강의실'
      insertPayload.location_latitude = location.latitude
      insertPayload.location_longitude = location.longitude
      insertPayload.location_radius = location.radius
    }

    const { data: insertedDemo, error: demoInsertError } = await supabase
      .from('courses')
      .insert(insertPayload)
      .select('id, name, course_code')
      .single<Pick<Database['public']['Tables']['courses']['Row'], 'id' | 'name' | 'course_code'>>()

    if (demoInsertError || !insertedDemo) {
      throw new Error(demoInsertError?.message || 'Failed to create demo course')
    }

    return {
      id: insertedDemo.id,
      name: insertedDemo.name,
      courseCode: insertedDemo.course_code
    }
  }

  const { data: course, error } = await supabase
    .from('courses')
    .select('id, name, course_code')
    .eq('id', courseId)
    .eq('professor_id', professorId)
    .maybeSingle<Pick<Database['public']['Tables']['courses']['Row'], 'id' | 'name' | 'course_code'>>()

  if (error) {
    throw new Error(error.message)
  }

  if (!course) {
    throw new Error('Course not found or access denied')
  }

  return {
    id: course.id,
    name: course.name,
    courseCode: course.course_code
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user || user.userType !== 'professor') {
      return NextResponse.json({ error: 'Unauthorized. Professor access required.' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const payload: QRGenerateRequest = await request.json()
    const { courseId, expiresInMinutes = 30, classroomLocation } = payload

    if (!courseId || !classroomLocation) {
      return NextResponse.json({ error: 'Missing required fields: courseId, classroomLocation' }, { status: 400 })
    }

    const locationType: LocationType = classroomLocation.locationType === 'current' ? 'current' : 'predefined'

    let normalizedLocation: NormalizedLocation | null = null

    if (locationType === 'predefined' && classroomLocation.predefinedLocationId) {
      normalizedLocation = await resolvePredefinedLocation(supabase, classroomLocation.predefinedLocationId, locationType)
    }

    const fallbackLat = toNumber(classroomLocation.latitude)
    const fallbackLon = toNumber(classroomLocation.longitude)
    const fallbackRadius = toNumber(classroomLocation.radius)

    if (!normalizedLocation) {
      if (fallbackLat === null || fallbackLon === null) {
        return NextResponse.json({ error: 'Invalid classroom location. latitude/longitude are required.' }, { status: 400 })
      }

      const normalizedRadius = Math.min(
        MAX_ALLOWED_RADIUS,
        Math.max(MIN_ALLOWED_RADIUS, Math.round(fallbackRadius ?? MIN_ALLOWED_RADIUS))
      )

      normalizedLocation = {
        latitude: fallbackLat,
        longitude: fallbackLon,
        radius: normalizedRadius,
        displayName: classroomLocation.displayName ?? undefined,
        locationType,
        predefinedLocationId: classroomLocation.predefinedLocationId ?? null
      }
    }

    const resolvedCourse = await resolveCourse(supabase, courseId, user.userId, normalizedLocation)

    const now = new Date()
    const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000)

    // UUID를 미리 생성하여 안전하게 처리
    const sessionId = crypto.randomUUID()

    const sessionData = {
      id: sessionId,  // ID를 명시적으로 설정
      course_id: resolvedCourse.id,
      status: 'active',
      date: now.toISOString().split('T')[0],
      qr_code: 'placeholder',
      qr_code_expires_at: expiresAt.toISOString(),
      classroom_latitude: normalizedLocation.latitude,
      classroom_longitude: normalizedLocation.longitude,
      classroom_radius: normalizedLocation.radius
    }

    console.log('📦 [QR Generate] 세션 생성 데이터:', {
      id: sessionData.id,
      courseId: sessionData.course_id,
      status: sessionData.status
    })

    const { error: sessionInsertError } = await supabase
      .from('class_sessions')
      .insert(sessionData)

    if (sessionInsertError) {
      console.error('❌ [QR Generate] 세션 저장 실패:', sessionInsertError)
      return NextResponse.json({ error: 'Failed to create session: ' + (sessionInsertError?.message ?? 'Unknown error') }, { status: 500 })
    }
    console.log('✅ [QR Generate] 세션 생성 성공:', {
      sessionId,
      sessionIdType: typeof sessionId,
      sessionIdLength: sessionId.length
    })

    // 세션이 정말로 저장되었는지 즉시 확인
    const { data: verifySession, error: verifyError } = await supabase
      .from('class_sessions')
      .select('id, status, qr_code')
      .eq('id', sessionId)
      .single()

    if (verifyError || !verifySession) {
      console.error('⚠️ [QR Generate] 세션 검증 실패:', {
        sessionId,
        error: verifyError,
        found: !!verifySession
      })
    } else {
      console.log('✔️ [QR Generate] 세션 검증 성공:', {
        id: verifySession.id,
        status: verifySession.status,
        qrCodeLength: verifySession.qr_code?.length
      })
    }

    const baseUrl = buildBaseUrl(request)

    // QR 데이터 객체 생성 (JSON 형태)
    const qrDataObject = {
      sessionId: sessionId,  // 이제 확실히 존재함
      courseId: resolvedCourse.id,
      expiresAt: expiresAt.toISOString(),
      type: 'attendance' as const,
      baseUrl
    }

    console.log('🎯 [QR Generate] QR 데이터 객체:', {
      sessionId: qrDataObject.sessionId,
      sessionIdValid: sessionId && sessionId.length === 36  // UUID 길이 확인
    })

    // JSON 문자열로 변환하여 DB에 저장
    const qrCodeString = JSON.stringify(qrDataObject)
    console.log('📋 [QR Generate] DB에 저장할 QR 문자열:', qrCodeString.substring(0, 150) + '...')

    const { error: updateError } = await supabase
      .from('class_sessions')
      .update({ qr_code: qrCodeString })
      .eq('id', sessionId)

    if (updateError) {
      console.error('❌ [QR Generate] QR 코드 업데이트 실패:', updateError)
    } else {
      console.log('✔️ [QR Generate] QR 코드 DB 업데이트 성공')
    }

    const response = {
      success: true,
      qrData: qrDataObject,
      qrCode: qrCodeString,  // 이제 JSON 문자열
      expiresAt: expiresAt.toISOString(),
      courseName: resolvedCourse.name,
      courseCode: resolvedCourse.courseCode,
      classroomLocation: normalizedLocation
    }

    console.log('🚀 [QR Generate] API 응답:', {
      sessionId: response.qrData.sessionId,
      qrDataSessionId: qrDataObject.sessionId,
      success: response.success
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('QR generation error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error during QR generation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
