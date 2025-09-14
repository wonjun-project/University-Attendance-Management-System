import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Create supabase client with service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check authentication using JWT (consistent with other APIs)
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is a student
    if (user.userType !== 'student') {
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

    if (!attendance || attendance.student_id !== user.userId) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
    }

    // Only track location for present students
    if (attendance.status !== 'present') {
      return NextResponse.json({ error: 'Can only track location for present students' }, { status: 400 })
    }

    // Get session and classroom location info
    const { data: sessionData, error: sessionError } = await supabase
      .from('attendances')
      .select(`
        session_id,
        class_sessions!session_id (
          course_id,
          courses!course_id (
            classroom_location
          )
        )
      `)
      .eq('id', attendanceId)
      .single()

    if (sessionError || !sessionData) {
      console.error('Session data error:', sessionError)
      return NextResponse.json({ error: 'Session information not found' }, { status: 500 })
    }

    // Extract classroom location
    const session = Array.isArray(sessionData.class_sessions) ? sessionData.class_sessions[0] : sessionData.class_sessions
    const course = Array.isArray(session?.courses) ? session.courses[0] : session?.courses
    const classroomLocation = course?.classroom_location as {
      latitude: number;
      longitude: number;
      radius: number;
    }

    if (!classroomLocation) {
      return NextResponse.json({ error: 'Classroom location not configured' }, { status: 500 })
    }

    // Calculate distance using Haversine formula
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371000; // Earth's radius in meters
      const φ1 = lat1 * Math.PI/180;
      const φ2 = lat2 * Math.PI/180;
      const Δφ = (lat2-lat1) * Math.PI/180;
      const Δλ = (lon2-lon1) * Math.PI/180;

      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

      return R * c;
    }

    const distance = calculateDistance(
      latitude,
      longitude,
      classroomLocation.latitude,
      classroomLocation.longitude
    );

    const locationValid = distance <= classroomLocation.radius;

    console.log(`Location tracking: ${Math.round(distance)}m from classroom (limit: ${classroomLocation.radius}m) → ${locationValid ? '✅ Valid' : '❌ Invalid'}`)

    // Log the location tracking
    const { error: locationLogError } = await supabase
      .from('location_logs')
      .insert({
        attendance_id: attendanceId,
        latitude: latitude,
        longitude: longitude,
        accuracy: accuracy,
        timestamp: new Date().toISOString(),
        is_valid: locationValid
      })

    if (locationLogError) {
      console.error('Location log error:', locationLogError)
      return NextResponse.json({ error: 'Failed to log location' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      locationValid: locationValid,
      distance: Math.round(distance),
      allowedRadius: classroomLocation.radius,
      message: locationValid
        ? 'Location tracked successfully - within classroom area'
        : `Student has moved ${Math.round(distance)}m from classroom (allowed: ${classroomLocation.radius}m)`
    })
  } catch (error) {
    console.error('Location tracking API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}