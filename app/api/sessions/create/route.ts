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

    // 강의실 위치 정보 (실제로는 데이터베이스에서 가져와야 함)
    const locationData: Record<string, { lat: number, lng: number, address: string, radius: number }> = {
      'course1': { lat: 37.2935, lng: 126.9740, address: '제1자연관 501호', radius: 50 }, // C언어프로그래밍
      'course2': { lat: 37.2930, lng: 126.9745, address: '데모 강의실', radius: 30 }, // 데모 강의
      'course3': { lat: 37.2935, lng: 126.9740, address: '제1자연관 501호', radius: 50 }, // 자료구조와 알고리즘
      'course4': { lat: 37.2925, lng: 126.9735, address: '미설정', radius: 100 }, // 컴퓨터과학개론
      'course5': { lat: 37.2940, lng: 126.9750, address: '컴퓨터공학관 204호', radius: 40 } // 웹 프로그래밍
    }

    const locationInfo = locationData[courseId] || { lat: 37.2930, lng: 126.9740, address: '기본 위치', radius: 50 }

    // 새 세션 생성
    const sessionId = `session_${Date.now()}`
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30분 후 만료

    const session = {
      id: sessionId,
      courseId: course.id,
      courseName: course.name,
      courseCode: course.courseCode,
      location: locationInfo,
      qrCode: JSON.stringify({
        sessionId: sessionId,
        courseId: course.id,
        courseName: course.name,
        location: locationInfo,
        expiresAt: expiresAt.toISOString(),
        attendanceUrl: `/student/attendance/${sessionId}`
      }),
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