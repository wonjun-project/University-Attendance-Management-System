/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.userType !== 'professor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const supabase = createClient()

    // 교수의 강의 목록
    const { data: coursesData, error: coursesError } = await supabase
      .from('courses')
      .select('id,name,course_code')
      .eq('professor_id', user.userId)
      .order('created_at', { ascending: false })

    if (coursesError) throw coursesError

    const courses: any[] = Array.isArray(coursesData) ? coursesData : []
    const courseIds = courses.map(course => course.id)

    // 활성 세션 정보
    let activeSessions: any[] = []
    if (courseIds.length > 0) {
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('class_sessions')
        .select('id, date, status, course_id, courses!inner(id,name,course_code)')
        .eq('status', 'active')
        .in('course_id', courseIds)
        .order('date', { ascending: false })

      if (sessionsError) throw sessionsError

      const sessions: any[] = Array.isArray(sessionsData) ? sessionsData : []
      const sessionIds = sessions.map(session => session.id)

      const { data: attendanceData } = sessionIds.length
        ? await supabase
            .from('attendances')
            .select('id, session_id, student_id, status, check_in_time, location_verified, users:users ( name, student_id )')
            .in('session_id', sessionIds)
        : { data: [] }

      const attendanceList: any[] = Array.isArray(attendanceData) ? attendanceData : []

      activeSessions = sessions.map((session: any) => {
        const list = attendanceList.filter(item => item.session_id === session.id)
        const total = list.length
        const present = list.filter(item => item.status === 'present').length
        const late = list.filter(item => item.status === 'late').length
        const absent = Math.max(0, total - present - late)

        return {
          id: session.id,
          courseName: session.courses?.name,
          courseCode: session.courses?.course_code,
          date: session.date,
          startTime: null,
          endTime: null,
          attendance: {
            total,
            present,
            late,
            absent,
            students: list.map(item => ({
              studentId: item.student_id,
              name: item.users?.name ?? item.student_id,
              status: item.status,
              checkInTime: item.check_in_time,
              locationVerified: Boolean(item.location_verified),
            })),
          },
        }
      })
    }

    const coursesWithSessions = await Promise.all(
      courses.map(async (course: any) => {
        const { data: recentSessions } = await supabase
          .from('class_sessions')
          .select('id, date, status')
          .eq('course_id', course.id)
          .order('date', { ascending: false })
          .limit(1)

        const sessions: any[] = Array.isArray(recentSessions) ? recentSessions : []

        const sessionSummaries = await Promise.all(
          sessions.map(async (session: any) => {
            const { data: atts } = await supabase
              .from('attendances')
              .select('id, status')
              .eq('session_id', session.id)

            const attendanceRows: any[] = Array.isArray(atts) ? atts : []
            const total = attendanceRows.length
            const present = attendanceRows.filter((a: any) => a.status === 'present').length
            const late = attendanceRows.filter((a: any) => a.status === 'late').length
            const absent = Math.max(0, total - present - late)

            return {
              id: session.id,
              date: session.date,
              isActive: session.status === 'active',
              attendance: { total, present, late, absent },
            }
          })
        )

        return {
          id: course.id,
          name: course.name,
          courseCode: course.course_code,
          sessions: sessionSummaries,
        }
      })
    )

    const dashboard = {
      totalCourses: courses.length,
      activeSessionsCount: activeSessions.length,
      courses: coursesWithSessions,
      activeSessions,
    }

    return NextResponse.json({ success: true, dashboard })
  } catch (error) {
    console.error('Professor dashboard API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
