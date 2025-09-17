import bcrypt from 'bcryptjs'
import { jwtVerify, SignJWT, type JWTPayload } from 'jose'
import { cookies } from 'next/headers'
import { createClient } from './supabase-server'

// JWT Secret key (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const SALT_ROUNDS = 12

// Types
export interface AuthUser {
  id: string
  name: string
  type: 'student' | 'professor'
}

export interface SessionData extends JWTPayload {
  userId: string
  userType: 'student' | 'professor'
  name: string
}

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash)
}

// JWT Token functions
export async function generateToken(payload: SessionData): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET)
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .setIssuer('attendance-app')
    .sign(secret)
}

export async function verifyToken(token: string): Promise<SessionData | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as SessionData
  } catch {
    return null
  }
}

// Cookie management
export function setAuthCookie(token: string) {
  const cookieStore = cookies()
  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/'
  })
}

export function getAuthToken(): string | null {
  try {
    const cookieStore = cookies()
    return cookieStore.get('auth-token')?.value || null
  } catch {
    return null
  }
}

export function clearAuthCookie() {
  const cookieStore = cookies()
  cookieStore.delete('auth-token')
}

// Get current user from token
export async function getCurrentUser(): Promise<SessionData | null> {
  const token = getAuthToken()
  if (!token) return null
  return await verifyToken(token)
}

// Get current user from API request (for API routes)
export async function getCurrentUserFromRequest(request: Request): Promise<SessionData | null> {
  try {
    console.log('getCurrentUserFromRequest called')

    // Extract token from cookies in the request
    const cookieHeader = request.headers.get('cookie')
    console.log('Cookie header:', cookieHeader)

    if (!cookieHeader) {
      console.log('No cookie header found')
      return null
    }

    // Parse cookies manually - more robust parsing
    const cookies: Record<string, string> = {}
    cookieHeader.split(';').forEach(cookie => {
      const [name, ...rest] = cookie.trim().split('=')
      if (name && rest.length > 0) {
        cookies[name] = rest.join('=') // Handle cases where value contains '='
      }
    })

    console.log('Parsed cookies:', Object.keys(cookies))

    const token = cookies['auth-token']
    if (!token) {
      console.log('No auth-token cookie found')
      return null
    }

    console.log('Token found, verifying...')
    const result = await verifyToken(token)
    console.log('Token verification result:', result ? { userId: result.userId, userType: result.userType } : 'null')

    return result
  } catch (error) {
    console.error('getCurrentUserFromRequest error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    return null
  }
}

// Database operations
export async function authenticateStudent(studentId: string, password: string): Promise<AuthUser | null> {
  const supabase = createClient()
  type StudentRow = { student_id: string; name: string; password_hash: string }

  try {
    const { data, error } = await supabase
      .from('students')
      .select('student_id, name, password_hash')
      .eq('student_id', studentId)
      .maybeSingle()

    if (error) {
      console.error('Student authentication DB error:', error)
      return null
    }

    const student = data as StudentRow | null

    if (!student) {
      console.log('Student not found:', studentId)
      return null
    }

    const isValid = await verifyPassword(password, student.password_hash)
    if (!isValid) {
      console.log('Invalid password for student:', studentId)
      return null
    }

    console.log('Student authentication successful:', studentId)
    return {
      id: student.student_id,
      name: student.name,
      type: 'student'
    }
  } catch (error) {
    console.error('Student authentication error:', error)
    return null
  }
}

export async function authenticateProfessor(professorId: string, password: string): Promise<AuthUser | null> {
  const supabase = createClient()
  type ProfessorRow = { professor_id: string; name: string; password_hash: string }

  try {
    const { data, error } = await supabase
      .from('professors')
      .select('professor_id, name, password_hash')
      .eq('professor_id', professorId)
      .maybeSingle()

    if (error) {
      console.error('Professor authentication DB error:', error)
      return null
    }

    const professor = data as ProfessorRow | null

    if (!professor) {
      console.log('Professor not found:', professorId)
      return null
    }

    const isValid = await verifyPassword(password, professor.password_hash)
    if (!isValid) {
      console.log('Invalid password for professor:', professorId)
      return null
    }

    console.log('Professor authentication successful:', professorId)
    return {
      id: professor.professor_id,
      name: professor.name,
      type: 'professor'
    }
  } catch (error) {
    console.error('Professor authentication error:', error)
    return null
  }
}
