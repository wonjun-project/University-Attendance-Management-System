import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.userType !== 'professor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month' // all|week|month
    const filterCourseId = searchParams.get('courseId') || 'all'

    const now = new Date()
    let fromDate: Date | null = null
    if (period === 'week') {
      fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else if (period === 'month') {
      fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 교수 강의 목록
    const { data: courses, error: coursesErr } = await supabase
      .from('courses')
      .select('id,name,course_code')
      .eq('professor_id', user.userId)
      .order('created_at', { ascending: false })
    if (coursesErr) throw coursesErr

    let courseIds = (courses || []).map((c) => c.id)
    if (filterCourseId !== 'all') courseIds = courseIds.filter((id) => id === filterCourseId)

    // 세션
    const sessionQuery = supabase
      .from('class_sessions')
      .select('id, course_id, date, status, qr_code_expires_at')
      .in('course_id', courseIds)
      .order('date', { ascending: true })
    const { data: sessions, error: sessionsErr } = fromDate
      ? await sessionQuery.gte('date', fromDate.toISOString().slice(0, 10))
      : await sessionQuery
    if (sessionsErr) throw sessionsErr

    const sessionIds = (sessions || []).map((s) => s.id)

    // 출석
    const { data: attends } = sessionIds.length
      ? await supabase
          .from('attendances')
          .select('id, session_id, student_id, status, check_in_time, location_verified')
          .in('session_id', sessionIds)
      : { data: [] as any[] }

    // 수강신청
    const { data: enrollments } = courseIds.length
      ? await supabase
          .from('course_enrollments')
          .select('course_id, student_id')
          .in('course_id', courseIds)
      : { data: [] as any[] }

    // 학생 이름 조회(있으면)
    const uniqueStudentIds = Array.from(new Set((attends || []).map((a) => a.student_id)))
    const { data: studentRows } = uniqueStudentIds.length
      ? await supabase
          .from('students')
          .select('student_id, name')
          .in('student_id', uniqueStudentIds)
      : { data: [] as any[] }
    const studentNameMap = new Map<string, string>((studentRows || []).map((s) => [s.student_id, s.name]))

    // 개요
    const totalCourses = filterCourseId === 'all' ? (courses?.length || 0) : 1
    const totalSessions = sessions?.length || 0
    const presentCnt = (attends || []).filter((a) => a.status === 'present').length
    const lateCnt = (attends || []).filter((a) => a.status === 'late').length
    const totalAttRows = (attends || []).length
    const overallAttendanceRate = totalAttRows > 0 ? Math.round(((presentCnt + lateCnt) / totalAttRows) * 100) : 0

    // 강의별 통계
    const courseStats = (filterCourseId === 'all' ? courses : courses?.filter((c) => c.id === filterCourseId))?.map((c) => {
      const sForCourse = (sessions || []).filter((s) => s.course_id === c.id)
      const sidSet = new Set(sForCourse.map((s) => s.id))
      const aForCourse = (attends || []).filter((a) => sidSet.has(a.session_id))
      const present = aForCourse.filter((a) => a.status === 'present').length
      const late = aForCourse.filter((a) => a.status === 'late').length
      const totalRows = aForCourse.length
      const attendanceRate = totalRows > 0 ? Math.round(((present + late) / totalRows) * 100) : 0
      const studentsForCourse = new Set((enrollments || []).filter((e) => e.course_id === c.id).map((e) => e.student_id)).size
      return {
        courseId: c.id,
        courseName: c.name,
        courseCode: c.course_code,
        totalSessions: sForCourse.length,
        totalStudents: studentsForCourse,
        totalAttendance: totalRows,
        presentCount: present,
        attendanceRate,
      }
    }) || []

    // 학생별 통계(상위)
    const studentAgg = new Map<string, { present: number; late: number; absent: number }>()
    for (const a of attends || []) {
      const cur = studentAgg.get(a.student_id) || { present: 0, late: 0, absent: 0 }
      if (a.status === 'present') cur.present++
      else if (a.status === 'late') cur.late++
      else cur.absent++
      studentAgg.set(a.student_id, cur)
    }
    const studentStats = Array.from(studentAgg.entries()).map(([id, v]) => {
      const total = v.present + v.late + v.absent
      const rate = total > 0 ? Math.round(((v.present + v.late) / total) * 100) : 0
      return {
        studentId: id,
        name: studentNameMap.get(id) || id,
        total,
        present: v.present,
        late: v.late,
        absent: v.absent,
        attendanceRate: rate,
      }
    }).sort((a, b) => b.attendanceRate - a.attendanceRate)

    // 시간 패턴
    const byHourMap = new Map<number, number>()
    for (const a of attends || []) {
      if (!a.check_in_time) continue
      const h = new Date(a.check_in_time).getHours()
      byHourMap.set(h, (byHourMap.get(h) || 0) + 1)
    }
    const byHour = Array.from(byHourMap.entries()).sort((a, b) => a[0] - b[0]).map(([hour, count]) => ({ hour, count }))

    const byDowMap = new Map<number, number>()
    for (const s of sessions || []) {
      const d = new Date(s.date + 'T00:00:00')
      const dow = d.getDay() // 0=Sun
      byDowMap.set(dow, (byDowMap.get(dow) || 0) + 1)
    }
    const days = ['일', '월', '화', '수', '목', '금', '토']
    const byDayOfWeek = Array.from(byDowMap.entries()).sort((a, b) => a[0] - b[0]).map(([dayNumber, count]) => ({ day: days[dayNumber], dayNumber, count }))

    // 추이
    const byDateMap = new Map<string, { total: number; presentLate: number }>()
    for (const s of sessions || []) {
      byDateMap.set(s.date, byDateMap.get(s.date) || { total: 0, presentLate: 0 })
    }
    for (const a of attends || []) {
      const s = (sessions || []).find((x) => x.id === a.session_id)
      if (!s) continue
      const key = s.date
      const cur = byDateMap.get(key) || { total: 0, presentLate: 0 }
      cur.total += 1
      if (a.status === 'present' || a.status === 'late') cur.presentLate += 1
      byDateMap.set(key, cur)
    }
    const attendanceByDate = Array.from(byDateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({
        date,
        attendanceRate: v.total > 0 ? Math.round((v.presentLate / v.total) * 100) : 0,
        totalStudents: v.total,
        presentStudents: v.presentLate,
      }))

    // 주간 추이(간단 집계)
    const weekMap = new Map<string, { total: number; presentLate: number }>()
    for (const entry of attendanceByDate) {
      const d = new Date(entry.date + 'T00:00:00')
      const diff = (d.getDay() + 6) % 7 // Monday-based
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - diff)
      const key = weekStart.toISOString().slice(0, 10)
      const cur = weekMap.get(key) || { total: 0, presentLate: 0 }
      cur.total += entry.totalStudents
      cur.presentLate += entry.presentStudents
      weekMap.set(key, cur)
    }
    const attendanceRateByWeek = Array.from(weekMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([weekStart, v]) => ({
        weekStart,
        attendanceRate: v.total > 0 ? Math.round((v.presentLate / v.total) * 100) : 0,
        totalStudents: v.total,
        presentStudents: v.presentLate,
      }))

    const statistics = {
      overview: { totalCourses, totalSessions, totalStudents: new Set((enrollments || []).map((e) => e.student_id)).size, overallAttendanceRate },
      courseStats,
      studentStats,
      timePatterns: { byHour, byDayOfWeek },
      trends: { attendanceByDate, attendanceRateByWeek },
    }

    return NextResponse.json({ success: true, statistics })
  } catch (error: any) {
    console.error('Professor statistics API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
