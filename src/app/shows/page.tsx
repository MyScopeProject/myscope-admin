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
  Film, 
  Search, 
  Plus, 
  Edit, 
  Trash2,
  Play,
  Eye,
  EyeOff,
  Clock,
  Calendar
} from "lucide-react"

interface Show {
  _id: string
  title: string
  description: string
  category: string
  thumbnail?: string
  videoUrl?: string
  duration?: number
  views?: number
  status: "published" | "draft"
  scheduledDate?: string
  createdAt: string
}

export default function ShowsPage() {
  const { user: currentUser } = useAuth()
  const [shows, setShows] = useState<Show[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [showModal, setShowModal] = useState(false)
  const [selectedShow, setSelectedShow] = useState<Show | null>(null)

  useEffect(() => {
    fetchShows()
  }, [])

  const fetchShows = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getShows()
      setShows(response.data.shows || response.data || [])
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load shows")
      toast.error("Failed to load shows")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this show?")) return

    try {
      await adminAPI.deleteShow(id)
      toast.success("Show deleted successfully")
      fetchShows()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete show")
    }
  }

  const handleToggleStatus = async (show: Show) => {
    const newStatus = show.status === "published" ? "draft" : "published"
    try {
      await adminAPI.updateShow(show._id, { status: newStatus })
      toast.success(`Show ${newStatus === "published" ? "published" : "unpublished"}`)
      fetchShows()
    } catch (err: any) {
      toast.error("Failed to update show status")
    }
  }

  const handleEdit = (show: Show) => {
    setSelectedShow(show)
    setShowModal(true)
  }

  const filteredShows = shows.filter(show => {
    const matchesSearch = show.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         show.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === "all" || show.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const categories = Array.from(new Set(shows.map(s => s.category)))
  const stats = {
    total: shows.length,
    published: shows.filter(s => s.status === "published").length,
    draft: shows.filter(s => s.status === "draft").length,
    totalViews: shows.reduce((sum, s) => sum + (s.views || 0), 0)
  }

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={["superadmin", "content-manager"]}>
        <AdminLayout user={currentUser || undefined}>
          <PageLoader />
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requiredRoles={["superadmin", "content-manager"]}>
      <AdminLayout user={currentUser || undefined}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Film className="h-8 w-8 text-primary" />
                Shows Management
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage video content and show bookings
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedShow(null)
                setShowModal(true)
              }}
              className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition"
            >
              <Plus className="mr-2 h-4 w-4" />
              Upload Show
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Shows" value={stats.total} color="bg-purple-500" />
            <StatCard title="Published" value={stats.published} color="bg-green-500" />
            <StatCard title="Drafts" value={stats.draft} color="bg-yellow-500" />
            <StatCard title="Total Views" value={stats.totalViews} color="bg-blue-500" />
          </div>

          {/* Filters */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search shows..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Error */}
          {error && <ErrorMessage type="error" title="Error" message={error} />}

          {/* Shows Grid */}
          {!error && filteredShows.length === 0 ? (
            <EmptyState
              icon={Film}
              title="No shows found"
              description="Start by uploading your first show"
              action={
                <button
                  onClick={() => setShowModal(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                >
                  Upload Show
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredShows.map((show) => (
                <div key={show._id} className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors">
                  <div className="relative h-48 bg-linear-to-br from-primary/20 to-secondary/20 flex items-center justify-center group">
                    <Film className="h-16 w-16 text-primary/40" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="h-12 w-12 text-white" />
                    </div>
                  </div>
                  
                  <div className="p-6 space-y-4">
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-lg font-semibold text-foreground line-clamp-1">
                          {show.title}
                        </h3>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full shrink-0 ml-2 ${
                          show.status === 'published' ? 'bg-green-500/10 text-green-500' :
                          'bg-yellow-500/10 text-yellow-500'
                        }`}>
                          {show.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {show.description}
                      </p>
                    </div>

                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Film className="h-4 w-4" />
                        {show.category}
                      </div>
                      {show.duration && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {Math.floor(show.duration / 60)}m {show.duration % 60}s
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        {show.views || 0} views
                      </div>
                      {show.scheduledDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {new Date(show.scheduledDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleEdit(show)}
                        className="flex-1 px-3 py-2 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition flex items-center justify-center gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(show)}
                        className="flex-1 px-3 py-2 text-sm bg-secondary/10 text-secondary rounded-lg hover:bg-secondary/20 transition flex items-center justify-center gap-2"
                      >
                        {show.status === "published" ? (
                          <>
                            <EyeOff className="h-4 w-4" />
                            Hide
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4" />
                            Publish
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(show._id)}
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
    description: show?.description || "",
    category: show?.category || "Entertainment",
    duration: show?.duration || 0,
    status: show?.status || "draft",
    scheduledDate: show?.scheduledDate ? new Date(show.scheduledDate).toISOString().slice(0, 16) : ""
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (show) {
        await adminAPI.updateShow(show._id, formData)
        toast.success("Show updated successfully")
      } else {
        await adminAPI.createShow(formData)
        toast.success("Show uploaded successfully")
      }
      onSuccess()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Operation failed")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const categories = ["Entertainment", "Comedy", "Music", "Documentary", "Interview", "Live Event", "Other"]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-lg max-w-2xl w-full p-6 my-8">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          {show ? "Edit Show" : "Upload New Show"}
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
                Duration (seconds)
              </label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                min="0"
                className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Scheduled Date (Optional)
              </label>
              <input
                type="datetime-local"
                value={formData.scheduledDate}
                onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
                <option value="draft">Draft</option>
                <option value="published">Published</option>
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
              {loading ? "Saving..." : show ? "Update Show" : "Upload Show"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
