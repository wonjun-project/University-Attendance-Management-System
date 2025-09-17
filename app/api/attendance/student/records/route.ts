import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

type AttendanceWithSession = Database['public']['Tables']['attendances']['Row'] & {
  class_sessions: (
    Database['public']['Tables']['class_sessions']['Row'] & {
      courses: Pick<Database['public']['Tables']['courses']['Row'], 'name' | 'course_code'> | null
    }
  ) | null
}

export async function GET() {
  try {
    // Get current user
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'student') {
      return NextResponse.json({ error: 'Only students can view attendance records' }, { status: 403 })
    }

    // Create supabase client inside the function to avoid build-time errors
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get student's attendance records with course and session details
    const { data: attendanceRecords, error } = await supabase
      .from('attendances')
      .select(`
        id,
        session_id,
        check_in_time,
        status,
        location_verified,
        class_sessions (
          id,
          date,
          courses (
            name,
            course_code
          )
        )
      `)
      .eq('student_id', user.userId)
      .order('check_in_time', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch attendance records' }, { status: 500 })
    }

    // Format the records for frontend
    const typedRecords: AttendanceWithSession[] = (attendanceRecords ?? []) as AttendanceWithSession[]
    const formattedRecords = typedRecords.map((record) => ({
      id: record.id,
      sessionId: record.session_id,
      courseName: record.class_sessions?.courses?.name ?? '알 수 없는 강의',
      courseCode: record.class_sessions?.courses?.course_code ?? '',
      sessionDate: record.class_sessions?.date ?? null,
      checkedInAt: record.check_in_time,
      status: record.status,
      locationVerified: record.location_verified
    }))

    return NextResponse.json({
      success: true,
      records: formattedRecords
    })

  } catch (error: unknown) {
    console.error('Get student attendance records error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
