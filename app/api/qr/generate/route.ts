import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type LocationType = 'predefined' | 'current'

interface QRGenerateRequest {
  courseId: string
  expiresInMinutes?: number
  classroomLocation: {
    latitude?: number | string | null
    longitude?: number | string | null
    radius?: number | string | null
    locationType?: LocationType
    predefinedLocationId?: string | null
    displayName?: string | null
  }
}

interface NormalizedLocation {
  latitude: number
  longitude: number
  radius: number
  locationType: LocationType
  predefinedLocationId: string | null
  displayName?: string
}

export async function POST(request: NextRequest) {
  try {
    console.log('QR generation API called')

    // Supabase 클라이언트 생성 (서비스 역할 키 사용)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 사용자 인증 확인
    const user = await getCurrentUser()
    console.log('User authentication result:', user)

    if (!user || user.userType !== 'professor') {
      return NextResponse.json(
        { error: 'Unauthorized. Professor access required.' },
        { status: 401 }
      )
    }

    // 요청 데이터 파싱 및 위치 정규화
    const payload: QRGenerateRequest = await request.json()
    const { courseId, expiresInMinutes = 30, classroomLocation } = payload

    if (!courseId || !classroomLocation) {
      return NextResponse.json(
        { error: 'Missing required fields: courseId, classroomLocation' },
        { status: 400 }
      )
    }

    const toNumber = (value: unknown): number | null => {
      if (value === null || value === undefined || value === '') {
        return null
      }
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null
      }
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    }

    const locationType: LocationType = classroomLocation.locationType === 'current' ? 'current' : 'predefined'
    let normalizedLocation: NormalizedLocation | null = null

    if (locationType === 'predefined' && classroomLocation.predefinedLocationId) {
      const { data: predefinedLocation, error: predefinedError } = await supabase
        .from('predefined_locations')
        .select('id, latitude, longitude, radius, display_name, is_active')
        .eq('id', classroomLocation.predefinedLocationId)
        .maybeSingle()

      if (predefinedError) {
        console.warn('⚠️ Failed to resolve predefined location, fallback to client payload:', predefinedError.message)
      }

      if (predefinedLocation && predefinedLocation.is_active !== false) {
        const lat = toNumber(predefinedLocation.latitude)
        const lon = toNumber(predefinedLocation.longitude)
        const rad = toNumber(predefinedLocation.radius)

        if (lat !== null && lon !== null) {
          normalizedLocation = {
            latitude: lat,
            longitude: lon,
            radius: rad ?? 100,
            locationType: 'predefined',
            predefinedLocationId: predefinedLocation.id,
            displayName: predefinedLocation.display_name ?? undefined
          }
        }
      }
    }

    const fallbackLat = toNumber(classroomLocation.latitude)
    const fallbackLon = toNumber(classroomLocation.longitude)
    const fallbackRadius = toNumber(classroomLocation.radius)

    if (!normalizedLocation) {
      if (fallbackLat === null || fallbackLon === null) {
        return NextResponse.json(
          { error: 'Invalid classroom location. latitude/longitude are required.' },
          { status: 400 }
        )
      }

      normalizedLocation = {
        latitude: fallbackLat,
        longitude: fallbackLon,
        radius: fallbackRadius ?? 100,
        locationType,
        predefinedLocationId: locationType === 'predefined' ? classroomLocation.predefinedLocationId ?? null : null,
        displayName: classroomLocation.displayName ?? undefined
      }
    } else {
      normalizedLocation = {
        ...normalizedLocation,
        radius: fallbackRadius ?? normalizedLocation.radius,
        locationType,
        predefinedLocationId: locationType === 'predefined' ? classroomLocation.predefinedLocationId ?? normalizedLocation.predefinedLocationId : null,
        displayName: classroomLocation.displayName ?? normalizedLocation.displayName
      }
    }

    if (!normalizedLocation) {
      return NextResponse.json(
        { error: 'Failed to normalize classroom location.' },
        { status: 400 }
      )
    }

    normalizedLocation.radius = Math.max(10, Math.round(normalizedLocation.radius))

    // 강의 정보 조회 또는 데모 강의 생성
    let courseName = '데모 강의'
    let courseCode = 'DEMO101'

    if (courseId.startsWith('demo-course-')) {
      // 데모 강의인 경우 기본 값 사용 (DB 조회 없이)
      courseName = '데모 강의'
      courseCode = 'DEMO101'
    } else {
      // 실제 강의인 경우 DB에서 조회
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('name, course_code')
        .eq('id', courseId)
        .eq('professor_id', user.userId)
        .single()

      if (courseError || !course) {
        return NextResponse.json(
          { error: 'Course not found or access denied' },
          { status: 404 }
        )
      }

      courseName = course.name
      courseCode = course.course_code
    }

    // 현재 시간과 만료 시간 계산
    const now = new Date()
    const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000)

    // 세션을 Supabase에 저장 (UUID는 자동 생성됨)
    // 데모 강의인 경우 course_id를 null로 설정
    const sessionData: Record<string, unknown> = {
      status: 'active',
      date: now.toISOString().split('T')[0], // YYYY-MM-DD 형식
      qr_code: 'placeholder', // 임시 플레이스홀더
      qr_code_expires_at: expiresAt.toISOString(), // QR 코드 만료 시간 추가
      classroom_latitude: normalizedLocation.latitude,
      classroom_longitude: normalizedLocation.longitude,
      classroom_radius: normalizedLocation.radius,
      updated_at: now.toISOString()
    }

    // 데모 강의가 아닌 경우에만 course_id 설정
    if (!courseId.startsWith('demo-course-')) {
      sessionData.course_id = courseId
    } else {
      // 데모 강의의 경우 실제 존재하는 강의 UUID 사용
      sessionData.course_id = '27468faa-0394-41bf-871a-a4079e9dee79'
    }

    // 먼저 세션을 생성해서 ID를 얻은 후 QR 코드 생성
    const { data: session, error: sessionError } = await supabase
      .from('class_sessions')
      .insert(sessionData)
      .select('id')
      .single()

    if (sessionError) {
      console.error('세션 저장 실패:', sessionError)
      return NextResponse.json(
        { error: 'Failed to create session: ' + sessionError.message },
        { status: 500 }
      )
    }

    const sessionId = session.id

    // 실제 QR 코드 문자열 생성 (학생이 스캔할 URL)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'
    const qrCodeString = `${baseUrl}/student/attendance/${sessionId}`

    // 생성된 세션의 qr_code 필드 업데이트
    const { error: updateError } = await supabase
      .from('class_sessions')
      .update({ qr_code: qrCodeString })
      .eq('id', sessionId)

    if (updateError) {
      console.error('QR 코드 업데이트 실패:', updateError)
      // 세션은 생성되었으므로 계속 진행
    }

    // QR 데이터 생성
    const qrData = {
      sessionId: sessionId,
      courseId: courseId,
      expiresAt: expiresAt.toISOString(),
      type: 'attendance' as const
    }

    console.log('Session saved:', {
      id: sessionId,
      courseId,
      courseName,
      courseCode,
      date: now.toISOString().split('T')[0],
      qrCode: qrCodeString,
      qrCodeExpiresAt: expiresAt.toISOString(),
      status: 'active',
      classroomLocation: normalizedLocation,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    })

    // 로컬 개발 환경용 세션 JSON 업데이트 (실패해도 무시)
    try {
      const fs = (await import('fs')).default
      const path = (await import('path')).default
      const sessionsFilePath = path.join(process.cwd(), 'data', 'sessions.json')

      if (fs.existsSync(sessionsFilePath)) {
        const raw = fs.readFileSync(sessionsFilePath, 'utf-8')
        let sessions: any[] = []
        try {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            sessions = parsed
          }
        } catch (parseError) {
          console.warn('⚠️ Failed to parse sessions.json. Recreating file.', parseError)
        }

        const filtered = sessions.filter(sessionItem => sessionItem?.id !== sessionId)
        filtered.push({
          id: sessionId,
          courseId,
          courseName,
          courseCode,
          date: now.toISOString().split('T')[0],
          qrCode: qrCodeString,
          qrCodeExpiresAt: expiresAt.toISOString(),
          status: 'active',
          classroomLocation: {
            latitude: normalizedLocation.latitude,
            longitude: normalizedLocation.longitude,
            radius: normalizedLocation.radius,
            locationType: normalizedLocation.locationType,
            predefinedLocationId: normalizedLocation.predefinedLocationId,
            displayName: normalizedLocation.displayName
          },
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        })

        fs.writeFileSync(sessionsFilePath, JSON.stringify(filtered, null, 2))
      }
    } catch (fileError) {
      console.warn('⚠️ Unable to update local sessions.json:', fileError instanceof Error ? fileError.message : fileError)
    }

    // 성공 응답
    return NextResponse.json({
      success: true,
      qrData,
      qrCode: qrCodeString,
      expiresAt: expiresAt.toISOString(),
      courseName,
      courseCode,
      classroomLocation: normalizedLocation
    })

  } catch (error) {
    console.error('QR generation error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error during QR generation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
