/**
 * Role-Based Access Control (RBAC) Utilities
 * Centralized role and permission management for frontend
 */

// Role hierarchy (higher number = more permissions)
export const ROLE_HIERARCHY = {
  user: 1,
  artist: 2,
  moderator: 3,
  'content-manager': 4,
  'event-manager': 4,
  support: 4,
  superadmin: 5
} as const;

export type UserRole = keyof typeof ROLE_HIERARCHY;

// Permission definitions
export const PERMISSIONS = {
  // User permissions
  CREATE_POSTS: 'create_posts',
  COMMENT: 'comment',
  LIKE: 'like',
  FOLLOW: 'follow',
  
  // Artist permissions
  UPLOAD_MUSIC: 'upload_music',
  CREATE_EVENTS: 'create_events',
  CREATE_SHOWS: 'create_shows',
  
  // Moderator permissions
  DELETE_POSTS: 'delete_posts',
  DELETE_COMMENTS: 'delete_comments',
  BAN_USERS: 'ban_users',
  VIEW_REPORTS: 'view_reports',
  MANAGE_POSTS: 'manage_posts',
  
  // Content Manager permissions
  MANAGE_MUSIC: 'manage_music',
  MANAGE_EVENTS: 'manage_events',
  MANAGE_SHOWS: 'manage_shows',
  APPROVE_CONTENT: 'approve_content',
  DELETE_CONTENT: 'delete_content',
  VIEW_ANALYTICS: 'view_analytics',
  
  // Event Manager permissions
  APPROVE_EVENTS: 'approve_events',
  DELETE_EVENTS: 'delete_events',
  
  // Support permissions
  VIEW_USERS: 'view_users',
  RESPOND_TICKETS: 'respond_tickets',
  
  // Superadmin permission
  ALL: '*'
} as const;

// Role to permissions mapping
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  user: [
    PERMISSIONS.CREATE_POSTS,
    PERMISSIONS.COMMENT,
    PERMISSIONS.LIKE,
    PERMISSIONS.FOLLOW
  ],
  artist: [
    PERMISSIONS.CREATE_POSTS,
    PERMISSIONS.COMMENT,
    PERMISSIONS.LIKE,
    PERMISSIONS.FOLLOW,
    PERMISSIONS.UPLOAD_MUSIC,
    PERMISSIONS.CREATE_EVENTS,
    PERMISSIONS.CREATE_SHOWS
  ],
  moderator: [
    PERMISSIONS.DELETE_POSTS,
    PERMISSIONS.DELETE_COMMENTS,
    PERMISSIONS.BAN_USERS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_POSTS
  ],
  'content-manager': [
    PERMISSIONS.MANAGE_MUSIC,
    PERMISSIONS.MANAGE_EVENTS,
    PERMISSIONS.MANAGE_SHOWS,
    PERMISSIONS.MANAGE_POSTS,
    PERMISSIONS.APPROVE_CONTENT,
    PERMISSIONS.DELETE_CONTENT,
    PERMISSIONS.VIEW_ANALYTICS
  ],
  'event-manager': [
    PERMISSIONS.MANAGE_EVENTS,
    PERMISSIONS.APPROVE_EVENTS,
    PERMISSIONS.DELETE_EVENTS,
    PERMISSIONS.VIEW_ANALYTICS
  ],
  support: [
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.RESPOND_TICKETS
  ],
  superadmin: [PERMISSIONS.ALL]
};

// Route access control
export const ROUTE_ACCESS: Record<string, UserRole[]> = {
  // Dashboard - all admin roles can access
  '/dashboard': ['superadmin', 'content-manager', 'event-manager', 'moderator', 'support'],
  
  // User Management - superadmin, moderator, support
  '/users': ['superadmin', 'moderator', 'support'],
  
  // Event Management
  '/events': ['superadmin', 'content-manager', 'event-manager'],

  // Event approval queue — same access as event management
  '/events/review': ['superadmin', 'content-manager', 'event-manager'],

  // Hero carousel curation — public landing-page management
  '/hero-carousel': ['superadmin', 'content-manager'],

  // Organizer applications — admins who can vouch for businesses
  '/organizers': ['superadmin', 'content-manager', 'event-manager'],

  // Step 12: payouts & finance — superadmin and event-manager
  '/payouts': ['superadmin', 'event-manager'],
  '/reports': ['superadmin'],

  // Settings - superadmin only
  '/settings': ['superadmin'],
  
  // Analytics - higher roles
  '/analytics': ['superadmin', 'content-manager', 'event-manager']
};

