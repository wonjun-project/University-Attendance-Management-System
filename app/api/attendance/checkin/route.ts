import { getCurrentUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { autoEndSessionIfNeeded } from '@/lib/session/session-service'
import { SupabaseSessionRow } from '@/lib/session/types'
import { promises as fs } from 'fs'
import path from 'path'

// Haversine 공식을 이용한 두 지점 간 거리 계산 (미터 단위)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000 // 지구의 반지름 (미터)
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DATA_DIR = path.join(process.cwd(), 'data')
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json')
const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance.json')

interface ResolvedLocation {
  latitude: number
  longitude: number
  radius: number
  locationType?: 'predefined' | 'current'
  predefinedLocationId?: string | null
  displayName?: string
}

interface LocalSessionRecord {
  id: string
  courseId: string
  courseName?: string
  courseCode?: string
  date?: string
  qrCode?: string
  qrCodeExpiresAt?: string
  qr_code_expires_at?: string
  status?: 'active' | 'ended'
  classroomLocation?: {
    latitude: number
    longitude: number
    radius: number
    locationType?: 'predefined' | 'current'
    predefinedLocationId?: string | null
    displayName?: string
  }
  createdAt?: string
  updatedAt?: string
}

interface LocalAttendanceRecord {
  id: string
  sessionId: string
  studentId: string
  status: 'present' | 'late' | 'absent' | 'left_early'
  checkInTime: string
  locationVerified: boolean
  distance: number
  latitude: number
  longitude: number
  accuracy: number
}

async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return defaultValue
  }
}

async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

async function loadLocalSession(sessionId: string): Promise<LocalSessionRecord | null> {
  const sessions = await readJsonFile<LocalSessionRecord[]>(SESSIONS_FILE, [])
  return sessions.find(session => session.id === sessionId) ?? null
}

async function upsertLocalSession(session: LocalSessionRecord): Promise<void> {
  const sessions = await readJsonFile<LocalSessionRecord[]>(SESSIONS_FILE, [])
  const filtered = sessions.filter(item => item.id !== session.id)
  filtered.push(session)
  await writeJsonFile(SESSIONS_FILE, filtered)
}

async function upsertLocalAttendance(record: LocalAttendanceRecord): Promise<void> {
  const attendances = await readJsonFile<LocalAttendanceRecord[]>(ATTENDANCE_FILE, [])
  const filtered = attendances.filter(att => !(att.sessionId === record.sessionId && att.studentId === record.studentId))
  filtered.push(record)
  await writeJsonFile(ATTENDANCE_FILE, filtered)
}

function evaluateLocation(
  student: { latitude: number; longitude: number; accuracy: number },
  classroom: ResolvedLocation
) {
  const distance = calculateDistance(student.latitude, student.longitude, classroom.latitude, classroom.longitude)
  const effectiveDistance = Math.max(0, distance - student.accuracy)
  const allowedRadius = classroom.radius
  const isDevelopment = process.env.NODE_ENV === 'development'
  const isLocationValid = isDevelopment || effectiveDistance <= allowedRadius

  return {
    distance,
    effectiveDistance,
    allowedRadius,
    isLocationValid,
    isDevelopment
  }
}

