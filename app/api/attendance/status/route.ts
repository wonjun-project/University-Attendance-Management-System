import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    // JWT 기반 인증 확인
    const session = getCurrentUser()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.userType !== 'professor') {
      return NextResponse.json({ error: 'Only professors can view attendance status' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    // 세션 소유권 확인 (교수)
    const { data: sessionRow } = await supabase
      .from('class_sessions')
      .select(`
        id,
        date,
        status,
        qr_code_expires_at,
        course_id,
        courses (
          id,
          name,
          professor_id
        )
      `)
      .eq('id', sessionId)
      .single()

    if (!sessionRow || (sessionRow.courses as any)?.professor_id !== session.userId) {
      return NextResponse.json({ error: 'Session not found or access denied' }, { status: 404 })
    }

    // 출석 데이터 + 학생 정보
    const { data: attendanceData } = await supabase
      .from('attendances')
      .select(`
        id,
        status,
        check_in_time,
        check_out_time,
        location_verified,
        created_at,
        updated_at,
        student_id,
        students (
          student_id,
          name
        )
      `)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })

    // 수강 신청한 학생 수
    const { count: enrolledCount } = await supabase
      .from('course_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', (sessionRow.courses as any)?.id || '')

    const totalStudents = enrolledCount || 0
    const presentStudents = attendanceData?.filter(a => a.status === 'present').length || 0
    const lateStudents = attendanceData?.filter(a => a.status === 'late').length || 0
    const leftEarlyStudents = attendanceData?.filter(a => a.status === 'left_early').length || 0
    const absentStudents = totalStudents - presentStudents - lateStudents - leftEarlyStudents

    const activeAttendanceIds = attendanceData
      ?.filter(a => a.status === 'present')
      .map(a => a.id) || []

    let recentLocations: any[] = []
    if (activeAttendanceIds.length > 0) {
      const { data: locationLogs } = await supabase
        .from('location_logs')
        .select('*')
        .in('attendance_id', activeAttendanceIds)
        .order('timestamp', { ascending: false })
        .limit(50)

      recentLocations = locationLogs || []
    }

    const response = {
      session: {
        id: sessionRow.id,
        date: sessionRow.date,
        status: sessionRow.status,
        course: sessionRow.courses,
        qr_expires_at: sessionRow.qr_code_expires_at
      },
      statistics: {
        total: totalStudents,
        present: presentStudents,
        late: lateStudents,
        left_early: leftEarlyStudents,
        absent: absentStudents,
        attendance_rate: totalStudents > 0 ? ((presentStudents / totalStudents) * 100).toFixed(1) : '0.0'
      },
      attendances: attendanceData?.map(attendance => ({
        id: attendance.id,
        student: {
          id: (attendance as any).student_id,
          name: (attendance as any).students?.name,
          student_id: (attendance as any).students?.student_id
        },
        status: attendance.status,
        check_in_time: attendance.check_in_time,
        check_out_time: attendance.check_out_time,
        location_verified: attendance.location_verified,
        last_updated: attendance.updated_at
      })) || [],
      recent_locations: recentLocations.slice(0, 10)
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Attendance status API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
