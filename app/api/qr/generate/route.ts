import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

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

interface LocalSessionRecord {
  id: string
  courseId: string
  courseName: string
  courseCode: string
  date: string
  qrCode: string
  qrCodeExpiresAt: string
  status: 'active' | 'ended'
  classroomLocation: {
    latitude: number
    longitude: number
    radius: number
    locationType: LocationType
    predefinedLocationId: string | null
    displayName?: string
  }
  createdAt: string
  updatedAt: string
}

interface LocalCourseRecord {
  id: string
  name?: string | null
  courseCode?: string | null
  course_code?: string | null
  totalSessions?: number
  updatedAt?: string
}

const DATA_DIR = path.join(process.cwd(), 'data')
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json')
const COURSES_FILE = path.join(DATA_DIR, 'courses.json')

function isUUID(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value)
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

function createSessionId(): string {
  try {
    return randomUUID()
  } catch {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  }
}

async function upsertLocalSession(record: LocalSessionRecord): Promise<void> {
  const sessions = await readJsonFile<LocalSessionRecord[]>(SESSIONS_FILE, [])
  const filtered = sessions.filter(session => session.id !== record.id)
  filtered.push(record)
  await writeJsonFile(SESSIONS_FILE, filtered)
}

async function updateLocalCourseSessionCount(courseId: string, isoTimestamp: string): Promise<void> {
  const courses = await readJsonFile<LocalCourseRecord[]>(COURSES_FILE, [])
  const index = courses.findIndex(course => course?.id === courseId)
  if (index === -1) {
    return
  }

  const current = courses[index]
  const totalSessions = typeof current?.totalSessions === 'number' ? current.totalSessions + 1 : 1

  courses[index] = {
    ...current,
    totalSessions,
    updatedAt: isoTimestamp
  }

  await writeJsonFile(COURSES_FILE, courses)
}

function buildBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'
}