function normalizeLocalSessionLocation(session: LocalSessionRecord): ResolvedLocation {
  const fallbackRadius = 150
  const location = session.classroomLocation

  if (location?.latitude !== undefined && location?.longitude !== undefined) {
    return {
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      radius: Number(location.radius ?? fallbackRadius) || fallbackRadius,
      locationType: location.locationType ?? 'predefined',
      predefinedLocationId: location.predefinedLocationId ?? null,
      displayName: location.displayName
    }
  }

  return {
    latitude: 37.5665,
    longitude: 126.9780,
    radius: fallbackRadius,
    locationType: 'predefined' as const,
    predefinedLocationId: null,
    displayName: '기본 강의실 위치'
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    const lat = Number(latitude)
    const lon = Number(longitude)
    const acc = Number(accuracy) || 0

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return NextResponse.json({
        error: '유효하지 않은 위치 정보입니다. 위도와 경도는 숫자여야 합니다.'
      }, { status: 400 })
    }

    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return NextResponse.json({
        error: '유효하지 않은 위치 범위입니다. 위도는 -90~90, 경도는 -180~180 사이여야 합니다.'
      }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseAvailable = Boolean(supabaseUrl && supabaseServiceRoleKey)

    if (supabaseAvailable) {
      try {
        const response = await handleSupabaseCheckIn({
          sessionId,
          lat,
          lon,
          acc,
          userId: user.userId,
          userName: user.name,
          supabaseUrl: supabaseUrl!,
          serviceRoleKey: supabaseServiceRoleKey!
        })

        if (response) {
          return response
        }

        console.warn('Supabase 세션을 찾지 못해 로컬 데이터로 폴백합니다.')
      } catch (supabaseError) {
        console.warn('Supabase 출석 체크 처리 실패, 로컬 저장소로 폴백합니다:', supabaseError)
      }
    }

    return await handleLocalCheckIn({ sessionId, lat, lon, acc, userId: user.userId, userName: user.name })
  } catch (error) {
    console.error('Check-in API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleSupabaseCheckIn(args: {
  sessionId: string
  lat: number
  lon: number
  acc: number
  userId: string
  userName: string
  supabaseUrl: string
  serviceRoleKey: string
}): Promise<NextResponse | null> {
  const { sessionId, lat, lon, acc, userId, userName, supabaseUrl, serviceRoleKey } = args
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: session, error: sessionError } = await supabase
    .from('class_sessions')
    .select(`
      id,
      course_id,
      created_at,
      updated_at,
      qr_code_expires_at,
      status,
      classroom_latitude,
      classroom_longitude,
      classroom_radius,
      classroom_location_type,
      predefined_location_id,
      classroom_display_name,
      courses (
        id,
        name,
        course_code,
        classroom_location
      )
    `)
    .eq('id', sessionId)
    .maybeSingle()

  if (sessionError) {
    throw new Error(`Failed to load session: ${sessionError.message}`)
  }

  if (!session) {
    return null
  }

  const sessionRow = ({
    ...session,
    courses: Array.isArray(session.courses) ? session.courses[0] ?? null : session.courses ?? null
  } as unknown) as SupabaseSessionRow

  if (!sessionRow.course_id) {
    return NextResponse.json({ error: 'Session has no linked course.' }, { status: 400 })
  }

  const autoEndResult = await autoEndSessionIfNeeded(supabase, {
    id: sessionRow.id,
    status: sessionRow.status,
    created_at: sessionRow.created_at,
    updated_at: sessionRow.updated_at,
    course_id: sessionRow.course_id
  })

  const normalizedSession: SupabaseSessionRow = {
    ...sessionRow,
    status: autoEndResult.session.status,
    updated_at: autoEndResult.session.updated_at ?? sessionRow.updated_at
  }

  if (autoEndResult.autoEnded || normalizedSession.status === 'ended') {
    return NextResponse.json({
      error: 'Session has already ended.',
      sessionEnded: true,
      autoEnded: autoEndResult.autoEnded
    }, { status: 400 })
  }

  const expiresAt = new Date(normalizedSession.qr_code_expires_at)
  const currentTime = new Date()

  if (expiresAt < currentTime) {
    return NextResponse.json({
      error: 'QR code has expired',
      debug: {
        expiresAt: normalizedSession.qr_code_expires_at,
        currentTime: currentTime.toISOString(),
        expired: true
      }
    }, { status: 400 })
  }

  const enrollResult = await supabase
    .from('course_enrollments')
    .select('id')
    .eq('course_id', normalizedSession.course_id)
    .eq('student_id', userId)
    .maybeSingle()

  if (!enrollResult.data) {
    const { error: enrollError } = await supabase
      .from('course_enrollments')
      .insert({
        course_id: normalizedSession.course_id,
        student_id: userId,
        enrolled_at: new Date().toISOString()
      })

    if (enrollError) {
      return NextResponse.json({ error: 'Failed to enroll in course' }, { status: 500 })
    }
  }

  const classroomLatitude = toNumber(normalizedSession.classroom_latitude)
  const classroomLongitude = toNumber(normalizedSession.classroom_longitude)
  const classroomRadius = toNumber(normalizedSession.classroom_radius)
  const courseRecord = Array.isArray(normalizedSession.courses)
    ? normalizedSession.courses[0] ?? null
    : normalizedSession.courses

  let location: ResolvedLocation | null = null

  if (classroomLatitude !== null && classroomLongitude !== null) {
    location = {
      latitude: classroomLatitude,
      longitude: classroomLongitude,
      radius: classroomRadius ?? Math.max(150, acc * 3),
      locationType: normalizedSession.classroom_location_type ?? 'predefined',
      predefinedLocationId: normalizedSession.predefined_location_id ?? null,
      displayName: normalizedSession.classroom_display_name ?? undefined
    }
  }

  if (!location) {
    const rawLocation = courseRecord?.classroom_location
    if (rawLocation) {
      try {
        const parsed = typeof rawLocation === 'string' ? JSON.parse(rawLocation) : rawLocation
        if (parsed?.latitude !== undefined && parsed?.longitude !== undefined) {
          location = {
            latitude: Number(parsed.latitude),
            longitude: Number(parsed.longitude),
            radius: Number(parsed.radius ?? Math.max(150, acc * 3)) || Math.max(150, acc * 3),
            locationType: parsed.locationType ?? 'predefined',
            predefinedLocationId: parsed.predefinedLocationId ?? null,
            displayName: parsed.displayName ?? undefined
          }
        }
      } catch (parseError) {
        console.warn('Failed to parse classroom_location JSON:', parseError)
      }
    }
  }

  if (!location) {
    location = {
      latitude: 37.5665,
      longitude: 126.9780,
      radius: Math.max(150, acc * 3),
      locationType: 'predefined' as const,
      predefinedLocationId: null,
      displayName: '기본 강의실 위치'
    }
  }

  const check = evaluateLocation({ latitude: lat, longitude: lon, accuracy: acc }, location)

  if (!Number.isFinite(check.distance)) {
    return NextResponse.json({
      error: '위치 검증 중 오류가 발생했습니다. 위치 정보를 확인해주세요.'
    }, { status: 400 })
  }

  if (!check.isLocationValid) {
    return NextResponse.json({
      error: `위치 검증 실패: 강의실에서 ${Math.round(check.distance)}m 떨어져 있습니다. (허용 반경: ${location.radius}m, GPS 정확도: ${Math.round(acc)}m)`,
      distance: Math.round(check.distance),
      effectiveDistance: Math.round(check.effectiveDistance),
      allowedRadius: location.radius,
      gpsAccuracy: Math.round(acc)
    }, { status: 400 })
  }

  const { data: existingAttendance } = await supabase
    .from('attendances')
    .select('id, status')
    .eq('session_id', sessionId)
    .eq('student_id', userId)
    .maybeSingle()

  let attendanceId: string

  if (existingAttendance) {
    const { error: updateError } = await supabase
      .from('attendances')
      .update({
        status: 'present',
        check_in_time: new Date().toISOString(),
        location_verified: check.isLocationValid,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingAttendance.id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update attendance' }, { status: 500 })
    }

    attendanceId = existingAttendance.id
  } else {
    const { data: newAttendance, error: insertError } = await supabase
      .from('attendances')
      .insert({
        session_id: sessionId,
        student_id: userId,
        status: 'present',
        check_in_time: new Date().toISOString(),
        location_verified: check.isLocationValid
      })
      .select('id')
      .maybeSingle()

    if (insertError || !newAttendance) {
      return NextResponse.json({ error: 'Failed to create attendance record' }, { status: 500 })
    }

    attendanceId = newAttendance.id
  }

  try {
    await upsertLocalAttendance({
      id: attendanceId,
      sessionId,
      studentId: userId,
      status: 'present',
      checkInTime: new Date().toISOString(),
      locationVerified: true,
      distance: Math.round(check.distance),
      latitude: lat,
      longitude: lon,
      accuracy: acc
    })
  } catch (fileError) {
    console.warn('⚠️ Unable to persist local attendance snapshot:', fileError instanceof Error ? fileError.message : fileError)
  }

  console.log(`✅ 출석 체크 완료: ${userName} (${userId})`)

  return NextResponse.json({
    success: true,
    attendanceId,
    sessionId,
    message: existingAttendance ? 'Successfully checked in (updated)' : 'Successfully checked in',
    locationVerified: true,
    distance: Math.round(check.distance)
  })
}

async function handleLocalCheckIn(args: {
  sessionId: string
  lat: number
  lon: number
  acc: number
  userId: string
  userName: string
}): Promise<NextResponse> {
  const { sessionId, lat, lon, acc, userId, userName } = args
  const session = await loadLocalSession(sessionId)

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  if (session.status === 'ended') {
    return NextResponse.json({ error: 'Session has already ended.' }, { status: 400 })
  }

  const expiresRaw = session.qrCodeExpiresAt ?? session.qr_code_expires_at
  if (expiresRaw) {
    const expiresAt = new Date(expiresRaw)
    if (expiresAt < new Date()) {
      return NextResponse.json({
        error: 'QR code has expired',
        debug: {
          expiresAt: expiresAt.toISOString(),
          currentTime: new Date().toISOString(),
          expired: true
        }
      }, { status: 400 })
    }
  }

  const classroom = normalizeLocalSessionLocation(session)
  const check = evaluateLocation({ latitude: lat, longitude: lon, accuracy: acc }, classroom)

  if (!Number.isFinite(check.distance)) {
    return NextResponse.json({
      error: '위치 검증 중 오류가 발생했습니다. 위치 정보를 확인해주세요.'
    }, { status: 400 })
  }

  if (!check.isLocationValid) {
    return NextResponse.json({
      error: `위치 검증 실패: 강의실에서 ${Math.round(check.distance)}m 떨어져 있습니다. (허용 반경: ${classroom.radius}m, GPS 정확도: ${Math.round(acc)}m)`,
      distance: Math.round(check.distance),
      effectiveDistance: Math.round(check.effectiveDistance),
      allowedRadius: classroom.radius,
      gpsAccuracy: Math.round(acc)
    }, { status: 400 })
  }

  const attendanceId = `attendance_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  const nowIso = new Date().toISOString()

  await upsertLocalAttendance({
    id: attendanceId,
    sessionId,
    studentId: userId,
    status: 'present',
    checkInTime: nowIso,
    locationVerified: true,
    distance: Math.round(check.distance),
    latitude: lat,
    longitude: lon,
    accuracy: acc
  })

  try {
    const updatedSession: LocalSessionRecord = {
      ...session,
      status: session.status ?? 'active',
      updatedAt: nowIso
    }
    await upsertLocalSession(updatedSession)
  } catch (sessionUpdateError) {
    console.warn('⚠️ Unable to update local session metadata:', sessionUpdateError instanceof Error ? sessionUpdateError.message : sessionUpdateError)
  }

  console.log(`✅ 로컬 출석 체크 완료: ${userName} (${userId})`)

  return NextResponse.json({
    success: true,
    attendanceId,
    sessionId,
    message: 'Successfully checked in (local)',
    locationVerified: true,
    distance: Math.round(check.distance)
  })
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
