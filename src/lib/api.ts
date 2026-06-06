import axios from 'axios';

// Create axios instance with base configuration.
// withCredentials: true → browser automatically sends the httpOnly auth cookie.
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor - handle common responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 401:
          // Unauthorized — redirect to login, but only if not already there
          // (avoids infinite reload loop when checkAuth fires on the login page itself).
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
            window.location.href = '/login';
          }
          break;

        case 400:
          // 4xx business-rule failures (e.g. approve-before-seatmap) — soft warn
          // since the caller surfaces the message via toast already.
          console.warn('Validation:', data?.message);
          break;

        case 403:
          console.warn('Access forbidden:', data?.message);
          break;

        case 404:
          console.warn('Resource not found:', data?.message);
          break;

        case 500:
          console.error('Server error:', data?.message);
          break;

        default:
          // Reserve console.error for the unexpected — everything else warns.
          if (status >= 500) {
            console.error('API Error:', data?.message || 'An error occurred');
          } else {
            console.warn('API Error:', data?.message || 'An error occurred');
          }
      }
    } else if (error.request) {
      console.error('Network error: No response from server');
    } else {
      console.error('Error:', error.message);
    }

    return Promise.reject(error);
  }
);

export default api;
