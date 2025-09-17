/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'student') {
      return NextResponse.json({ error: 'Only students can view enrolled courses' }, { status: 403 })
    }

    const supabase = createClient()

    const { data: enrolledCoursesData, error: enrollmentsError } = await supabase
      .from('course_enrollments')
      .select(
        `course_id,
         enrolled_at,
         courses (
           id,
           name,
           course_code,
           classroom_location,
           schedule,
           created_at,
           professors ( professor_id, name ),
           class_sessions (
             id,
             date,
             status,
             attendances!inner ( id, student_id, status, check_in_time, location_verified )
           )
         )`
      )
      .eq('student_id', user.userId)

    if (enrollmentsError) {
      console.error('Database error:', enrollmentsError)
      return NextResponse.json({ error: 'Failed to fetch enrolled courses' }, { status: 500 })
    }

    const enrolledCourses: any[] = Array.isArray(enrolledCoursesData) ? enrolledCoursesData : []
    const today = new Date().toISOString().split('T')[0]

    const courses = enrolledCourses.map(enrollment => {
      const course = (enrollment.courses ?? {}) as any
      const sessions: any[] = Array.isArray(course.class_sessions) ? course.class_sessions : []

      let totalSessions = 0
      let attendedSessions = 0
      let lateSessions = 0
      const todaySessions: any[] = []

      sessions.forEach((session: any) => {
        const attendances = Array.isArray(session.attendances)
          ? session.attendances.filter((att: any) => att.student_id === user.userId)
          : []

        if (attendances.length > 0) {
          totalSessions += 1
          const attendance = attendances[0]

          if (attendance.status === 'present') attendedSessions += 1
          else if (attendance.status === 'late') lateSessions += 1
        }

        if (session.date === today) {
          const attendance = attendances[0] ?? null
          todaySessions.push({
            id: session.id,
            status: session.status,
            attendance: attendance
              ? {
                  status: attendance.status,
                  checkInTime: attendance.check_in_time,
                  locationVerified: attendance.location_verified,
                }
              : null,
          })
        }
      })

      const attendanceRate = totalSessions > 0 ? Math.round(((attendedSessions + lateSessions) / totalSessions) * 100) : 0

      return {
        id: course.id,
        name: course.name,
        courseCode: course.course_code,
        professor: {
          id: course.professors?.professor_id ?? null,
          name: course.professors?.name ?? null,
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
          missedSessions: totalSessions - attendedSessions - lateSessions,
        },
        todaySessions,
      }
    })

    const { data: activeSessionsData, error: activeSessionsError } = await supabase
      .from('class_sessions')
      .select(
        `id, date, status,
         courses!inner (
           id,
           name,
           course_code,
           professors ( professor_id, name ),
           course_enrollments!inner ( student_id )
         ),
         attendances ( id, student_id, status, check_in_time, location_verified )`
      )
      .eq('date', today)
      .eq('status', 'active')
      .eq('courses.course_enrollments.student_id', user.userId)

    if (activeSessionsError) {
      console.error('Active sessions error:', activeSessionsError)
    }

    const activeSessions: any[] = Array.isArray(activeSessionsData) ? activeSessionsData : []

    const todayActiveSessions = activeSessions.map((session: any) => {
      const course = (session.courses ?? {}) as any
      const attendance = Array.isArray(session.attendances)
        ? session.attendances.find((att: any) => att.student_id === user.userId)
        : null

      return {
        sessionId: session.id,
        courseId: course.id,
        courseName: course.name,
        courseCode: course.course_code,
        professor: {
          id: course.professors?.professor_id ?? null,
          name: course.professors?.name ?? null,
        },
        attendance: attendance
          ? {
              status: attendance.status,
              checkInTime: attendance.check_in_time,
              locationVerified: attendance.location_verified,
            }
          : null,
        canCheckIn: !attendance || attendance.status === 'absent',
      }
    })

    const summary = {
      totalEnrolledCourses: courses.length,
      totalSessions: courses.reduce((sum, course) => sum + course.attendance.totalSessions, 0),
      totalAttended: courses.reduce((sum, course) => sum + course.attendance.attendedSessions, 0),
      overallAttendanceRate:
        courses.length > 0
          ? Math.round(
              courses.reduce((sum, course) => sum + course.attendance.attendanceRate, 0) / courses.length
            )
          : 0,
      todayActiveSessionsCount: todayActiveSessions.length,
    }

    return NextResponse.json({
      success: true,
      data: {
        enrolledCourses: courses,
        todayActiveSessions,
        summary,
      },
    })
  } catch (error) {
    console.error('Get student courses error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
