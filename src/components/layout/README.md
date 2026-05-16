# AdminLayout Component

A comprehensive, responsive admin layout component with sidebar navigation and top bar.

## Features

✅ **Fixed Sidebar Navigation**
- 7 main navigation items (Dashboard, Users, Events, Music, Community, Shows, Settings)
- Active route highlighting
- Icons from lucide-react
- Collapsible on desktop (toggle button)

✅ **Top Navigation Bar**
- User info display (name, role, avatar)
- Theme toggle (dark/light mode)
- Logout button
- Mobile menu toggle

✅ **Responsive Design**
- Mobile: Overlay sidebar (swipe/tap to close)
- Tablet/Desktop: Fixed sidebar
- Collapsible sidebar on desktop for more screen space

## Usage

### Basic Implementation

```tsx
import { AdminLayout } from "@/components/layout/AdminLayout"

export default function YourPage() {
  const user = {
    name: "Admin User",
    email: "admin@myscope.com",
    role: "superadmin"
  }

  return (
    <AdminLayout user={user}>
      <h1>Your Page Content</h1>
    </AdminLayout>
  )
}
```

### With Auth Context

```tsx
"use client"

import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/hooks/useAuth"

export default function YourPage() {
  const { user } = useAuth()

  return (
    <AdminLayout user={user}>
      <h1>Your Page Content</h1>
    </AdminLayout>
  )
}
```

## Props

### AdminLayoutProps

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | `React.ReactNode` | Yes | Page content to render |
| `user` | `UserObject` | No | Logged-in user information |

### UserObject

```typescript
{
  name: string      // Display name
  email: string     // User email
  role: string      // User role (superadmin, event-manager, etc.)
}
```

## Navigation Items

The sidebar includes these routes:

1. **Dashboard** - `/dashboard` - Overview and statistics
2. **Users** - `/users` - User management
3. **Organizers** - `/organizers` - Organizer application review
4. **Events** - `/events` - Event management
5. **Event Review** - `/events/review` - Event approval queue
6. **Payouts** - `/payouts` - Organizer payouts
7. **Finance Reports** - `/reports` - Revenue & fee reporting
8. **Activity Logs** - `/logs` - Admin activity audit
9. **Settings** - `/settings` - Admin settings

## Responsive Behavior

### Mobile (< 1024px)
- Sidebar is hidden by default
- Hamburger menu in top bar
- Sidebar slides in as overlay
- Tap outside to close

### Desktop (≥ 1024px)
- Sidebar always visible
- Toggle button to collapse/expand
- Collapsed: Only icons (width: 64px)
- Expanded: Icons + labels (width: 256px)

## Customization

### Adding New Navigation Items

Edit the `navItems` array in `AdminLayout.tsx`:

```tsx
const navItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Your New Item", href: "/new-route", icon: YourIcon },
  // ... other items
]
```

### Changing Logout Behavior

Modify the `handleLogout` function:

```tsx
const handleLogout = () => {
  // Your custom logout logic
  localStorage.removeItem("adminToken")
  window.location.href = "/login"
}
```

## Keyboard Shortcuts

- **Escape** - Close mobile sidebar (when open)
- **Tab** - Navigate through interactive elements

## Accessibility

- ✅ Semantic HTML structure
- ✅ ARIA labels for icon-only buttons
- ✅ Keyboard navigation support
- ✅ Focus visible states
- ✅ Screen reader friendly

## Examples

### Dashboard Page
See `/src/app/dashboard/page.tsx` for a complete implementation example.

### Login Page
See `/src/app/login/page.tsx` for authentication flow.

## Dependencies

- `lucide-react` - Icons
- `next/link` - Navigation
- `next/navigation` - usePathname hook
- Theme system - Dark/Light mode support
