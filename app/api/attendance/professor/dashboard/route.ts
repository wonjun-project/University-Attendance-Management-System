import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    // Get current user
    const user = getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'professor') {
      return NextResponse.json({ error: 'Only professors can view attendance dashboard' }, { status: 403 })
    }

    // Create supabase client inside the function to avoid build-time errors
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get professor's courses and active sessions
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select(`
        id,
        name,
        course_code,
        class_sessions (
          id,
          date,
          status,
          attendances (
            id,
            student_id,
            status,
            check_in_time,
            location_verified,
            students (
              student_id,
              name
            )
          )
        )
      `)
      .eq('professor_id', user.userId)
      .order('name')

    if (coursesError) {
      console.error('Database error:', coursesError)
      return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 })
    }

    // Get current active sessions
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    
    const { data: activeSessions, error: sessionsError } = await supabase
      .from('class_sessions')
      .select(`
        id,
        date,
        status,
        courses (
          id,
          name,
          course_code,
          schedule
        ),
        attendances (
          id,
          student_id,
          status,
          check_in_time,
          location_verified,
          students (
            student_id,
            name
          )
        )
      `)
      .eq('courses.professor_id', user.userId)
      .eq('date', today)
      .eq('status', 'active')

    if (sessionsError) {
      console.error('Active sessions error:', sessionsError)
    }

    // Format dashboard data
    const dashboard = {
      totalCourses: courses?.length || 0,
      activeSessionsCount: activeSessions?.length || 0,
      courses: courses?.map(course => ({
        id: course.id,
        name: course.name,
        courseCode: course.course_code,
        sessions: course.class_sessions?.map(session => ({
          id: session.id,
          date: session.date,
          startTime: null,
          endTime: null,
          isActive: session.status === 'active',
          attendance: {
            total: session.attendances?.length || 0,
            present: session.attendances?.filter(a => a.status === 'present').length || 0,
            late: session.attendances?.filter(a => a.status === 'late').length || 0,
            absent: session.attendances?.filter(a => a.status === 'absent').length || 0,
            students: session.attendances?.map(att => ({
              studentId: att.students?.student_id,
              name: att.students?.name,
              status: att.status,
              checkInTime: att.check_in_time,
              locationVerified: att.location_verified
            })) || []
          }
        })) || []
      })) || [],
      activeSessions: activeSessions?.map(session => {
        const course = session.courses as any
        const schedule = course?.schedule
        let startTime = null
        let endTime = null
        
        // Extract time from course schedule
        if (Array.isArray(schedule) && schedule.length > 0) {
          // Use the first schedule entry for display
          startTime = schedule[0].start_time || null
          endTime = schedule[0].end_time || null
        }
        
        return {
          id: session.id,
          courseName: course?.name,
          courseCode: course?.course_code,
          date: session.date,
          startTime,
          endTime,
        attendance: {
          total: session.attendances?.length || 0,
          present: session.attendances?.filter(a => a.status === 'present').length || 0,
          late: session.attendances?.filter(a => a.status === 'late').length || 0,
          students: session.attendances?.map(att => ({
            studentId: (att.students as any)?.student_id,
            name: (att.students as any)?.name,
            status: att.status,
            checkInTime: att.check_in_time,
            locationVerified: att.location_verified
          })) || []
        }
        }
      }) || []
    }

    return NextResponse.json({
      success: true,
      dashboard
    })

  } catch (error: any) {
    console.error('Get professor dashboard error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}