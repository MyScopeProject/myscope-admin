"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import { adminAPI } from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  ExternalLink,
  ImageIcon,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Shield,
  Tag,
  Ticket,
  Trash2,
  User,
  Users,
  XCircle,
  AlertCircle,
} from "lucide-react"

interface TicketType {
  id: string
  name: string
  description: string | null
  price: number
  quantity_total: number
  quantity_sold: number
  per_order_limit: number
  sale_start: string | null
  sale_end: string | null
  is_active: boolean
}

interface EventDetail {
  id: string
  title: string
  description: string | null
  date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  venue_name: string | null
  venue_address: string | null
  venue_location_url: string | null
  category: string | null
  banner_url: string | null
  price: number
  capacity: number | null
  tickets_available: number
  tickets_sold: number
  approval_status: "draft" | "pending" | "approved" | "rejected" | "cancelled"
  rejection_reason: string | null
  featured: boolean
  created_at: string
  organizer: {
    id: string
    name: string
    email: string
    profile_image: string | null
    phone: string | null
    city: string | null
    country: string | null
    role: string | null
    status: string | null
    created_at: string | null
    last_login: string | null
    total_events: number
    approved_events: number
  } | null
  ticket_types: TicketType[]
}

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  draft: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-muted text-muted-foreground border-border",
}

const formatLkr = (n: number) =>
  n === 0 ? "Free" : `LKR ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}`

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    year: "numeric", hour: "numeric", minute: "2-digit",
  })
}

