import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get current user
    const user = getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'student') {
      return NextResponse.json({ error: 'Only students can view enrolled courses' }, { status: 403 })
    }

    // Create supabase client inside the function to avoid build-time errors
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get student's enrolled courses
    const { data: enrolledCourses, error: enrollmentsError } = await supabase
      .from('course_enrollments')
      .select(`
        course_id,
        enrolled_at,
        courses (
          id,
          name,
          course_code,
          classroom_location,
          schedule,
          created_at,
          professors (
            professor_id,
            name
          ),
          class_sessions (
            id,
            date,
            status,
            attendances!inner (
              id,
              student_id,
              status,
              check_in_time,
              location_verified
            )
          )
        )
      `)
      .eq('student_id', user.userId)

    if (enrollmentsError) {
      console.error('Database error:', enrollmentsError)
      return NextResponse.json({ error: 'Failed to fetch enrolled courses' }, { status: 500 })
    }

    // Get today's date
    const today = new Date().toISOString().split('T')[0]

    // Process course data
    const courses = enrolledCourses?.map(enrollment => {
      const course = enrollment.courses as any
      const sessions = course.class_sessions || []
      
      // Calculate attendance statistics
      let totalSessions = 0
      let attendedSessions = 0
      let lateSessions = 0
      let todaySessions: any[] = []
      
      sessions.forEach((session: any) => {
        // Only count sessions for this student
        const studentAttendances = session.attendances?.filter((att: any) => att.student_id === user.userId) || []
        
        if (studentAttendances.length > 0) {
          totalSessions++
          const attendance = studentAttendances[0]
          
          if (attendance.status === 'present') {
            attendedSessions++
          } else if (attendance.status === 'late') {
            lateSessions++
          }
        }

        // Check if session is today
        if (session.date === today) {
          const studentAttendance = studentAttendances.length > 0 ? studentAttendances[0] : null
          todaySessions.push({
            id: session.id,
            status: session.status,
            attendance: studentAttendance ? {
              status: studentAttendance.status,
              checkInTime: studentAttendance.check_in_time,
              locationVerified: studentAttendance.location_verified
            } : null
          })
        }
      })

      const attendanceRate = totalSessions > 0 ? Math.round(((attendedSessions + lateSessions) / totalSessions) * 100) : 0

      return {
        id: course.id,
        name: course.name,
        courseCode: course.course_code,
        professor: {
          id: course.professors?.professor_id,
          name: course.professors?.name
        },
        enrolledAt: enrollment.enrolled_at,
        createdAt: course.created_at,
        location: course.classroom_location,
        schedule: course.schedule,
        attendance: {
          totalSessions,
          attendedSessions,
          lateSessions,
          attendanceRate,
          missedSessions: totalSessions - attendedSessions - lateSessions
        },
        todaySessions
      }
    }) || []

    // Get active sessions for today
    const { data: activeSessions, error: activeSessionsError } = await supabase
      .from('class_sessions')
      .select(`
        id,
        date,
        status,
        courses!inner (
          id,
          name,
          course_code,
          professors (
            professor_id,
            name
          ),
          course_enrollments!inner (
            student_id
          )
        ),
        attendances (
          id,
          student_id,
          status,
          check_in_time,
          location_verified
        )
      `)
      .eq('date', today)
      .eq('status', 'active')
      .eq('courses.course_enrollments.student_id', user.userId)

    if (activeSessionsError) {
      console.error('Active sessions error:', activeSessionsError)
    }

    const todayActiveSessions = activeSessions?.map(session => {
      const course = session.courses as any
      const studentAttendance = session.attendances?.find((att: any) => att.student_id === user.userId)

      return {
        sessionId: session.id,
        courseId: course.id,
        courseName: course.name,
        courseCode: course.course_code,
        professor: {
          id: course.professors?.professor_id,
          name: course.professors?.name
        },
        attendance: studentAttendance ? {
          status: studentAttendance.status,
          checkInTime: studentAttendance.check_in_time,
          locationVerified: studentAttendance.location_verified
        } : null,
        canCheckIn: !studentAttendance || studentAttendance.status === 'absent'
      }
    }) || []

    return NextResponse.json({
      success: true,
      data: {
        enrolledCourses: courses,
        todayActiveSessions,
        summary: {
          totalEnrolledCourses: courses.length,
          totalSessions: courses.reduce((sum, course) => sum + course.attendance.totalSessions, 0),
          totalAttended: courses.reduce((sum, course) => sum + course.attendance.attendedSessions, 0),
          overallAttendanceRate: courses.length > 0 
            ? Math.round(courses.reduce((sum, course) => sum + course.attendance.attendanceRate, 0) / courses.length)
            : 0,
          todayActiveSessionsCount: todayActiveSessions.length
        }
      }
    })

  } catch (error: any) {
    console.error('Get student courses error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}