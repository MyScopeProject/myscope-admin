# Route Protection Implementation

## Overview

The admin panel now has comprehensive route protection ensuring only authenticated users with valid JWT tokens can access protected pages. The system includes:

- **AuthContext**: Centralized authentication state management
- **ProtectedRoute**: Wrapper component for protected pages
- **Role-based access**: Support for role-specific page access
- **Auto-redirect**: Unauthenticated users redirected to login
- **Persistent sessions**: Auth state persists across page reloads

## Architecture

### 1. Auth Context (`/src/contexts/auth-context.tsx`)

Provides global authentication state and methods:

```typescript
interface AuthContextType {
  user: User | null           // Current logged-in user
  token: string | null        // JWT token
  login: (token, user) => void  // Login method
  logout: () => void          // Logout method
  isLoading: boolean          // Loading state during auth check
  isAuthenticated: boolean    // Whether user is authenticated
}
```

**Features:**
- Automatically loads auth from localStorage on mount
- Provides `useAuth()` hook for components
- Handles token and user data persistence
- Centralized logout with automatic redirect

**Usage in components:**
```typescript
import { useAuth } from '@/contexts/auth-context'

const { user, isAuthenticated, logout } = useAuth()
```

### 2. Protected Route Component (`/src/components/auth/ProtectedRoute.tsx`)

Wrapper component that protects pages from unauthorized access:

```typescript
<ProtectedRoute requiredRoles={['superadmin', 'event-manager']}>
  <YourPageContent />
</ProtectedRoute>
```

**Features:**
- Checks authentication status
- Shows loading spinner while checking
- Redirects to `/login` if not authenticated
- Stores intended destination for post-login redirect
- Supports optional role-based access control
- Redirects to `/unauthorized` if user lacks required role

**Props:**
- `children`: React.ReactNode - Page content to protect
- `requiredRoles?`: string[] - Optional array of roles that can access the page

### 3. Updated Pages

#### Dashboard (`/src/app/dashboard/page.tsx`)
```typescript
export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <ProtectedRoute>
      <AdminLayout user={user || undefined}>
        {/* Dashboard content */}
      </AdminLayout>
    </ProtectedRoute>
  )
}
```

#### Login Page (`/src/app/login/page.tsx`)
- Updated to use `login()` from auth context
- Auto-redirects if already authenticated
- Stores auth data via context (persists to localStorage)
- Redirects to intended destination or `/dashboard` after login

#### Root Page (`/src/app/page.tsx`)
- Uses auth context instead of direct localStorage
- Shows loading spinner while checking auth
- Redirects authenticated users to `/dashboard`
- Redirects unauthenticated users to `/login`

#### Unauthorized Page (`/src/app/unauthorized/page.tsx`)
- New page for role-based access denials
- Shows clear error message
- Provides link back to dashboard

### 4. Updated Components

#### AdminLayout (`/src/components/layout/AdminLayout.tsx`)
- Now uses `logout()` from auth context
- Cleaner logout implementation
- Centralized auth management

## Authentication Flow

### Login Flow
1. User submits email/password on `/login`
2. POST to `/api/auth/login` endpoint
3. Verify admin access via `/api/admin/dashboard`
4. Call `login(token, user)` from auth context
5. Auth context stores token and user in localStorage
6. Redirect to intended destination or `/dashboard`

### Protected Page Access
1. User navigates to protected page
2. ProtectedRoute checks `isAuthenticated` from context
3. If loading, show spinner
4. If not authenticated:
   - Store intended path in localStorage
   - Redirect to `/login`
5. If authenticated but lacks required role:
   - Redirect to `/unauthorized`
6. If authenticated with correct role:
   - Render page content

### Logout Flow
1. User clicks logout button
2. Call `logout()` from auth context
3. Context clears token and user from state
4. Context removes items from localStorage
5. Router redirects to `/login`

### Page Reload
1. Browser reloads page
2. AuthProvider checks localStorage in useEffect
3. If token and user found:
   - Parse and restore to state
   - User remains authenticated
4. If not found:
   - User marked as unauthenticated
   - Protected routes redirect to login

## Role-Based Access Control

### Available Roles
From backend User model:
- `superadmin` - Full access to all features
- `event-manager` - Manage events
- `content-manager` - Manage music, shows, community
- `support` - View-only or support features
- `user` - Regular user (not admin)

### Implementing Role Restrictions

**Example 1: Single role**
```typescript
<ProtectedRoute requiredRoles={['superadmin']}>
  <AdminSettingsPage />
</ProtectedRoute>
```

**Example 2: Multiple roles**
```typescript
<ProtectedRoute requiredRoles={['superadmin', 'event-manager']}>
  <EventManagementPage />
</ProtectedRoute>
```

**Example 3: No role restriction (any authenticated admin)**
```typescript
<ProtectedRoute>
  <DashboardPage />
</ProtectedRoute>
```

### Checking Roles in Components
```typescript
import { useAuth } from '@/contexts/auth-context'

function MyComponent() {
  const { user } = useAuth()

  if (user?.role === 'superadmin') {
    return <AdminControls />
  }

  return <LimitedControls />
}
```

## Usage Examples

### Protecting a New Page

