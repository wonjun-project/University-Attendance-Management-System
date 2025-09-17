import { getCurrentUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

// Haversine 공식을 이용한 두 지점 간 거리 계산 (미터 단위)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // 지구의 반지름 (미터)
  const φ1 = lat1 * Math.PI/180; // φ, λ를 라디안으로 변환
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // 거리 (미터)
}

// 파일 기반 데이터 타입 정의
interface AttendanceRecord {
  id: string
  sessionId: string
  studentId: string
  status: 'present' | 'absent' | 'late'
  checkInTime: string
  locationVerified: boolean
  distance?: number
  latitude?: number
  longitude?: number
  accuracy?: number
}

interface EnrollmentRecord {
  id: string
  courseId: string
  studentId: string
  enrolledAt: string
}

interface SessionRecord {
  id: string
  courseId: string
  courseName: string
  courseCode: string
  date: string
  qrCode: string
  qrCodeExpiresAt: string
  status: string
  classroomLocation: {
    latitude: number
    longitude: number
    radius: number
  }
  createdAt: string
  updatedAt: string
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Check authentication using JWT
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is a student
    if (user.userType !== 'student') {
      return NextResponse.json({ error: 'Only students can check in' }, { status: 403 })
    }

    const body = await request.json()
    const { sessionId, latitude, longitude, accuracy = 0 } = body

    if (!sessionId || latitude === undefined || longitude === undefined) {
      return NextResponse.json({
        error: 'Session ID, latitude, and longitude are required'
      }, { status: 400 })
    }

    // 위치 값이 유효한 숫자인지 검증
    const lat = Number(latitude)
    const lon = Number(longitude)
    const acc = Number(accuracy) || 0

    if (isNaN(lat) || isNaN(lon)) {
      return NextResponse.json({
        error: '유효하지 않은 위치 정보입니다. 위도와 경도는 숫자여야 합니다.'
      }, { status: 400 })
    }

