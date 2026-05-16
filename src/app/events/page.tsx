"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import { ErrorMessage, EmptyState } from "@/components/ui/error-message"
import { adminAPI } from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import {
  AlertTriangle,
  Calendar,
  Search,
  MapPin,
  DollarSign,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  ListChecks,
  Loader2,
  Trash2,
} from "lucide-react"

interface Event {
  id: string
  title: string
  description: string
  date: string
  location: string
  price: number
  tickets_available: number
  tickets_sold?: number
  status: "upcoming" | "ongoing" | "completed" | "cancelled"
  approval_status: "pending" | "approved" | "rejected"
  organizer?: {
    id: string
    name: string
    email: string
  }
  banner_url?: string | null
  category?: string
  created_at: string
}

export default function EventsPage() {
  const { user: currentUser } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [canForce, setCanForce] = useState(false)

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getEvents()
      setEvents(response.data?.data?.events || [])
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load events")
      toast.error("Failed to load events")
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      await adminAPI.approveEvent(id)
      toast.success("Event approved")
      fetchEvents()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to approve event")
    }
  }

  const handleReject = async (id: string) => {
    // Reason is required server-side. Use prompt() as a quick path —
    // the dedicated /events/review page has a proper modal.
    const reason = window.prompt("Reason for rejection (required, visible to the organizer):")
    if (!reason || !reason.trim()) return

    try {
      await adminAPI.rejectEvent(id, reason.trim())
      toast.success("Event rejected")
      fetchEvents()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to reject event")
    }
  }

  const openDelete = (event: Event) => {
    setDeleteError(null)
    setCanForce(false)
    setDeleteTarget(event)
  }

  const closeDelete = () => {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteError(null)
    setCanForce(false)
  }

  const confirmDelete = async (force: boolean) => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await adminAPI.deleteEvent(deleteTarget.id, { force })
      toast.success(force ? "Event force-deleted" : "Event deleted")
      setDeleteTarget(null)
      setCanForce(false)
      fetchEvents()
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to delete event"
      const allowForce = !!err.response?.data?.data?.can_force
      setDeleteError(msg)
      setCanForce(allowForce)
    } finally {
      setDeleting(false)
    }
  }

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (event.organizer?.name ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || event.approval_status === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: events.length,
    approved: events.filter(e => e.approval_status === "approved").length,
    pending: events.filter(e => e.approval_status === "pending").length,
    upcoming: events.filter(e => new Date(e.date) > new Date() && e.status === "upcoming").length,
  }

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={["superadmin", "event-manager", "content-manager"]}>
        <AdminLayout user={currentUser || undefined}>
          <PageLoader />
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requiredRoles={["superadmin", "event-manager", "content-manager"]}>
      <AdminLayout user={currentUser || undefined}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Calendar className="h-8 w-8 text-primary" />
                Event Management
              </h1>
              <p className="text-muted-foreground mt-1">
                Review submitted events. Organizers create events from their own dashboard.
              </p>
            </div>
            <Link
              href="/events/review"
              className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition"
            >
              <ListChecks className="mr-2 h-4 w-4" />
              Approval queue
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Events" value={stats.total} />
            <StatCard title="Approved" value={stats.approved} />
            <StatCard title="Pending" value={stats.pending} />
            <StatCard title="Upcoming" value={stats.upcoming} />
          </div>

          {/* Filters */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {error && <ErrorMessage type="error" title="Error" message={error} />}

          {!error && filteredEvents.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No events found"
              description={searchTerm || statusFilter !== "all"
                ? "Try adjusting your filters."
                : "When organizers submit events for review they'll appear here."}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents.map((event) => {
                const sold = event.tickets_sold ?? 0
                const cap = event.tickets_available ?? 0
                return (
                  <div key={event.id} className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors">
                    <div className="h-48 bg-primary/10 flex items-center justify-center overflow-hidden">
                      {event.banner_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={event.banner_url}
                          alt={event.title}
                          className="h-full w-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <Calendar className="h-16 w-16 text-primary/40" />
                      )}
                    </div>
                    <div className="p-6 space-y-4">
                      <div>
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <h3 className="text-lg font-semibold text-foreground line-clamp-1">
                            {event.title}
                          </h3>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap capitalize ${
                            event.approval_status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                            event.approval_status === 'pending' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                            'bg-destructive/10 text-destructive'
                          }`}>
                            {event.approval_status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          by {event.organizer?.name || 'Unknown organizer'}
                        </p>
                      </div>

                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {new Date(event.date).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {event.location}
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          LKR {Number(event.price ?? 0).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {sold} / {cap} tickets sold
                        </div>
                      </div>

                      {event.approval_status === 'pending' && (
                        <div className="flex gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => handleApprove(event.id)}
                            className="flex-1 px-3 py-2 text-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md hover:bg-emerald-500/20 transition flex items-center justify-center gap-1"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(event.id)}
                            className="flex-1 px-3 py-2 text-sm bg-destructive/10 text-destructive rounded-md hover:bg-destructive/20 transition flex items-center justify-center gap-1"
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </button>
                        </div>
                      )}

                      <div className="pt-2 border-t border-border">
                        <button
                          type="button"
                          onClick={() => openDelete(event)}
                          className="w-full px-3 py-2 text-sm bg-destructive/10 text-destructive rounded-md hover:bg-destructive/20 transition flex items-center justify-center gap-1.5"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete event
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Delete confirmation modal */}
        {deleteTarget && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={closeDelete}
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
                    You&rsquo;re about to delete{" "}
                    <span className="font-semibold text-foreground">&ldquo;{deleteTarget.title}&rdquo;</span>
                    {deleteTarget.organizer?.name && (
                      <> by <span className="font-medium text-foreground">{deleteTarget.organizer.name}</span></>
                    )}
                    . Ticket types and pending bookings will be removed too. This can&rsquo;t be undone.
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
                  onClick={closeDelete}
                  disabled={deleting}
                  className="px-3 py-2 text-sm rounded-md border border-border text-foreground hover:bg-muted transition disabled:opacity-50"
                >
                  Cancel
                </button>
                {canForce ? (
                  <button
                    type="button"
                    onClick={() => confirmDelete(true)}
                    disabled={deleting}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:opacity-90 transition disabled:opacity-50"
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                    Force delete
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => confirmDelete(false)}
                    disabled={deleting}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:opacity-90 transition disabled:opacity-50"
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

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
    </div>
  )
}
