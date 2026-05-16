"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { useGoogleLogin } from "@react-oauth/google"
import { useAuth } from "@/contexts/auth-context"
import { adminAPI } from "@/lib/apiEndpoints"
import { canAccessRoute } from "@/lib/rbac"
import Image from "next/image"
import { AlertCircle, Loader } from "lucide-react"

const safeRedirectFor = (role: string): string => {
  const saved = localStorage.getItem('redirectAfterLogin')
  localStorage.removeItem('redirectAfterLogin')
  if (saved && canAccessRoute(role, saved)) return saved
  return '/dashboard'
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58Z"/>
    </svg>
  )
}

export default function LoginPage() {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { login, isAuthenticated, isLoading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, authLoading, router])

  const googleSignIn = useGoogleLogin({
    onSuccess: async ({ access_token }) => {
      setError("")
      setLoading(true)
      const loadingToast = toast.loading("Signing in…")
      try {
        const res = await adminAPI.googleLogin(access_token, true)
        const data = res.data
        login(data.token ?? 'cookie', {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
        })
        toast.success("Welcome back!", { id: loadingToast })
        setTimeout(() => router.push(safeRedirectFor(data.user.role)), 500)
      } catch (err: any) {
        const msg = err?.response?.data?.message || err?.message || 'Google login failed'
        toast.error(msg, { id: loadingToast })
        setError(msg)
        setLoading(false)
      }
    },
    onError: () => {
      setError("Google sign-in was cancelled or failed. Try again.")
    },
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <Image
            src="/images/logo.png"
            alt="MyScope"
            width={160}
            height={48}
            className="h-12 w-auto"
            priority
          />
          <h1 className="text-2xl font-bold tracking-tight text-violet-900 dark:text-violet-200">
            MyScope Admin
          </h1>
          <p className="text-sm text-muted-foreground">Sign in to access the admin panel</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm dark:ring-1 dark:ring-white/10">

          {error && (
            <div className="mb-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => googleSignIn()}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted disabled:opacity-60"
          >
            {loading ? <Loader className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
            {loading ? "Signing in…" : "Continue with Google"}
          </button>

          <div className="mt-6 border-t border-border pt-6">
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              Only authorized administrators can access this panel. Contact your superadmin to request access.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
