import bcrypt from 'bcryptjs'
import { createClient } from './supabase-server'

// 매우 간단한 인증 (JWT 없음)
export interface AuthUser {
  id: string
  name: string
  type: 'student' | 'professor'
}

export interface SimpleSession {
  userId: string
  userType: 'student' | 'professor'
  name: string
  expires: number
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash)
}

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
      console.error('Student authentication error:', error)
      return null
    }

    const student = data as StudentRow | null

    if (!student) {
      console.warn('Student not found:', studentId)
      return null
    }

    const isValid = await verifyPassword(password, student.password_hash)
    if (!isValid) {
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
      console.error('Professor authentication error:', error)
      return null
    }

    const professor = data as ProfessorRow | null

    if (!professor) {
      console.warn('Professor not found:', professorId)
      return null
    }

    const isValid = await verifyPassword(password, professor.password_hash)
    if (!isValid) {
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

export function createSession(user: AuthUser): SimpleSession {
  return {
    userId: user.id,
    userType: user.type,
    name: user.name,
    expires: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7일
  }
}

export function validateSession(sessionData: string): SimpleSession | null {
  try {
    const session: SimpleSession = JSON.parse(decodeURIComponent(sessionData))

    // 만료 확인
    if (Date.now() > session.expires) {
      return null
    }

    return session
  } catch {
    return null
  }
}
