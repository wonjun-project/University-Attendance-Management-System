import { NextResponse } from 'next/server'

export async function POST() {
  try {
    console.log('Logout request received')

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    })

    // Clear the auth cookie
    response.cookies.set('auth-token', '', {
      path: '/',
      maxAge: 0, // Expire immediately
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    })

    console.log('Logout successful, cookie cleared')

    return response

  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      {
        error: '로그아웃 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
