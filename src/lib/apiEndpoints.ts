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
  markPayoutPaid: (id: string, reference?: string, slipUrl?: string) =>
    api.post(`/admin/payouts/${id}/mark-paid`, {
      ...(reference ? { reference } : {}),
      ...(slipUrl ? { slip_url: slipUrl } : {}),
    }),
  uploadPayoutSlip: (file: File) => {
    const fd = new FormData()
    fd.append('image', file)
    return api.post('/admin/payouts/upload-slip', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  rejectPayout: (id: string, reason: string) =>
    api.post(`/admin/payouts/${id}/reject`, { reason }),

  // Finance reports (Step 12)
  getFinanceReport: (params?: { from?: string; to?: string }) =>
    api.get('/admin/reports/finance', { params }),
  // CSV download is handled directly via window.open (auth via cookie)
};

// Admin event management — superadmin override that reuses the organizer
// event endpoints. The admin's superadmin cookie passes the organizer role
// gate + ownership check (loadOwnedEvent allows superadmin), so the admin can
// manage any organizer's event exactly like its owner.
export const adminEventManage = {
  get: (id: string) => api.get(`/organizer/events/${id}`),
  update: (id: string, data: any) => api.patch(`/organizer/events/${id}`, data),
  pauseSales: (id: string) => api.post(`/organizer/events/${id}/pause-sales`),
  resumeSales: (id: string) => api.post(`/organizer/events/${id}/resume-sales`),
  cancel: (id: string, reason?: string) =>
    api.post(`/organizer/events/${id}/cancel`, reason ? { reason } : {}),
  announce: (id: string, body: { message: string; channel: 'email' | 'sms' | 'both' }) =>
    api.post(`/organizer/events/${id}/announce`, body),

  // Ticket types
  listTicketTypes: (id: string) => api.get(`/organizer/events/${id}/ticket-types`),
  createTicketType: (id: string, data: any) =>
    api.post(`/organizer/events/${id}/ticket-types`, data),
  updateTicketType: (id: string, ttId: string, data: any) =>
    api.patch(`/organizer/events/${id}/ticket-types/${ttId}`, data),
  deleteTicketType: (id: string, ttId: string) =>
    api.delete(`/organizer/events/${id}/ticket-types/${ttId}`),

  // Attendees / bookings
  bookings: (id: string) => api.get(`/organizer/events/${id}/bookings`),
  resendBooking: (id: string, bookingId: string) =>
    api.post(`/organizer/events/${id}/bookings/${bookingId}/resend`),
  refundBooking: (id: string, bookingId: string) =>
    api.post(`/organizer/events/${id}/bookings/${bookingId}/refund`),
  checkInStatus: (id: string) => api.get(`/organizer/events/${id}/check-in-status`),

  // Promo codes
  listPromos: (id: string) => api.get(`/organizer/events/${id}/promo-codes`),
  createPromo: (id: string, data: any) => api.post(`/organizer/events/${id}/promo-codes`, data),
  updatePromo: (id: string, codeId: string, data: any) =>
    api.patch(`/organizer/events/${id}/promo-codes/${codeId}`, data),
  deletePromo: (id: string, codeId: string) =>
    api.delete(`/organizer/events/${id}/promo-codes/${codeId}`),

  // Waitlist
  waitlist: (id: string) => api.get(`/organizer/events/${id}/waitlist`),
};

// Venue templates — superadmin-curated reusable seat maps (organizer_id NULL,
// is_template TRUE). Organizers pick these in their reserved-seating wizard and
// price each section per event. CRUD lives under /venue-layouts/admin/*; reading
// a single template's full layout_data reuses the shared GET /venue-layouts/:id.
export interface VenueLayoutSeat {
  number: string
  type?: string
}
export interface VenueLayoutRow {
  label: string
  seats: VenueLayoutSeat[]
}
export interface VenueLayoutSection {
  id?: string
  name: string
  color?: string
  rows: VenueLayoutRow[]
}
export interface VenueLayoutData {
  sections: VenueLayoutSection[]
}
export interface VenueTemplateSummary {
  id: string
  name: string
  description: string | null
  stage_position: string
  total_seats: number
  is_template: boolean
  created_at: string
  updated_at: string
}
export interface VenueTemplateDetail extends VenueTemplateSummary {
  layout_data: VenueLayoutData
}
export interface VenueTemplatePayload {
  name?: string
  description?: string | null
  stage_position?: string
  layout_data?: VenueLayoutData
}

export const venueTemplatesAPI = {
  list: () => api.get('/venue-layouts/admin/templates'),
  get: (id: string) => api.get(`/venue-layouts/${id}`),
  create: (data: VenueTemplatePayload) => api.post('/venue-layouts/admin/templates', data),
  update: (id: string, data: VenueTemplatePayload) =>
    api.put(`/venue-layouts/admin/templates/${id}`, data),
  remove: (id: string) => api.delete(`/venue-layouts/admin/templates/${id}`),
  // Generate event_seats for an event from a layout. section_ticket_map keys are
  // layout section names, values are this event's ticket_type ids.
  applyToEvent: (layoutId: string, body: { event_id: string; section_ticket_map: Record<string, string> }) =>
    api.post(`/venue-layouts/${layoutId}/apply-to-event`, body),
}

// Tier 3 custom-layout requests — reserved events submitted without a seat map,
// awaiting an admin to build + apply one. The list feeds the admin queue; the
// event's ticket types (for section→price mapping) come from adminEventManage.
export interface LayoutRequest {
  id: string
  title: string
  venue_name: string | null
  venue_address: string | null
  start_time: string | null
  date: string | null
  approval_status: string
  layout_status: string
  layout_request_note: string | null
  layout_floor_plan_url: string | null
  created_at: string
  organizer?: { id: string; name: string; email: string; profile_image?: string | null } | null
}

export const layoutRequestsAPI = {
  list: () => api.get('/admin/events/layout-requests'),
  ticketTypes: (eventId: string) => api.get(`/organizer/events/${eventId}/ticket-types`),
}

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