    // 위치 값이 유효한 범위인지 검증
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return NextResponse.json({
        error: '유효하지 않은 위치 범위입니다. 위도는 -90~90, 경도는 -180~180 사이여야 합니다.'
      }, { status: 400 })
    }

    // 데이터 파일 경로 설정
    const dataDir = path.join(process.cwd(), 'data')
    const sessionsPath = path.join(dataDir, 'sessions.json')
    const attendancePath = path.join(dataDir, 'attendance.json')
    const enrollmentsPath = path.join(dataDir, 'enrollments.json')

    // 세션 정보 조회
    const sessionsData = await fs.readFile(sessionsPath, 'utf-8')
    const sessions: SessionRecord[] = JSON.parse(sessionsData)
    const session = sessions.find((s) => s.id === sessionId)

    if (!session) {
      console.error('Session not found:', sessionId)
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    console.log('=== 출석 체크인 시도 ===')
    console.log(`학생: ${user.name} (${user.userId})`)
    console.log(`위치: (${lat}, ${lon}) ±${acc}m`)

    if (session.status !== 'active') {
      return NextResponse.json({ error: 'Session is not active' }, { status: 400 })
    }

    // 만료 시간 디버깅
    const expiresAt = new Date(session.qrCodeExpiresAt)
    const currentTime = new Date()
    console.log('QR 만료 시간 체크:')
    console.log('  - 만료 시간:', expiresAt.toISOString(), '(', expiresAt.getTime(), ')')
    console.log('  - 현재 시간:', currentTime.toISOString(), '(', currentTime.getTime(), ')')
    console.log('  - 만료됨?:', expiresAt < currentTime)

    if (expiresAt < currentTime) {
      return NextResponse.json({
        error: 'QR code has expired',
        debug: {
          expiresAt: session.qrCodeExpiresAt,
          currentTime: currentTime.toISOString(),
          expired: true
        }
      }, { status: 400 })
    }

    // 등록 여부 확인
    let enrollments: EnrollmentRecord[] = []
    try {
      const enrollmentsData = await fs.readFile(enrollmentsPath, 'utf-8')
      enrollments = JSON.parse(enrollmentsData)
    } catch {
      // 등록 파일이 없으면 빈 배열로 초기화
      enrollments = []
    }

    const isEnrolled = enrollments.some(e =>
      e.courseId === session.courseId && e.studentId === user.userId
    )

    if (!isEnrolled) {
      // 자동 등록 (MVP용)
      console.log(`자동 등록 진행: ${user.userId} -> ${session.courseId}`)
      const newEnrollment: EnrollmentRecord = {
        id: `enroll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        courseId: session.courseId,
        studentId: user.userId,
        enrolledAt: new Date().toISOString()
      }
      enrollments.push(newEnrollment)
      await fs.writeFile(enrollmentsPath, JSON.stringify(enrollments, null, 2))
    }

    // 강의실 위치 정보 확인
    const classroomLocation = session.classroomLocation

    if (!classroomLocation) {
      return NextResponse.json({ error: 'Classroom location not configured' }, { status: 500 })
    }

    console.log(`강의실: (${classroomLocation.latitude}, ${classroomLocation.longitude}) 반경 ${classroomLocation.radius}m`)

    // 학생 위치와 강의실 위치 간 거리 계산 (검증된 값 사용)
    const distance = calculateDistance(
      lat,  // 검증된 숫자 값 사용
      lon,  // 검증된 숫자 값 사용
      classroomLocation.latitude,
      classroomLocation.longitude
    );

    // 거리 계산 결과가 유효한지 확인
    if (isNaN(distance)) {
      console.error('거리 계산 실패:', { lat, lon, classroomLocation })
      return NextResponse.json({
        error: '위치 검증 중 오류가 발생했습니다. 위치 정보를 확인해주세요.'
      }, { status: 400 })
    }

    // 허용 반경 내에 있는지 확인
    const isLocationValid = distance <= classroomLocation.radius;

    console.log(`거리: ${Math.round(distance)}m / 허용: ${classroomLocation.radius}m → ${isLocationValid ? '✅ 승인' : '❌ 거부'}`)

    if (!isLocationValid) {
      return NextResponse.json({
        error: `위치 검증 실패: 강의실에서 ${Math.round(distance)}m 떨어져 있습니다. (허용 반경: ${classroomLocation.radius}m)`,
        distance: Math.round(distance),
        allowedRadius: classroomLocation.radius
      }, { status: 400 })
    }

    // 출석 기록 읽기/생성
    let attendanceRecords: AttendanceRecord[] = []
    try {
      const attendanceData = await fs.readFile(attendancePath, 'utf-8')
      attendanceRecords = JSON.parse(attendanceData)
    } catch {
      // 출석 파일이 없으면 빈 배열로 초기화
      attendanceRecords = []
    }

    // 기존 출석 기록 확인
    const existingAttendance = attendanceRecords.find(
      a => a.sessionId === sessionId && a.studentId === user.userId
    )

    const attendanceId = existingAttendance?.id ||
      `attendance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const attendanceRecord: AttendanceRecord = {
      id: attendanceId,
      sessionId: sessionId,
      studentId: user.userId,
      status: 'present',
      checkInTime: new Date().toISOString(),
      locationVerified: isLocationValid,
      distance: Math.round(distance),
      latitude: lat,  // 검증된 값 사용
      longitude: lon,  // 검증된 값 사용
      accuracy: acc    // 검증된 값 사용
    }

    if (existingAttendance) {
      // 기존 기록 업데이트
      const index = attendanceRecords.findIndex(a => a.id === attendanceId)
      attendanceRecords[index] = attendanceRecord
    } else {
      // 새로운 기록 추가
      attendanceRecords.push(attendanceRecord)
    }

    // 출석 파일 저장
    await fs.writeFile(attendancePath, JSON.stringify(attendanceRecords, null, 2))

    console.log(`✅ 출석 체크 완료: ${user.name} (${user.userId})`)

    return NextResponse.json({
      success: true,
      attendanceId: attendanceId,
      sessionId: sessionId, // 출석 추적 페이지에서 사용할 세션 ID
      message: 'Successfully checked in',
      locationVerified: isLocationValid,
      distance: Math.round(distance)
    })
  } catch (error) {
    console.error('Check-in API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
