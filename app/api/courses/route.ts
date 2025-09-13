import { NextRequest, NextResponse } from 'next/server'

// 테스트용 강의 데이터 (데이터베이스 없이)
const DEMO_COURSES = [
  {
    id: 'course1',
    name: 'C언어프로그래밍',
    courseCode: 'C언어669',
    description: 'C언어 기초부터 고급까지',
    location: '제1자연관 501호',
    totalSessions: 0,
    professorId: 'prof001'
  },
  {
    id: 'course2',
    name: '데모 강의',
    courseCode: 'DEMO101',
    description: '테스트용 강의입니다',
    location: null,
    totalSessions: 1,
    professorId: 'prof001'
  },
  {
    id: 'course3',
    name: '자료구조와 알고리즘',
    courseCode: '자료구782',
    description: '자료구조와 알고리즘 이론 및 실습',
    location: '제1자연관 501호',
    totalSessions: 0,
    professorId: 'prof001'
  },
  {
    id: 'course4',
    name: '컴퓨터과학개론',
    courseCode: 'CS101',
    description: '컴퓨터과학의 기초 개념',
    location: null,
    totalSessions: 0,
    professorId: 'prof001'
  },
  {
    id: 'course5',
    name: '웹 프로그래밍',
    courseCode: 'WEB301',
    description: 'HTML, CSS, JavaScript 기반 웹 개발',
    location: '컴퓨터공학관 204호',
    totalSessions: 0,
    professorId: 'prof001'
  }
]

export async function GET(request: NextRequest) {
  try {
    // 실제 구현에서는 JWT에서 professorId를 가져와야 함
    const professorId = 'prof001' // 하드코딩된 테스트 ID

    // 해당 교수의 강의만 필터링
    const professorCourses = DEMO_COURSES.filter(course => course.professorId === professorId)

    return NextResponse.json({
      success: true,
      courses: professorCourses
    })
  } catch (error) {
    console.error('Courses fetch error:', error)
    return NextResponse.json(
      { error: '강의 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, courseCode, description, location } = await request.json()

    if (!name || !courseCode) {
      return NextResponse.json(
        { error: '강의명과 강의코드는 필수입니다.' },
        { status: 400 }
      )
    }

    // 새 강의 생성 (실제로는 데이터베이스에 저장)
    const newCourse = {
      id: `course_${Date.now()}`,
      name,
      courseCode,
      description: description || '',
      location: location || null,
      totalSessions: 0,
      professorId: 'prof001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      course: newCourse
    })
  } catch (error) {
    console.error('Course creation error:', error)
    return NextResponse.json(
      { error: '강의 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}