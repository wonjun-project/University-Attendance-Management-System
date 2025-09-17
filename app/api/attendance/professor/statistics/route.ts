/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
import { createClient } from '@/lib/supabase-server'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.userType !== 'professor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const supabase = createClient()

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'
    const filterCourseId = searchParams.get('courseId') || 'all'

    const now = new Date()
    let fromDate: Date | null = null
    if (period === 'week') {
      fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else if (period === 'month') {
      fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    const { data: coursesData, error: coursesErr } = await supabase
      .from('courses')
      .select('id,name,course_code')
      .eq('professor_id', user.userId)
      .order('created_at', { ascending: false })

    if (coursesErr) throw coursesErr

    const courses: any[] = Array.isArray(coursesData) ? coursesData : []
    let courseIds = courses.map(course => course.id)
    if (filterCourseId !== 'all') {
      courseIds = courseIds.filter(id => id === filterCourseId)
    }

    let sessions: any[] = []
    if (courseIds.length > 0) {
      const sessionQuery = supabase
        .from('class_sessions')
        .select('id, course_id, date, status, qr_code_expires_at')
        .in('course_id', courseIds)
        .order('date', { ascending: true })

      const { data: sessionsData, error: sessionsErr } = fromDate
        ? await sessionQuery.gte('date', fromDate.toISOString().slice(0, 10))
        : await sessionQuery

      if (sessionsErr) throw sessionsErr
      sessions = Array.isArray(sessionsData) ? sessionsData : []
    }

    const sessionIds = sessions.map((session: any) => session.id)

    const { data: attendsData } = sessionIds.length
      ? await supabase
          .from('attendances')
          .select('id, session_id, student_id, status, check_in_time, location_verified')
          .in('session_id', sessionIds)
      : { data: [] }

    const attends: any[] = Array.isArray(attendsData) ? attendsData : []

    const { data: enrollmentsData } = courseIds.length
      ? await supabase
          .from('course_enrollments')
          .select('course_id, student_id')
          .in('course_id', courseIds)
      : { data: [] }

    const enrollments: any[] = Array.isArray(enrollmentsData) ? enrollmentsData : []

    const uniqueStudentIds = Array.from(new Set(attends.map(a => a.student_id)))
    const { data: studentRowsData } = uniqueStudentIds.length
      ? await supabase
          .from('users')
          .select('student_id, name')
          .in('student_id', uniqueStudentIds)
      : { data: [] }

    const studentRows: any[] = Array.isArray(studentRowsData) ? studentRowsData : []
    const studentNameMap = new Map(
      studentRows
        .filter(row => typeof row.student_id === 'string')
        .map(row => [row.student_id as string, row.name as string])
    )

    const totalCourses = filterCourseId === 'all' ? courses.length : 1
    const totalSessions = sessions.length
    const presentCnt = attends.filter(a => a.status === 'present').length
    const lateCnt = attends.filter(a => a.status === 'late').length
    const totalAttRows = attends.length
    const overallAttendanceRate = totalAttRows > 0 ? Math.round(((presentCnt + lateCnt) / totalAttRows) * 100) : 0

    const courseSource: any[] = filterCourseId === 'all'
      ? courses
      : courses.filter(course => course.id === filterCourseId)

    const courseStats = courseSource.map((course: any) => {
      const sessionsForCourse = sessions.filter((session: any) => session.course_id === course.id)
      const sessionIdSet = new Set(sessionsForCourse.map((session: any) => session.id))
      const attendanceForCourse = attends.filter((attendance: any) => sessionIdSet.has(attendance.session_id))
      const present = attendanceForCourse.filter((attendance: any) => attendance.status === 'present').length
      const late = attendanceForCourse.filter((attendance: any) => attendance.status === 'late').length
      const totalRows = attendanceForCourse.length
      const attendanceRate = totalRows > 0 ? Math.round(((present + late) / totalRows) * 100) : 0
      const studentsForCourse = new Set(
        enrollments
          .filter((enrollment: any) => enrollment.course_id === course.id)
          .map((enrollment: any) => enrollment.student_id)
      ).size

      return {
        courseId: course.id,
        courseName: course.name,
        courseCode: course.course_code,
        totalSessions: sessionsForCourse.length,
        totalStudents: studentsForCourse,
        totalAttendance: totalRows,
        presentCount: present,
        attendanceRate,
      }
    })

    const studentAgg = new Map<string, { present: number; late: number; absent: number }>()
    for (const attendance of attends as any[]) {
      const current = studentAgg.get(attendance.student_id) || { present: 0, late: 0, absent: 0 }
      if (attendance.status === 'present') current.present += 1
      else if (attendance.status === 'late') current.late += 1
      else current.absent += 1
      studentAgg.set(attendance.student_id, current)
    }

    const studentStats = Array.from(studentAgg.entries()).map(([id, value]) => {
      const total = value.present + value.late + value.absent
      const rate = total > 0 ? Math.round(((value.present + value.late) / total) * 100) : 0
      return {
        studentId: id,
        name: studentNameMap.get(id) || id,
        total,
        present: value.present,
        late: value.late,
        absent: value.absent,
        attendanceRate: rate,
      }
    }).sort((a, b) => b.attendanceRate - a.attendanceRate)

    const byHourMap = new Map<number, number>()
    for (const attendance of attends as any[]) {
      if (!attendance.check_in_time) continue
      const hour = new Date(attendance.check_in_time).getHours()
      byHourMap.set(hour, (byHourMap.get(hour) || 0) + 1)
    }
    const byHour = Array.from(byHourMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([hour, count]) => ({ hour, count }))

    const byDowMap = new Map<number, number>()
    for (const session of sessions) {
      const date = new Date(`${session.date}T00:00:00`)
      const dow = date.getDay()
      byDowMap.set(dow, (byDowMap.get(dow) || 0) + 1)
    }
    const days = ['일', '월', '화', '수', '목', '금', '토']
    const byDayOfWeek = Array.from(byDowMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([dayNumber, count]) => ({ day: days[dayNumber], dayNumber, count }))

    const byDateMap = new Map<string, { total: number; presentLate: number }>()
    for (const session of sessions) {
      byDateMap.set(session.date, byDateMap.get(session.date) || { total: 0, presentLate: 0 })
    }
    for (const attendance of attends) {
      const session = sessions.find((s: any) => s.id === attendance.session_id)
      if (!session) continue
      const key = session.date
      const current = byDateMap.get(key) || { total: 0, presentLate: 0 }
      current.total += 1
      if (attendance.status === 'present' || attendance.status === 'late') current.presentLate += 1
      byDateMap.set(key, current)
    }
    const attendanceByDate = Array.from(byDateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({
        date,
        attendanceRate: value.total > 0 ? Math.round((value.presentLate / value.total) * 100) : 0,
        totalStudents: value.total,
        presentStudents: value.presentLate,
      }))

    const weekMap = new Map<string, { total: number; presentLate: number }>()
    for (const entry of attendanceByDate) {
      const date = new Date(`${entry.date}T00:00:00`)
      const diff = (date.getDay() + 6) % 7
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - diff)
      const key = weekStart.toISOString().slice(0, 10)
      const current = weekMap.get(key) || { total: 0, presentLate: 0 }
      current.total += entry.totalStudents
      current.presentLate += entry.presentStudents
      weekMap.set(key, current)
    }
    const attendanceRateByWeek = Array.from(weekMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([weekStart, value]) => ({
        weekStart,
        attendanceRate: value.total > 0 ? Math.round((value.presentLate / value.total) * 100) : 0,
        totalStudents: value.total,
        presentStudents: value.presentLate,
      }))

    const statistics = {
      overview: {
        totalCourses,
        totalSessions,
        totalStudents: new Set(enrollments.map(enrollment => enrollment.student_id)).size,
        overallAttendanceRate,
      },
      courseStats,
      studentStats,
      timePatterns: { byHour, byDayOfWeek },
      trends: { attendanceByDate, attendanceRateByWeek },
    }

    return NextResponse.json({ success: true, statistics })
  } catch (error) {
    console.error('Professor statistics API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
