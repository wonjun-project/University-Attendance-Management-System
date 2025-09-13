import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
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

export interface SessionData {
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
export function generateToken(payload: SessionData): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d',
    issuer: 'attendance-app'
  })
}

export function verifyToken(token: string): SessionData | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionData
  } catch (error) {
    return null
  }
}

// Database operations
export async function authenticateStudent(studentId: string, password: string): Promise<AuthUser | null> {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from('students')
      .select('student_id, name, password_hash')
      .eq('student_id', studentId)
      .single()

    if (error) {
      console.error('Student authentication DB error:', error)
      return null
    }

    if (!data) {
      console.log('Student not found:', studentId)
      return null
    }

    const isValid = await verifyPassword(password, data.password_hash)
    if (!isValid) {
      console.log('Invalid password for student:', studentId)
      return null
    }

    console.log('Student authentication successful:', studentId)
    return {
      id: data.student_id,
      name: data.name,
      type: 'student'
    }
  } catch (error) {
    console.error('Student authentication error:', error)
    return null
  }
}

export async function authenticateProfessor(professorId: string, password: string): Promise<AuthUser | null> {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from('professors')
      .select('professor_id, name, password_hash')
      .eq('professor_id', professorId)
      .single()

    if (error) {
      console.error('Professor authentication DB error:', error)
      return null
    }

    if (!data) {
      console.log('Professor not found:', professorId)
      return null
    }

    const isValid = await verifyPassword(password, data.password_hash)
    if (!isValid) {
      console.log('Invalid password for professor:', professorId)
      return null
    }

    console.log('Professor authentication successful:', professorId)
    return {
      id: data.professor_id,
      name: data.name,
      type: 'professor'
    }
  } catch (error) {
    console.error('Professor authentication error:', error)
    return null
  }
}

export async function createStudent(studentId: string, name: string, password: string): Promise<boolean> {
  const supabase = createClient()
  const passwordHash = await hashPassword(password)

  const { error } = await supabase
    .from('students')
    .insert({
      student_id: studentId,
      name,
      password_hash: passwordHash
    })

  return !error
}

export async function createProfessor(professorId: string, name: string, email: string | null, password: string): Promise<boolean> {
  const supabase = createClient()
  const passwordHash = await hashPassword(password)

  const { error } = await supabase
    .from('professors')
    .insert({
      professor_id: professorId,
      name,
      email,
      password_hash: passwordHash
    })

  return !error
}