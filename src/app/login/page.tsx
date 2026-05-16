"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google"
import { useAuth } from "@/contexts/auth-context"
import { useTheme } from "@/components/theme-provider"
import api from "@/lib/api"
import { adminAPI } from "@/lib/apiEndpoints"
import { canAccessRoute } from "@/lib/rbac"
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

// Honor the saved redirect only if the freshly-logged-in user can actually
// reach it. Otherwise a stale `redirectAfterLogin=/settings` from an earlier
// attempt sends a non-superadmin straight to /unauthorized.
const safeRedirectFor = (role: string): string => {
  const saved = localStorage.getItem('redirectAfterLogin')
  localStorage.removeItem('redirectAfterLogin')
  if (saved && canAccessRoute(role, saved)) return saved
  return '/dashboard'
}

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { login, isAuthenticated, isLoading: authLoading } = useAuth()
  const { resolvedTheme } = useTheme()

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

      const redirectTo = safeRedirectFor(data.user.role)

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

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      toast.error("Google did not return a credential.")
      return
    }
    setError("")
    setLoading(true)
    const loadingToast = toast.loading("Signing in with Google...")

    try {
      const res = await adminAPI.googleLogin(credentialResponse.credential)
      const data = res.data

      login(data.token ?? 'cookie', {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
      })

      toast.success("Login successful!", { id: loadingToast })

      const redirectTo = safeRedirectFor(data.user.role)

      setTimeout(() => router.push(redirectTo), 500)
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Google login failed'
      toast.error(msg, { id: loadingToast })
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 dark:bg-background px-4 py-8">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          {/* Logo */}
          <div className="text-center mb-2">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary mb-4">
              <span className="text-primary-foreground font-bold text-2xl">M</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              MyScope Admin
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Sign in to access the admin panel
            </p>
          </div>
        </CardHeader>

        <CardContent>
          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email address
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@myscope.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-card text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => {
                  setError("Google login failed. Please try again.")
                  toast.error("Google login failed.")
                }}
                theme={resolvedTheme === "dark" ? "filled_black" : "outline"}
                size="large"
                width="320"
              />
            </div>
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