**Step 1:** Create your page component
```typescript
// src/app/users/page.tsx
"use client"

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { useAuth } from '@/contexts/auth-context'

export default function UsersPage() {
  const { user } = useAuth()

  return (
    <ProtectedRoute requiredRoles={['superadmin', 'content-manager']}>
      <AdminLayout user={user || undefined}>
        <h1>User Management</h1>
        {/* Page content */}
      </AdminLayout>
    </ProtectedRoute>
  )
}
```

### Using Auth in API Calls

The Axios instance (`/src/lib/api.ts`) automatically attaches the JWT token from localStorage to all requests. However, you can also use the token from auth context:

```typescript
import { useAuth } from '@/contexts/auth-context'

function MyComponent() {
  const { token } = useAuth()

  const fetchData = async () => {
    const response = await fetch('/api/endpoint', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
  }
}
```

### Conditional Rendering Based on Auth

```typescript
import { useAuth } from '@/contexts/auth-context'

function Navigation() {
  const { isAuthenticated, user } = useAuth()

  return (
    <nav>
      {isAuthenticated ? (
        <>
          <span>Welcome, {user?.name}</span>
          <LogoutButton />
        </>
      ) : (
        <LoginButton />
      )}
    </nav>
  )
}
```

## Security Considerations

### Token Storage
- Tokens stored in localStorage (accessible to JavaScript)
- Consider using httpOnly cookies for production (requires backend changes)
- Tokens should have expiration time (JWT exp claim)

### Token Validation
- Backend validates token on every request
- Invalid tokens return 401, triggering auto-logout
- Role verification happens on backend (admin routes check user role)

### XSS Protection
- Sanitize user inputs to prevent XSS attacks
- Next.js provides built-in XSS protection
- Don't use dangerouslySetInnerHTML with user content

### CSRF Protection
- Consider implementing CSRF tokens for state-changing requests
- Use SameSite cookie attribute if switching to cookie-based auth

## Testing the Implementation

### Manual Testing Checklist

**✅ Login Flow:**
- [ ] Can log in with valid credentials
- [ ] Invalid credentials show error
- [ ] Successful login redirects to dashboard
- [ ] Token and user stored in localStorage
- [ ] Auth context updated with user data

**✅ Protected Routes:**
- [ ] Accessing `/dashboard` without login redirects to `/login`
- [ ] After login, redirects to originally requested page
- [ ] Accessing protected page while logged in works
- [ ] Role-restricted pages block unauthorized roles

**✅ Logout Flow:**
- [ ] Clicking logout clears auth state
- [ ] Clicking logout clears localStorage
- [ ] Clicking logout redirects to `/login`
- [ ] Cannot access protected pages after logout

**✅ Session Persistence:**
- [ ] Refreshing page keeps user logged in
- [ ] Closing and reopening browser keeps user logged in
- [ ] Auth state restored from localStorage on reload

**✅ Role-Based Access:**
- [ ] Users with correct role can access restricted pages
- [ ] Users without correct role see unauthorized page
- [ ] Superadmin can access all pages

**✅ Error Handling:**
- [ ] Network errors show appropriate messages
- [ ] 401 errors trigger auto-logout
- [ ] 403 errors show unauthorized message
- [ ] Loading states display during auth checks

## Troubleshooting

### Issue: Infinite redirect loop
**Cause:** AuthContext and ProtectedRoute both redirecting
**Fix:** Ensure login page doesn't use ProtectedRoute

### Issue: User logged out unexpectedly
**Cause:** Invalid or expired JWT token
**Fix:** Check token expiration on backend, implement refresh token

### Issue: Role check not working
**Cause:** Role not included in JWT or response
**Fix:** Verify backend includes role in login response and JWT payload

### Issue: Page flashes before redirect
**Cause:** ProtectedRoute renders content before checking auth
**Fix:** Use isLoading state to show spinner while checking

### Issue: localStorage not persisting
**Cause:** Browser privacy settings or incognito mode
**Fix:** Check browser settings, localStorage not available in some modes

## Next Steps

1. **Implement Refresh Tokens**: Add token refresh mechanism for longer sessions
2. **Add Token Expiration Check**: Validate token expiration on frontend
3. **Improve Security**: Move to httpOnly cookies for token storage
4. **Add Remember Me**: Optional extended session duration
5. **Add 2FA**: Two-factor authentication for enhanced security
6. **Add Session Management**: View and revoke active sessions
7. **Add Audit Logging**: Track login/logout events

## Files Changed

### Created:
- `/src/contexts/auth-context.tsx` - Auth state management
- `/src/components/auth/ProtectedRoute.tsx` - Route protection wrapper
- `/src/app/unauthorized/page.tsx` - Unauthorized access page

### Updated:
- `/src/app/layout.tsx` - Added AuthProvider
- `/src/app/page.tsx` - Uses auth context
- `/src/app/login/page.tsx` - Uses auth context login method
- `/src/app/dashboard/page.tsx` - Wrapped with ProtectedRoute
- `/src/components/layout/AdminLayout.tsx` - Uses auth context logout

## Summary

The route protection system provides:
✅ Centralized authentication state management
✅ Automatic redirect for unauthenticated users
✅ Loading states during auth checks
✅ Role-based access control support
✅ Session persistence across reloads
✅ Clean logout functionality
✅ Intended destination redirect after login
✅ Unauthorized page for role violations

All admin pages are now protected and require valid authentication to access!
