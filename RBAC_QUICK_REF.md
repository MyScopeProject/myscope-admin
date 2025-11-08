# RBAC Quick Reference Card

## Backend Middleware

```javascript
import { 
  adminAuth,           // Basic admin auth
  requireRole,         // Specific roles
  requirePermission,   // Specific permissions
  requireMinRole,      // Minimum role level
  superadminOnly,      // Superadmin only
  requireOwnershipOrRole // Owner or privileged role
} from '../middleware/adminAuth.js'
```

### Usage Examples

```javascript
// Basic admin authentication
router.get('/protected', adminAuth, handler)

// Specific roles only
router.delete('/item/:id', 
  adminAuth,
  requireRole(['superadmin', 'content-manager']),
  handler
)

// Permission-based
router.post('/upload', 
  adminAuth,
  requirePermission(['manage_music']),
  handler
)

// Minimum role level
router.put('/moderate', 
  adminAuth,
  requireMinRole('moderator'),
  handler
)

// Superadmin only
router.post('/reset', 
  adminAuth,
  superadminOnly,
  handler
)

// Ownership or role
router.put('/profile/:userId',
  adminAuth,
  requireOwnershipOrRole(['superadmin']),
  handler
)
```

## Frontend Components

### useRBAC Hook

```typescript
import { useRBAC } from '@/hooks/useRBAC'

const {
  // Role info
  userRole,
  isSuperAdmin,
  isAdmin,
  
  // Permission checks
  canDeleteContent,
  canApproveContent,
  canManageMusic,
  
  // Functions
  hasRole,
  hasPermission,
  canPerformAction
} = useRBAC()
```

### RoleGuard Component

```typescript
import { RoleGuard, SuperadminOnly } from '@/components/auth/RoleGuard'

// By role
<RoleGuard allowedRoles={['superadmin', 'content-manager']}>
  <DeleteButton />
</RoleGuard>

// By permission
<RoleGuard requiredPermission="manage_music">
  <MusicUpload />
</RoleGuard>

// By action
<RoleGuard requiredAction="banUser">
  <BanButton />
</RoleGuard>

// Minimum role
<RoleGuard minimumRole="moderator">
  <ModPanel />
</RoleGuard>

// Superadmin only
<SuperadminOnly>
  <DangerZone />
</SuperadminOnly>

// With fallback
<RoleGuard 
  allowedRoles={['superadmin']}
  fallback={<p>Access denied</p>}
>
  <Content />
</RoleGuard>

// Show forbidden message
<RoleGuard 
  allowedRoles={['superadmin']}
  showForbidden
>
  <RestrictedContent />
</RoleGuard>
```

### ProtectedRoute

```typescript
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

// Basic protection
<ProtectedRoute>
  <Page />
</ProtectedRoute>

// With role requirements
<ProtectedRoute requiredRoles={['superadmin']}>
  <SettingsPage />
</ProtectedRoute>
```

## Roles & Permissions

### Roles (Hierarchical)
1. **user** - Basic access
2. **artist** - Content creation
3. **moderator** - Content moderation
4. **content-manager** - Content management
5. **event-manager** - Event management
6. **support** - User support
7. **superadmin** - Full access

### Common Permissions
- `create_posts`, `comment`, `like`, `follow`
- `upload_music`, `create_events`, `create_shows`
- `delete_posts`, `delete_comments`, `ban_users`
- `manage_music`, `manage_events`, `manage_shows`
- `approve_content`, `delete_content`
- `view_analytics`, `view_reports`

### Action Permissions
- `banUser` - Ban users
- `deleteUser` - Delete users
- `editUserRole` - Change user roles
- `approveContent` - Approve content
- `deleteContent` - Delete content
- `toggleFeatured` - Feature content
- `updateSiteConfig` - Update site settings

## Common Patterns

### Conditional Rendering

```typescript
// Using hook
const { canDelete } = useRBAC()

{canDelete && <DeleteButton />}

// Using component
<RoleGuard requiredAction="deleteContent">
  <DeleteButton />
</RoleGuard>
```

### Button States

```typescript
const { canEdit, canDelete } = useRBAC()

<button disabled={!canEdit}>Edit</button>
<button disabled={!canDelete}>Delete</button>
```

### Navigation

```typescript
import { useRouteAccess } from '@/hooks/useRBAC'

const { canAccessSettings, canAccessUsers } = useRouteAccess()

<nav>
  {canAccessUsers && <Link href="/users">Users</Link>}
  {canAccessSettings && <Link href="/settings">Settings</Link>}
</nav>
```

### Role Badges

```typescript
import { useRoleUI } from '@/hooks/useRBAC'

const { badge } = useRoleUI()

<span {...badge} />
// or
<span className={badgeColor}>{displayName}</span>
```

## Testing Different Roles

Create test users with different roles:

```javascript
// Superadmin - full access
{ role: 'superadmin' }

// Content Manager - manage content
{ role: 'content-manager' }

// Moderator - moderate content
{ role: 'moderator' }

// Support - view & help users
{ role: 'support' }
```

## Security Checklist

- ✅ Use backend middleware on all protected routes
- ✅ Never rely solely on frontend checks
- ✅ Validate user role in backend
- ✅ Check token expiration
- ✅ Log unauthorized access attempts
- ✅ Use HTTPS in production
- ✅ Implement rate limiting
- ✅ Add CSRF protection

## Troubleshooting

**403 Forbidden Error**
- Check user role in token
- Verify role spelling
- Check route middleware configuration

**Content Still Visible**
- Ensure RoleGuard is used
- Check user object is loaded
- Verify role in localStorage/cookies

**Route Redirects to Unauthorized**
- Check ROUTE_ACCESS in rbac.ts
- Verify user role matches allowed roles
- Check browser console for errors
