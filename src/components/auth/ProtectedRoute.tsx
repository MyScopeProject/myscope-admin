"use client"

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { FullPageLoader } from '@/components/ui/loading'
import { canAccessRoute, hasRole, UserRole } from '@/lib/rbac'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRoles?: UserRole[]
  requireAuth?: boolean
}

export function ProtectedRoute({ 
  children, 
  requiredRoles,
  requireAuth = true 
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Redirect to login if authentication is required but user is not authenticated
    if (requireAuth && !isLoading && !isAuthenticated) {
      // Store the intended destination
      localStorage.setItem('redirectAfterLogin', pathname)
      router.push('/login')
      return
    }

    // Check role-based access
    if (!isLoading && isAuthenticated && user) {
      // Check if user's role allows access to this route
      if (!canAccessRoute(user.role, pathname)) {
        console.warn(`Access denied: User role "${user.role}" cannot access route "${pathname}"`)
        router.push('/unauthorized')
        return
      }

      // Additional check for specific required roles
      if (requiredRoles && requiredRoles.length > 0) {
        if (!hasRole(user.role, requiredRoles)) {
          console.warn(`Access denied: Required roles ${requiredRoles.join(', ')}, user has "${user.role}"`)
          router.push('/unauthorized')
          return
        }
      }
    }
  }, [isLoading, isAuthenticated, user, requiredRoles, requireAuth, router, pathname])

  // Show loading while checking auth
  if (isLoading) {
    return <FullPageLoader />
  }

  // Don't render protected content if authentication is required but not authenticated
  if (requireAuth && !isAuthenticated) {
    return <FullPageLoader />
  }

  // Check role-based access after loading
  if (isAuthenticated && user) {
    // Check route access
    if (!canAccessRoute(user.role, pathname)) {
      return <FullPageLoader />
    }

    // Check specific required roles
    if (requiredRoles && requiredRoles.length > 0) {
      if (!hasRole(user.role, requiredRoles)) {
        return <FullPageLoader />
      }
    }
  }

  return <>{children}</>
}
