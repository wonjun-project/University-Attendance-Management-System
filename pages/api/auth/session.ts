import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    // 세션 쿠키에서 데이터 추출
    let sessionData = null
    if (req.headers.cookie) {
      const cookieHeader = req.headers.cookie
      const sessionMatch = cookieHeader.match(/auth-token=([^;]+)/)
      if (sessionMatch) {
        sessionData = sessionMatch[1]
      }
    }

    if (!sessionData) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    let session
    try {
      // 새로운 JSON 쿠키 형태 시도
      session = JSON.parse(decodeURIComponent(sessionData))
    } catch (error) {
      // JWT 토큰이거나 잘못된 형식이면 인증 실패 처리
      console.log('Invalid session format, clearing cookie:', error instanceof Error ? error.message : 'Unknown error')
      res.setHeader('Set-Cookie', [
        `auth-token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${
          process.env.NODE_ENV === 'production' ? '; Secure' : ''
        }`
      ])
      res.status(401).json({ error: 'Invalid session format' })
      return
    }

    // 만료 확인
    if (Date.now() > session.expires) {
      res.status(401).json({ error: 'Session expired' })
      return
    }

    res.status(200).json({
      success: true,
      user: {
        id: session.userId,
        name: session.name,
        type: session.userType
      }
    })

  } catch (error) {
    console.error('Session check error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}