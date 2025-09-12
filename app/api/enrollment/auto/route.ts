import { getCurrentUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// MVP용 자동 등록 API - 학생이 QR 스캔 시 자동으로 데모 강의에 등록
export async function POST(request: NextRequest) {
  try {
    // Check authentication using JWT
    const user = getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is a student
    if (user.userType !== 'student') {
      return NextResponse.json({ error: 'Only students can enroll' }, { status: 403 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const body = await request.json()
    const { courseId } = body

    if (!courseId) {
      return NextResponse.json({ error: 'Course ID is required' }, { status: 400 })
    }

    // 새 스키마에서는 student_id를 직접 사용 (TEXT)
    const { data: studentRecord, error: studentError } = await supabase
      .from('students')
      .select('student_id')
      .eq('student_id', user.userId)
      .single()

    if (studentError || !studentRecord) {
      console.error('Student not found:', studentError)
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 })
    }

    // Check if already enrolled
    const { data: existingEnrollment } = await supabase
      .from('course_enrollments')
      .select('id')
      .eq('course_id', courseId)
      .eq('student_id', user.userId)
      .single()

    if (existingEnrollment) {
      return NextResponse.json({ 
        success: true, 
        message: 'Already enrolled',
        enrollmentId: existingEnrollment.id
      })
    }

    // Auto-enroll student in the course
    const { data: enrollment, error: enrollError } = await supabase
      .from('course_enrollments')
      .insert({
        course_id: courseId,
        student_id: user.userId, // TEXT student_id 직접 사용
        enrolled_at: new Date().toISOString()
      })
      .select()
      .single()

    if (enrollError) {
      console.error('Auto-enrollment error:', enrollError)
      return NextResponse.json({ error: 'Failed to enroll student' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Successfully enrolled',
      enrollmentId: enrollment.id
    })
  } catch (error) {
    console.error('Auto-enrollment API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}