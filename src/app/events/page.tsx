"use client"

import { useState, useEffect } from "react"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import { ErrorMessage, EmptyState } from "@/components/ui/error-message"
import { adminAPI } from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import { 
  Calendar, 
  Search, 
  Plus, 
  Edit, 
  Trash2,
  MapPin,
  DollarSign,
  Users,
  Eye,
  EyeOff,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react"

interface Event {
  _id: string
  title: string
  description: string
  date: string
  location: string
  price: number
  ticketsAvailable: number
  ticketsSold?: number
  status: "upcoming" | "ongoing" | "completed" | "cancelled"
  approvalStatus: "pending" | "approved" | "rejected"
  organizer: {
    _id: string
    name: string
    email: string
  }
  image?: string
  category?: string
  createdAt: string
}

export default function EventsPage() {
  const { user: currentUser } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showModal, setShowModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getEvents()
      setEvents(response.data.events || response.data || [])
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load events")
      toast.error("Failed to load events")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return

    try {
      await adminAPI.deleteEvent(id)
      toast.success("Event deleted successfully")
      fetchEvents()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete event")
    }
  }

  const handleApprove = async (id: string) => {
    try {
      await adminAPI.approveEvent(id)
      toast.success("Event approved successfully")
      fetchEvents()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to approve event")
    }
  }

  const handleReject = async (id: string) => {
    if (!confirm("Are you sure you want to reject this event?")) return
    
    try {
      await adminAPI.rejectEvent(id)
      toast.success("Event rejected")
      fetchEvents()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to reject event")
    }
  }

  const handleToggleStatus = async (event: Event) => {
    const newStatus = event.status === "upcoming" ? "cancelled" : "upcoming"
    try {
      await adminAPI.updateEvent(event._id, { status: newStatus })
      toast.success(`Event status updated`)
      fetchEvents()
    } catch (err: any) {
      toast.error("Failed to update event status")
    }
  }

  const handleEdit = (event: Event) => {
    setSelectedEvent(event)
    setShowModal(true)
  }

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.organizer?.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || event.approvalStatus === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: events.length,
    approved: events.filter(e => e.approvalStatus === "approved").length,
    pending: events.filter(e => e.approvalStatus === "pending").length,
    upcoming: events.filter(e => new Date(e.date) > new Date() && e.status === "upcoming").length
  }

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={["superadmin", "event-manager"]}>
        <AdminLayout user={currentUser || undefined}>
          <PageLoader />
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requiredRoles={["superadmin", "event-manager"]}>
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
                Create and manage event listings and bookings
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedEvent(null)
                setShowModal(true)
              }}
              className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Event
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Events" value={stats.total} color="bg-blue-500" />
            <StatCard title="Approved" value={stats.approved} color="bg-green-500" />
            <StatCard title="Pending" value={stats.pending} color="bg-yellow-500" />
            <StatCard title="Upcoming" value={stats.upcoming} color="bg-purple-500" />
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

          {/* Error */}
          {error && <ErrorMessage type="error" title="Error" message={error} />}

          {/* Events Grid */}
          {!error && filteredEvents.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No events found"
              description="Start by creating your first event"
              action={
                <button
                  onClick={() => setShowModal(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                >
                  Create Event
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents.map((event) => (
                <div key={event._id} className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors">
                  <div className="h-48 bg-linear-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                    <Calendar className="h-16 w-16 text-primary/40" />
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-lg font-semibold text-foreground line-clamp-1">
                          {event.title}
                        </h3>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          event.approvalStatus === 'approved' ? 'bg-green-500/10 text-green-500' :
                          event.approvalStatus === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                          'bg-red-500/10 text-red-500'
                        }`}>
                          {event.approvalStatus}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {event.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        by {event.organizer.name}
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
                        ${event.price}
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {event.ticketsSold || 0} / {event.ticketsAvailable} tickets sold
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      {event.approvalStatus === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(event._id)}
                            className="px-3 py-2 text-sm bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20 transition flex items-center justify-center gap-1"
                            title="Approve event"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleReject(event._id)}
                            className="px-3 py-2 text-sm bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition flex items-center justify-center gap-1"
                            title="Reject event"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleEdit(event)}
                        className="flex-1 px-3 py-2 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition flex items-center justify-center gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(event)}
                        className="flex-1 px-3 py-2 text-sm bg-secondary/10 text-secondary rounded-lg hover:bg-secondary/20 transition flex items-center justify-center gap-2"
                      >
                        {event.status === "upcoming" ? (
                          <>
                            <EyeOff className="h-4 w-4" />
                            Cancel
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4" />
                            Activate
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(event._id)}
                        className="px-3 py-2 text-sm bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <EventModal
            event={selectedEvent}
            isOpen={showModal}
            onClose={() => {
              setShowModal(false)
              setSelectedEvent(null)
            }}
            onSuccess={() => {
              fetchEvents()
              setShowModal(false)
              setSelectedEvent(null)
            }}
          />
        )}
      </AdminLayout>
    </ProtectedRoute>
  )
}

function StatCard({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
    </div>
  )
}

function EventModal({ 
  event, 
  isOpen, 
  onClose, 
  onSuccess 
}: { 
  event: Event | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    title: event?.title || "",
    description: event?.description || "",
    date: event?.date ? new Date(event.date).toISOString().slice(0, 16) : "",
    location: event?.location || "",
    price: event?.price || 0,
    ticketsAvailable: event?.ticketsAvailable || 100,
    status: event?.status || "upcoming"
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (event) {
        await adminAPI.updateEvent(event._id, formData)
        toast.success("Event updated successfully")
      } else {
        await adminAPI.createEvent(formData)
        toast.success("Event created successfully")
      }
      onSuccess()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Operation failed")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-lg max-w-2xl w-full p-6 my-8">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          {event ? "Edit Event" : "Create New Event"}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Event Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Date & Time
              </label>
              <input
                type="datetime-local"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Price ($)
              </label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                min="0"
                step="0.01"
                className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Tickets Available
              </label>
              <input
                type="number"
                value={formData.ticketsAvailable}
                onChange={(e) => setFormData({ ...formData, ticketsAvailable: Number(e.target.value) })}
                min="1"
                className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="upcoming">Upcoming</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:opacity-90 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? "Saving..." : event ? "Update Event" : "Create Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
