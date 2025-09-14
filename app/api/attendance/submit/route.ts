import { NextRequest, NextResponse } from 'next/server'
import { sessionStore } from '@/lib/session-store'

// 출석 기록 저장소 (실제로는 데이터베이스 사용)
const attendanceRecords = global.attendanceRecords || (global.attendanceRecords = new Map())

// 거리 계산 함수 (Haversine formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371e3 // 지구 반지름 (미터)
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // 거리 (미터)
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, studentId, studentName, currentLocation } = await request.json()

    if (!sessionId || !studentId || !studentName || !currentLocation) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      )
    }

    if (!currentLocation.lat || !currentLocation.lng) {
      return NextResponse.json(
        { error: '위치 정보가 올바르지 않습니다.' },
        { status: 400 }
      )
    }

    // 세션 확인 - 새로운 저장소 사용
    const session = sessionStore.get(sessionId)
    if (!session) {
      return NextResponse.json(
        { error: '유효하지 않은 세션입니다.' },
        { status: 404 }
      )
    }

    // 세션 만료 확인
    if (new Date() > new Date(session.expiresAt)) {
      return NextResponse.json(
        { error: '만료된 세션입니다.' },
        { status: 410 }
      )
    }

    // 이미 출석했는지 확인
    const attendanceKey = `${sessionId}_${studentId}`
    if (attendanceRecords.has(attendanceKey)) {
      return NextResponse.json(
        { error: '이미 출석 처리되었습니다.' },
        { status: 409 }
      )
    }

    // 거리 계산
    const distance = calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      session.location.lat,
      session.location.lng
    )

    const isWithinRange = distance <= session.location.radius

    // 출석 기록 저장
    const attendanceRecord = {
      sessionId,
      studentId,
      studentName,
      courseId: session.courseId,
      courseName: session.courseName,
      submittedLocation: currentLocation,
      targetLocation: session.location,
      distance: Math.round(distance),
      isWithinRange,
      status: isWithinRange ? 'present' : 'out_of_range',
      submittedAt: new Date().toISOString()
    }

    attendanceRecords.set(attendanceKey, attendanceRecord)

    console.log('Attendance submitted:', attendanceRecord)

    return NextResponse.json({
      success: true,
      attendance: attendanceRecord,
      message: isWithinRange
        ? `✅ 출석이 완료되었습니다! (거리: ${Math.round(distance)}m)`
        : `❌ 강의실에서 너무 멀리 떨어져 있습니다. (거리: ${Math.round(distance)}m, 허용범위: ${session.location.radius}m)`
    })

  } catch (error) {
    console.error('Attendance submission error:', error)
    return NextResponse.json(
      { error: '출석 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}