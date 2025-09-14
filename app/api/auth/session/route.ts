import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // JWT 토큰 검증
    let sessionData
    try {
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
      const secret = new TextEncoder().encode(jwtSecret)
      const { payload } = await jwtVerify(authToken, secret)
      sessionData = payload as { userId: string; userType: string; name: string }
    } catch (error) {
      console.log('Invalid JWT token:', error)
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Return user session data
    return NextResponse.json({
      success: true,
      user: {
        id: sessionData.userId,
        name: sessionData.name,
        type: sessionData.userType
      }
    })

  } catch (error) {
    console.error('Session check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
