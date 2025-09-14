import { NextRequest, NextResponse } from 'next/server'
import { sessionStore } from '@/lib/session-store'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id

    if (!sessionId) {
      return NextResponse.json(
        { error: '세션 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 세션 찾기 - 새로운 저장소 사용
    const session = sessionStore.get(sessionId)

    if (!session) {
      return NextResponse.json(
        { error: '세션을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 세션 만료 확인
    if (new Date() > new Date(session.expiresAt)) {
      return NextResponse.json(
        { error: '만료된 세션입니다.' },
        { status: 410 }
      )
    }

    return NextResponse.json({
      success: true,
      session: session
    })

  } catch (error) {
    console.error('Session retrieval error:', error)
    return NextResponse.json(
      { error: '세션 정보를 가져오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}