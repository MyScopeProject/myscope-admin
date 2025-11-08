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
  Tv, 
  Search, 
  Plus, 
  Edit, 
  Trash2,
  Calendar,
  MapPin,
  Ticket,
  XCircle,
  CalendarClock,
  Star,
  StarOff
} from "lucide-react"

interface Show {
  _id: string
  title: string
  category: string
  description: string
  date: string
  venue: string
  ticketsAvailable: number
  ticketsSold: number
  status: "upcoming" | "ongoing" | "completed" | "cancelled" | "rescheduled"
  featured: boolean
  videoUrl?: string
  thumbnail?: string
  uploadedBy?: {
    _id: string
    name: string
    email: string
  }
  createdAt: string
}

export default function ShowsPage() {
  const { user: currentUser } = useAuth()
  const [shows, setShows] = useState<Show[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [selectedShow, setSelectedShow] = useState<Show | null>(null)
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [newDate, setNewDate] = useState("")

  useEffect(() => {
    fetchShows()
  }, [])

  const fetchShows = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getShows()
      // Backend returns response.data.data as the shows array directly
      setShows(response.data?.data || [])
      setError("")
    } catch (err: any) {
      console.error("Error fetching shows:", err)
      setError(err.response?.data?.message || "Failed to load shows")
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to cancel "${title}"?`)) return
    
    try {
      await adminAPI.cancelShow(id)
      toast.success("Show cancelled successfully")
      fetchShows()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to cancel show")
    }
  }

  const handleReschedule = async () => {
    if (!rescheduleId || !newDate) return
    
    try {
      await adminAPI.rescheduleShow(rescheduleId, newDate)
      toast.success("Show rescheduled successfully")
      setRescheduleId(null)
      setNewDate("")
      fetchShows()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to reschedule show")
    }
  }

  const handleToggleFeatured = async (id: string) => {
    try {
      await adminAPI.toggleFeaturedShow(id)
      toast.success("Featured status updated")
      fetchShows()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update featured status")
    }
  }

  const handleEdit = (show: Show) => {
    setSelectedShow(show)
    setShowModal(true)
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return
    }

    try {
      await adminAPI.deleteShow(id)
      toast.success("Show deleted successfully")
      fetchShows()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete show")
    }
  }

  const filteredShows = shows.filter(show => {
    const matchesSearch = 
      show.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      show.venue.toLowerCase().includes(searchTerm.toLowerCase()) ||
      show.uploadedBy?.name.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = !statusFilter || show.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const stats = {
    total: shows.length,
    upcoming: shows.filter(s => s.status === "upcoming" && new Date(s.date) >= new Date()).length,
    completed: shows.filter(s => s.status === "completed").length,
    totalTicketsSold: shows.reduce((sum, s) => sum + s.ticketsSold, 0)
  }

  if (loading) return <PageLoader />

  return (
    <ProtectedRoute>
      <AdminLayout user={currentUser || undefined}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Show Management</h1>
              <p className="text-muted-foreground mt-1">
                Manage upcoming shows and track ticket sales
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedShow(null)
                setShowModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
            >
              <Plus className="h-4 w-4" />
              Add Show
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Total Shows" value={stats.total} color="bg-blue-500" />
            <StatCard title="Upcoming" value={stats.upcoming} color="bg-green-500" />
            <StatCard title="Completed" value={stats.completed} color="bg-gray-500" />
            <StatCard title="Tickets Sold" value={stats.totalTicketsSold} color="bg-purple-500" />
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by show name, venue, or organizer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Status</option>
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="rescheduled">Rescheduled</option>
            </select>
          </div>

          {/* Shows Table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {error ? (
              <ErrorMessage message={error} />
            ) : filteredShows.length === 0 ? (
              <EmptyState
                icon={Tv}
                title="No shows found"
                description="Start by adding your first show"
                action={
                  <button
                    onClick={() => setShowModal(true)}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                  >
                    Add Show
                  </button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Show Name</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Date</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Venue</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Tickets Sold</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Status</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredShows.map((show) => (
                      <tr key={show._id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-lg bg-linear-to-br from-primary/20 to-secondary/20 flex items-center justify-center shrink-0">
                              {show.thumbnail ? (
                                <img src={show.thumbnail} alt={show.title} className="h-12 w-12 rounded-lg object-cover" />
                              ) : (
                                <Tv className="h-6 w-6 text-primary/40" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{show.title}</p>
                              <p className="text-xs text-muted-foreground">{show.category}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm text-foreground">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {new Date(show.date).toLocaleDateString()}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(show.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm text-foreground">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            {show.venue}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Ticket className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-foreground">
                              {show.ticketsSold} / {show.ticketsAvailable}
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2 mt-2">
                            <div 
                              className="bg-primary h-2 rounded-full" 
                              style={{ width: `${(show.ticketsSold / show.ticketsAvailable) * 100}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full w-fit ${
                              show.status === 'upcoming' ? 'bg-green-500/10 text-green-500' :
                              show.status === 'ongoing' ? 'bg-blue-500/10 text-blue-500' :
                              show.status === 'completed' ? 'bg-gray-500/10 text-gray-500' :
                              show.status === 'rescheduled' ? 'bg-yellow-500/10 text-yellow-500' :
                              'bg-red-500/10 text-red-500'
                            }`}>
                              {show.status}
                            </span>
                            {show.featured && (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full w-fit bg-purple-500/10 text-purple-500">
                                Featured
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {show.status === 'upcoming' && (
                              <>
                                <button
                                  onClick={() => {
                                    setRescheduleId(show._id)
                                    setNewDate(new Date(show.date).toISOString().slice(0, 16))
                                  }}
                                  className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition"
                                  title="Reschedule show"
                                >
                                  <CalendarClock className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleCancel(show._id, show.title)}
                                  className="p-2 text-orange-500 hover:bg-orange-500/10 rounded-lg transition"
                                  title="Cancel show"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleToggleFeatured(show._id)}
                              className={`p-2 ${show.featured ? 'text-purple-500' : 'text-muted-foreground'} hover:bg-purple-500/10 rounded-lg transition`}
                              title={show.featured ? "Remove from featured" : "Add to featured"}
                            >
                              {show.featured ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => handleEdit(show)}
                              className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition"
                              title="Edit show"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(show._id, show.title)}
                              className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition"
                              title="Delete show"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Reschedule Modal */}
        {rescheduleId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-card border border-border rounded-lg max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-foreground mb-4">Reschedule Show</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    New Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setRescheduleId(null)
                      setNewDate("")
                    }}
                    className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:opacity-90 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReschedule}
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
                  >
                    Reschedule
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Show Modal */}
        {showModal && (
          <ShowModal
            show={selectedShow}
            isOpen={showModal}
            onClose={() => {
              setShowModal(false)
              setSelectedShow(null)
            }}
            onSuccess={() => {
              fetchShows()
              setShowModal(false)
              setSelectedShow(null)
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

function ShowModal({ 
  show, 
  isOpen, 
  onClose, 
  onSuccess 
}: { 
  show: Show | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    title: show?.title || "",
    category: show?.category || "Concert",
    description: show?.description || "",
    date: show?.date ? new Date(show.date).toISOString().slice(0, 16) : "",
    venue: show?.venue || "",
    ticketsAvailable: show?.ticketsAvailable || 100,
    status: show?.status || "upcoming"
  })
  const [loading, setLoading] = useState(false)

  const categories = ["Concert", "Interview", "Documentary", "Behind the Scenes", "Live Performance", "Music Video", "Talk Show", "Other"]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (show) {
        await adminAPI.updateShow(show._id, formData)
        toast.success("Show updated successfully")
      } else {
        await adminAPI.createShow(formData)
        toast.success("Show created successfully")
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
          {show ? "Edit Show" : "Add New Show"}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Show Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

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
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Venue
            </label>
            <input
              type="text"
              value={formData.venue}
              onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
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
                <option value="rescheduled">Rescheduled</option>
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
              {loading ? "Saving..." : show ? "Update Show" : "Add Show"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
