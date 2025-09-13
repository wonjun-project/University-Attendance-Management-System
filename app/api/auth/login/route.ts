import { NextRequest, NextResponse } from 'next/server'
import { authenticateStudent, authenticateProfessor, generateToken, setAuthCookie } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { id, password, userType } = await request.json()

    console.log('Login attempt:', { id, userType })

    if (!id || !password || !userType) {
      return NextResponse.json(
        { error: 'ID, 비밀번호, 사용자 타입을 모두 입력해주세요' },
        { status: 400 }
      )
    }

    if (userType !== 'student' && userType !== 'professor') {
      return NextResponse.json(
        { error: '올바르지 않은 사용자 타입입니다' },
        { status: 400 }
      )
    }

    let user = null

    // Authenticate based on user type
    if (userType === 'student') {
      user = await authenticateStudent(id, password)
    } else if (userType === 'professor') {
      user = await authenticateProfessor(id, password)
    }

    if (!user) {
      console.log('Authentication failed for:', { id, userType })
      return NextResponse.json(
        { error: '아이디 또는 비밀번호가 올바르지 않습니다' },
        { status: 401 }
      )
    }

    console.log('Authentication successful:', user)

    // Generate JWT token
    const sessionData = {
      userId: user.id,
      userType: user.type,
      name: user.name
    }

    const token = generateToken(sessionData)

    // Set auth cookie
    setAuthCookie(token)

    // Return success response
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        type: user.type
      }
    })

    return response

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      {
        error: '로그인 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Handle CORS for development
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