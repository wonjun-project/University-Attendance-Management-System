import { NextRequest, NextResponse } from 'next/server'
import { createStudent, createProfessor, generateToken, setAuthCookie } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, userType, studentId, professorId, email, password } = body

    console.log('Signup attempt:', { name, userType, studentId, professorId, hasPassword: !!password })

    // Validate required fields
    if (!name || !password || !userType) {
      console.log('Missing required fields:', { name: !!name, password: !!password, userType: !!userType })
      return NextResponse.json({ 
        error: 'Name, password, and user type are required' 
      }, { status: 400 })
    }

    if (userType === 'student') {
      // Student signup
      if (!studentId) {
        return NextResponse.json({ 
          error: 'Student ID is required for student accounts' 
        }, { status: 400 })
      }

      // Validate student ID format (9 digits)
      if (!/^\d{9}$/.test(studentId)) {
        return NextResponse.json({ 
          error: 'Student ID must be 9 digits' 
        }, { status: 400 })
      }

      const success = await createStudent(studentId, name, password)
      console.log('Student creation result:', success)
      if (!success) {
        console.log('Student creation failed for studentId:', studentId)
        return NextResponse.json({ 
          error: 'Student ID already exists or database error' 
        }, { status: 400 })
      }

      // Generate token and set cookie
      const token = generateToken({
        userId: studentId,
        userType: 'student',
        name
      })

      const response = NextResponse.json({ 
        success: true,
        user: { id: studentId, name, type: 'student' }
      })

      // Set auth cookie
      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/'
      })

      return response

    } else if (userType === 'professor') {
      // Professor signup
      if (!professorId) {
        return NextResponse.json({ 
          error: 'Professor ID is required for professor accounts' 
        }, { status: 400 })
      }

      const success = await createProfessor(professorId, name, null, password)
      if (!success) {
        return NextResponse.json({ 
          error: 'Professor ID already exists or database error' 
        }, { status: 400 })
      }

      // Generate token and set cookie
      const token = generateToken({
        userId: professorId,
        userType: 'professor',
        name
      })

      const response = NextResponse.json({ 
        success: true,
        user: { id: professorId, name, type: 'professor' }
      })

      // Set auth cookie
      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/'
      })

      return response

    } else {
      return NextResponse.json({ 
        error: 'Invalid user type' 
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}