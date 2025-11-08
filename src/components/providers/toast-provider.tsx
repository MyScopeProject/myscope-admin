"use client"

import { Toaster } from 'react-hot-toast'

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        // Default options
        duration: 4000,
        style: {
          background: 'hsl(var(--card))',
          color: 'hsl(var(--foreground))',
          border: '1px solid hsl(var(--border))',
        },
        // Success
        success: {
          duration: 3000,
          iconTheme: {
            primary: '#10B981',
            secondary: '#FFFFFF',
          },
        },
        // Error
        error: {
          duration: 5000,
          iconTheme: {
            primary: '#EF4444',
            secondary: '#FFFFFF',
          },
        },
        // Loading
        loading: {
          iconTheme: {
            primary: '#6366F1',
            secondary: '#FFFFFF',
          },
        },
      }}
    />
  )
}
