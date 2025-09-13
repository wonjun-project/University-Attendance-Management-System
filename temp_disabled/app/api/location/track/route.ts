import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is a student
    const { data: userData } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role !== 'student') {
      return NextResponse.json({ error: 'Only students can track location' }, { status: 403 })
    }

    const body = await request.json()
    const { attendanceId, latitude, longitude, accuracy = 0 } = body

    if (!attendanceId || latitude === undefined || longitude === undefined) {
      return NextResponse.json({ 
        error: 'Attendance ID, latitude, and longitude are required' 
      }, { status: 400 })
    }

    // Verify the attendance record belongs to the current user
    const { data: attendance } = await supabase
      .from('attendances')
      .select('student_id, status')
      .eq('id', attendanceId)
      .single()

    if (!attendance || attendance.student_id !== user.id) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
    }

    // Only track location for present students
    if (attendance.status !== 'present') {
      return NextResponse.json({ error: 'Can only track location for present students' }, { status: 400 })
    }

    // Call Supabase function to track location
    const { data: result, error: trackingError } = await supabase
      .rpc('track_student_location', {
        p_attendance_id: attendanceId,
        p_latitude: latitude,
        p_longitude: longitude,
        p_accuracy: accuracy
      })

    if (trackingError) {
      console.error('Location tracking error:', trackingError)
      return NextResponse.json({ error: 'Failed to track location' }, { status: 500 })
    }

    // Parse the result
    const trackingResult = typeof result === 'string' ? JSON.parse(result) : result

    if (!trackingResult.success) {
      return NextResponse.json({ 
        error: trackingResult.error || 'Location tracking failed' 
      }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true,
      locationValid: trackingResult.location_valid,
      message: trackingResult.location_valid 
        ? 'Location tracked successfully' 
        : 'Student has left the classroom area'
    })
  } catch (error) {
    console.error('Location tracking API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}