export default function AdminEventDetailPage() {
  const { user: currentUser } = useAuth()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const eventId = params?.id

  const [event, setEvent] = useState<EventDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Action states
  const [approving, setApproving] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [rejecting, setRejecting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [canForce, setCanForce] = useState(false)

  const fetchEvent = useCallback(async () => {
    if (!eventId) return
    try {
      setLoading(true)
      setError(null)
      const res = await adminAPI.getEventById(eventId)
      setEvent(res.data?.data ?? null)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load event")
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    fetchEvent()
  }, [fetchEvent])

  const handleApprove = async () => {
    if (!event) return
    setApproving(true)
    try {
      await adminAPI.approveEvent(event.id)
      toast.success("Event approved and now live")
      fetchEvent()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to approve event")
    } finally {
      setApproving(false)
    }
  }

  const handleReject = async () => {
    if (!event || !rejectReason.trim()) return
    setRejecting(true)
    try {
      await adminAPI.rejectEvent(event.id, rejectReason.trim())
      toast.success("Event rejected")
      setShowRejectModal(false)
      setRejectReason("")
      fetchEvent()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to reject event")
    } finally {
      setRejecting(false)
    }
  }

  const handleDelete = async (force: boolean) => {
    if (!event) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await adminAPI.deleteEvent(event.id, { force })
      toast.success(force ? "Event force-deleted" : "Event deleted")
      router.push("/events")
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to delete event"
      setDeleteError(msg)
      setCanForce(!!err.response?.data?.data?.can_force)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={["superadmin", "event-manager", "content-manager"]}>
        <AdminLayout user={currentUser || undefined}><PageLoader /></AdminLayout>
      </ProtectedRoute>
    )
  }

  if (error || !event) {
    return (
      <ProtectedRoute requiredRoles={["superadmin", "event-manager", "content-manager"]}>
        <AdminLayout user={currentUser || undefined}>
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-6 w-6" />
            </span>
            <h2 className="text-xl font-semibold text-foreground">Event not found</h2>
            <p className="text-muted-foreground">{error}</p>
            <Link href="/events" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" /> Back to events
            </Link>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  const isPending = event.approval_status === "pending"
  const startDate = event.start_time || event.date
  const venue = event.venue_name || event.location
  const minPrice = event.ticket_types.length > 0
    ? Math.min(...event.ticket_types.map(t => Number(t.price)))
    : Number(event.price ?? 0)

  return (
    <ProtectedRoute requiredRoles={["superadmin", "event-manager", "content-manager"]}>
      <AdminLayout user={currentUser || undefined}>
        <div className="space-y-6 max-w-5xl">

          {/* Back + header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Link
                href="/events"
                className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> Back to events
              </Link>
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl leading-tight">
                {event.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[event.approval_status] ?? STATUS_STYLES.draft}`}>
                  {event.approval_status}
                </span>
                {event.featured && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    Featured
                  </span>
                )}
                {event.category && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-0.5 text-xs font-medium text-muted-foreground capitalize">
                    <Tag className="h-3 w-3" />{event.category}
                  </span>
                )}
              </div>
            </div>

            {/* Primary actions */}
            {isPending && (
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={approving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/20"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              </div>
            )}
          </div>

          {/* Rejection reason banner */}
          {event.approval_status === "rejected" && event.rejection_reason && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-semibold text-destructive">Rejection reason</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{event.rejection_reason}</p>
              </div>
            </div>
          )}

          {/* Banner */}
          <div className="overflow-hidden rounded-2xl border border-border bg-muted aspect-21/9 w-full">
            {event.banner_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.banner_url}
                alt={event.title}
                className="h-full w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                <ImageIcon className="h-16 w-16" />
              </div>
            )}
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

            {/* Left — details */}
            <div className="space-y-6 lg:col-span-2">

              {/* Description */}
              <Section title="Description">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {event.description || "No description provided."}
                </p>
              </Section>

              {/* Venue */}
              <Section title="Venue & Location">
                <div className="space-y-3">
                  {venue && (
                    <InfoRow icon={MapPin} label="Venue">{venue}</InfoRow>
                  )}
                  {event.venue_address && (
                    <InfoRow icon={MapPin} label="Address">{event.venue_address}</InfoRow>
                  )}
                  {event.venue_location_url && (
                    <div className="pt-1">
                      <a
                        href={event.venue_location_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
                      >
                        <MapPin className="h-4 w-4 text-primary" />
                        View on map
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </a>
                    </div>
                  )}
                  {!venue && !event.venue_address && !event.venue_location_url && (
                    <p className="text-sm text-muted-foreground">No venue information provided.</p>
                  )}
                </div>
              </Section>

              {/* Ticket types */}
              <Section title={`Ticket Types (${event.ticket_types.length})`}>
                {event.ticket_types.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No ticket types defined.</p>
                ) : (
                  <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                    {event.ticket_types.map((tt) => {
                      const remaining = Math.max(0, tt.quantity_total - tt.quantity_sold)
                      const soldPct = tt.quantity_total > 0 ? (tt.quantity_sold / tt.quantity_total) * 100 : 0
                      return (
                        <div key={tt.id} className="flex items-center gap-4 bg-card px-4 py-3">
                          <Ticket className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-foreground">{tt.name}</span>
                              {!tt.is_active && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Inactive</span>
                              )}
                            </div>
                            {tt.description && (
                              <p className="mt-0.5 text-xs text-muted-foreground">{tt.description}</p>
                            )}
                            <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>{tt.quantity_sold}/{tt.quantity_total} sold</span>
                              <span>{remaining} remaining</span>
                              <span>max {tt.per_order_limit}/order</span>
                            </div>
                            {/* Progress bar */}
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary transition-all w-(--sold-pct)"
                                style={{ '--sold-pct': `${soldPct.toFixed(1)}%` } as React.CSSProperties}
                              />
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-base font-bold text-foreground">
                              {Number(tt.price) === 0 ? "Free" : `LKR ${Number(tt.price).toLocaleString()}`}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Section>

              {/* Organizer */}
              {event.organizer && (
                <Section title="Organizer">
                  {/* Avatar + name row */}
                  <div className="flex items-center gap-4 pb-4 border-b border-border">
                    <span className="inline-flex h-16 w-16 shrink-0 overflow-hidden rounded-full bg-primary/10 text-xl font-bold text-primary">
                      {event.organizer.profile_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={event.organizer.profile_image}
                          alt={event.organizer.name}
                          className="h-full w-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center">
                          {event.organizer.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-semibold text-foreground">{event.organizer.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {event.organizer.role && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary capitalize">
                            <Shield className="h-3 w-3" />{event.organizer.role}
                          </span>
                        )}
                        {event.organizer.status && (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                            event.organizer.status === "active"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-destructive/10 text-destructive"
                          }`}>
                            {event.organizer.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact & location */}
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InfoRow icon={Mail} label="Email">
                      <span className="truncate">{event.organizer.email}</span>
                    </InfoRow>
                    {event.organizer.phone && (
                      <InfoRow icon={Phone} label="Phone">{event.organizer.phone}</InfoRow>
                    )}
                    {(event.organizer.city || event.organizer.country) && (
                      <InfoRow icon={MapPin} label="Location">
                        {[event.organizer.city, event.organizer.country].filter(Boolean).join(", ")}
                      </InfoRow>
                    )}
                    <InfoRow icon={Calendar} label="Member since">
                      {event.organizer.created_at
                        ? new Date(event.organizer.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </InfoRow>
                    {event.organizer.last_login && (
                      <InfoRow icon={Clock} label="Last login">
                        {new Date(event.organizer.last_login).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </InfoRow>
                    )}
                  </div>

                  {/* Event stats */}
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
                    <div className="rounded-xl bg-muted/50 px-4 py-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{event.organizer.total_events}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Total events</p>
                    </div>
                    <div className="rounded-xl bg-muted/50 px-4 py-3 text-center">
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{event.organizer.approved_events}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Approved events</p>
                    </div>
                  </div>
                </Section>
              )}
            </div>

            {/* Right — sidebar */}
            <div className="space-y-4 lg:col-span-1">

              {/* Key facts */}
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event info</h3>

                <div className="space-y-3">
                  <InfoRow icon={Clock} label="Starts">{formatDate(startDate)}</InfoRow>
                  {event.end_time && (
                    <InfoRow icon={Clock} label="Ends">{formatDate(event.end_time)}</InfoRow>
                  )}
                  <InfoRow icon={Users} label="Capacity">
                    {event.capacity ? event.capacity.toLocaleString() : "Unlimited"}
                  </InfoRow>
                  <InfoRow icon={Users} label="Sold">
                    {(event.tickets_sold ?? 0).toLocaleString()} / {(event.tickets_available ?? 0).toLocaleString()}
                  </InfoRow>
                  <InfoRow icon={Tag} label="Starting from">
                    {formatLkr(minPrice)}
                  </InfoRow>
                  <InfoRow icon={Calendar} label="Submitted">
                    {formatDate(event.created_at)}
                  </InfoRow>
                </div>
              </div>

              {/* Actions repeated at sidebar for easy access */}
              {isPending && (
                <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Review decision</h3>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={approving}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    Approve event
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(true)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive transition hover:bg-destructive/20"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject event
                  </button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    The organizer will be notified of your decision.
  </p>
                </div>
              )}

              {/* Danger zone */}
              <div className="rounded-2xl border border-destructive/20 bg-card p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-destructive/70 mb-3">Danger zone</h3>
                <button
                  type="button"
                  onClick={() => { setDeleteError(null); setCanForce(false); setShowDeleteModal(true) }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive transition hover:bg-destructive/20"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete event
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Reject modal */}
        {showRejectModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => { if (!rejecting) { setShowRejectModal(false); setRejectReason("") } }}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-4">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <XCircle className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Reject event</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Provide a clear reason — the organizer will see this and can revise their event.
                  </p>
                </div>
              </div>

              <label htmlFor="reject-reason" className="block text-sm font-medium text-foreground mb-1.5">
                Rejection reason <span className="text-destructive">*</span>
              </label>
              <textarea
                id="reject-reason"
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Missing venue details, incomplete description, inappropriate content…"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowRejectModal(false); setRejectReason("") }}
                  disabled={rejecting}
                  className="px-4 py-2 text-sm rounded-lg border border-border text-foreground hover:bg-muted transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={rejecting || !rejectReason.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-destructive text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {rejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Confirm rejection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete modal */}
        {showDeleteModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => { if (!deleting) { setShowDeleteModal(false); setDeleteError(null); setCanForce(false) } }}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <Trash2 className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-foreground">Delete this event?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">&ldquo;{event.title}&rdquo;</span> and all its ticket types will be permanently removed. This cannot be undone.
                  </p>
                  {deleteError && (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{deleteError}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowDeleteModal(false); setDeleteError(null); setCanForce(false) }}
                  disabled={deleting}
                  className="px-3 py-2 text-sm rounded-lg border border-border text-foreground hover:bg-muted transition disabled:opacity-50"
                >
                  Cancel
                </button>
                {canForce ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(true)}
                    disabled={deleting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 transition disabled:opacity-50"
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                    Force delete
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDelete(false)}
                    disabled={deleting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 transition disabled:opacity-50"
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete event
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 font-medium text-foreground">{children}</span>
    </div>
  )
}
