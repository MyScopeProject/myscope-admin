import api from './api';

// Admin Dashboard
export const adminAPI = {
  // Admin Auth
  login: (email: string, password: string) => 
    api.post('/admin/login', { email, password }),
  
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
  
  // Event Management
  getEvents: (params?: { page?: number; limit?: number; search?: string; status?: string; approvalStatus?: string }) => 
    api.get('/admin/events', { params }),
  getEventById: (id: string) => api.get(`/admin/events/${id}`),
  createEvent: (data: any) => api.post('/admin/events', data),
  updateEvent: (id: string, data: any) => api.put(`/admin/events/${id}`, data),
  approveEvent: (id: string) => api.put(`/admin/events/${id}/approve`),
  rejectEvent: (id: string) => api.put(`/admin/events/${id}/reject`),
  deleteEvent: (id: string) => api.delete(`/admin/events/${id}`),
  
  // Music Management
  getMusic: (params?: { page?: number; limit?: number; search?: string; genre?: string; approvalStatus?: string; featured?: string }) => 
    api.get('/admin/music', { params }),
  getMusicById: (id: string) => api.get(`/admin/music/${id}`),
  createMusic: (data: any) => api.post('/admin/music', data),
  updateMusic: (id: string, data: any) => api.put(`/admin/music/${id}`, data),
  approveMusic: (id: string) => api.put(`/admin/music/${id}/approve`),
  rejectMusic: (id: string) => api.put(`/admin/music/${id}/reject`),
  toggleFeatured: (id: string) => api.put(`/admin/music/${id}/toggle-featured`),
  deleteMusic: (id: string) => api.delete(`/admin/music/${id}`),
  
  // Community Management
  getPosts: (params?: { page?: number; limit?: number; search?: string; author?: string }) => 
    api.get('/admin/community', { params }),
  getPostById: (id: string) => api.get(`/admin/community/${id}`),
  deletePost: (id: string) => api.delete(`/admin/community/${id}`),
  togglePinPost: (id: string) => api.put(`/admin/community/${id}/pin`),
  deleteComment: (postId: string, commentId: string) => api.delete(`/admin/community/${postId}/comments/${commentId}`),
  banPostAuthor: (id: string) => api.post(`/admin/community/${id}/ban-author`),
  
  // Shows Management
  getShows: (params?: { page?: number; limit?: number; search?: string; status?: string; category?: string; featured?: string }) => 
    api.get('/admin/shows', { params }),
  getShowById: (id: string) => api.get(`/admin/shows/${id}`),
  createShow: (data: any) => api.post('/admin/shows', data),
  updateShow: (id: string, data: any) => api.put(`/admin/shows/${id}`, data),
  cancelShow: (id: string) => api.put(`/admin/shows/${id}/cancel`),
  rescheduleShow: (id: string, date: string) => api.put(`/admin/shows/${id}/reschedule`, { date }),
  toggleFeaturedShow: (id: string) => api.put(`/admin/shows/${id}/toggle-featured`),
  deleteShow: (id: string) => api.delete(`/admin/shows/${id}`),
  
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
