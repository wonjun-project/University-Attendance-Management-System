/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    console.log('🎯 [Professor Dashboard] API 호출됨')

    const user = await getCurrentUser()
    if (!user) {
      console.log('❌ [Professor Dashboard] 인증 실패: user 없음')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (user.userType !== 'professor') {
      console.log('❌ [Professor Dashboard] 권한 없음: userType =', user.userType)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    console.log('✅ [Professor Dashboard] 인증 성공:', { userId: user.userId, name: user.name })

    const supabase = createClient()

    // 교수의 강의 목록
    console.log('📚 [Professor Dashboard] 강의 목록 조회 시작...', { professorId: user.userId })

    const { data: coursesData, error: coursesError } = await supabase
      .from('courses')
      .select('id,name,course_code')
      .eq('professor_id', user.userId)
      .order('created_at', { ascending: false })

    if (coursesError) {
      console.error('❌ [Professor Dashboard] 강의 조회 에러:', coursesError)
      throw coursesError
    }

    const courses: any[] = Array.isArray(coursesData) ? coursesData : []
    const courseIds = courses.map(course => course.id)

    console.log('📚 [Professor Dashboard] 강의 목록:', {
      count: courses.length,
      courseIds,
      courses: courses.map(c => ({ id: c.id, name: c.name }))
    })

    // 활성 세션 정보
    let activeSessions: any[] = []
    if (courseIds.length > 0) {
      console.log('🔍 [Professor Dashboard] 활성 세션 조회 시작...', { courseIds })

      const { data: sessionsData, error: sessionsError } = await supabase
        .from('class_sessions')
        .select('id, date, status, course_id, courses!inner(id,name,course_code)')
        .eq('status', 'active')
        .in('course_id', courseIds)
        .order('date', { ascending: false })

      if (sessionsError) {
        console.error('❌ [Professor Dashboard] 세션 조회 에러:', sessionsError)
        throw sessionsError
      }

      const sessions: any[] = Array.isArray(sessionsData) ? sessionsData : []
      const sessionIds = sessions.map(session => session.id)

      console.log('📋 [Professor Dashboard] 활성 세션 목록:', {
        count: sessions.length,
        sessionIds,
        sessions: sessions.map(s => ({ id: s.id, status: s.status, courseName: s.courses?.name }))
      })

      const { data: attendanceData, error: attendanceError } = sessionIds.length
        ? await supabase
            .from('attendances')
            .select('id, session_id, student_id, status, check_in_time, location_verified, students ( name, student_id )')
            .in('session_id', sessionIds)
        : { data: [], error: null }

      if (attendanceError) {
        console.error('❌ [Professor Dashboard] Attendance 조회 에러:', attendanceError)
      }

      const attendanceList: any[] = Array.isArray(attendanceData) ? attendanceData : []

      console.log('📊 [Professor Dashboard] 출석 데이터 조회 결과:', {
        sessionIdsCount: sessionIds.length,
        attendanceCount: attendanceList.length,
        sampleData: attendanceList.slice(0, 2),
        error: attendanceError?.message
      })

      activeSessions = sessions.map((session: any) => {
        const list = attendanceList.filter(item => item.session_id === session.id)
        const total = list.length
        const present = list.filter(item => item.status === 'present').length
        const late = list.filter(item => item.status === 'late').length
        const leftEarly = list.filter(item => item.status === 'left_early').length
        const absent = Math.max(0, total - present - late - leftEarly)

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
            leftEarly,
            absent,
            students: list.map(item => ({
              studentId: item.student_id,
              name: item.students?.name ?? item.student_id,
              status: item.status,
              checkInTime: item.check_in_time,
              locationVerified: Boolean(item.location_verified),
            })),
          },
        }
      })
    }

    // ✅ 최적화: N+1 쿼리 문제 해결 - 단일 쿼리로 모든 데이터 가져오기
    let coursesWithSessions: any[] = []

    if (courseIds.length > 0) {
      // 모든 강의의 최신 세션을 한 번에 가져오기
      const { data: allRecentSessions, error: sessionsError } = await supabase
        .from('class_sessions')
        .select('id, date, status, course_id')
        .in('course_id', courseIds)
        .order('date', { ascending: false })

      if (sessionsError) {
        console.error('❌ [Professor Dashboard] 세션 조회 에러:', sessionsError)
      }

      const allSessions: any[] = Array.isArray(allRecentSessions) ? allRecentSessions : []

      // 각 강의별 최신 세션만 필터링
      const latestSessionsByCourse = new Map<string, any>()
      allSessions.forEach(session => {
        if (!latestSessionsByCourse.has(session.course_id)) {
          latestSessionsByCourse.set(session.course_id, session)
        }
      })

      const sessionIds = Array.from(latestSessionsByCourse.values()).map(s => s.id)

      // 모든 세션의 출석 데이터를 한 번에 가져오기
      let allAttendances: any[] = []
      if (sessionIds.length > 0) {
        const { data: attendancesData, error: attendancesError } = await supabase
          .from('attendances')
          .select('id, status, session_id')
          .in('session_id', sessionIds)

        if (attendancesError) {
          console.error('❌ [Professor Dashboard] 출석 조회 에러:', attendancesError)
        }

        allAttendances = Array.isArray(attendancesData) ? attendancesData : []
      }

      // 클라이언트 사이드에서 그룹화
      coursesWithSessions = courses.map((course: any) => {
        const latestSession = latestSessionsByCourse.get(course.id)
        const sessionSummaries = latestSession ? [{
          id: latestSession.id,
          date: latestSession.date,
          isActive: latestSession.status === 'active',
          attendance: (() => {
            const sessionAttendances = allAttendances.filter(a => a.session_id === latestSession.id)
            const total = sessionAttendances.length
            const present = sessionAttendances.filter(a => a.status === 'present').length
            const late = sessionAttendances.filter(a => a.status === 'late').length
            const absent = Math.max(0, total - present - late)
            return { total, present, late, absent }
          })()
        }] : []

        return {
          id: course.id,
          name: course.name,
          courseCode: course.course_code,
          sessions: sessionSummaries,
        }
      })
    } else {
      coursesWithSessions = courses.map((course: any) => ({
        id: course.id,
        name: course.name,
        courseCode: course.course_code,
        sessions: [],
      }))
    }

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
