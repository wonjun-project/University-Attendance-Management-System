import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-admin'

interface EnrollmentRequest {
  courseId: string
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'student') {
      return NextResponse.json({ error: 'Only students can enroll' }, { status: 403 })
    }

    const body = (await request.json()) as Partial<EnrollmentRequest>
    const courseId = body.courseId

    if (!courseId) {
      return NextResponse.json({ error: 'Course ID is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .maybeSingle<{ id: string }>()

    if (courseError) {
      console.error('Course lookup error:', courseError)
      return NextResponse.json({ error: 'Failed to verify course.' }, { status: 500 })
    }

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 })
    }

    const { data: existingEnrollment, error: enrollmentLookupError } = await supabase
      .from('course_enrollments')
      .select('id')
      .eq('course_id', courseId)
      .eq('student_id', user.userId)
      .maybeSingle<{ id: string }>()

    if (enrollmentLookupError) {
      console.error('Enrollment lookup error:', enrollmentLookupError)
      return NextResponse.json({ error: 'Failed to verify enrollment.' }, { status: 500 })
    }

    if (existingEnrollment) {
      return NextResponse.json({
        success: true,
        message: 'Already enrolled',
        enrollmentId: existingEnrollment.id
      })
    }

    const { data: inserted, error: insertError } = await supabase
      .from('course_enrollments')
      .insert({
        course_id: courseId,
        student_id: user.userId,
        enrolled_at: new Date().toISOString()
      })
      .select('id')
      .single<{ id: string }>()

    if (insertError || !inserted) {
      console.error('Auto-enrollment insert error:', insertError)
      return NextResponse.json({ error: 'Failed to enroll in course' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully enrolled',
      enrollmentId: inserted.id
    })
  } catch (error) {
    console.error('Auto-enrollment API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
