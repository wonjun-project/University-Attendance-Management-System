import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import * as fs from 'fs'
import * as path from 'path'

// 간단한 파일 기반 저장소 경로
const USERS_FILE = path.join(process.cwd(), 'data', 'users.json')

// 사용자 데이터를 파일에서 읽어오기
function getUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('사용자 데이터 읽기 실패:', error)
  }

  // 기본 테스트 계정
  return {
    students: {
      'stu001': {
        id: 'stu001',
        name: '테스트 학생',
        password: 'password123',
        type: 'student'
      }
    },
    professors: {
      'prof001': {
        id: 'prof001',
        name: '테스트 교수',
        password: 'password123',
        type: 'professor'
      }
    }
  }
}

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

    // 파일 또는 기본 데이터에서 사용자 찾기
    const users = getUsers()
    const userGroup = userType === 'student' ? users.students : users.professors
    const userData = userGroup[id]

    let user = null

    if (userData && userData.password === password) {
      user = {
        id: userData.id,
        name: userData.name,
        type: userData.type
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