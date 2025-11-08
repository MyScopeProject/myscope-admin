# Loading, Toast & Error Handling - Documentation

## Overview

Comprehensive loading spinners, toast notifications, and error handling system for the MyScope Admin Panel.

## 📦 Installed Packages

```bash
npm install react-hot-toast axios
```

## 🎯 Components

### 1. Toast Notifications

**Location**: `src/components/providers/toast-provider.tsx`

**Features**:
- Auto-configured with theme colors
- Different durations for success/error/loading
- Positioned at top-right
- Animated entrance/exit

**Usage**:
```tsx
import toast from 'react-hot-toast'

// Success
toast.success('User created successfully!')

// Error
toast.error('Failed to delete item')

// Loading with ID (for updates)
const loadingToast = toast.loading('Processing...')
// Later update it
toast.success('Done!', { id: loadingToast })

// Custom duration
toast('Custom message', { duration: 2000 })

// With icon
toast('Info message', {
  icon: '👏',
  style: {
    borderRadius: '10px',
    background: '#333',
    color: '#fff',
  },
})
```

### 2. Loading Spinners

**Location**: `src/components/ui/loading.tsx`

**Components**:

#### LoadingSpinner
```tsx
import { LoadingSpinner } from '@/components/ui/loading'

<LoadingSpinner size="sm" /> // sm, md, lg, xl
<LoadingSpinner size="lg" className="text-blue-500" />
```

#### FullPageLoader
```tsx
import { FullPageLoader } from '@/components/ui/loading'

// Shows over entire page with backdrop
<FullPageLoader />
```

#### PageLoader
```tsx
import { PageLoader } from '@/components/ui/loading'

// Shows in content area (min 400px height)
<PageLoader />
```

#### InlineLoader
```tsx
import { InlineLoader } from '@/components/ui/loading'

<InlineLoader text="Fetching data..." />
```

#### ButtonLoader
```tsx
import { ButtonLoader } from '@/components/ui/loading'

<button disabled={loading}>
  {loading && <ButtonLoader />}
  Submit
</button>
```

### 3. Error Messages

**Location**: `src/components/ui/error-message.tsx`

#### ErrorMessage
```tsx
import { ErrorMessage } from '@/components/ui/error-message'

<ErrorMessage 
  type="error" 
  title="Error Occurred"
  message="Failed to load data. Please try again."
/>

<ErrorMessage 
  type="warning" 
  message="Your session will expire soon"
/>

<ErrorMessage 
  type="info" 
  message="New features available"
/>

<ErrorMessage 
  type="success" 
  message="Changes saved successfully"
/>
```

#### EmptyState
```tsx
import { EmptyState } from '@/components/ui/error-message'
import { Users } from 'lucide-react'

<EmptyState
  icon={Users}
  title="No users found"
  description="Start by creating your first user"
  action={
    <button className="btn-primary">
      Create User
    </button>
  }
/>
```

## 🔧 API Integration with Error Handling

**Location**: `src/lib/api.ts`

The Axios instance automatically:
- Attaches JWT token to all requests
- Handles 401 errors (clears token, redirects to login)
- Handles 403 errors (permission denied)
- Logs all errors to console

**Usage**:
```tsx
import api from '@/lib/api'
import toast from 'react-hot-toast'

async function fetchUsers() {
  try {
    const response = await api.get('/admin/users')
    toast.success('Users loaded successfully')
    return response.data
  } catch (error: any) {
    // Error is already logged by interceptor
    toast.error(error.response?.data?.message || 'Failed to load users')
    throw error
  }
}
```

## 📱 Responsive Design Patterns

### Mobile-First Approach

```tsx
// Grid that stacks on mobile
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Cards */}
</div>

// Hide on mobile, show on tablet+
<div className="hidden md:block">
  {/* Content */}
</div>

// Show on mobile, hide on desktop
<div className="md:hidden">
  {/* Mobile menu */}
</div>

// Responsive text sizes
<h1 className="text-2xl md:text-3xl lg:text-4xl">
  Title
</h1>

// Responsive padding
<div className="p-4 md:p-6 lg:p-8">
  {/* Content */}
</div>

// Responsive flex direction
<div className="flex flex-col md:flex-row gap-4">
  {/* Items */}
</div>
```

