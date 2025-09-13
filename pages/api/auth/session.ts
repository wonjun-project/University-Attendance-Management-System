import type { NextApiRequest, NextApiResponse } from 'next'
import { validateSession } from '../../../lib/auth-simple'

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
      const sessionMatch = cookieHeader.match(/simple-session=([^;]+)/)
      if (sessionMatch) {
        sessionData = sessionMatch[1]
      }
    }

    if (!sessionData) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const session = validateSession(sessionData)

    if (!session) {
      res.status(401).json({ error: 'Invalid or expired session' })
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