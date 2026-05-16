"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

interface User {
  id: string
  name: string
  email: string
  role: string
}

interface AuthContextType {
  user: User | null
  // Sentinel: 'cookie' when authenticated via httpOnly cookie, null otherwise.
  // Kept in the interface so `isAuthenticated: !!token && !!user` and other
  // existing token-truthiness checks continue to work.
  token: string | null
  login: (token: string, user: User) => void
  logout: () => Promise<void>
  isLoading: boolean
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const COOKIE_SENTINEL = 'cookie'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await api.get('/auth/me')
      const u = res.data?.data?.user
      if (u) {
        setUser({ id: u.id, name: u.name, email: u.email, role: u.role })
        setToken(COOKIE_SENTINEL)
      }
    } catch {
      // 401 handler in api.ts will redirect — we just leave state null here
      setUser(null)
      setToken(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Called by the login page after a successful POST /admin/login.
  // Server has already set the httpOnly cookie; we just track user state.
  const login = (_token: string, newUser: User) => {
    setUser(newUser)
    setToken(COOKIE_SENTINEL)
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      setUser(null)
      setToken(null)
      router.push('/login')
    }
  }

  const value = {
    user,
    token,
    login,
    logout,
    isLoading,
    isAuthenticated: !!token && !!user,
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
