import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

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

    let sessionData
    try {
      // Decode the session data from cookie
      sessionData = JSON.parse(decodeURIComponent(authToken))
    } catch (error) {
      console.log('Invalid session format:', error)
      return NextResponse.json(
        { error: 'Invalid session format' },
        { status: 401 }
      )
    }

    // Check if session is expired
    if (Date.now() > sessionData.expires) {
      return NextResponse.json(
        { error: 'Session expired' },
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