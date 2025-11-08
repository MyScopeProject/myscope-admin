"use client"

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { FullPageLoader } from '@/components/ui/loading'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRoles?: string[]
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Store the intended destination
      localStorage.setItem('redirectAfterLogin', pathname)
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, router, pathname])

  useEffect(() => {
    // Check role-based access if required
    if (!isLoading && isAuthenticated && requiredRoles && requiredRoles.length > 0) {
      if (!user || !requiredRoles.includes(user.role)) {
        router.push('/unauthorized')
      }
    }
  }, [isLoading, isAuthenticated, user, requiredRoles, router])

  // Show loading while checking auth
  if (isLoading) {
    return <FullPageLoader />
  }

  // Don't render protected content if not authenticated
  if (!isAuthenticated) {
    return <FullPageLoader />
  }

  // Check role-based access
  if (requiredRoles && requiredRoles.length > 0) {
    if (!user || !requiredRoles.includes(user.role)) {
      return <FullPageLoader />
    }
  }

  return <>{children}</>
}
