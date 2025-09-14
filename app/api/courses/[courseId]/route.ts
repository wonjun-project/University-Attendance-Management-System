import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

// GET - 특정 강의 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    // Create supabase client inside the function to avoid build-time errors
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'professor') {
      return NextResponse.json({ error: 'Only professors can view course details' }, { status: 403 })
    }

    const { data: course, error } = await supabase
      .from('courses')
      .select(`
        id,
        name,
        course_code,
        classroom_location,
        schedule,
        created_at,
        class_sessions (
          id,
          date,
          status,
          attendances (
            id,
            student_id,
            status,
            students (
              name
            )
          )
        )
      `)
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

    // Format the course data
    const formattedCourse = {
      id: course.id,
      name: course.name,
      courseCode: course.course_code,
      description: null, // No description in current schema
      schedule: Array.isArray(course.schedule) ? course.schedule.map((s: any) => 
        `${['일','월','화','수','목','금','토'][s.day_of_week]} ${s.start_time}-${s.end_time}`
      ).join(', ') : null,
      location: course.classroom_location?.displayName || '위치 정보 없음',
      locationLatitude: course.classroom_location?.latitude || null,
      locationLongitude: course.classroom_location?.longitude || null,
      locationRadius: course.classroom_location?.radius || 50,
      createdAt: course.created_at,
      sessions: course.class_sessions?.map(session => ({
        id: session.id,
        date: session.date,
        startTime: null,
        endTime: null,
        isActive: session.status === 'active',
        attendanceCount: session.attendances?.length || 0,
        presentCount: session.attendances?.filter(a => a.status === 'present').length || 0
      })) || []
    }

    return NextResponse.json({
      success: true,
      course: formattedCourse
    })

  } catch (error: any) {
    console.error('Get course error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// PUT - 강의 정보 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    // Create supabase client inside the function to avoid build-time errors
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'professor') {
      return NextResponse.json({ error: 'Only professors can edit courses' }, { status: 403 })
    }

    const body = await request.json()
    const { name, courseCode, schedule, location, locationLatitude, locationLongitude, locationRadius } = body

    // Validate required fields
    if (!name || !courseCode) {
      return NextResponse.json({ 
        error: 'Course name and code are required' 
      }, { status: 400 })
    }

    // Check if course exists and belongs to this professor
    const { data: existingCourse, error: checkError } = await supabase
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

    // Check if new course code conflicts with existing courses (excluding current course)
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
        return NextResponse.json({ 
          error: 'Course code already exists' 
        }, { status: 409 })
      }
    }

    // Update course
    const { data: updatedCourse, error: updateError } = await supabase
      .from('courses')
      .update({
        name,
        course_code: courseCode,
        classroom_location: locationLatitude && locationLongitude ? {
          latitude: locationLatitude,
          longitude: locationLongitude,
          radius: locationRadius || 50,
          displayName: location || '설정된 위치'
        } : null,
        schedule: schedule ? [{
          day_of_week: 2, // Default Tuesday
          start_time: '09:00',
          end_time: '10:30'
        }] : [{
          day_of_week: 2, // Default Tuesday
          start_time: '09:00',
          end_time: '10:30'
        }]
      })
      .eq('id', params.courseId)
      .eq('professor_id', user.userId)
      .select()
      .single()

    if (updateError) {
      console.error('Update course error:', updateError)
      return NextResponse.json({ error: 'Failed to update course' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      course: {
        id: updatedCourse.id,
        name: updatedCourse.name,
        courseCode: updatedCourse.course_code,
        description: null, // No description in current schema
        schedule: Array.isArray(updatedCourse.schedule) ? updatedCourse.schedule.map((s: { day_of_week: number; start_time: string; end_time: string }) => 
          `${['일','월','화','수','목','금','토'][s.day_of_week]} ${s.start_time}-${s.end_time}`
        ).join(', ') : null,
        location: updatedCourse.classroom_location?.displayName || '설정된 위치',
        locationLatitude: updatedCourse.classroom_location?.latitude || null,
        locationLongitude: updatedCourse.classroom_location?.longitude || null,
        locationRadius: updatedCourse.classroom_location?.radius || 50
      }
    })

  } catch (error: any) {
    console.error('Update course error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// DELETE - 강의 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    // Create supabase client inside the function to avoid build-time errors
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'professor') {
      return NextResponse.json({ error: 'Only professors can delete courses' }, { status: 403 })
    }

    // Check if course exists and belongs to this professor
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

    // Delete course (cascade will handle related records)
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
      message: `Course "${existingCourse.name}" has been deleted successfully`
    })

  } catch (error: any) {
    console.error('Delete course error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}