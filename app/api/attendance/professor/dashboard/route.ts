import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

type Course = { id: string; name: string; course_code: string }

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.userType !== 'professor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 교수의 강의 목록
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('id,name,course_code')
      .eq('professor_id', user.userId)
      .order('created_at', { ascending: false })

    if (coursesError) throw coursesError

    const courseIds = (courses || []).map((c) => c.id)

    // 활성 세션
    let activeSessions: any[] = []
    if (courseIds.length > 0) {
      const { data: sessions, error: sessErr } = await supabase
        .from('class_sessions')
        .select('id, date, status, course_id, courses!inner(id,name,course_code)')
        .eq('status', 'active')
        .in('course_id', courseIds)
        .order('date', { ascending: false })

      if (sessErr) throw sessErr

      const sessionIds = (sessions || []).map((s) => s.id)

      const { data: atts } = sessionIds.length
        ? await supabase
            .from('attendances')
            .select('id, session_id, student_id, status, check_in_time, location_verified, students ( name, student_id )')
            .in('session_id', sessionIds)
        : { data: [] as any[] }

      activeSessions = (sessions || []).map((s) => {
        const list = (atts || []).filter((a) => a.session_id === s.id)
        const total = list.length
        const present = list.filter((a) => a.status === 'present').length
        const late = list.filter((a) => a.status === 'late').length
        const absent = Math.max(0, total - present - late)
        return {
          id: s.id,
          courseName: (s as any).courses?.name,
          courseCode: (s as any).courses?.course_code,
          date: s.date,
          startTime: null,
          endTime: null,
          attendance: {
            total,
            present,
            late,
            absent,
            students: list.map((a) => ({
              studentId: a.student_id,
              name: a.students?.name || a.student_id,
              status: a.status,
              checkInTime: a.check_in_time,
              locationVerified: !!a.location_verified,
            })),
          },
        }
      })
    }

    // 각 강의 최근 세션 1개 + 간단 통계
    const coursesWithSessions = await Promise.all(
      (courses || []).map(async (c: Course) => {
        const { data: recentSessions } = await supabase
          .from('class_sessions')
          .select('id, date, status')
          .eq('course_id', c.id)
          .order('date', { ascending: false })
          .limit(1)

        const sessions = await Promise.all(
          (recentSessions || []).map(async (s) => {
            const { data: atts } = await supabase
              .from('attendances')
              .select('id, status')
              .eq('session_id', s.id)
            const total = atts?.length || 0
            const present = (atts || []).filter((a) => a.status === 'present').length
            const late = (atts || []).filter((a) => a.status === 'late').length
            const absent = Math.max(0, total - present - late)
            return {
              id: s.id,
              date: s.date,
              isActive: s.status === 'active',
              attendance: { total, present, late, absent },
            }
          })
        )

        return {
          id: c.id,
          name: c.name,
          courseCode: c.course_code,
          sessions,
        }
      })
    )

    const dashboard = {
      totalCourses: courses?.length || 0,
      activeSessionsCount: activeSessions.length,
      courses: coursesWithSessions,
      activeSessions,
    }

    return NextResponse.json({ success: true, dashboard })
  } catch (error: any) {
    console.error('Professor dashboard API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
