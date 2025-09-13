import { NextRequest, NextResponse } from 'next/server'

// 임시 세션 저장소 (실제로는 데이터베이스 사용)
const activeSessions = new Map()

export async function POST(request: NextRequest) {
  try {
    const { courseId } = await request.json()

    if (!courseId) {
      return NextResponse.json(
        { error: '강의 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 강의 정보 가져오기 (하드코딩)
    const courses = [
      { id: 'course1', name: 'C언어프로그래밍', courseCode: 'C언어669' },
      { id: 'course2', name: '데모 강의', courseCode: 'DEMO101' },
      { id: 'course3', name: '자료구조와 알고리즘', courseCode: '자료구782' },
      { id: 'course4', name: '컴퓨터과학개론', courseCode: 'CS101' },
      { id: 'course5', name: '웹 프로그래밍', courseCode: 'WEB301' }
    ]

    const course = courses.find(c => c.id === courseId)
    if (!course) {
      return NextResponse.json(
        { error: '강의를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 새 세션 생성
    const sessionId = `session_${Date.now()}`
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30분 후 만료

    const session = {
      id: sessionId,
      courseId: course.id,
      courseName: course.name,
      courseCode: course.courseCode,
      qrCode: `QR_${sessionId}`, // 실제로는 QR코드 생성 라이브러리 사용
      expiresAt: expiresAt.toISOString(),
      isActive: true,
      createdAt: new Date().toISOString()
    }

    // 세션 저장
    activeSessions.set(sessionId, session)

    console.log('Created session:', session)

    return NextResponse.json({
      success: true,
      session: session
    })

  } catch (error) {
    console.error('Session creation error:', error)
    return NextResponse.json(
      { error: '세션 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}