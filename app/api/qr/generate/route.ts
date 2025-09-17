import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import * as fs from 'fs'
import * as path from 'path'

// Ensure Node.js runtime (service role key usage)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

// 타입 정의
interface Course {
  id: string
  name: string
  courseCode: string
  description: string
  location: string | null
  professorId: string
  totalSessions: number
  classroomLocation?: {
    latitude: number
    longitude: number
    radius: number
  }
  createdAt?: string
  updatedAt?: string
}

interface Session {
  id: string
  courseId: string
  courseName: string
  courseCode: string
  date: string
  qrCode: string
  qrCodeExpiresAt: string
  status: string
  classroomLocation?: {
    latitude: number
    longitude: number
    radius: number
  }
  createdAt: string
  updatedAt: string
}

// 세션 데이터 파일 경로
const SESSIONS_FILE = path.join(process.cwd(), 'data', 'sessions.json')
const COURSES_FILE = path.join(process.cwd(), 'data', 'courses.json')

// 세션 데이터를 파일에서 읽어오기
function getSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = fs.readFileSync(SESSIONS_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('세션 데이터 읽기 실패:', error)
  }
  return []
}

// 세션 데이터를 파일에 저장하기
function saveSessions(sessions: Session[]) {
  try {
    const dir = path.dirname(SESSIONS_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2))
    return true
  } catch (error) {
    console.error('세션 데이터 저장 실패:', error)
    return false
  }
}

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
function saveCourses(courses: any[]) {
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

// JWT에서 사용자 정보 추출
async function getCurrentUserFromRequest(request: NextRequest) {
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
    console.log('QR generation API called')

    // Check authentication using JWT from request
    const user = await getCurrentUserFromRequest(request)
    console.log('User authentication result:', user ? { userId: user.userId, userType: user.userType } : 'No user')

    if (!user) {
      return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    // Check if user is a professor
    if (user.userType !== 'professor') {
      return withCors(NextResponse.json({ error: 'Only professors can generate QR codes' }, { status: 403 }))
    }

    const body = await request.json()
    const { courseId, expiresInMinutes = 30, classroomLocation } = body

    if (!courseId) {
      return withCors(NextResponse.json({ error: 'Course ID is required' }, { status: 400 }))
    }

    // 강의 데이터 확인 또는 생성
    let courses = getCourses()
    let course = courses.find((c: Course) => c.id === courseId && c.professorId === user.userId)

    if (!course) {
      // 교수의 실제 위치가 전달되지 않은 경우 에러 처리
      if (!classroomLocation || !classroomLocation.latitude || !classroomLocation.longitude) {
        return withCors(NextResponse.json({
          error: '강의실 위치 정보가 필요합니다. 위치 설정을 먼저 완료해주세요.'
        }, { status: 400 }))
      }

      // 데모 강의 생성
      const newCourse = {
        id: courseId || `demo_${Date.now()}`,
        professorId: user.userId,
        name: '데모 강의',
        courseCode: 'DEMO101',
        description: '테스트용 강의입니다',
        location: `위도: ${classroomLocation.latitude}, 경도: ${classroomLocation.longitude}`,
        classroomLocation: {
          latitude: classroomLocation.latitude,
          longitude: classroomLocation.longitude,
          radius: classroomLocation.radius || 100
        },
        totalSessions: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      courses.push(newCourse)
      saveCourses(courses)
      course = newCourse

      console.log('Demo course created, ID:', course.id)
    }

    // 실제 course ID 사용
    const actualCourseId = course.id

    // QR 코드 생성
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const qrCodeValue = `${sessionId}_${actualCourseId}`
    const expiresAt = new Date(Date.now() + (expiresInMinutes * 60 * 1000))
    const today = new Date().toISOString().split('T')[0]

    // 세션 데이터 읽기
    let sessions = getSessions()

    // 오늘 날짜의 기존 세션 찾기
    let session = sessions.find((s: Session) =>
      s.courseId === actualCourseId &&
      s.date === today
    )

    if (session) {
      // 기존 세션 업데이트
      session.qrCode = qrCodeValue
      session.qrCodeExpiresAt = expiresAt.toISOString()
      session.status = 'active'
      session.updatedAt = new Date().toISOString()
    } else {
      // 새 세션 생성
      session = {
        id: sessionId,
        courseId: actualCourseId,
        courseName: course.name,
        courseCode: course.courseCode,
        date: today,
        qrCode: qrCodeValue,
        qrCodeExpiresAt: expiresAt.toISOString(),
        status: 'active',
        classroomLocation: course.classroomLocation || classroomLocation,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      sessions.push(session)
    }

    // 세션 저장
    saveSessions(sessions)
    console.log('Session saved:', session)

    const qrData = {
      sessionId: session.id,
      courseId: actualCourseId,
      expiresAt: session.qrCodeExpiresAt,
      type: 'attendance' as const
    }

    return withCors(NextResponse.json({
      success: true,
      qrData,
      qrCode: qrCodeValue,
      expiresAt: session.qrCodeExpiresAt
    }))
  } catch (error) {
    console.error('QR generation API error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error)
    })

    return withCors(NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 }))
  }
}