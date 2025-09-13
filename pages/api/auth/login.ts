import type { NextApiRequest, NextApiResponse } from 'next'
import { authenticateStudent, authenticateProfessor, generateToken } from '@/lib/auth-pages'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { id, password, userType } = req.body

    // Validate required fields
    if (!id || !password || !userType) {
      res.status(400).json({
        error: 'ID, password, and user type are required'
      })
      return
    }

    let user = null

    if (userType === 'student') {
      user = await authenticateStudent(id, password)
    } else if (userType === 'professor') {
      user = await authenticateProfessor(id, password)
    } else {
      res.status(400).json({
        error: 'Invalid user type'
      })
      return
    }

    if (!user) {
      res.status(401).json({
        error: 'Invalid credentials'
      })
      return
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      userType: user.type,
      name: user.name
    })

    // Set auth cookie
    res.setHeader('Set-Cookie', [
      `auth-token=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax${
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
      error: 'Internal server error'
    })
  }
}