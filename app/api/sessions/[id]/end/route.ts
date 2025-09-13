import { NextRequest, NextResponse } from 'next/server'

// 임시 세션 저장소 (실제로는 데이터베이스 사용)
const activeSessions = new Map()

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionId = params.id

    if (!sessionId) {
      return NextResponse.json(
        { error: '세션 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 세션 종료
    const session = activeSessions.get(sessionId)
    if (session) {
      session.isActive = false
      session.endedAt = new Date().toISOString()
      activeSessions.set(sessionId, session)
    }

    console.log('Session ended:', sessionId)

    return NextResponse.json({
      success: true,
      message: '세션이 종료되었습니다.'
    })

  } catch (error) {
    console.error('Session end error:', error)
    return NextResponse.json(
      { error: '세션 종료에 실패했습니다.' },
      { status: 500 }
    )
  }
}