"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import { ErrorMessage, EmptyState } from "@/components/ui/error-message"
import { adminAPI } from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  MapPin,
  Loader,
  Tag,
  Users,
} from "lucide-react"

type ApprovalStatus = "pending" | "approved" | "rejected"

interface TicketType {
  id: string
  name: string
  price: number
  quantity_total: number
  quantity_sold: number
  per_order_limit: number
}

interface Organizer {
  id: string
  name: string
  email: string
  profile_image: string | null
}

interface EventRow {
  id: string
  title: string
  description: string | null
  category: string | null
  venue_name: string | null
  venue_address: string | null
  start_time: string | null
  end_time: string | null
  date: string | null // legacy
  capacity: number | null
  banner_url: string | null
  approval_status: ApprovalStatus
  rejection_reason: string | null
  approved_at: string | null
  created_at: string
  organizer: Organizer | null
  // Used by the Approve gate: reserved events need a built seat map before
  // approval, so we block the button until layout_status === 'ready'.
  seating_mode?: string | null
  layout_status?: string | null
}

const TABS: { key: ApprovalStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
]

export default function EventReviewPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<ApprovalStatus>("pending")
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [rejectingFor, setRejectingFor] = useState<EventRow | null>(null)
  const [tickets, setTickets] = useState<Record<string, TicketType[]>>({})

  const fetchEvents = async (status: ApprovalStatus) => {
    try {
      setLoading(true)
      // adminAPI.getEvents calls GET /admin/events?approvalStatus=... — list endpoint
      // accepts `approvalStatus` query param (mapped to approval_status server-side).
      const res = await adminAPI.getEvents({ approvalStatus: status, limit: 50 })
      setEvents(res.data?.data?.events ?? [])
      setError(null)
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load events")
      toast.error("Failed to load events")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents(tab)
    setTickets({}) // reset cached tickets when switching tabs
  }, [tab])

  // Lazy-fetch ticket types per event when admin expands the card.
  const ensureTickets = async (eventId: string) => {
    if (tickets[eventId]) return
    try {
      const res = await adminAPI.getEventForReview(eventId)
      setTickets((prev) => ({ ...prev, [eventId]: res.data?.data?.ticket_types ?? [] }))
    } catch {
      setTickets((prev) => ({ ...prev, [eventId]: [] }))
    }
  }

  const handleApprove = async (event: EventRow) => {
    if (!confirm(`Approve "${event.title}"? It will become publicly visible.`)) return
    setPendingActionId(event.id)
    try {
      await adminAPI.approveEvent(event.id)
      toast.success("Event approved")
      setEvents((prev) => prev.filter((e) => e.id !== event.id))
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to approve")
    } finally {
      setPendingActionId(null)
    }
  }

  const submitRejection = async (reason: string) => {
    if (!rejectingFor) return
    setPendingActionId(rejectingFor.id)
    try {
      await adminAPI.rejectEvent(rejectingFor.id, reason)
      toast.success("Event rejected")
      setEvents((prev) => prev.filter((e) => e.id !== rejectingFor.id))
      setRejectingFor(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to reject")
    } finally {
      setPendingActionId(null)
    }
  }

  const counts = useMemo(() => ({ shown: events.length }), [events])

  return (
    <ProtectedRoute requiredRoles={["superadmin", "content-manager", "event-manager"]}>
      <AdminLayout user={user || undefined}>
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Calendar className="h-8 w-8 text-primary" />
              Event Review Queue
            </h1>
            <p className="text-muted-foreground mt-1">
              Review organizer-submitted events. Approving makes them publicly visible.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-border">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
            <div className="ml-auto text-xs text-muted-foreground py-2">
              {!loading && `${counts.shown} shown`}
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <PageLoader />
          ) : error ? (
            <ErrorMessage type="error" title="Error loading events" message={error} />
          ) : events.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title={`No ${tab} events`}
              description={
                tab === "pending"
                  ? "Nothing waiting for review right now."
                  : `No events have been ${tab} yet.`
              }
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {events.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  tickets={tickets[e.id]}
                  onLoadTickets={() => ensureTickets(e.id)}
                  busy={pendingActionId === e.id}
                  showActions={tab === "pending"}
                  onApprove={() => handleApprove(e)}
                  onReject={() => setRejectingFor(e)}
                />
              ))}
            </div>
          )}
        </div>

        {rejectingFor && (
          <RejectModal
            event={rejectingFor}
            busy={pendingActionId === rejectingFor.id}
            onClose={() => setRejectingFor(null)}
            onSubmit={submitRejection}
          />
        )}
      </AdminLayout>
    </ProtectedRoute>
  )
}

