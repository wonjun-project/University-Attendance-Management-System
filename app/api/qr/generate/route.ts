import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

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

interface ResolvedCourse {
  id: string
  name: string
  courseCode: string
}

let cachedCourseLocationSupport: boolean | null = null

async function hasAdvancedCourseLocationColumns(supabase: SupabaseClient<Database>): Promise<boolean> {
  if (cachedCourseLocationSupport !== null) {
    return cachedCourseLocationSupport
  }

  const { error } = await supabase.from('courses').select('location_latitude').limit(1)

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('Courses table lacks advanced location columns, falling back to classroom_location JSON:', error.message)
    }
    cachedCourseLocationSupport = false
    return false
  }

  cachedCourseLocationSupport = true
  return true
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

function buildBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'
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

  return {
    latitude: lat,
    longitude: lon,
    radius: rad ?? 100,
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
    const { data: existingDemo, error: demoLookupError } = await supabase
      .from('courses')
      .select('id, name, course_code')
      .eq('professor_id', professorId)
      .eq('course_code', 'DEMO101')
      .maybeSingle<Pick<Database['public']['Tables']['courses']['Row'], 'id' | 'name' | 'course_code'>>()

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

    const insertPayload: Database['public']['Tables']['courses']['Insert'] = {
      name: '데모 강의',
      course_code: 'DEMO101',
      professor_id: professorId,
      description: 'QR 테스트용 데모 강의',
      schedule: null
    }

    if (supportsAdvancedLocation) {
      insertPayload.location = location.displayName ?? '임시 강의실'
      insertPayload.location_latitude = location.latitude
      insertPayload.location_longitude = location.longitude
      insertPayload.location_radius = location.radius
    } else {
      insertPayload.classroom_location = {
        latitude: location.latitude,
        longitude: location.longitude,
        radius: location.radius,
        displayName: location.displayName ?? '임시 강의실',
        locationType: location.locationType,
        predefinedLocationId: location.predefinedLocationId
      } as unknown as Database['public']['Tables']['courses']['Insert']['classroom_location']
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
    const fallbackRadius = toNumber(classroomLocation.radius) ?? 100

    if (!normalizedLocation) {
      if (fallbackLat === null || fallbackLon === null) {
        return NextResponse.json({ error: 'Invalid classroom location. latitude/longitude are required.' }, { status: 400 })
      }

      normalizedLocation = {
        latitude: fallbackLat,
        longitude: fallbackLon,
        radius: Math.max(10, Math.round(fallbackRadius)),
        displayName: classroomLocation.displayName ?? undefined,
        locationType,
        predefinedLocationId: classroomLocation.predefinedLocationId ?? null
      }
    }

    const resolvedCourse = await resolveCourse(supabase, courseId, user.userId, normalizedLocation)

    const now = new Date()
    const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000)

    const { data: sessionInsert, error: sessionInsertError } = await supabase
      .from('class_sessions')
      .insert({
        course_id: resolvedCourse.id,
        status: 'active',
        date: now.toISOString().split('T')[0],
        qr_code: 'placeholder',
        qr_code_expires_at: expiresAt.toISOString(),
        classroom_latitude: normalizedLocation.latitude,
        classroom_longitude: normalizedLocation.longitude,
        classroom_radius: normalizedLocation.radius
      })
      .select('id')
      .single()

    if (sessionInsertError || !sessionInsert) {
      console.error('세션 저장 실패:', sessionInsertError)
      return NextResponse.json({ error: 'Failed to create session: ' + (sessionInsertError?.message ?? 'Unknown error') }, { status: 500 })
    }

    const sessionId = sessionInsert.id

    const baseUrl = buildBaseUrl()
    const qrCodeString = `${baseUrl}/student/attendance/${sessionId}`

    const { error: updateError } = await supabase
      .from('class_sessions')
      .update({ qr_code: qrCodeString })
      .eq('id', sessionId)

    if (updateError) {
      console.warn('QR 코드 업데이트 실패:', updateError)
    }

    return NextResponse.json({
      success: true,
      qrData: {
        sessionId,
        courseId: resolvedCourse.id,
        expiresAt: expiresAt.toISOString(),
        type: 'attendance' as const
      },
      qrCode: qrCodeString,
      expiresAt: expiresAt.toISOString(),
      courseName: resolvedCourse.name,
      courseCode: resolvedCourse.courseCode,
      classroomLocation: normalizedLocation
    })
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
