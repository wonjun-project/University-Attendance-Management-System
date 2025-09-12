'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { AuthUser } from '@/types'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUserSession = async () => {
    try {
      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include', // Include cookies
      })

      if (response.ok) {
        const data = await response.json()
        return {
          id: data.user.id,
          email: null, // 이메일은 사용하지 않음
          role: data.user.type as 'student' | 'professor',
          student_id: data.user.type === 'student' ? data.user.id : null,
          professor_id: data.user.type === 'professor' ? data.user.id : null,
          name: data.user.name,
        }
      } else {
        return null
      }
    } catch (error) {
      console.error('Error fetching user session:', error)
      return null
    }
  }

  const refreshUser = async () => {
    setLoading(true)
    const userData = await fetchUserSession()
    setUser(userData)
    setLoading(false)
  }

  useEffect(() => {
    refreshUser()
  }, [])

  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
      setUser(null)
      // Redirect to home page
      window.location.href = '/'
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const value = {
    user,
    loading,
    signOut,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}