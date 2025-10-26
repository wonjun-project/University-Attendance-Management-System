import { NextRequest, NextResponse } from 'next/server'
import { authenticateStudent, authenticateProfessor } from '@/lib/auth'
import { SignJWT } from 'jose'
import { RateLimitPresets } from '@/lib/middleware/rate-limit'
import { LoginRequestSchema } from '@/lib/schemas/auth'
import { validateSchema } from '@/lib/utils/validation'
import { withFastAPIPerformance } from '@/lib/middleware/performance'

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7

async function loginHandler(request: NextRequest) {
  // Rate limiting 체크
  const rateLimitResult = await RateLimitPresets.auth(request)
  if (rateLimitResult) {
    return rateLimitResult
  }

  try {
    const body = await request.json()

    // Zod 스키마로 런타임 검증
    const validated = validateSchema(LoginRequestSchema, body)
    if (validated instanceof NextResponse) {
      return validated // 검증 실패 응답 반환
    }

    const { id, password, userType } = validated

    const authUser = userType === 'student'
      ? await authenticateStudent(id, password)
      : await authenticateProfessor(id, password)

    if (!authUser) {
      return NextResponse.json(
        { error: '아이디 또는 비밀번호가 올바르지 않습니다' },
        { status: 401 }
      )
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
    const secret = new TextEncoder().encode(jwtSecret)

    const token = await new SignJWT({
      userId: authUser.id,
      userType: authUser.type,
      name: authUser.name
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${ONE_WEEK_SECONDS}s`)
      .sign(secret)

    const response = NextResponse.json({
      success: true,
      user: {
        id: authUser.id,
        name: authUser.name,
        type: authUser.type
      }
    })

    response.cookies.set('auth-token', token, {
      path: '/',
      maxAge: ONE_WEEK_SECONDS,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
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

export const POST = withFastAPIPerformance(loginHandler, '/api/auth/login')

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 })
}
