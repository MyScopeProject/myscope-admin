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
  // Pass { force: true } to bypass FK blockers (payouts, shop_orders,
  // scanner_sessions, events). Destructive — wipes those records too.
  deleteUser: (id: string, opts?: { force?: boolean }) =>
    api.delete(`/admin/users/${id}`, opts?.force ? { params: { force: 'true' } } : undefined),
  
  // Event Management — backend supports list/get/approve/reject/delete. Create
  // also lives here for the "admin sets up an event on behalf of an organizer"
  // flow; organizers still create their own events via the organizer dashboard.
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

  // Pending-edits moderation queue. When an organizer edits an APPROVED
  // event, the change is queued here instead of going live. Admin reviews
  // the diff and either applies it to the live row or declines (with an
  // optional reason that the organizer sees on their edit page).
  listPendingEdits: () =>
    api.get<{
      success: boolean
      data: {
        pending_edits: Array<{
          id: string
          event_id: string
          submitted_by: string
          submitted_at: string
          status: 'pending' | 'approved' | 'declined'
          changes: Record<string, unknown>
          events: { id: string; title: string; organizer_id: string; banner_url: string | null } | null
        }>
      }
    }>('/admin/events/pending-edits'),
  getPendingEdit: (id: string) =>
    api.get(`/admin/events/pending-edits/${id}`),
  approvePendingEdit: (id: string) =>
    api.post(`/admin/events/pending-edits/${id}/approve`),
  declinePendingEdit: (id: string, reason?: string) =>
    api.post(`/admin/events/pending-edits/${id}/decline`, reason ? { reason } : {}),

  // Picker source for the "create event for organizer" page — every approved
  // organizer in the system. Filtered/searched client-side since the list is
  // small and we don't need pagination.
  listApprovedOrganizers: () =>
    api.get<{
      success: boolean
      data: {
        organizers: Array<{
          user_id: string
          business_name: string
          contact_name: string | null
          email: string | null
          profile_image: string | null
        }>
      }
    }>('/admin/events/approved-organizers'),

  // Per-event end-to-end earnings breakdown. Lists every event with revenue,
  // convenience fees, platform fees, comm billing, refunds, and payouts —
  // plus grand totals across the result set for the page-level summary tiles.
  listEarnings: (params?: { approval_status?: string }) =>
    api.get('/admin/earnings', { params }),
  getEventEarnings: (id: string) => api.get(`/admin/earnings/${id}`),

  createEventForOrganizer: (payload: {
    organizer_id: string
    title: string
    description?: string | null
    category?: string | null
    venue_name?: string | null
    venue_address?: string | null
    venue_location_url?: string | null
    banner_url?: string | null
    start_time: string
    end_time?: string | null
    capacity?: number | null
    seating_mode?: 'none' | 'free' | 'zoned' | 'reserved'
    ticket_types: Array<{
      name: string
      description?: string | null
      price: number
      quantity_total: number
      per_order_limit?: number
    }>
  }) => api.post('/admin/events', payload),

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

  // Past events — admin-curated image strip shown on the home page under
  // "Upcoming events". Image-only; mirrors the hero-slides CRUD shape.
  listPastEvents: () => api.get('/past-events/admin'),
  createPastEvent: (data: {
    image_url: string
    title?: string | null
    link_url?: string | null
    sort_order?: number
    active?: boolean
  }) => api.post('/past-events/admin', data),
  updatePastEvent: (
    id: string,
    data: Partial<{
      image_url: string
      title: string | null
      link_url: string | null
      sort_order: number
      active: boolean
    }>,
  ) => api.patch(`/past-events/admin/${id}`, data),
  deletePastEvent: (id: string) => api.delete(`/past-events/admin/${id}`),
  uploadPastEventImage: (file: File) => {
    const fd = new FormData()
    fd.append('image', file)
    return api.post('/past-events/admin/upload-image', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  // Partners — admin-curated logo strip shown on the home page above the footer.
  // Mirrors past-events shape exactly; `name` replaces `title`, `website_url`
  // replaces `link_url`.
  listPartners: () => api.get('/partners/admin'),
  createPartner: (data: {
    image_url: string
    name?: string | null
    website_url?: string | null
    sort_order?: number
    active?: boolean
  }) => api.post('/partners/admin', data),
  updatePartner: (
    id: string,
    data: Partial<{
      image_url: string
      name: string | null
      website_url: string | null
      sort_order: number
      active: boolean
    }>,
  ) => api.patch(`/partners/admin/${id}`, data),
  deletePartner: (id: string) => api.delete(`/partners/admin/${id}`),
  uploadPartnerImage: (file: File) => {
    const fd = new FormData()
    fd.append('image', file)
    return api.post('/partners/admin/upload-image', fd, {
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
  // Hard-delete the organizer profile. Pending/rejected applications
  // need no reason/force; approved organizers need reason (>=10 chars)
  // and optionally force=true to bypass blockers (active events, payouts).
  deleteOrganizer: (
    id: string,
    opts?: { reason?: string; force?: boolean },
  ) =>
    api.delete(`/admin/organizers/${id}`, {
      data: {
        ...(opts?.reason ? { reason: opts.reason } : {}),
        ...(opts?.force ? { force: true } : {}),
      },
    }),

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

  // Shop orders — admin oversight across every organizer's storefront.
  // Read-mostly: only mutation is force-cancel for support escalations.
  getShopOrders: (params?: {
    status?: 'Pending' | 'Confirmed' | 'Cancelled' | 'Refunded'
    fulfillment_status?: 'pending' | 'preparing' | 'shipped' | 'delivered' | 'picked_up' | 'returned'
    organizerId?: string
    q?: string
    limit?: number
    offset?: number
  }) => api.get('/admin/shop/orders', { params }),

  getShopOrdersSummary: () => api.get('/admin/shop/orders/summary'),

  getShopOrderById: (id: string) => api.get(`/admin/shop/orders/${id}`),

  forceCancelShopOrder: (id: string, reason: string) =>
    api.post(`/admin/shop/orders/${id}/force-cancel`, { reason }),
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
  // Convenience fee toggle is admin-only — lives on the admin events router
  // even though the rest of this object talks to /organizer routes (admins
  // act as superadmin organizers on those paths). Default is ON.
  setConvenienceFee: (id: string, enabled: boolean) =>
    api.patch(`/admin/events/${id}/convenience-fee`, { enabled }),
  cancel: (id: string, reason?: string) =>
    api.post(`/organizer/events/${id}/cancel`, reason ? { reason } : {}),
  postpone: (
    id: string,
    body: { new_start_time?: string; reason?: string; notify?: boolean; close_sales?: boolean },
  ) => api.post(`/organizer/events/${id}/postpone`, body),
  unpostpone: (id: string) => api.post(`/organizer/events/${id}/unpostpone`),
  announce: (id: string, body: { message: string; channel: 'email' | 'sms' | 'both' }) =>
    api.post(`/organizer/events/${id}/announce`, body),

  // Comm billing — admins enable per-event SMS/email billing and pick which
  // message types to charge for. Lives under the admin events router (not
  // organizer) since organizers don't get to set their own billing.
  getCommBilling: (id: string) =>
    api.get<{
      success: boolean
      data: {
        config: {
          sms_enabled: boolean
          email_enabled: boolean
          sms_billable_types: string[]
          email_billable_types: string[]
        }
        rates: { smsRateLkr: number; emailRateLkr: number }
        totals: {
          total_lkr: number
          sms: { count: number; total_lkr: number }
          email: { count: number; total_lkr: number }
        }
        catalogue: { email: string[]; sms: string[] }
        defaults: { billable_types: string[] }
      }
    }>(`/admin/events/${id}/comm-billing`),
  updateCommBilling: (
    id: string,
    body: {
      sms_enabled?: boolean
      email_enabled?: boolean
      sms_billable_types?: string[]
      email_billable_types?: string[]
    },
  ) => api.patch(`/admin/events/${id}/comm-billing`, body),

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

// Reserved Seating Events — the dedicated admin section. Lists every reserved
// event with its layout state (custom upload vs organizer grid, uploaded docs,
// seat count) so admins can build the seat map for custom requests and then
// approve the event for live. Building reuses the organizer seat-grid /
// venue-layouts apply endpoints (superadmin passes their role gates).
// Payload for POST /api/organizer/events/:id/seat-map — the visual / canvas
// seat-map endpoint. Each seat carries absolute (x, y) on the layout's
// viewport; decor renders behind the seats (stage, walls, labels).
export interface VisualSeatMapSeat {
  section: string
  row_label: string
  seat_number: string | number
  seat_label?: string
  x: number
  y: number
  rotation?: number
  ticket_type_id: string
  seat_type?: 'standard' | 'accessible' | 'restricted_view' | 'aisle'
}
export interface VisualSeatMapDecor {
  id?: string
  kind: 'rect' | 'text' | 'line'
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  label?: string
  fill?: string
  color?: string
}
export interface VisualSeatMapPayload {
  viewbox_width: number
  viewbox_height: number
  background_image_url?: string | null
  decor: VisualSeatMapDecor[]
  seats: VisualSeatMapSeat[]
}

export interface ReservedLayoutDoc {
  url: string
  name: string
  type: string
}
export interface ReservedEvent {
  id: string
  title: string
  venue_name: string | null
  venue_address: string | null
  start_time: string | null
  date: string | null
  approval_status: string
  layout_status: string
  layout_source: 'grid' | 'custom' | null
  layout_request_note: string | null
  layout_floor_plan_url: string | null
  layout_documents: ReservedLayoutDoc[] | null
  layout_image_url: string | null
  banner_url: string | null
  created_at: string
  seats_count: number
  organizer?: { id: string; name: string; email: string; profile_image?: string | null } | null
}
export interface ReservedEventTicketType {
  id: string
  name: string
  price: number | string
  // Organizer-declared seat cap for this tier (set in the event create form).
  // The admin builder displays this alongside the painted seat count so we
  // can see whether the seat map matches the organizer's intent.
  quantity_total?: number | string
  // True when the organizer marked this tier as free-seating (GA-style):
  // the admin still paints seats for the zone (so the venue map shows it)
  // but those seats render in the consumer picker as a non-clickable area.
  // See myscope-api/migrations/2026-06-09-free-seating-tier.sql.
  is_free_seating?: boolean
}

export const reservedEventsAPI = {
  list: () => api.get('/admin/events/reserved'),
  ticketTypes: (eventId: string) => api.get(`/organizer/events/${eventId}/ticket-types`),
  // Build a grid seat map straight onto the event (no reusable layout saved).
  buildGrid: (
    eventId: string,
    body: { layout_data: VenueLayoutData; section_ticket_map: Record<string, string> },
  ) => api.post(`/organizer/events/${eventId}/seat-grid`, body),
  // Apply an existing venue template to the event.
  applyTemplate: (
    templateId: string,
    body: { event_id: string; section_ticket_map: Record<string, string> },
  ) => api.post(`/venue-layouts/${templateId}/apply-to-event`, body),
  // Save a visual / canvas seat map (per-seat x/y, decor, viewport). The
  // MyTickets-quality path — replaces the entire seat list for the event.
  buildSeatMap: (
    eventId: string,
    body: VisualSeatMapPayload,
  ) => api.post(`/organizer/events/${eventId}/seat-map`, body),
  // Load the current seat-map state for the canvas builder (works at any
  // approval status; returns an empty seats[] + default viewport for events
  // that haven't had a map built yet).
  getSeatMap: (
    eventId: string,
  ) => api.get<{
    success: boolean
    data: {
      event_id: string
      layout: {
        viewbox_width: number
        viewbox_height: number
        background_image_url: string | null
        decor: VisualSeatMapDecor[]
      }
      seats: Array<{
        id: string
        section: string | null
        row_label: string | null
        seat_number: string | number | null
        seat_label: string | null
        seat_type: 'standard' | 'accessible' | 'restricted_view' | 'aisle' | null
        status: 'available' | 'held' | 'booked' | 'disabled'
        x: number | null
        y: number | null
        rotation: number | null
        ticket_type_id: string | null
      }>
    }
  }>(`/organizer/events/${eventId}/seat-map`),
  approve: (eventId: string) => api.post(`/admin/events/${eventId}/approve`),
  reject: (eventId: string, reason: string) =>
    api.post(`/admin/events/${eventId}/reject`, { reason }),
  // Upload a layout document (image or PDF) — used by the visual builder as
  // the background floor-plan reference. Returns the public URL.
  uploadLayoutDoc: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<{ success: boolean; data: { url: string; name: string; type: string } }>(
      '/organizer/events/upload-layout-doc',
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
  },
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
