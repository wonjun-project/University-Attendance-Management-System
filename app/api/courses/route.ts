import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-admin'
import { getCurrentUserFromRequest } from '@/lib/auth'
import type { SupabaseCourseRow } from '@/lib/session/types'

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
    type CourseWithSessionAggregate = SupabaseCourseRow & {
      class_sessions: { count: number }[]
    }

    const { data, error } = await supabase
      .from('courses')
      .select('id, name, course_code, description, location, location_latitude, location_longitude, location_radius, class_sessions(count)')
      .eq('professor_id', user.userId)
      .order('created_at', { ascending: false })


    if (error) {
      console.error('Courses fetch error:', error)
      return NextResponse.json({ error: '강의 목록을 불러오는데 실패했습니다.' }, { status: 500 })
    }

    const rawCourses = (data ?? []) as CourseWithSessionAggregate[]

    const courses: CourseResponseItem[] = rawCourses.map((course) => {
      const sessionCount = Array.isArray(course.class_sessions) && course.class_sessions.length > 0
        ? course.class_sessions[0]?.count ?? 0
        : 0

      return {
        id: course.id,
        name: course.name,
        courseCode: course.course_code,
        description: course.description,
        location: course.location,
        totalSessions: sessionCount,
        locationLatitude: course.location_latitude,
        locationLongitude: course.location_longitude,
        locationRadius: course.location_radius
      }
    })

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

    const { data, error } = await supabase
      .from('courses')
      .insert({
        name,
        course_code: courseCode,
        description: description ?? null,
        location: location ?? null,
        location_latitude: null,
        location_longitude: null,
        location_radius: location ? 100 : null,
        professor_id: user.userId
      })
      .select('id, name, course_code, description, location, location_latitude, location_longitude, location_radius')
      .single<SupabaseCourseRow>()

    if (error || !data) {
      console.error('Course creation error:', error)
      return NextResponse.json({ error: '강의 생성에 실패했습니다.' }, { status: 500 })
    }

    const insertedCourse = data as SupabaseCourseRow

    const course: CourseResponseItem = {
      id: insertedCourse.id,
      name: insertedCourse.name,
      courseCode: insertedCourse.course_code,
      description: insertedCourse.description,
      location: insertedCourse.location,
      totalSessions: 0,
      locationLatitude: insertedCourse.location_latitude,
      locationLongitude: insertedCourse.location_longitude,
      locationRadius: insertedCourse.location_radius
    }

    return NextResponse.json({ success: true, course })
  } catch (error) {
    console.error('Course creation error:', error)
    return NextResponse.json({ error: '강의 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
