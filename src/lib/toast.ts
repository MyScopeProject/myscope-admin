import toast from 'react-hot-toast';

// Custom toast wrapper with consistent styling
const defaultOptions = {
  duration: 4000,
  position: 'top-right' as const,
  style: {
    background: '#fff',
    color: '#333',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '14px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  },
};

export const showToast = {
  /**
   * Show success toast
   */
  success: (message: string, options = {}) => {
    return toast.success(message, {
      ...defaultOptions,
      icon: '✅',
      style: {
        ...defaultOptions.style,
        border: '1px solid #10b981',
      },
      ...options,
    });
  },

  /**
   * Show error toast
   */
  error: (message: string, options = {}) => {
    return toast.error(message, {
      ...defaultOptions,
      duration: 5000, // Show errors longer
      icon: '❌',
      style: {
        ...defaultOptions.style,
        border: '1px solid #ef4444',
      },
      ...options,
    });
  },

  /**
   * Show warning toast
   */
  warning: (message: string, options = {}) => {
    return toast(message, {
      ...defaultOptions,
      icon: '⚠️',
      style: {
        ...defaultOptions.style,
        border: '1px solid #f59e0b',
      },
      ...options,
    });
  },

  /**
   * Show info toast
   */
  info: (message: string, options = {}) => {
    return toast(message, {
      ...defaultOptions,
      icon: 'ℹ️',
      style: {
        ...defaultOptions.style,
        border: '1px solid #3b82f6',
      },
      ...options,
    });
  },

  /**
   * Show loading toast
   */
  loading: (message: string, options = {}) => {
    return toast.loading(message, {
      ...defaultOptions,
      style: {
        ...defaultOptions.style,
        border: '1px solid #6b7280',
      },
      ...options,
    });
  },

  /**
   * Promise-based toast
   * Automatically shows loading, success, or error
   */
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    },
    options = {}
  ) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading,
        success: messages.success,
        error: messages.error,
      },
      {
        ...defaultOptions,
        ...options,
      }
    );
  },

  /**
   * Dismiss a specific toast
   */
  dismiss: (toastId?: string) => {
    toast.dismiss(toastId);
  },

  /**
   * Dismiss all toasts
   */
  dismissAll: () => {
    toast.dismiss();
  },

  /**
   * Custom toast with full control
   */
  custom: (message: string, options = {}) => {
    return toast(message, {
      ...defaultOptions,
      ...options,
    });
  },
};

// Export the base toast for advanced usage
export { toast };

// Usage examples:
/*
// Success
showToast.success('User created successfully');

// Error
showToast.error('Failed to delete event');

// Warning
showToast.warning('This action cannot be undone');

// Info
showToast.info('Settings auto-saved');

// Loading
const toastId = showToast.loading('Processing...');
// Later...
showToast.dismiss(toastId);
showToast.success('Done!');

// Promise-based (automatic loading -> success/error)
showToast.promise(
  adminAPI.deleteUser(userId),
  {
    loading: 'Deleting user...',
    success: 'User deleted successfully',
    error: (err) => err.response?.data?.message || 'Failed to delete user',
  }
);

// Promise with dynamic success message
showToast.promise(
  adminAPI.approveEvent(eventId),
  {
    loading: 'Approving event...',
    success: (data) => `Event "${data.event.name}" approved!`,
    error: 'Failed to approve event',
  }
);
*/
