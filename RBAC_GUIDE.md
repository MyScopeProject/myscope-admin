# Role-Based Access Control (RBAC) Implementation Guide

This document explains the comprehensive RBAC system implemented across the MyScope admin platform.

## Overview

The RBAC system provides granular access control based on user roles and permissions, ensuring that users can only access features and perform actions appropriate to their role.

## Role Hierarchy

Roles are organized hierarchically with increasing levels of permissions:

1. **User** (Level 1) - Basic platform access
2. **Artist** (Level 2) - Content creation capabilities
3. **Moderator** (Level 3) - Content moderation
4. **Content Manager** (Level 4) - Content management
5. **Event Manager** (Level 4) - Event-specific management
6. **Support** (Level 4) - User support functions
7. **Superadmin** (Level 5) - Full platform access

## Backend Implementation

### Middleware Functions

#### 1. Basic Admin Authentication
```javascript
import { adminAuth } from '../middleware/adminAuth.js'

router.get('/protected', adminAuth, async (req, res) => {
  // req.user is available here
  // User must be authenticated and have an admin role
})
```

#### 2. Role-Based Access
```javascript
import { adminAuth, requireRole } from '../middleware/adminAuth.js'

// Only superadmin and content-manager can access
router.delete('/content/:id', 
  adminAuth, 
  requireRole(['superadmin', 'content-manager']),
  async (req, res) => {
    // Handle delete
  }
)
```

#### 3. Permission-Based Access
```javascript
import { adminAuth, requirePermission } from '../middleware/adminAuth.js'

// Requires specific permissions
router.post('/music/upload', 
  adminAuth,
  requirePermission(['manage_music', 'upload_music']),
  async (req, res) => {
    // Handle upload
  }
)
```

#### 4. Minimum Role Level
```javascript
import { adminAuth, requireMinRole } from '../middleware/adminAuth.js'

// Requires at least moderator role
router.delete('/post/:id', 
  adminAuth,
  requireMinRole('moderator'),
  async (req, res) => {
    // Handle delete
  }
)
```

#### 5. Ownership or Role Check
```javascript
import { adminAuth, requireOwnershipOrRole } from '../middleware/adminAuth.js'

// User must own the resource OR have moderator+ role
router.put('/profile/:userId', 
  adminAuth,
  requireOwnershipOrRole(['superadmin', 'moderator']),
  async (req, res) => {
    // Handle update
  }
)
```

#### 6. Superadmin Only
```javascript
import { adminAuth, superadminOnly } from '../middleware/adminAuth.js'

router.post('/settings/reset', 
  adminAuth,
  superadminOnly,
  async (req, res) => {
    // Only superadmin can access
  }
)
```

### Role Utilities
```javascript
import { roleUtils } from '../middleware/adminAuth.js'

// Check if role has permission
roleUtils.hasPermission('content-manager', 'manage_music') // true

// Check if role has any of multiple permissions
roleUtils.hasAnyPermission('moderator', ['delete_posts', 'ban_users']) // true

// Check if role has all permissions
roleUtils.hasAllPermissions('artist', ['upload_music', 'create_events']) // true

// Get role level
roleUtils.getRoleLevel('superadmin') // 5

// Check if user can access another role
roleUtils.canAccessRole('superadmin', 'moderator') // true
```

## Frontend Implementation

### 1. Using the useRBAC Hook

```typescript
import { useRBAC } from '@/hooks/useRBAC'

function MyComponent() {
  const { 
    userRole,
    isSuperAdmin,
    canDeleteContent,
    canManageMusic,
    hasPermission
  } = useRBAC()

  return (
    <div>
      <p>Your role: {userRole}</p>
      
      {canDeleteContent && (
        <button onClick={handleDelete}>Delete</button>
      )}
      
      {hasPermission('view_analytics') && (
        <AnalyticsDashboard />
      )}
    </div>
  )
}
```

### 2. Using RoleGuard Component

```typescript
import { RoleGuard } from '@/components/auth/RoleGuard'

// Show only to specific roles
<RoleGuard allowedRoles={['superadmin', 'content-manager']}>
  <DeleteButton />
</RoleGuard>

// Require specific permission
<RoleGuard requiredPermission="manage_music">
  <MusicUploadForm />
</RoleGuard>

// Require specific action permission
<RoleGuard requiredAction="banUser">
  <BanUserButton />
</RoleGuard>

// Minimum role level
<RoleGuard minimumRole="moderator">
  <ModerationPanel />
</RoleGuard>

// With fallback content
<RoleGuard 
  allowedRoles={['superadmin']} 
  fallback={<p>Access denied</p>}
>
  <SettingsPanel />
</RoleGuard>

// Show forbidden message
<RoleGuard 
  allowedRoles={['superadmin']} 
  showForbidden
>
  <DangerousAction />
</RoleGuard>
```

### 3. Using SuperadminOnly Component

```typescript
import { SuperadminOnly } from '@/components/auth/RoleGuard'

<SuperadminOnly>
  <ResetSettingsButton />
</SuperadminOnly>

<SuperadminOnly fallback={<p>Superadmin only</p>}>
  <DangerZone />
</SuperadminOnly>
```

### 4. Using ShowForRoles / HideForRoles

```typescript
import { ShowForRoles, HideForRoles } from '@/components/auth/RoleGuard'

<ShowForRoles roles={['moderator', 'superadmin']}>
  <ModeratorTools />
</ShowForRoles>

<HideForRoles roles={['user']}>
  <AdvancedSettings />
</HideForRoles>
```

### 5. Protected Routes