export async function POST(request: NextRequest) {
  try {
    console.log('QR generation API called')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseAvailable = Boolean(supabaseUrl && supabaseServiceRoleKey)

    const user = await getCurrentUser()
    console.log('User authentication result:', user)

    if (!user || user.userType !== 'professor') {
      return NextResponse.json(
        { error: 'Unauthorized. Professor access required.' },
        { status: 401 }
      )
    }

    const payload: QRGenerateRequest = await request.json()
    const { courseId, expiresInMinutes = 30, classroomLocation } = payload

    if (!courseId || !classroomLocation) {
      return NextResponse.json(
        { error: 'Missing required fields: courseId, classroomLocation' },
        { status: 400 }
      )
    }

    const locationType: LocationType = classroomLocation.locationType === 'current' ? 'current' : 'predefined'
    let normalizedLocation: NormalizedLocation | null = null

    const fallbackLat = toNumber(classroomLocation.latitude)
    const fallbackLon = toNumber(classroomLocation.longitude)
    const fallbackRadius = toNumber(classroomLocation.radius)

    if (locationType === 'predefined' && classroomLocation.predefinedLocationId && supabaseAvailable) {
      try {
        const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!)
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
      } catch (predefinedLookupError) {
        console.warn('⚠️ Predefined location lookup failed, using client payload:', predefinedLookupError)
      }
    }

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

    normalizedLocation.radius = Math.max(10, Math.round(normalizedLocation.radius))

    const now = new Date()
    const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000)

    const shouldUseSupabase = supabaseAvailable && (courseId.startsWith('demo-course-') || isUUID(courseId))

    if (shouldUseSupabase) {
      try {
        const response = await generateWithSupabase({
          courseId,
          normalizedLocation,
          expiresAt,
          now,
          baseUrl: buildBaseUrl(),
          supabaseUrl: supabaseUrl!,
          serviceRoleKey: supabaseServiceRoleKey!
        })
        if (response) {
          return response
        }
      } catch (supabaseError) {
        console.warn('Supabase QR generation failed, falling back to local JSON store:', supabaseError)
      }
    }

    return await generateWithLocal({
      courseId,
      normalizedLocation,
      expiresAt,
      now,
      baseUrl: buildBaseUrl()
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

async function generateWithSupabase(args: {
  courseId: string
  normalizedLocation: NormalizedLocation
  expiresAt: Date
  now: Date
  baseUrl: string
  supabaseUrl: string
  serviceRoleKey: string
}): Promise<NextResponse | null> {
  const { courseId, normalizedLocation, expiresAt, now, baseUrl, supabaseUrl, serviceRoleKey } = args
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  let courseName = '데모 강의'
  let courseCode = 'DEMO101'

  if (courseId.startsWith('demo-course-')) {
    courseName = '데모 강의'
    courseCode = 'DEMO101'
  } else {
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('name, course_code')
      .eq('id', courseId)
      .maybeSingle()

    if (courseError) {
      throw new Error(`Course lookup failed: ${courseError.message}`)
    }

    if (!course) {
      console.warn('Supabase course not found. Falling back to local generation.')
      return null
    }

    courseName = course.name
    courseCode = course.course_code
  }

  const sessionData: Record<string, unknown> = {
    status: 'active',
    date: now.toISOString().split('T')[0],
    qr_code: 'placeholder',
    qr_code_expires_at: expiresAt.toISOString(),
    classroom_latitude: normalizedLocation.latitude,
    classroom_longitude: normalizedLocation.longitude,
    classroom_radius: normalizedLocation.radius,
    classroom_location_type: normalizedLocation.locationType,
    predefined_location_id: normalizedLocation.predefinedLocationId,
    classroom_display_name: normalizedLocation.displayName,
    updated_at: now.toISOString()
  }

  if (!courseId.startsWith('demo-course-')) {
    sessionData.course_id = courseId
  } else {
    sessionData.course_id = '27468faa-0394-41bf-871a-a4079e9dee79'
  }

  const { data: session, error: sessionError } = await supabase
    .from('class_sessions')
    .insert(sessionData)
    .select('id')
    .single()

  if (sessionError || !session) {
    throw new Error(sessionError ? `Failed to create session: ${sessionError.message}` : 'Failed to create session')
  }

  const sessionId = session.id as string
  const qrCodeString = `${baseUrl}/student/attendance/${sessionId}`

  const { error: updateError } = await supabase
    .from('class_sessions')
    .update({ qr_code: qrCodeString })
    .eq('id', sessionId)

  if (updateError) {
    console.error('QR 코드 업데이트 실패:', updateError)
  }

  const sessionRecord: LocalSessionRecord = {
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
  }

  try {
    await upsertLocalSession(sessionRecord)
  } catch (fileError) {
    console.warn('⚠️ Unable to update local sessions.json:', fileError instanceof Error ? fileError.message : fileError)
  }

  try {
    await updateLocalCourseSessionCount(courseId, now.toISOString())
  } catch (courseUpdateError) {
    console.warn('⚠️ Unable to update local course session count:', courseUpdateError instanceof Error ? courseUpdateError.message : courseUpdateError)
  }

  return NextResponse.json({
    success: true,
    qrData: {
      sessionId,
      courseId,
      expiresAt: expiresAt.toISOString(),
      type: 'attendance' as const
    },
    qrCode: qrCodeString,
    expiresAt: expiresAt.toISOString(),
    courseName,
    courseCode,
    classroomLocation: normalizedLocation
  })
}

async function generateWithLocal(args: {
  courseId: string
  normalizedLocation: NormalizedLocation
  expiresAt: Date
  now: Date
  baseUrl: string
}): Promise<NextResponse> {
  const { courseId, normalizedLocation, expiresAt, now, baseUrl } = args

  const courses = await readJsonFile<LocalCourseRecord[]>(COURSES_FILE, [])
  const course = courses.find(item => item?.id === courseId)

  const courseName = course?.name ?? '데모 강의'
  const courseCode = course?.courseCode ?? course?.course_code ?? 'DEMO101'

  const sessionId = createSessionId()
  const qrCodeString = `${baseUrl}/student/attendance/${sessionId}`

  const sessionRecord: LocalSessionRecord = {
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
  }

  await upsertLocalSession(sessionRecord)

  try {
    await updateLocalCourseSessionCount(courseId, now.toISOString())
  } catch (courseUpdateError) {
    console.warn('⚠️ Unable to update local course session count:', courseUpdateError instanceof Error ? courseUpdateError.message : courseUpdateError)
  }

  return NextResponse.json({
    success: true,
    qrData: {
      sessionId,
      courseId,
      expiresAt: expiresAt.toISOString(),
      type: 'attendance' as const
    },
    qrCode: qrCodeString,
    expiresAt: expiresAt.toISOString(),
    courseName,
    courseCode,
    classroomLocation: normalizedLocation
  })
}
