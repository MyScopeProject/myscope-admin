"use client"

import { useAuth } from "@/contexts/auth-context"
import { 
  hasRole, 
  hasPermission, 
  canAccessRoute, 
  canPerformAction,
  isSuperadmin,
  hasMinimumRole,
  UserRole
} from "@/lib/rbac"
import type { ReactNode } from "react"

interface RoleGuardProps {
  children: ReactNode
  allowedRoles?: UserRole[]
  requiredPermission?: string
  requiredAction?: string
  minimumRole?: UserRole
  fallback?: ReactNode
  showForbidden?: boolean
}

/**
 * Role Guard Component
 * Conditionally renders children based on user role/permissions
 * 
 * Usage:
 * <RoleGuard allowedRoles={['superadmin', 'content-manager']}>
 *   <Button>Delete</Button>
 * </RoleGuard>
 * 
 * <RoleGuard requiredPermission="manage_music">
 *   <MusicManager />
 * </RoleGuard>
 */
export function RoleGuard({
  children,
  allowedRoles,
  requiredPermission,
  requiredAction,
  minimumRole,
  fallback = null,
  showForbidden = false
}: RoleGuardProps) {
  const { user } = useAuth()

  // Check if user has required access
  let hasAccess = true

  if (allowedRoles && !hasRole(user?.role, allowedRoles)) {
    hasAccess = false
  }

  if (requiredPermission && !hasPermission(user?.role, requiredPermission)) {
    hasAccess = false
  }

  if (requiredAction && !canPerformAction(user?.role, requiredAction as any)) {
    hasAccess = false
  }

  if (minimumRole && !hasMinimumRole(user?.role, minimumRole)) {
    hasAccess = false
  }

  if (!hasAccess) {
    if (showForbidden) {
      return (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-destructive text-sm">
            You don't have permission to access this feature.
          </p>
        </div>
      )
    }
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Superadmin Only Guard
 */
export function SuperadminOnly({ 
  children, 
  fallback = null 
}: { 
  children: ReactNode
  fallback?: ReactNode 
}) {
  const { user } = useAuth()
  
  if (!isSuperadmin(user?.role)) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

/**
 * Hide for roles
 * Opposite of RoleGuard - hides content for specified roles
 */
export function HideForRoles({
  children,
  roles
}: {
  children: ReactNode
  roles: UserRole[]
}) {
  const { user } = useAuth()
  
  if (hasRole(user?.role, roles)) {
    return null
  }
  
  return <>{children}</>
}

/**
 * Show only for roles
 */
export function ShowForRoles({
  children,
  roles,
  fallback = null
}: {
  children: ReactNode
  roles: UserRole[]
  fallback?: ReactNode
}) {
  const { user } = useAuth()
  
  if (!hasRole(user?.role, roles)) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}
