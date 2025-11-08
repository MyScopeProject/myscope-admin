import api from './api';

// Admin Dashboard
export const adminAPI = {
  // Admin Auth
  login: (email: string, password: string) => 
    api.post('/admin/login', { email, password }),
  
  // Get dashboard stats
  getDashboard: () => api.get('/admin/dashboard'),
  
  // User Management
  getUsers: (params?: { page?: number; limit?: number; search?: string }) => 
    api.get('/admin/users', { params }),
  getUserById: (id: string) => api.get(`/admin/users/${id}`),
  createUser: (data: any) => api.post('/admin/users', data),
  updateUser: (id: string, data: any) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  
  // Event Management
  getEvents: (params?: { page?: number; limit?: number; search?: string }) => 
    api.get('/admin/events', { params }),
  getEventById: (id: string) => api.get(`/admin/events/${id}`),
  createEvent: (data: any) => api.post('/admin/events', data),
  updateEvent: (id: string, data: any) => api.put(`/admin/events/${id}`, data),
  deleteEvent: (id: string) => api.delete(`/admin/events/${id}`),
  
  // Music Management
  getMusic: (params?: { page?: number; limit?: number; search?: string }) => 
    api.get('/admin/music', { params }),
  getMusicById: (id: string) => api.get(`/admin/music/${id}`),
  createMusic: (data: any) => api.post('/admin/music', data),
  updateMusic: (id: string, data: any) => api.put(`/admin/music/${id}`, data),
  deleteMusic: (id: string) => api.delete(`/admin/music/${id}`),
  
  // Community Management
  getPosts: (params?: { page?: number; limit?: number; search?: string }) => 
    api.get('/admin/community', { params }),
  getPostById: (id: string) => api.get(`/admin/community/${id}`),
  deletePost: (id: string) => api.delete(`/admin/community/${id}`),
  
  // Shows Management
  getShows: (params?: { page?: number; limit?: number; search?: string }) => 
    api.get('/admin/shows', { params }),
  getShowById: (id: string) => api.get(`/admin/shows/${id}`),
  createShow: (data: any) => api.post('/admin/shows', data),
  updateShow: (id: string, data: any) => api.put(`/admin/shows/${id}`, data),
  deleteShow: (id: string) => api.delete(`/admin/shows/${id}`),
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
