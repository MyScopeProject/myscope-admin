"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { useAuth } from "@/contexts/auth-context"
import api from "@/lib/api"
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { login, isAuthenticated, isLoading: authLoading } = useAuth()

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, authLoading, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    // Show loading toast
    const loadingToast = toast.loading("Signing in...")

    try {
      // Hits POST /api/admin/login. The api instance has withCredentials:true,
      // so the httpOnly cookie set by the server lands in the browser automatically.
      const res = await api.post('/admin/login', { email, password })
      const data = res.data

      // Track user in React state. Token arg is unused (cookie is the source of truth).
      login(data.token ?? 'cookie', {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role
      })

      toast.success("Login successful!", { id: loadingToast })

      const redirectTo = localStorage.getItem('redirectAfterLogin') || '/dashboard'
      localStorage.removeItem('redirectAfterLogin')

      setTimeout(() => {
        router.push(redirectTo)
      }, 500)
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Login failed'
      toast.error(msg, { id: loadingToast })
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          {/* Logo */}
          <div className="text-center mb-2">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-secondary mb-4">
              <span className="text-primary-foreground font-bold text-2xl">M</span>
            </div>
            <h1 className="text-3xl font-bold bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">
              MyScope Admin
            </h1>
            <p className="text-muted-foreground mt-2">
              Sign in to access the admin panel
            </p>
          </div>
        </CardHeader>

        <CardContent>
          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@myscope.com"
              required
              autoComplete="email"
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />

            <Button
              type="submit"
              className="w-full"
              loading={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>

        <CardFooter>
          <p className="w-full text-center text-sm text-muted-foreground">
            Only authorized administrators can access this panel
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
