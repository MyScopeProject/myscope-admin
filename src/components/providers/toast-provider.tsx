"use client"

import { Toaster } from 'react-hot-toast'

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        // Use raw CSS variables so toasts adapt to light/dark automatically.
        // (`hsl(var(--card))` doesn't work here — the tokens are oklch, not hsl.)
        style: {
          background: 'var(--popover)',
          color: 'var(--popover-foreground)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
        },
        success: {
          duration: 3000,
          iconTheme: { primary: '#10B981', secondary: '#FFFFFF' },
        },
        error: {
          duration: 5000,
          iconTheme: { primary: '#EF4444', secondary: '#FFFFFF' },
        },
        loading: {
          iconTheme: { primary: '#6366F1', secondary: '#FFFFFF' },
        },
      }}
    />
  )
}
