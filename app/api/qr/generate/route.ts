import { NextRequest, NextResponse } from 'next/server'

// Ensure Node.js runtime (service role key usage)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function withCors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.headers.set('Cache-Control', 'no-store')
  return res
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }))
}

// Optional GET for liveness/debug checks
export async function GET() {
  return withCors(NextResponse.json({ ok: true, route: '/api/qr/generate', allows: ['POST'] }))
}

export async function POST(request: NextRequest) {
  try {
    const { getCurrentUser } = await import('@/lib/auth')
    const { createClient } = await import('@supabase/supabase-js')
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return withCors(NextResponse.json({
        error: 'Server misconfiguration: Supabase URL or SERVICE_ROLE key is missing.'
      }, { status: 500 }))
    }
    // Check authentication using JWT
    const user = getCurrentUser()
    if (!user) {
      return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    // Check if user is a professor
    if (user.userType !== 'professor') {
      return withCors(NextResponse.json({ error: 'Only professors can generate QR codes' }, { status: 403 }))
    }

    // Create supabase client inside the function to avoid build-time errors
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const body = await request.json()
    const { courseId, expiresInMinutes = 30, classroomLocation } = body

    if (!courseId) {
      return withCors(NextResponse.json({ error: 'Course ID is required' }, { status: 400 }))
    }

    // Verify professor owns the course or create demo course
    let course
    if (courseId) {
      const { data: existingCourse } = await supabase
        .from('courses')
        .select('id')
        .eq('id', courseId)
        .eq('professor_id', user.userId) // 새 스키마에서는 professor_id가 TEXT
        .single()
      if (existingCourse) {
        course = existingCourse
      }
    }
    if (!course) {
      // 교수의 실제 위치가 전달되지 않은 경우 에러 처리
      if (!classroomLocation || !classroomLocation.latitude || !classroomLocation.longitude) {
        return withCors(NextResponse.json({ 
          error: '강의실 위치 정보가 필요합니다. 위치 설정을 먼저 완료해주세요.' 
        }, { status: 400 }))
      }

      // Create a demo course with professor's actual location
      const { data: newCourse, error: createError } = await supabase
        .from('courses')
        .insert({
          professor_id: user.userId,
          name: '데모 강의',
          course_code: 'DEMO101',
          classroom_location: {
            latitude: classroomLocation.latitude,
            longitude: classroomLocation.longitude,
            radius: classroomLocation.radius || 50 // 기본 50m 반경
          },
          schedule: [{
            day_of_week: 1,
            start_time: '09:00',
            end_time: '10:30'
          }]
        })
        .select('id')
        .single()
      if (createError) {
        console.error('Create demo course error:', createError)
        return withCors(NextResponse.json({ error: `Failed to create demo course: ${createError.message}` }, { status: 500 }))
      }
      course = newCourse
      
      // 데모 학생을 데모 코스에 자동 등록
      if (user.userType === 'professor') {
        // 현재 사용자가 학생이라면 자동 등록 (테스트용)
        // 실제로는 별도 API를 통해 관리해야 하지만, MVP에서는 자동 등록
        console.log('Demo course created, ID:', course.id)
      }
    }

    // Use the actual course ID (either existing or newly created)
    const actualCourseId = course.id
    
    // Generate QR code manually (temporary solution)
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const qrCodeValue = `${sessionId}_${actualCourseId}`
    const expiresAt = new Date(Date.now() + (expiresInMinutes * 60 * 1000))
    const today = new Date().toISOString().split('T')[0]

    // Create or find today's session
    let session
    const { data: existingSession } = await supabase
      .from('class_sessions')
      .select('*')
      .eq('course_id', actualCourseId)
      .eq('date', today)
      .single()

    if (existingSession) {
      // Update existing session with new QR code
      const { data: updatedSession, error: updateError } = await supabase
        .from('class_sessions')
        .update({
          qr_code: qrCodeValue,
          qr_code_expires_at: expiresAt.toISOString(),
          status: 'active'
        })
        .eq('id', existingSession.id)
        .select()
        .single()

      if (updateError) {
        console.error('Update session error:', updateError)
        return withCors(NextResponse.json({ error: 'Failed to update session' }, { status: 500 }))
      }
      session = updatedSession
    } else {
      // Create new session
      const { data: newSession, error: createError } = await supabase
        .from('class_sessions')
        .insert({
          course_id: actualCourseId,
          date: today,
          qr_code: qrCodeValue,
          qr_code_expires_at: expiresAt.toISOString(),
          status: 'active'
        })
        .select()
        .single()

      if (createError) {
        console.error('Create session error:', createError)
        return withCors(NextResponse.json({ error: 'Failed to create session' }, { status: 500 }))
      }
      session = newSession
    }

    const qrData = {
      sessionId: session.id,
      courseId: actualCourseId,
      expiresAt: session.qr_code_expires_at,
      type: 'attendance' as const
    }

    return withCors(NextResponse.json({ 
      success: true, 
      qrData,
      qrCode: qrCodeValue,
      expiresAt: session.qr_code_expires_at
    }))
  } catch (error) {
    console.error('QR generation API error:', error)
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
