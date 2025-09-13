import type { NextApiRequest, NextApiResponse } from 'next'
import { authenticateStudent, authenticateProfessor, createSession } from '@/lib/auth-simple'

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

    if (!id || !password || !userType) {
      res.status(400).json({ error: 'Missing required fields' })
      return
    }

    let user = null

    if (userType === 'student') {
      user = await authenticateStudent(id, password)
    } else if (userType === 'professor') {
      user = await authenticateProfessor(id, password)
    } else {
      res.status(400).json({ error: 'Invalid user type' })
      return
    }

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    // 간단한 세션 생성
    const session = createSession(user)
    const sessionData = encodeURIComponent(JSON.stringify(session))

    res.setHeader('Set-Cookie', [
      `simple-session=${sessionData}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax${
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
    console.error('Simple login error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}