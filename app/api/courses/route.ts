import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-admin'
import { getCurrentUserFromRequest } from '@/lib/auth'
import {
  hasAdvancedCourseLocationColumns,
  hasCourseDescriptionColumn,
  hasCourseScheduleColumn
} from '@/lib/courses/schemaSupport'
import type { SupabaseCourseRow } from '@/lib/session/types'
import type { Database } from '@/types/supabase'

interface CourseResponseItem {
  id: string
  name: string
  courseCode: string
  description?: string | null
  location?: string | null
  totalSessions: number
  locationLatitude?: number | null
  locationLongitude?: number | null
  locationRadius?: number | null
}

type RawCourseRow = SupabaseCourseRow & {
  class_sessions?: { count: number }[]
}

interface SchemaSupportFlags {
  advancedLocation: boolean
  description: boolean
  schedule: boolean
}

function mapCourseResponse(
  course: RawCourseRow,
  support: SchemaSupportFlags
): CourseResponseItem {
  const sessionCount = Array.isArray(course.class_sessions) && course.class_sessions.length > 0
    ? course.class_sessions[0]?.count ?? 0
    : 0

  const classroomLocation = (course.classroom_location ?? null) as
    | null
    | {
        displayName?: string
        latitude?: number
        longitude?: number
        radius?: number
      }

  const locationName = support.advancedLocation
    ? course.location ?? null
    : typeof classroomLocation?.displayName === 'string'
      ? classroomLocation.displayName
      : null

  const latitude = support.advancedLocation
    ? course.location_latitude ?? null
    : typeof classroomLocation?.latitude === 'number'
      ? classroomLocation.latitude
      : null

  const longitude = support.advancedLocation
    ? course.location_longitude ?? null
    : typeof classroomLocation?.longitude === 'number'
      ? classroomLocation.longitude
      : null

  const radius = support.advancedLocation
    ? course.location_radius ?? null
    : typeof classroomLocation?.radius === 'number'
      ? classroomLocation.radius
      : null

  return {
    id: course.id,
    name: course.name,
    courseCode: course.course_code,
    description: support.description ? course.description ?? null : null,
    location: locationName,
    totalSessions: sessionCount,
    locationLatitude: latitude,
    locationLongitude: longitude,
    locationRadius: radius
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    if (user.userType !== 'professor') {
      return NextResponse.json({ error: '교수만 강의 목록을 조회할 수 있습니다.' }, { status: 403 })
    }

    const supabase = createServiceClient()

    const [advancedLocation, descriptionSupport, scheduleSupport] = await Promise.all([
      hasAdvancedCourseLocationColumns(supabase),
      hasCourseDescriptionColumn(supabase),
      hasCourseScheduleColumn(supabase)
    ])

    const baseColumns = ['id', 'name', 'course_code', 'classroom_location', 'created_at']

    if (scheduleSupport) {
      baseColumns.push('schedule')
    }

    if (advancedLocation) {
      baseColumns.push('location', 'location_latitude', 'location_longitude', 'location_radius')
    }

    if (descriptionSupport) {
      baseColumns.push('description')
    }

    const selectClause = `${baseColumns.join(', ')}, class_sessions(count)`

    const { data, error } = await supabase
      .from('courses')
      .select(selectClause)
      .eq('professor_id', user.userId)
      .order('created_at', { ascending: false })


    if (error) {
      console.error('Courses fetch error:', error)
      return NextResponse.json({ error: '강의 목록을 불러오는데 실패했습니다.' }, { status: 500 })
    }

    const rawCourses = (data ?? []) as unknown as RawCourseRow[]

    const courses: CourseResponseItem[] = rawCourses.map((course) =>
      mapCourseResponse(course, {
        advancedLocation,
        description: descriptionSupport,
        schedule: scheduleSupport
      })
    )

    return NextResponse.json({ success: true, courses })
  } catch (error) {
    console.error('Courses fetch error:', error)
    return NextResponse.json({ error: '강의 목록을 불러오는데 실패했습니다.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    if (user.userType !== 'professor') {
      return NextResponse.json({ error: '교수만 강의를 생성할 수 있습니다.' }, { status: 403 })
    }

    const { name, courseCode, description, location } = await request.json()

    if (!name || !courseCode) {
      return NextResponse.json({ error: '강의명과 강의코드는 필수입니다.' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const [advancedLocation, descriptionSupport, scheduleSupport] = await Promise.all([
      hasAdvancedCourseLocationColumns(supabase),
      hasCourseDescriptionColumn(supabase),
      hasCourseScheduleColumn(supabase)
    ])

    const insertPayload: Database['public']['Tables']['courses']['Insert'] = {
      name,
      course_code: courseCode,
      professor_id: user.userId,
      schedule: [] as unknown as Database['public']['Tables']['courses']['Insert']['schedule'],
      classroom_location: location
        ? ({
            displayName: location,
            radius: 100
          } as Database['public']['Tables']['courses']['Insert']['classroom_location'])
        : null
    }

    if (!scheduleSupport) {
      delete (insertPayload as Record<string, unknown>).schedule
    }

    if (descriptionSupport) {
      insertPayload.description = description ?? null
    }

    if (advancedLocation) {
      insertPayload.location = location ?? null
      insertPayload.location_latitude = null
      insertPayload.location_longitude = null
      insertPayload.location_radius = location ? 100 : null
    }

    const baseColumns = ['id', 'name', 'course_code', 'classroom_location', 'created_at']

    if (scheduleSupport) {
      baseColumns.push('schedule')
    }

    if (advancedLocation) {
      baseColumns.push('location', 'location_latitude', 'location_longitude', 'location_radius')
    }

    if (descriptionSupport) {
      baseColumns.push('description')
    }

    const selectClause = baseColumns.join(', ')

    const { data, error } = await supabase
      .from('courses')
      .insert(insertPayload)
      .select(selectClause)
      .single<SupabaseCourseRow>()

    if (error || !data) {
      console.error('Course creation error:', error)
      return NextResponse.json({ error: '강의 생성에 실패했습니다.' }, { status: 500 })
    }

    const course = mapCourseResponse(
      data as RawCourseRow,
      {
        advancedLocation,
        description: descriptionSupport,
        schedule: scheduleSupport
      }
    )
    course.totalSessions = 0

    return NextResponse.json({ success: true, course })
  } catch (error) {
    console.error('Course creation error:', error)
    return NextResponse.json({ error: '강의 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
