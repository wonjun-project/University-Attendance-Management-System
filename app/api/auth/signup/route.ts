import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { hashPassword, authenticateStudent, authenticateProfessor } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-admin'
import { RateLimitPresets } from '@/lib/middleware/rate-limit'
import { SignupRequestSchema } from '@/lib/schemas/auth'
import { validateSchema } from '@/lib/utils/validation'
import { withStandardAPIPerformance } from '@/lib/middleware/performance'

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7

async function signupHandler(request: NextRequest) {
  // Rate limiting 체크
  const rateLimitResult = await RateLimitPresets.auth(request)
  if (rateLimitResult) {
    return rateLimitResult
  }

  try {
    const body = await request.json()

    // Zod 스키마로 런타임 검증
    const validated = validateSchema(SignupRequestSchema, body)
    if (validated instanceof NextResponse) {
      return validated // 검증 실패 응답 반환
    }

    const { name, password, userType, studentId, professorId } = validated

    const supabase = createServiceClient()

    if (userType === 'student') {
      if (!studentId) {
        return NextResponse.json({ error: '학번을 입력해주세요' }, { status: 400 })
      }

      const { data: existingStudent, error: lookupError } = await supabase
        .from('students')
        .select('student_id')
        .eq('student_id', studentId)
        .maybeSingle<{ student_id: string }>()

      if (lookupError) {
        console.error('Student lookup error:', lookupError)
        return NextResponse.json({ error: '학생 정보를 확인할 수 없습니다.' }, { status: 500 })
      }

      if (existingStudent) {
        return NextResponse.json({ error: '이미 등록된 학번입니다.' }, { status: 409 })
      }

      const passwordHash = await hashPassword(password)

      const { error: insertError } = await supabase
        .from('students')
        .insert({
          student_id: studentId,
          name,
          password_hash: passwordHash
        })

      if (insertError) {
        console.error('Student insert error:', insertError)
        return NextResponse.json({ error: '학생 계정을 생성할 수 없습니다.' }, { status: 500 })
      }
    } else {
      if (!professorId) {
        return NextResponse.json({ error: '교수번호를 입력해주세요' }, { status: 400 })
      }

      const { data: existingProfessor, error: lookupError } = await supabase
        .from('professors')
        .select('professor_id')
        .eq('professor_id', professorId)
        .maybeSingle<{ professor_id: string }>()

      if (lookupError) {
        console.error('Professor lookup error:', lookupError)
        return NextResponse.json({ error: '교수 정보를 확인할 수 없습니다.' }, { status: 500 })
      }

      if (existingProfessor) {
        return NextResponse.json({ error: '이미 등록된 교수번호입니다.' }, { status: 409 })
      }

      const passwordHash = await hashPassword(password)

      const { error: insertError } = await supabase
        .from('professors')
        .insert({
          professor_id: professorId,
          name,
          password_hash: passwordHash
        })

      if (insertError) {
        console.error('Professor insert error:', insertError)
        return NextResponse.json({ error: '교수 계정을 생성할 수 없습니다.' }, { status: 500 })
      }
    }

    // 재인증하여 생성된 사용자 정보 확보
    const authUser = userType === 'student'
      ? await authenticateStudent(studentId as string, password)
      : await authenticateProfessor(professorId as string, password)

    if (!authUser) {
      return NextResponse.json({ error: '생성된 계정을 확인할 수 없습니다.' }, { status: 500 })
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
      },
      message: '회원가입이 완료되었습니다'
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

export const POST = withStandardAPIPerformance(signupHandler, '/api/auth/signup')

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 })
}