function EventCard({
  event,
  tickets,
  onLoadTickets,
  busy,
  showActions,
  onApprove,
  onReject,
}: {
  event: EventRow
  tickets?: TicketType[]
  onLoadTickets: () => void
  busy: boolean
  showActions: boolean
  onApprove: () => void
  onReject: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const when = event.start_time || event.date

  useEffect(() => {
    if (expanded) onLoadTickets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded])

  return (
    <div className="bg-card border border-border rounded-lg p-5 flex flex-col">
      {/* Banner — show only if URL provided */}
      {event.banner_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.banner_url}
          alt=""
          className="w-full h-32 object-cover rounded-md mb-3"
          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
        />
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground truncate">{event.title}</h3>
          {event.category && (
            <p className="text-xs text-muted-foreground capitalize">{event.category}</p>
          )}
        </div>
        <StatusBadge status={event.approval_status} />
      </div>

      {/* Quick facts */}
      <div className="space-y-1.5 text-sm text-muted-foreground">
        {when && (
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            <span>{new Date(when).toLocaleString()}</span>
          </div>
        )}
        {(event.venue_name || event.venue_address) && (
          <div className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 mt-0.5" />
            <span>
              {[event.venue_name, event.venue_address].filter(Boolean).join(" · ")}
            </span>
          </div>
        )}
        {event.capacity != null && (
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            <span>Capacity: {event.capacity}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5" />
          <span>{event.organizer?.name || "—"} · {event.organizer?.email || "—"}</span>
        </div>
      </div>

      {/* Description, collapsed by default */}
      {event.description && (
        <p className="text-sm text-muted-foreground mt-3 line-clamp-3">
          {event.description}
        </p>
      )}

      {/* Rejection reason */}
      {event.rejection_reason && (
        <div className="mt-3 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          <span className="font-semibold">Rejection reason: </span>
          {event.rejection_reason}
        </div>
      )}

      {/* Ticket types (lazy on expand) */}
      <div className="mt-3 border-t border-border pt-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <Tag className="h-3.5 w-3.5" />
          {expanded ? "Hide ticket types" : "Show ticket types"}
        </button>
        {expanded && (
          <div className="mt-2 space-y-1.5 text-sm">
            {tickets === undefined ? (
              <span className="text-xs text-muted-foreground">Loading…</span>
            ) : tickets.length === 0 ? (
              <span className="text-xs text-muted-foreground">No ticket types.</span>
            ) : (
              tickets.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3">
                  <span className="text-foreground font-medium">{t.name}</span>
                  <span className="text-muted-foreground">
                    LKR {t.price} · {t.quantity_total} seats · max {t.per_order_limit}/order
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground mt-3">
        Submitted {new Date(event.created_at).toLocaleString()}
      </div>

      {showActions && (() => {
        // Reserved events can't be approved until the seat map is built —
        // the API rejects the call anyway, so gate the button up here with
        // a tooltip so the admin sees the requirement before clicking.
        const seatMapMissing =
          event.seating_mode === "reserved" && event.layout_status !== "ready"
        const approveDisabled = busy || seatMapMissing
        const approveTitle = seatMapMissing
          ? "Build the seat map first (Reserved Seating Events)"
          : busy
            ? "Working…"
            : "Approve this event"
        return (
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onApprove}
            disabled={approveDisabled}
            title={approveTitle}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <Loader className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Approve
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 transition disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </button>
          <Link
            href={`/events`}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            All events →
          </Link>
        </div>
        )
      })()}
      {showActions && (() => {
        const seatMapMissing =
          event.seating_mode === "reserved" && event.layout_status !== "ready"
        return seatMapMissing ? (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <span>
              Reserved event — seat map not built yet. Build it from{" "}
              <Link href="/reserved-seating-events" className="underline font-medium">
                Reserved Seating Events
              </Link>{" "}
              before approving.
            </span>
          </div>
        ) : null
      })()}
    </div>
  )
}

function StatusBadge({ status }: { status: ApprovalStatus }) {
  const map: Record<ApprovalStatus, { classes: string; icon: React.ReactNode; label: string }> = {
    pending: {
      classes: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      icon: <Clock className="h-3 w-3" />,
      label: "Pending",
    },
    approved: {
      classes: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Approved",
    },
    rejected: {
      classes: "bg-destructive/10 text-destructive",
      icon: <XCircle className="h-3 w-3" />,
      label: "Rejected",
    },
  }
  const c = map[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${c.classes}`}>
      {c.icon}
      {c.label}
    </span>
  )
}

function RejectModal({
  event,
  busy,
  onClose,
  onSubmit,
}: {
  event: EventRow
  busy: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = useState("")
  const trimmed = reason.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-foreground mb-1">Reject event</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {event.title} — the organizer will see this reason and can edit + re-submit.
        </p>

        <label className="block text-sm font-medium text-foreground mb-2">Reason</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          placeholder="e.g. Banner image is low quality; please re-upload at 1200×630."
          maxLength={1000}
          autoFocus
        />
        <div className="text-xs text-muted-foreground mt-1">{trimmed.length} / 1000</div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:opacity-90 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !trimmed}
            onClick={() => onSubmit(trimmed)}
            className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:opacity-90 transition disabled:opacity-50"
          >
            {busy ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  )
}
