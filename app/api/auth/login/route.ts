import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'

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

    // 하드코딩된 테스트 계정 (데이터베이스 없이)
    let user = null

    if (userType === 'student' && id === 'stu001' && password === 'password123') {
      user = {
        id: 'stu001',
        name: '테스트 학생',
        type: 'student'
      }
    } else if (userType === 'professor' && id === 'prof001' && password === 'password123') {
      user = {
        id: 'prof001',
        name: '테스트 교수',
        type: 'professor'
      }
    }

    if (!user) {
      console.log('Authentication failed for:', { id, userType })
      return NextResponse.json(
        { error: '아이디 또는 비밀번호가 올바르지 않습니다' },
        { status: 401 }
      )
    }

    console.log('Authentication successful:', user)

    // JWT 토큰 생성
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
    const secret = new TextEncoder().encode(jwtSecret)

    const token = await new SignJWT({
      userId: user.id,
      userType: user.type,
      name: user.name,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret)

    // Return success response with cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        type: user.type
      }
    })

    // JWT 토큰을 쿠키로 설정
    response.cookies.set('auth-token', token, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true
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