import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SessionRecord {
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
}

interface CourseRecord {
  id: string
  name: string
  courseCode: string
  location?: string | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id

    if (!sessionId) {
      return NextResponse.json(
        { error: '세션 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    console.log('Fetching session from file:', sessionId)

    // 파일에서 세션 데이터 읽기
    const dataDir = path.join(process.cwd(), 'data')
    const sessionsPath = path.join(dataDir, 'sessions.json')
    const coursesPath = path.join(dataDir, 'courses.json')

    const [sessionsData, coursesData] = await Promise.all([
      fs.readFile(sessionsPath, 'utf-8'),
      fs.readFile(coursesPath, 'utf-8')
    ])

    const sessions: SessionRecord[] = JSON.parse(sessionsData)
    const courses: CourseRecord[] = JSON.parse(coursesData)

    // 세션 찾기
    const session = sessions.find((s) => s.id === sessionId)

    if (!session) {
      return NextResponse.json(
        { error: '세션을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 세션 만료 확인
    if (new Date() > new Date(session.qrCodeExpiresAt)) {
      return NextResponse.json(
        { error: '만료된 세션입니다.' },
        { status: 410 }
      )
    }

    // 강의 정보 찾기
    const course = courses.find((c) => c.id === session.courseId)

    if (!course) {
      return NextResponse.json(
        { error: '강의 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 응답 데이터 구성 (QRCodeScannerNative 컴포넌트가 기대하는 형식)
    const responseData = {
      session: {
        id: session.id,
        courseId: session.courseId || course.id,
        course_id: session.courseId || course.id, // 레거시 호환성
        courseName: session.courseName || course.name,
        courseCode: session.courseCode || course.courseCode,
        qr_code_expires_at: session.qrCodeExpiresAt, // 레거시 호환성
        expiresAt: session.qrCodeExpiresAt,
        status: session.status,
        date: session.date,
        classroomLocation: session.classroomLocation,
        location: {
          lat: session.classroomLocation?.latitude || 0,
          lng: session.classroomLocation?.longitude || 0,
          address: course.location || '위치 정보 없음',
          radius: session.classroomLocation?.radius || 100
        },
        isActive: session.status === 'active'
      }
    }

    console.log('Session found and returned:', responseData.session.id)

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Session retrieval error:', error)
    return NextResponse.json(
      { error: '세션 정보를 가져오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
