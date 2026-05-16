"use client"

import { useAuth } from "@/contexts/auth-context"
import {
  hasRole,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canAccessRoute,
  canPerformAction,
  canModifyUser,
  isSuperadmin,
  isAdmin,
  hasMinimumRole,
  getRoleLevel,
  getRoleDisplayName,
  getRoleBadgeColor,
  getRolePermissions,
  getAccessibleRoutes,
  UserRole,
  PERMISSIONS,
  ROLE_HIERARCHY
} from "@/lib/rbac"

/**
 * Custom hook for Role-Based Access Control
 * Provides convenient access to RBAC utilities with current user context
 * 
 * Usage:
 * const { canDelete, isSuperAdmin, userRole } = useRBAC()
 */
export function useRBAC() {
  const { user } = useAuth()
  const userRole = user?.role

  return {
    // User info
    user,
    userRole,
    roleLevel: getRoleLevel(userRole),
    roleDisplayName: getRoleDisplayName(userRole),
    roleBadgeColor: getRoleBadgeColor(userRole),
    
    // Role checks
    hasRole: (roles: UserRole[]) => hasRole(userRole, roles),
    isSuperAdmin: isSuperadmin(userRole),
    isAdmin: isAdmin(userRole),
    hasMinimumRole: (minRole: UserRole) => hasMinimumRole(userRole, minRole),
    
    // Permission checks
    hasPermission: (permission: string) => hasPermission(userRole, permission),
    hasAnyPermission: (permissions: string[]) => hasAnyPermission(userRole, permissions),
    hasAllPermissions: (permissions: string[]) => hasAllPermissions(userRole, permissions),
    
    // Action checks
    canAccessRoute: (route: string) => canAccessRoute(userRole, route),
    canPerformAction: (action: any) => canPerformAction(userRole, action),
    canModifyUser: (targetUserRole: string) => canModifyUser(userRole, targetUserRole),
    
    // Specific action permissions
    canBanUser: canPerformAction(userRole, 'banUser'),
    canDeleteUser: canPerformAction(userRole, 'deleteUser'),
    canEditUserRole: canPerformAction(userRole, 'editUserRole'),
    canApproveContent: canPerformAction(userRole, 'approveContent'),
    canRejectContent: canPerformAction(userRole, 'rejectContent'),
    canDeleteContent: canPerformAction(userRole, 'deleteContent'),
    canToggleFeatured: canPerformAction(userRole, 'toggleFeatured'),
    canApproveEvent: canPerformAction(userRole, 'approveEvent'),
    canCancelEvent: canPerformAction(userRole, 'cancelEvent'),
    canDeleteEvent: canPerformAction(userRole, 'deleteEvent'),
    canUpdateSiteConfig: canPerformAction(userRole, 'updateSiteConfig'),
    canUpdateRoles: canPerformAction(userRole, 'updateRoles'),
    canUpdateFeatures: canPerformAction(userRole, 'updateFeatures'),
    canResetSettings: canPerformAction(userRole, 'resetSettings'),
    
    // Specific permission checks
    canManageMusic: hasPermission(userRole, PERMISSIONS.MANAGE_MUSIC),
    canManageEvents: hasPermission(userRole, PERMISSIONS.MANAGE_EVENTS),
    canManageShows: hasPermission(userRole, PERMISSIONS.MANAGE_SHOWS),
    canManagePosts: hasPermission(userRole, PERMISSIONS.MANAGE_POSTS),
    canViewAnalytics: hasPermission(userRole, PERMISSIONS.VIEW_ANALYTICS),
    canViewReports: hasPermission(userRole, PERMISSIONS.VIEW_REPORTS),
    
    // Utility functions
    getRolePermissions: () => getRolePermissions(userRole),
    getAccessibleRoutes: () => getAccessibleRoutes(userRole),
    
    // Constants
    PERMISSIONS,
    ROLE_HIERARCHY
  }
}

/**
 * Hook to check if user can access specific routes
 */
export function useRouteAccess() {
  const { canAccessRoute } = useRBAC()
  
  return {
    canAccessDashboard: canAccessRoute('/'),
    canAccessUsers: canAccessRoute('/users'),
    canAccessEvents: canAccessRoute('/events'),
    canAccessSettings: canAccessRoute('/settings'),
    canAccessAnalytics: canAccessRoute('/analytics')
  }
}

/**
 * Hook to get role-specific UI elements
 */
export function useRoleUI() {
  const { userRole, roleDisplayName, roleBadgeColor } = useRBAC()
  
  return {
    displayName: roleDisplayName,
    badgeColor: roleBadgeColor,
    badgeText: roleDisplayName,
    
    // Badge component props
    badge: {
      className: `px-2 py-1 text-xs font-semibold rounded-full ${roleBadgeColor}`,
      children: roleDisplayName
    }
  }
}
