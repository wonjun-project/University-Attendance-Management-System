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

// 사용자 데이터를 파일에 저장하기
function saveUsers(users: any) {
  try {
    const dir = path.dirname(USERS_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
    return true
  } catch (error) {
    console.error('사용자 데이터 저장 실패:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const { studentId, professorId, name, password, userType } = await request.json()

    // userType에 따라 적절한 ID 선택
    const id = userType === 'student' ? studentId : professorId

    console.log('회원가입 시도:', { id, name, userType })

    // 입력값 검증
    if (!id || !name || !password || !userType) {
      return NextResponse.json(
        { error: '모든 필드를 입력해주세요' },
        { status: 400 }
      )
    }

    // 비밀번호 길이 확인
    if (password.length < 6) {
      return NextResponse.json(
        { error: '비밀번호는 최소 6자 이상이어야 합니다' },
        { status: 400 }
      )
    }

    // 학생인 경우 학번 길이 확인
    if (userType === 'student' && id.length !== 9) {
      return NextResponse.json(
        { error: '학번은 9자리여야 합니다' },
        { status: 400 }
      )
    }

    // 기존 사용자 데이터 불러오기
    const users = getUsers()

    // 중복 ID 체크
    const userGroup = userType === 'student' ? users.students : users.professors
    if (userGroup[id]) {
      return NextResponse.json(
        { error: '이미 등록된 ID입니다' },
        { status: 409 }
      )
    }

    // 새 사용자 추가
    const newUser = {
      id,
      name,
      password, // 실제로는 해시화해야 하지만 테스트용으로 평문 저장
      type: userType
    }

    userGroup[id] = newUser

    // 파일에 저장
    const saved = saveUsers(users)
    if (!saved) {
      console.warn('파일 저장 실패, 메모리에만 저장됨')
    }

    console.log('회원가입 성공:', { id, name, userType })

    // JWT 토큰 생성
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
    const secret = new TextEncoder().encode(jwtSecret)

    const token = await new SignJWT({
      userId: newUser.id,
      userType: newUser.type,
      name: newUser.name,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret)

    // 응답 생성
    const response = NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        type: newUser.type
      },
      message: '회원가입이 완료되었습니다'
    })

    // JWT 토큰을 쿠키로 설정
    response.cookies.set('auth-token', token, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7일
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true
    })

    return response

  } catch (error) {
    console.error('회원가입 오류:', error)
    return NextResponse.json(
      {
        error: '회원가입 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// CORS 처리
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