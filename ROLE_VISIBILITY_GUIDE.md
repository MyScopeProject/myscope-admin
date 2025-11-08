# Role-Based Navigation Visibility Guide

## Overview
The admin panel now implements **role-based navigation visibility**, ensuring users only see menu items they're authorized to access.

## How It Works

### 1. Navigation Filtering
The `AdminLayout` component automatically filters navigation items based on the logged-in user's role:

```typescript
// Filter navigation items based on user's role
const navItems = React.useMemo(() => {
  if (!user?.role) return []
  
  return allNavItems.filter(item => {
    // Dashboard is accessible to all admin roles
    if (item.href === '/dashboard') return true
    
    // Check if user can access this route
    return canAccessRoute(user.role, item.href)
  })
}, [user?.role])
```

### 2. Route Protection
Routes are protected using the `ProtectedRoute` component, which:
- Redirects unauthenticated users to login
- Checks if user's role can access the route
- Redirects unauthorized users to `/unauthorized` page

## Role Access Matrix

### 🔴 Super Admin
**Full Access - Sees ALL sections:**
- ✅ Dashboard
- ✅ Users
- ✅ Events
- ✅ Music
- ✅ Community
- ✅ Shows
- ✅ Activity Logs
- ✅ Settings

**Navigation Count:** 8 items

---

### 🟣 Content Manager
**Content-focused access:**
- ✅ Dashboard
- ❌ Users (no access)
- ✅ Events
- ✅ Music
- ✅ Community
- ✅ Shows
- ✅ Activity Logs
- ❌ Settings (no access)

**Navigation Count:** 6 items

**Hidden Sections:** Users, Settings

---

### 🔵 Event Manager
**Event-focused access:**
- ✅ Dashboard
- ❌ Users (no access)
- ✅ Events
- ❌ Music (no access)
- ❌ Community (no access)
- ❌ Shows (no access)
- ✅ Activity Logs
- ❌ Settings (no access)

**Navigation Count:** 3 items

**Hidden Sections:** Users, Music, Community, Shows, Settings

---

### 🟡 Moderator
**Community moderation access:**
- ✅ Dashboard
- ✅ Users (can ban users)
- ❌ Events (no access)
- ❌ Music (no access)
- ✅ Community (manage posts)
- ❌ Shows (no access)
- ✅ Activity Logs
- ❌ Settings (no access)

**Navigation Count:** 4 items

**Hidden Sections:** Events, Music, Shows, Settings

---

### 🟢 Support
**User support access:**
- ✅ Dashboard
- ✅ Users (view only)
- ❌ Events (no access)
- ❌ Music (no access)
- ❌ Community (no access)
- ❌ Shows (no access)
- ✅ Activity Logs
- ❌ Settings (no access)

**Navigation Count:** 3 items

**Hidden Sections:** Events, Music, Community, Shows, Settings

---

## Visual Examples

### Super Admin View
```
┌─────────────────────┐
│ 📊 Dashboard        │ ✅
│ 👥 Users            │ ✅
│ 📅 Events           │ ✅
│ 🎵 Music            │ ✅
│ 💬 Community        │ ✅
│ 🎬 Shows            │ ✅
│ 📜 Activity Logs    │ ✅
│ ⚙️  Settings        │ ✅
└─────────────────────┘
```

### Content Manager View
```
┌─────────────────────┐
│ 📊 Dashboard        │ ✅
│ 📅 Events           │ ✅
│ 🎵 Music            │ ✅
│ 💬 Community        │ ✅
│ 🎬 Shows            │ ✅
│ 📜 Activity Logs    │ ✅
└─────────────────────┘
```

### Event Manager View
```
┌─────────────────────┐
│ 📊 Dashboard        │ ✅
│ 📅 Events           │ ✅
│ 📜 Activity Logs    │ ✅
└─────────────────────┘
```

### Moderator View
```
┌─────────────────────┐
│ 📊 Dashboard        │ ✅
│ 👥 Users            │ ✅
│ 💬 Community        │ ✅
│ 📜 Activity Logs    │ ✅
└─────────────────────┘
```

### Support View
```
┌─────────────────────┐
│ 📊 Dashboard        │ ✅
│ 👥 Users            │ ✅
│ 📜 Activity Logs    │ ✅
└─────────────────────┘
```

---

## Implementation Details

### Files Modified

1. **`src/components/layout/AdminLayout.tsx`**
   - Renamed `navItems` to `allNavItems`
   - Added `ScrollText` icon for Activity Logs
   - Added dynamic filtering with `useMemo` hook
   - Imported `canAccessRoute` from rbac utilities

2. **`src/lib/rbac.ts`**
   - Updated `ROUTE_ACCESS` to include `/dashboard` and `/logs`
   - Ensured all routes have proper role assignments

### Code Changes

#### Before:
```typescript
const navItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Users", href: "/users", icon: Users },
  // ... all items always visible
]
```

