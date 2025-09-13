import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { id, password, userType } = req.body

    console.log('Login attempt:', { id, userType })

    if (!id || !password || !userType) {
      res.status(400).json({ error: 'Missing required fields' })
      return
    }

    // 하드코딩된 테스트 계정 (데이터베이스 없이)
    let user = null

    if (userType === 'student' && id === 'stu001' && password === 'password123') {
      user = {
        id: 'stu001',
        name: '테스트 학생',
        type: 'student'
      }
    } else if (userType === 'professor' && id === 'prof001' && password === 'password123') {
      user = {
        id: 'prof001',
        name: '테스트 교수',
        type: 'professor'
      }
    }

    if (!user) {
      console.log('Authentication failed for:', { id, userType })
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    console.log('Authentication successful:', user)

    // 간단한 세션 쿠키 (JWT 없이)
    const sessionData = JSON.stringify({
      userId: user.id,
      userType: user.type,
      name: user.name,
      expires: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7일
    })

    res.setHeader('Set-Cookie', [
      `auth-token=${encodeURIComponent(sessionData)}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax${
        process.env.NODE_ENV === 'production' ? '; Secure' : ''
      }`
    ])

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        type: user.type
      }
    })

  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}