// Action permissions for specific features
export const ACTION_PERMISSIONS = {
  // User actions
  banUser: ['superadmin', 'moderator'],
  deleteUser: ['superadmin'],
  editUserRole: ['superadmin'],
  
  // Content actions
  approveContent: ['superadmin', 'content-manager'],
  rejectContent: ['superadmin', 'content-manager'],
  deleteContent: ['superadmin', 'content-manager', 'moderator'],
  toggleFeatured: ['superadmin', 'content-manager'],
  
  // Event actions
  approveEvent: ['superadmin', 'content-manager', 'event-manager'],
  cancelEvent: ['superadmin', 'content-manager', 'event-manager'],
  deleteEvent: ['superadmin', 'content-manager', 'event-manager'],
  
  // Settings actions
  updateSiteConfig: ['superadmin'],
  updateRoles: ['superadmin'],
  updateFeatures: ['superadmin'],
  resetSettings: ['superadmin']
};

/**
 * Check if user has a specific role
 */
export function hasRole(userRole: string | undefined, allowedRoles: UserRole[]): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole as UserRole);
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(userRole: string | undefined, permission: string): boolean {
  if (!userRole) return false;
  
  const permissions = ROLE_PERMISSIONS[userRole as UserRole] || [];
  return permissions.includes(PERMISSIONS.ALL) || permissions.includes(permission);
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(userRole: string | undefined, permissions: string[]): boolean {
  if (!userRole) return false;
  return permissions.some(perm => hasPermission(userRole, perm));
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(userRole: string | undefined, permissions: string[]): boolean {
  if (!userRole) return false;
  return permissions.every(perm => hasPermission(userRole, perm));
}

/**
 * Check if user can access a specific route
 */
export function canAccessRoute(userRole: string | undefined, route: string): boolean {
  if (!userRole) return false;
  
  // Superadmin can access everything
  if (userRole === 'superadmin') return true;
  
  const allowedRoles = ROUTE_ACCESS[route];
  if (!allowedRoles) return true; // No restrictions
  
  return allowedRoles.includes(userRole as UserRole);
}

/**
 * Check if user can perform a specific action
 */
export function canPerformAction(userRole: string | undefined, action: keyof typeof ACTION_PERMISSIONS): boolean {
  if (!userRole) return false;
  
  const allowedRoles = ACTION_PERMISSIONS[action];
  if (!allowedRoles) return false;
  
  return allowedRoles.includes(userRole as UserRole);
}

/**
 * Get role level for comparison
 */
export function getRoleLevel(role: string | undefined): number {
  if (!role) return 0;
  return ROLE_HIERARCHY[role as UserRole] || 0;
}

/**
 * Check if user role is higher or equal to target role
 */
export function hasMinimumRole(userRole: string | undefined, minimumRole: UserRole): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(minimumRole);
}

/**
 * Check if user can modify another user (based on role hierarchy)
 */
export function canModifyUser(userRole: string | undefined, targetUserRole: string | undefined): boolean {
  if (!userRole || !targetUserRole) return false;
  
  // Superadmin can modify anyone
  if (userRole === 'superadmin') return true;
  
  // Can't modify users with equal or higher role
  return getRoleLevel(userRole) > getRoleLevel(targetUserRole);
}

/**
 * Check if user is superadmin
 */
export function isSuperadmin(userRole: string | undefined): boolean {
  return userRole === 'superadmin';
}

/**
 * Check if user is admin (any admin role)
 */
export function isAdmin(userRole: string | undefined): boolean {
  if (!userRole) return false;
  const adminRoles: UserRole[] = ['superadmin', 'content-manager', 'event-manager', 'moderator', 'support'];
  return adminRoles.includes(userRole as UserRole);
}

/**
 * Get formatted role name for display
 */
export function getRoleDisplayName(role: string | undefined): string {
  if (!role) return 'Unknown';
  
  const displayNames: Record<string, string> = {
    user: 'User',
    artist: 'Artist',
    moderator: 'Moderator',
    'content-manager': 'Content Manager',
    'event-manager': 'Event Manager',
    support: 'Support',
    superadmin: 'Super Admin'
  };
  
  return displayNames[role] || role;
}

/**
 * Get role badge color
 */
export function getRoleBadgeColor(role: string | undefined): string {
  if (!role) return 'bg-gray-500/10 text-gray-500';
  
  const colors: Record<string, string> = {
    user: 'bg-gray-500/10 text-gray-500',
    artist: 'bg-blue-500/10 text-blue-500',
    moderator: 'bg-yellow-500/10 text-yellow-500',
    'content-manager': 'bg-purple-500/10 text-purple-500',
    'event-manager': 'bg-indigo-500/10 text-indigo-500',
    support: 'bg-green-500/10 text-green-500',
    superadmin: 'bg-red-500/10 text-red-500'
  };
  
  return colors[role] || 'bg-gray-500/10 text-gray-500';
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: string | undefined): string[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role as UserRole] || [];
}

/**
 * Get accessible routes for a role
 */
export function getAccessibleRoutes(role: string | undefined): string[] {
  if (!role) return [];
  
  return Object.entries(ROUTE_ACCESS)
    .filter(([_, allowedRoles]) => allowedRoles.includes(role as UserRole))
    .map(([route]) => route);
}
