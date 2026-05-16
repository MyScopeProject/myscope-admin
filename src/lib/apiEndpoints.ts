import api from './api';

// Admin Dashboard
export const adminAPI = {
  // Admin Auth
  login: (email: string, password: string) =>
    api.post('/admin/login', { email, password }),
  googleLogin: (credential: string) =>
    api.post('/admin/google', { token: credential }),
  
  // Get dashboard stats
  getDashboard: () => api.get('/admin/dashboard'),
  getOverview: () => api.get('/admin/overview'),
  
  // User Management
  getUsers: (params?: { page?: number; limit?: number; search?: string; role?: string; status?: string }) => 
    api.get('/admin/users', { params }),
  getUserById: (id: string) => api.get(`/admin/users/${id}`),
  createUser: (data: any) => api.post('/admin/users', data),
  updateUser: (id: string, data: any) => api.put(`/admin/users/${id}`, data),
  banUser: (id: string) => api.put(`/admin/users/${id}/ban`),
  unbanUser: (id: string) => api.put(`/admin/users/${id}/unban`),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  
  // Event Management — backend supports list/get/approve/reject/delete. Create
  // and edits live with the organizer flow (organizer dashboard / API).
  getEvents: (params?: { page?: number; limit?: number; search?: string; status?: string; approvalStatus?: string }) =>
    api.get('/admin/events', { params }),
  getEventById: (id: string) => api.get(`/admin/events/${id}`),
  approveEvent: (id: string) => api.post(`/admin/events/${id}/approve`),
  rejectEvent: (id: string, reason: string) =>
    api.post(`/admin/events/${id}/reject`, { reason }),
  getEventForReview: (id: string) => api.get(`/admin/events/${id}`),
  deleteEvent: (id: string, opts?: { force?: boolean }) =>
    api.delete(`/admin/events/${id}`, { params: opts?.force ? { force: 'true' } : undefined }),
  
  // Movies Management
  getMovies: (params?: { page?: number; limit?: number; search?: string; genre?: string; status?: string; featured?: string }) =>
    api.get('/admin/movies', { params }),
  getMovieById: (id: string) => api.get(`/admin/movies/${id}`),
  createMovie: (data: any) => api.post('/admin/movies', data),
  updateMovie: (id: string, data: any) => api.put(`/admin/movies/${id}`, data),
  toggleMovieFeatured: (id: string) => api.put(`/admin/movies/${id}/toggle-featured`),
  deleteMovie: (id: string) => api.delete(`/admin/movies/${id}`),


  // Settings Management
  getSettings: () => api.get('/admin/settings'),
  updateSiteConfig: (data: any) => api.put('/admin/settings/site-config', data),
  updateFeatures: (data: any) => api.put('/admin/settings/features', data),
  updateRoles: (data: any) => api.put('/admin/settings/roles', data),
  createCustomRole: (data: any) => api.post('/admin/settings/roles/custom', data),
  deleteCustomRole: (roleName: string) => api.delete(`/admin/settings/roles/custom/${roleName}`),
  updateNotifications: (data: any) => api.put('/admin/settings/notifications', data),
  updateModeration: (data: any) => api.put('/admin/settings/moderation', data),
  updateSystem: (data: any) => api.put('/admin/settings/system', data),
  resetSettings: () => api.post('/admin/settings/reset'),
  
  // Admin Logs
  getLogs: (params?: { 
    limit?: number; 
    page?: number; 
    action?: string; 
    resourceType?: string; 
    status?: string; 
    severity?: string; 
    adminId?: string;
    startDate?: string;
    endDate?: string;
  }) => api.get('/admin/logs', { params }),
  getLogStats: (params?: { startDate?: string; endDate?: string }) => 
    api.get('/admin/logs/stats', { params }),
  getResourceLogs: (type: string, id: string) => 
    api.get(`/admin/logs/resource/${type}/${id}`),
  getAdminActivity: (id: string, limit?: number) => 
    api.get(`/admin/logs/admin/${id}`, { params: { limit } }),
  getMyActivity: (limit?: number) => 
    api.get('/admin/logs/my-activity', { params: { limit } }),
  cleanupLogs: (daysToKeep: number) => 
    api.delete('/admin/logs/cleanup', { data: { daysToKeep } }),
  exportLogs: (params?: { startDate?: string; endDate?: string; format?: string }) =>
    api.get('/admin/logs/export', { params }),

  // Organizer applications (Week 3 / Step 2)
  getOrganizers: (status: 'pending' | 'approved' | 'rejected' = 'pending') =>
    api.get('/admin/organizers', { params: { status } }),
  approveOrganizer: (id: string) => api.post(`/admin/organizers/${id}/approve`),
  rejectOrganizer: (id: string, reason: string) =>
    api.post(`/admin/organizers/${id}/reject`, { reason }),

  // Refunds (Step 12)
  refundBooking: (booking_id: string, reason: string) =>
    api.post('/admin/refunds', { booking_id, reason }),

  // Payouts (Step 12)
  getPayouts: (status?: 'requested' | 'approved' | 'paid' | 'rejected') =>
    api.get('/admin/payouts', { params: status ? { status } : undefined }),
  getOrganizerBalance: (organizerId: string) =>
    api.get(`/admin/payouts/balance/${organizerId}`),
  createPayout: (data: { organizer_id: string; amount: number; event_id?: string; notes?: string }) =>
    api.post('/admin/payouts', data),
  markPayoutPaid: (id: string, reference?: string) =>
    api.post(`/admin/payouts/${id}/mark-paid`, reference ? { reference } : {}),
  rejectPayout: (id: string, reason: string) =>
    api.post(`/admin/payouts/${id}/reject`, { reason }),

  // Finance reports (Step 12)
  getFinanceReport: (params?: { from?: string; to?: string }) =>
    api.get('/admin/reports/finance', { params }),
  // CSV download is handled directly via window.open (auth via cookie)
};

// Auth endpoints (public)
export const authAPI = {
  login: (email: string, password: string) => 
    api.post('/auth/login', { email, password }),
  register: (name: string, email: string, password: string) => 
    api.post('/auth/register', { name, email, password }),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data: any) => api.put('/auth/update', data),
};

export default api;