#### After:
```typescript
const allNavItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Users", href: "/users", icon: Users },
  { name: "Events", href: "/events", icon: Calendar },
  { name: "Music", href: "/music", icon: Music },
  { name: "Community", href: "/community", icon: MessageSquare },
  { name: "Shows", href: "/shows", icon: Film },
  { name: "Activity Logs", href: "/logs", icon: ScrollText },
  { name: "Settings", href: "/settings", icon: Settings },
]

// Dynamically filter based on user role
const navItems = React.useMemo(() => {
  if (!user?.role) return []
  
  return allNavItems.filter(item => {
    if (item.href === '/dashboard') return true
    return canAccessRoute(user.role, item.href)
  })
}, [user?.role])
```

---

## Testing Different Roles

### 1. Test as Super Admin
```bash
# Login with superadmin credentials
# Expected: See all 8 navigation items
```

### 2. Test as Content Manager
```bash
# Login with content-manager credentials
# Expected: See 6 items (no Users, no Settings)
```

### 3. Test as Event Manager
```bash
# Login with event-manager credentials
# Expected: See 3 items (Dashboard, Events, Logs)
```

### 4. Test as Moderator
```bash
# Login with moderator credentials
# Expected: See 4 items (Dashboard, Users, Community, Logs)
```

### 5. Test as Support
```bash
# Login with support credentials
# Expected: See 3 items (Dashboard, Users, Logs)
```

---

## Security Features

### 1. **Double Protection**
- Navigation items are hidden from UI
- Routes are protected by `ProtectedRoute` component
- Even if someone manually types a URL, they'll be redirected

### 2. **Unauthorized Page**
- Users trying to access restricted routes see `/unauthorized`
- Clear message about why access was denied

### 3. **Activity Logging**
- All admin actions are logged
- Logs show which role performed which action
- Superadmin can audit all activity

---

## Benefits

✅ **Better UX:** Users don't see options they can't use  
✅ **Clearer Navigation:** Less clutter for specialized roles  
✅ **Security:** Defense in depth (UI + route protection)  
✅ **Maintainability:** Single source of truth for permissions  
✅ **Scalability:** Easy to add new roles and routes  

---

## Customizing Role Access

To change which roles can access a route, edit `src/lib/rbac.ts`:

```typescript
export const ROUTE_ACCESS: Record<string, UserRole[]> = {
  '/users': ['superadmin', 'moderator', 'support'], // ← Add/remove roles here
  '/events': ['superadmin', 'content-manager', 'event-manager'],
  // ... more routes
}
```

After changing permissions:
1. Navigation will automatically update
2. Route protection will automatically update
3. No other code changes needed

---

## Common Scenarios

### Scenario 1: Add New Navigation Item
```typescript
// 1. Add to allNavItems in AdminLayout.tsx
{ name: "Analytics", href: "/analytics", icon: BarChart }

// 2. Add to ROUTE_ACCESS in rbac.ts
'/analytics': ['superadmin', 'content-manager', 'event-manager']

// 3. Create the page with ProtectedRoute wrapper
// Done! Navigation auto-filters based on role
```

### Scenario 2: Change Who Can Access Events
```typescript
// In rbac.ts, modify the array:
'/events': ['superadmin', 'content-manager', 'event-manager', 'moderator']
//                                                              ↑ added moderator

// Moderators will now see Events in navigation
```

### Scenario 3: Make Settings Accessible to Content Managers
```typescript
// In rbac.ts:
'/settings': ['superadmin', 'content-manager']
//                          ↑ added content-manager

// Content Managers will now see Settings in navigation
```

---

## Troubleshooting

### Issue: User sees navigation item but gets "Unauthorized" page
**Cause:** Mismatch between `ROUTE_ACCESS` and page-level `ProtectedRoute`  
**Fix:** Ensure both use the same role requirements

### Issue: Navigation item doesn't appear for a role
**Cause:** Role not listed in `ROUTE_ACCESS` for that route  
**Fix:** Add the role to the route's allowed roles array

### Issue: User can access route by typing URL directly
**Cause:** Page missing `ProtectedRoute` wrapper  
**Fix:** Wrap page content with `<ProtectedRoute>`

---

## Related Documentation

- [RBAC_GUIDE.md](./RBAC_GUIDE.md) - Complete RBAC implementation guide
- [RBAC_QUICK_REF.md](./RBAC_QUICK_REF.md) - Quick reference for permissions
- [ROUTE-PROTECTION.md](./ROUTE-PROTECTION.md) - Route protection details
- [ACTIVITY_LOGS_GUIDE.md](./ACTIVITY_LOGS_GUIDE.md) - Activity logging system

---

## Summary

✨ **Role-based navigation visibility is now active!**

- Users only see menu items they're authorized to access
- Routes are double-protected (UI + backend)
- Easy to customize and maintain
- Scales with your application

**Next Steps:**
1. Test login with different role accounts
2. Verify navigation items match expected role access
3. Try accessing unauthorized routes via URL (should redirect)
4. Check activity logs to see role-based actions