```typescript
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

// Basic authentication
<ProtectedRoute>
  <DashboardPage />
</ProtectedRoute>

// With specific role requirements
<ProtectedRoute requiredRoles={['superadmin', 'content-manager']}>
  <SettingsPage />
</ProtectedRoute>

// Optional authentication
<ProtectedRoute requireAuth={false}>
  <PublicPage />
</ProtectedRoute>
```

### 6. Route Access Hook

```typescript
import { useRouteAccess } from '@/hooks/useRBAC'

function Navigation() {
  const {
    canAccessDashboard,
    canAccessUsers,
    canAccessSettings
  } = useRouteAccess()

  return (
    <nav>
      {canAccessDashboard && <Link href="/">Dashboard</Link>}
      {canAccessUsers && <Link href="/users">Users</Link>}
      {canAccessSettings && <Link href="/settings">Settings</Link>}
    </nav>
  )
}
```

### 7. Role UI Hook

```typescript
import { useRoleUI } from '@/hooks/useRBAC'

function UserProfile() {
  const { displayName, badgeColor, badge } = useRoleUI()

  return (
    <div>
      <span className={badgeColor}>{displayName}</span>
      {/* Or use badge props directly */}
      <span {...badge} />
    </div>
  )
}
```

### 8. Direct RBAC Functions

```typescript
import { 
  hasRole, 
  hasPermission, 
  canAccessRoute,
  canPerformAction,
  isSuperadmin
} from '@/lib/rbac'

// In your component
const user = { role: 'moderator' }

if (hasRole(user.role, ['moderator', 'superadmin'])) {
  // User has one of these roles
}

if (hasPermission(user.role, 'delete_posts')) {
  // User can delete posts
}

if (canAccessRoute(user.role, '/settings')) {
  // User can access settings route
}

if (canPerformAction(user.role, 'banUser')) {
  // User can ban other users
}

if (isSuperadmin(user.role)) {
  // User is superadmin
}
```

## Permissions Reference

### User Permissions
- `create_posts` - Create community posts
- `comment` - Comment on content
- `like` - Like content
- `follow` - Follow other users

### Artist Permissions
- All user permissions +
- `upload_music` - Upload music tracks
- `create_events` - Create events
- `create_shows` - Create shows

### Moderator Permissions
- `delete_posts` - Delete posts
- `delete_comments` - Delete comments
- `ban_users` - Ban users
- `view_reports` - View reported content
- `manage_posts` - Manage community posts

### Content Manager Permissions
- `manage_music` - Manage music content
- `manage_events` - Manage events
- `manage_shows` - Manage shows
- `manage_posts` - Manage posts
- `approve_content` - Approve pending content
- `delete_content` - Delete any content
- `view_analytics` - View analytics

### Event Manager Permissions
- `manage_events` - Manage events
- `approve_events` - Approve events
- `delete_events` - Delete events
- `view_analytics` - View analytics

### Support Permissions
- `view_users` - View user information
- `view_reports` - View reports
- `respond_tickets` - Respond to support tickets

### Superadmin Permissions
- `*` - All permissions

## Route Access Control

Routes are automatically protected based on role:

| Route | Allowed Roles |
|-------|--------------|
| `/` (Dashboard) | All admin roles |
| `/users` | superadmin, moderator, support |
| `/events` | superadmin, content-manager, event-manager |
| `/music` | superadmin, content-manager |
| `/community` | superadmin, content-manager, moderator |
| `/shows` | superadmin, content-manager |
| `/settings` | superadmin only |
| `/analytics` | superadmin, content-manager, event-manager |

## Best Practices

1. **Always use backend middleware** - Never rely solely on frontend checks
2. **Combine multiple checks** - Use both role and permission checks when appropriate
3. **Provide feedback** - Use `showForbidden` or `fallback` to inform users
4. **Test with different roles** - Ensure proper access control for all roles
5. **Log access attempts** - Monitor unauthorized access attempts
6. **Keep permissions granular** - Prefer specific permissions over broad roles
7. **Use TypeScript** - Leverage type safety for roles and permissions

## Migration Guide

To add RBAC to existing routes:

### Backend
```javascript
// Before
router.delete('/item/:id', async (req, res) => {
  // Delete logic
})

// After
import { adminAuth, requireRole } from '../middleware/adminAuth.js'

router.delete('/item/:id', 
  adminAuth,
  requireRole(['superadmin', 'content-manager']),
  async (req, res) => {
    // Delete logic
  }
)
```

### Frontend
```typescript
// Before
<button onClick={handleDelete}>Delete</button>

// After
import { RoleGuard } from '@/components/auth/RoleGuard'

<RoleGuard requiredAction="deleteContent">
  <button onClick={handleDelete}>Delete</button>
</RoleGuard>
```

## Troubleshooting

**Issue: User has role but still gets 403**
- Check if the role is spelled correctly
- Verify role is in allowed roles array
- Check backend logs for specific error

**Issue: RoleGuard not hiding content**
- Ensure user object is loaded
- Check if role is passed correctly to RBAC functions
- Verify role exists in ROLE_HIERARCHY

**Issue: Route redirects to unauthorized**
- Check ROUTE_ACCESS configuration
- Verify user role is in allowed roles for route
- Check browser console for access denied logs

## Security Considerations

1. **Token Security** - JWT tokens must be stored securely
2. **Token Expiration** - Implement proper token refresh
3. **Role Changes** - Force re-authentication after role changes
4. **Audit Logging** - Log all role-based access decisions
5. **Rate Limiting** - Prevent brute force attacks
6. **HTTPS Only** - All admin routes must use HTTPS
7. **CSRF Protection** - Implement CSRF tokens for state-changing operations
