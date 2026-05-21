import api from './api';

// Admin Dashboard
export const adminAPI = {
  // Admin Auth
  login: (email: string, password: string) =>
    api.post('/admin/login', { email, password }),
  googleLogin: (credential: string, isAccessToken = false) =>
    api.post('/admin/google', isAccessToken ? { accessToken: credential } : { token: credential }),
  
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
  setEventFeatured: (id: string, featured: boolean) =>
    api.patch(`/admin/events/${id}/featured`, { featured }),

  // Hero slides — admin-uploaded banners OR references to existing events.
  // Each row carries exactly one of image_url / event_id. Public read at
  // /api/hero-slides; admin CRUD nested under /admin/*.
  listHeroSlides: () => api.get('/hero-slides/admin'),
  createHeroSlide: (data: {
    image_url?: string | null
    event_id?: string | null
    title?: string | null
    subtitle?: string | null
    link_url?: string | null
    sort_order?: number
    active?: boolean
  }) => api.post('/hero-slides/admin', data),
  updateHeroSlide: (
    id: string,
    data: Partial<{
      image_url: string | null
      event_id: string | null
      title: string | null
      subtitle: string | null
      link_url: string | null
      sort_order: number
      active: boolean
    }>,
  ) => api.patch(`/hero-slides/admin/${id}`, data),
  deleteHeroSlide: (id: string) => api.delete(`/hero-slides/admin/${id}`),
  uploadHeroSlideImage: (file: File) => {
    const fd = new FormData()
    fd.append('image', file)
    return api.post('/hero-slides/admin/upload-image', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  // Settings Management
  getSettings: () => api.get('/admin/settings'),
  updateSiteConfig: (data: any) => api.put('/admin/settings/site-config', data),
  updateFeatures: (data: any) => api.put('/admin/settings/features', data),
  updateRoles: (data: any) => api.put('/admin/settings/roles', data),
  createCustomRole: (data: any) => api.post('/admin/settings/roles/custom', data),
  // Encode the name so role labels with spaces or punctuation survive the URL.
  deleteCustomRole: (roleName: string) =>
    api.delete(`/admin/settings/roles/custom/${encodeURIComponent(roleName)}`),
  // Email -> role assignments. Adding promotes the user with that email to
  // the role on their next login; removing only unbinds the assignment (it
  // doesn't demote them automatically — use the Users page for that).
  addRoleAssignment: (roleName: string, email: string) =>
    api.post(`/admin/settings/roles/${encodeURIComponent(roleName)}/emails`, { email }),
  removeRoleAssignment: (roleName: string, email: string) =>
    api.delete(
      `/admin/settings/roles/${encodeURIComponent(roleName)}/emails/${encodeURIComponent(email)}`,
    ),
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
  canRevokeOrganizer: (id: string) => api.get(`/admin/organizers/${id}/can-revoke`),
  revokeOrganizer: (id: string, reason: string, force = false) =>
    api.post(`/admin/organizers/${id}/revoke`, { reason, force }),

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
  approvePayout: (id: string) =>
    api.post(`/admin/payouts/${id}/approve`),
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