### AdminLayout Responsive Features

The AdminLayout component already includes:
- ✅ Mobile: Hamburger menu, overlay sidebar
- ✅ Tablet: Fixed sidebar, auto-collapse
- ✅ Desktop: Full sidebar with collapse toggle

## 🎨 Complete Example: Data Fetching Page

```tsx
"use client"

import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { PageLoader, InlineLoader } from '@/components/ui/loading'
import { ErrorMessage, EmptyState } from '@/components/ui/error-message'
import { Users } from 'lucide-react'
import api from '@/lib/api'
import toast from 'react-hot-toast'

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Fetch users
  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get('/admin/users')
      setUsers(response.data.users)
      toast.success('Users loaded')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load users')
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  async function deleteUser(id: string) {
    if (!confirm('Are you sure?')) return
    
    try {
      setDeleting(id)
      await api.delete(`/admin/users/${id}`)
      toast.success('User deleted')
      fetchUsers() // Refresh list
    } catch (err: any) {
      toast.error('Failed to delete user')
    } finally {
      setDeleting(null)
    }
  }

  // Show page loader while loading
  if (loading) {
    return (
      <AdminLayout>
        <PageLoader />
      </AdminLayout>
    )
  }

  // Show error state
  if (error) {
    return (
      <AdminLayout>
        <ErrorMessage
          type="error"
          title="Error Loading Users"
          message={error}
        />
        <button onClick={fetchUsers} className="mt-4 btn-primary">
          Try Again
        </button>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold">Users</h1>

        {/* Empty state */}
        {users.length === 0 && (
          <EmptyState
            icon={Users}
            title="No users found"
            description="There are no users in the system yet"
          />
        )}

        {/* User list - responsive grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((user: any) => (
            <div key={user.id} className="bg-card rounded-lg border p-4">
              <h3 className="font-semibold">{user.name}</h3>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              
              <button
                onClick={() => deleteUser(user.id)}
                disabled={deleting === user.id}
                className="mt-2 text-sm text-destructive hover:underline disabled:opacity-50"
              >
                {deleting === user.id ? (
                  <>
                    <InlineLoader text="Deleting..." />
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
```

## 🚀 Best Practices

### 1. Always Handle Errors
```tsx
try {
  await api.post('/endpoint', data)
  toast.success('Success!')
} catch (error: any) {
  toast.error(error.response?.data?.message || 'Operation failed')
}
```

### 2. Show Loading States
```tsx
const [loading, setLoading] = useState(false)

async function handleSubmit() {
  setLoading(true)
  try {
    // API call
  } finally {
    setLoading(false) // Always reset in finally
  }
}
```

### 3. Use Optimistic Updates
```tsx
// Update UI immediately
setItems(items.filter(i => i.id !== id))

// Then make API call
try {
  await api.delete(`/items/${id}`)
  toast.success('Deleted')
} catch {
  // Rollback on error
  fetchItems()
  toast.error('Failed to delete')
}
```

### 4. Mobile-First CSS
```tsx
// Start with mobile, add larger screens
className="
  text-sm md:text-base lg:text-lg
  p-2 md:p-4 lg:p-6
  grid-cols-1 md:grid-cols-2 lg:grid-cols-3
"
```

## 📋 Checklist

- ✅ Toast provider added to root layout
- ✅ Loading spinners for all async operations
- ✅ Error messages for failed operations
- ✅ Empty states for no data
- ✅ Axios interceptors for auth
- ✅ Responsive layouts (mobile, tablet, desktop)
- ✅ Loading states in buttons
- ✅ Confirmation dialogs for destructive actions

---

**All systems ready for production!** 🎉
