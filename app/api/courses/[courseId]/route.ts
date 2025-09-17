/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'

// GET - 특정 강의 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const supabase: any = createClient()
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'professor') {
      return NextResponse.json({ error: 'Only professors can view course details' }, { status: 403 })
    }

    const { data: courseData, error } = await supabase
      .from('courses')
      .select(
        `id, name, course_code, classroom_location, schedule, created_at,
         class_sessions ( id, date, status, attendances ( id, student_id, status ) )`
      )
      .eq('id', params.courseId)
      .eq('professor_id', user.userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 })
      }
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch course' }, { status: 500 })
    }

    const course = courseData as any
    const classroomLocation =
      course?.classroom_location && typeof course.classroom_location === 'object'
        ? course.classroom_location
        : null

    const formattedCourse = {
      id: course.id,
      name: course.name,
      courseCode: course.course_code,
      description: null,
      schedule: Array.isArray(course.schedule)
        ? course.schedule
            .map((item: any) =>
              typeof item === 'object' && item
                ? `${['일', '월', '화', '수', '목', '금', '토'][item.day_of_week]} ${item.start_time}-${item.end_time}`
                : null
            )
            .filter(Boolean)
            .join(', ')
        : null,
      location: classroomLocation?.displayName || '위치 정보 없음',
      locationLatitude: classroomLocation?.latitude ?? null,
      locationLongitude: classroomLocation?.longitude ?? null,
      locationRadius: classroomLocation?.radius ?? 100,
      createdAt: course.created_at,
      sessions: Array.isArray(course.class_sessions)
        ? course.class_sessions.map((session: any) => {
            const attendances = Array.isArray(session.attendances) ? session.attendances : []
            const present = attendances.filter((a: any) => a.status === 'present').length
            return {
              id: session.id,
              date: session.date,
              startTime: null,
              endTime: null,
              isActive: session.status === 'active',
              attendanceCount: attendances.length,
              presentCount: present,
            }
          })
        : [],
    }

    return NextResponse.json({
      success: true,
      course: formattedCourse,
    })
  } catch (error) {
    console.error('Get course error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - 강의 정보 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const supabase: any = createClient()
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'professor') {
      return NextResponse.json({ error: 'Only professors can edit courses' }, { status: 403 })
    }

    const body = await request.json()
    const { name, courseCode, schedule, location, locationLatitude, locationLongitude, locationRadius } = body

    if (!name || !courseCode) {
      return NextResponse.json({ error: 'Course name and code are required' }, { status: 400 })
    }

    const { error: checkError } = await supabase
      .from('courses')
      .select('id')
      .eq('id', params.courseId)
      .eq('professor_id', user.userId)
      .single()

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 })
      }
      console.error('Check course error:', checkError)
      return NextResponse.json({ error: 'Failed to validate course' }, { status: 500 })
    }

    if (courseCode) {
      const { data: conflictCourse, error: conflictError } = await supabase
        .from('courses')
        .select('id')
        .eq('professor_id', user.userId)
        .eq('course_code', courseCode)
        .neq('id', params.courseId)
        .single()

      if (conflictError && conflictError.code !== 'PGRST116') {
        console.error('Check conflict error:', conflictError)
        return NextResponse.json({ error: 'Failed to validate course code' }, { status: 500 })
      }

      if (conflictCourse) {
        return NextResponse.json({ error: 'Course code already exists' }, { status: 409 })
      }
    }

    const classroomLocation =
      locationLatitude != null && locationLongitude != null
        ? {
            latitude: Number(locationLatitude),
            longitude: Number(locationLongitude),
            radius: Number(locationRadius) || 100,
            displayName: location || '설정된 위치',
          }
        : null

    const normalizedSchedule = Array.isArray(schedule) && schedule.length > 0 ? schedule : [
      {
        day_of_week: 2,
        start_time: '09:00',
        end_time: '10:30',
      },
    ]

    const { data: updatedCourse, error: updateError } = await supabase
      .from('courses')
      .update({
        name,
        course_code: courseCode,
        classroom_location: classroomLocation,
        schedule: normalizedSchedule,
      } as any)
      .eq('id', params.courseId)
      .eq('professor_id', user.userId)
      .select()
      .single()

    if (updateError) {
      console.error('Update course error:', updateError)
      return NextResponse.json({ error: 'Failed to update course' }, { status: 500 })
    }

    const updated = updatedCourse as any
    const updatedLocation =
      updated?.classroom_location && typeof updated.classroom_location === 'object'
        ? updated.classroom_location
        : null

    return NextResponse.json({
      success: true,
      course: {
        id: updated.id,
        name: updated.name,
        courseCode: updated.course_code,
        description: null,
        schedule: Array.isArray(updated.schedule)
          ? updated.schedule
              .map((item: any) =>
                typeof item === 'object' && item
                  ? `${['일', '월', '화', '수', '목', '금', '토'][item.day_of_week]} ${item.start_time}-${item.end_time}`
                  : null
              )
              .filter(Boolean)
              .join(', ')
          : null,
        location: updatedLocation?.displayName || '설정된 위치',
        locationLatitude: updatedLocation?.latitude ?? null,
        locationLongitude: updatedLocation?.longitude ?? null,
        locationRadius: updatedLocation?.radius ?? 100,
      },
    })
  } catch (error) {
    console.error('Update course error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - 강의 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const supabase: any = createClient()
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'professor') {
      return NextResponse.json({ error: 'Only professors can delete courses' }, { status: 403 })
    }

    const { data: existingCourse, error: checkError } = await supabase
      .from('courses')
      .select('id, name')
      .eq('id', params.courseId)
      .eq('professor_id', user.userId)
      .single()

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 })
      }
      console.error('Check course error:', checkError)
      return NextResponse.json({ error: 'Failed to validate course' }, { status: 500 })
    }

    const { error: deleteError } = await supabase
      .from('courses')
      .delete()
      .eq('id', params.courseId)
      .eq('professor_id', user.userId)

    if (deleteError) {
      console.error('Delete course error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete course' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Course "${existingCourse?.name ?? params.courseId}" has been deleted successfully`,
    })
  } catch (error) {
    console.error('Delete course error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
