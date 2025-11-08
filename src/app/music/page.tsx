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
  Music as MusicIcon, 
  Search, 
  Plus, 
  Edit, 
  Trash2,
  Play,
  Heart,
  CheckCircle,
  XCircle,
  Star,
  StarOff
} from "lucide-react"

interface Music {
  _id: string
  title: string
  artist: string
  album?: string
  genre: string
  coverImage?: string
  audioUrl: string
  duration?: number
  likes: number
  plays: number
  featured: boolean
  approvalStatus: "pending" | "approved" | "rejected"
  uploadedBy?: {
    _id: string
    name: string
    email: string
  }
  createdAt: string
}

export default function MusicPage() {
  const { user: currentUser } = useAuth()
  const [music, setMusic] = useState<Music[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [genreFilter, setGenreFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [selectedMusic, setSelectedMusic] = useState<Music | null>(null)

  useEffect(() => {
    fetchMusic()
  }, [])

  const fetchMusic = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getMusic()
      // Backend returns response.data.data as the music array directly
      setMusic(response.data?.data || [])
      setError("")
    } catch (err: any) {
      console.error("Error fetching music:", err)
      setError(err.response?.data?.message || "Failed to load music")
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      await adminAPI.approveMusic(id)
      toast.success("Track approved successfully")
      fetchMusic()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to approve track")
    }
  }

  const handleReject = async (id: string) => {
    if (!confirm("Are you sure you want to reject this track?")) return
    
    try {
      await adminAPI.rejectMusic(id)
      toast.success("Track rejected successfully")
      fetchMusic()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to reject track")
    }
  }

  const handleToggleFeatured = async (id: string) => {
    try {
      await adminAPI.toggleFeatured(id)
      toast.success("Featured status updated")
      fetchMusic()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update featured status")
    }
  }

  const handleEdit = (track: Music) => {
    setSelectedMusic(track)
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this track? This action cannot be undone.")) {
      return
    }

    try {
      await adminAPI.deleteMusic(id)
      toast.success("Track deleted successfully")
      fetchMusic()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete track")
    }
  }

  const genres = [
    "Pop", "Rock", "Hip Hop", "R&B", "Jazz", "Classical", 
    "Electronic", "Country", "Reggae", "Blues", "Metal", 
    "Folk", "Indie", "Alternative", "Latin", "K-Pop", "Other"
  ]

  const filteredMusic = music.filter(track => {
    const matchesSearch = 
      track.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      track.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
      track.album?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      track.uploadedBy?.name.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesGenre = !genreFilter || track.genre === genreFilter
    const matchesStatus = !statusFilter || track.approvalStatus === statusFilter

    return matchesSearch && matchesGenre && matchesStatus
  })

  const stats = {
    total: music.length,
    approved: music.filter(t => t.approvalStatus === "approved").length,
    pending: music.filter(t => t.approvalStatus === "pending").length,
    featured: music.filter(t => t.featured).length
  }

  if (loading) return <PageLoader />

  return (
    <ProtectedRoute>
      <AdminLayout user={currentUser || undefined}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Music Management</h1>
              <p className="text-muted-foreground mt-1">
                Manage uploaded tracks and approve new submissions
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedMusic(null)
                setShowModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
            >
              <Plus className="h-4 w-4" />
              Add Track
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Total Tracks" value={stats.total} color="bg-blue-500" />
            <StatCard title="Approved" value={stats.approved} color="bg-green-500" />
            <StatCard title="Pending" value={stats.pending} color="bg-yellow-500" />
            <StatCard title="Featured" value={stats.featured} color="bg-purple-500" />
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by title, artist, album, or uploader..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <select
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              className="px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Genres</option>
              {genres.map(genre => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Music Table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {error ? (
              <ErrorMessage message={error} />
            ) : filteredMusic.length === 0 ? (
              <EmptyState
                icon={MusicIcon}
                title="No tracks found"
                description="Start by adding your first music track"
                action={
                  <button
                    onClick={() => setShowModal(true)}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                  >
                    Add Track
                  </button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Song Title</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Artist</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Genre</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Uploaded By</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Stats</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Status</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredMusic.map((track) => (
                      <tr key={track._id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center flex-shrink-0">
                              {track.coverImage ? (
                                <img src={track.coverImage} alt={track.title} className="h-12 w-12 rounded-lg object-cover" />
                              ) : (
                                <MusicIcon className="h-6 w-6 text-primary/40" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{track.title}</p>
                              {track.album && (
                                <p className="text-xs text-muted-foreground">{track.album}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-foreground">{track.artist}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                            {track.genre}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-foreground">{track.uploadedBy?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{track.uploadedBy?.email || 'N/A'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Play className="h-3 w-3" />
                              <span>{track.plays}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Heart className="h-3 w-3" />
                              <span>{track.likes}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full w-fit ${
                              track.approvalStatus === 'approved' ? 'bg-green-500/10 text-green-500' :
                              track.approvalStatus === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                              'bg-red-500/10 text-red-500'
                            }`}>
                              {track.approvalStatus}
                            </span>
                            {track.featured && (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full w-fit bg-purple-500/10 text-purple-500">
                                Featured
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {track.approvalStatus === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApprove(track._id)}
                                  className="p-2 text-green-500 hover:bg-green-500/10 rounded-lg transition"
                                  title="Approve track"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleReject(track._id)}
                                  className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition"
                                  title="Reject track"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleToggleFeatured(track._id)}
                              className={`p-2 ${track.featured ? 'text-purple-500' : 'text-muted-foreground'} hover:bg-purple-500/10 rounded-lg transition`}
                              title={track.featured ? "Remove from featured" : "Add to featured"}
                            >
                              {track.featured ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => handleEdit(track)}
                              className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition"
                              title="Edit track"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(track._id)}
                              className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition"
                              title="Delete track"
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

        {/* Modal */}
        {showModal && (
          <MusicModal
            music={selectedMusic}
            isOpen={showModal}
            onClose={() => {
              setShowModal(false)
              setSelectedMusic(null)
            }}
            onSuccess={() => {
              fetchMusic()
              setShowModal(false)
              setSelectedMusic(null)
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

function MusicModal({ 
  music, 
  isOpen, 
  onClose, 
  onSuccess 
}: { 
  music: Music | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    title: music?.title || "",
    artist: music?.artist || "",
    album: music?.album || "",
    genre: music?.genre || "Other",
    audioUrl: music?.audioUrl || "",
    coverImage: music?.coverImage || "",
    duration: music?.duration || 0,
    featured: music?.featured || false
  })
  const [loading, setLoading] = useState(false)

  const genres = [
    "Pop", "Rock", "Hip Hop", "R&B", "Jazz", "Classical", 
    "Electronic", "Country", "Reggae", "Blues", "Metal", 
    "Folk", "Indie", "Alternative", "Latin", "K-Pop", "Other"
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (music) {
        await adminAPI.updateMusic(music._id, formData)
        toast.success("Track updated successfully")
      } else {
        await adminAPI.createMusic(formData)
        toast.success("Track created successfully")
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
          {music ? "Edit Track" : "Add New Track"}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Track Title
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
                Artist Name
              </label>
              <input
                type="text"
                value={formData.artist}
                onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Album (Optional)
              </label>
              <input
                type="text"
                value={formData.album}
                onChange={(e) => setFormData({ ...formData, album: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Genre
              </label>
              <select
                value={formData.genre}
                onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {genres.map(genre => (
                  <option key={genre} value={genre}>{genre}</option>
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

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Audio URL
            </label>
            <input
              type="url"
              value={formData.audioUrl}
              onChange={(e) => setFormData({ ...formData, audioUrl: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="https://example.com/audio.mp3"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Cover Image URL (Optional)
            </label>
            <input
              type="url"
              value={formData.coverImage}
              onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="https://example.com/cover.jpg"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="featured"
              checked={formData.featured}
              onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
              className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
            />
            <label htmlFor="featured" className="text-sm font-medium text-foreground">
              Feature this track
            </label>
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
              {loading ? "Saving..." : music ? "Update Track" : "Add Track"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
