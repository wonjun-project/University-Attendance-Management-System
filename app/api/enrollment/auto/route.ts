import { getCurrentUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

interface EnrollmentRecord {
  id: string
  courseId: string
  studentId: string
  enrolledAt: string
}

// MVP용 자동 등록 API - 학생이 QR 스캔 시 자동으로 데모 강의에 등록
export async function POST(request: NextRequest) {
  try {
    // Check authentication using JWT
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is a student
    if (user.userType !== 'student') {
      return NextResponse.json({ error: 'Only students can enroll' }, { status: 403 })
    }

    const body = await request.json()
    const { courseId } = body

    if (!courseId) {
      return NextResponse.json({ error: 'Course ID is required' }, { status: 400 })
    }

    // 파일 경로 설정
    const dataDir = path.join(process.cwd(), 'data')
    const enrollmentsPath = path.join(dataDir, 'enrollments.json')

    // 등록 데이터 읽기
    let enrollments: EnrollmentRecord[] = []
    try {
      const enrollmentsData = await fs.readFile(enrollmentsPath, 'utf-8')
      enrollments = JSON.parse(enrollmentsData)
    } catch {
      // 파일이 없으면 빈 배열로 시작
      enrollments = []
    }

    // 이미 등록되어 있는지 확인
    const existingEnrollment = enrollments.find(
      e => e.courseId === courseId && e.studentId === user.userId
    )

    if (existingEnrollment) {
      return NextResponse.json({
        success: true,
        message: 'Already enrolled',
        enrollmentId: existingEnrollment.id
      })
    }

    // 새로운 등록 생성
    const newEnrollment: EnrollmentRecord = {
      id: `enroll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      courseId: courseId,
      studentId: user.userId,
      enrolledAt: new Date().toISOString()
    }

    enrollments.push(newEnrollment)

    // 파일에 저장
    await fs.writeFile(enrollmentsPath, JSON.stringify(enrollments, null, 2))

    console.log(`자동 등록 완료: ${user.name} (${user.userId}) -> ${courseId}`)

    return NextResponse.json({
      success: true,
      message: 'Successfully enrolled',
      enrollmentId: newEnrollment.id
    })
  } catch (error) {
    console.error('Auto-enrollment API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
