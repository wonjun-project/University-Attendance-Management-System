import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import { jwtVerify } from 'jose'

// Course 타입 정의
interface Course {
  id: string
  name: string
  courseCode: string
  description: string
  location: string | null
  totalSessions: number
  professorId: string
  classroomLocation?: {
    latitude: number
    longitude: number
    radius: number
  }
  createdAt?: string
  updatedAt?: string
}

// 강의 데이터 파일 경로
const COURSES_FILE = path.join(process.cwd(), 'data', 'courses.json')

// 강의 데이터를 파일에서 읽어오기
function getCourses() {
  try {
    if (fs.existsSync(COURSES_FILE)) {
      const data = fs.readFileSync(COURSES_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('강의 데이터 읽기 실패:', error)
  }
  return []
}

// 강의 데이터를 파일에 저장하기
function saveCourses(courses: Course[]) {
  try {
    const dir = path.dirname(COURSES_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(COURSES_FILE, JSON.stringify(courses, null, 2))
    return true
  } catch (error) {
    console.error('강의 데이터 저장 실패:', error)
    return false
  }
}

// 초기 강의 데이터
const INITIAL_COURSES = [
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

// JWT에서 사용자 정보 추출
async function getUserFromRequest(request: NextRequest) {
  const authToken = request.cookies.get('auth-token')?.value

  if (!authToken) {
    return null
  }

  const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
  const secret = new TextEncoder().encode(jwtSecret)

  try {
    const { payload } = await jwtVerify(authToken, secret)
    return {
      userId: payload.userId as string,
      userType: payload.userType as string,
      name: payload.name as string
    }
  } catch (error) {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    // JWT에서 professorId 가져오기
    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      )
    }

    const professorId = user.userId

    // 파일에서 강의 데이터 읽기
    let allCourses = getCourses()

    // 초기 데이터가 없으면 기본 강의 생성
    if (allCourses.length === 0) {
      const initialCourses = INITIAL_COURSES.map(course => ({
        ...course,
        professorId: professorId
      }))
      saveCourses(initialCourses)
      allCourses = initialCourses
    }

    // 해당 교수의 강의만 필터링
    const professorCourses = allCourses.filter((course: Course) => course.professorId === professorId)

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

    // JWT에서 professorId 가져오기
    const user = await getUserFromRequest(request)
    if (!user || user.userType !== 'professor') {
      return NextResponse.json(
        { error: '교수만 강의를 생성할 수 있습니다' },
        { status: 403 }
      )
    }

    // 기존 강의 데이터 읽기
    const courses = getCourses()

    // 새 강의 생성
    const newCourse = {
      id: `course_${Date.now()}`,
      name,
      courseCode,
      description: description || '',
      location: location || null,
      totalSessions: 0,
      professorId: user.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // 강의 목록에 추가하고 저장
    courses.push(newCourse)
    saveCourses(courses)

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