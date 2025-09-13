import type { NextApiRequest, NextApiResponse } from 'next'
import { verifyToken } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // Only allow GET method
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    // Parse auth token from cookies
    let authToken = null
    if (req.headers.cookie) {
      const cookieHeader = req.headers.cookie
      const authTokenMatch = cookieHeader.match(/auth-token=([^;]+)/)
      if (authTokenMatch) {
        authToken = authTokenMatch[1]
      }
    }

    if (!authToken) {
      res.status(401).json({
        error: 'Not authenticated'
      })
      return
    }

    const user = verifyToken(authToken)

    if (!user) {
      res.status(401).json({
        error: 'Not authenticated'
      })
      return
    }

    res.status(200).json({
      success: true,
      user: {
        id: user.userId,
        name: user.name,
        type: user.userType
      }
    })

  } catch (error) {
    console.error('Session check error:', error)
    res.status(500).json({
      error: 'Internal server error'
    })
  }
}