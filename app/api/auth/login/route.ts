import { NextRequest, NextResponse } from 'next/server'
import { authenticateStudent, authenticateProfessor, generateToken } from '@/lib/auth'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Handle CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, password, userType } = body

    // Validate required fields
    if (!id || !password || !userType) {
      const errorResponse = NextResponse.json({
        error: 'ID, password, and user type are required'
      }, { status: 400 })

      errorResponse.headers.set('Access-Control-Allow-Origin', '*')
      errorResponse.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
      errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

      return errorResponse
    }

    let user = null

    if (userType === 'student') {
      user = await authenticateStudent(id, password)
    } else if (userType === 'professor') {
      user = await authenticateProfessor(id, password)
    } else {
      const errorResponse = NextResponse.json({
        error: 'Invalid user type'
      }, { status: 400 })

      errorResponse.headers.set('Access-Control-Allow-Origin', '*')
      errorResponse.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
      errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

      return errorResponse
    }

    if (!user) {
      const errorResponse = NextResponse.json({
        error: 'Invalid credentials'
      }, { status: 401 })

      errorResponse.headers.set('Access-Control-Allow-Origin', '*')
      errorResponse.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
      errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

      return errorResponse
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      userType: user.type,
      name: user.name
    })

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        type: user.type
      }
    })

    // Set CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    // Set auth cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    })

    return response

  } catch (error) {
    console.error('Login error:', error)
    const errorResponse = NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })

    // Set CORS headers for error response
    errorResponse.headers.set('Access-Control-Allow-Origin', '*')
    errorResponse.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    return errorResponse
  }
}