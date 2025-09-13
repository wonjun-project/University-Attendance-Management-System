import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authenticateStudent, authenticateProfessor, generateToken } from '@/lib/auth-pages'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, password, userType } = body

    // Validate required fields
    if (!id || !password || !userType) {
      return NextResponse.json(
        { error: 'ID, password, and user type are required' },
        { status: 400 }
      )
    }

    let user = null

    if (userType === 'student') {
      user = await authenticateStudent(id, password)
    } else if (userType === 'professor') {
      user = await authenticateProfessor(id, password)
    } else {
      return NextResponse.json(
        { error: 'Invalid user type' },
        { status: 400 }
      )
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      userType: user.type,
      name: user.name
    })

    // Create response with user data
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        type: user.type
      }
    })

    // Set auth cookie
    const cookieStore = cookies()
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    })

    return response

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}