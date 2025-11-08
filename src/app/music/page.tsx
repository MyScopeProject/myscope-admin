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
  Music, 
  Search, 
  Plus, 
  Edit, 
  Trash2,
  Play,
  Pause,
  User,
  Disc,
  Filter
} from "lucide-react"

interface MusicTrack {
  _id: string
  title: string
  artist: string
  album?: string
  genre: string
  duration?: number
  plays?: number
  likes?: number
  coverImage?: string
  audioUrl?: string
  createdAt: string
}

export default function MusicPage() {
  const { user: currentUser } = useAuth()
  const [tracks, setTracks] = useState<MusicTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [genreFilter, setGenreFilter] = useState("all")
  const [showModal, setShowModal] = useState(false)
  const [selectedTrack, setSelectedTrack] = useState<MusicTrack | null>(null)

  useEffect(() => {
    fetchMusic()
  }, [])

  const fetchMusic = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getMusic()
      setTracks(response.data.music || response.data || [])
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load music")
      toast.error("Failed to load music")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this track?")) return

    try {
      await adminAPI.deleteMusic(id)
      toast.success("Track deleted successfully")
      fetchMusic()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete track")
    }
  }

  const handleEdit = (track: MusicTrack) => {
    setSelectedTrack(track)
    setShowModal(true)
  }

  const filteredTracks = tracks.filter(track => {
    const matchesSearch = track.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         track.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         track.album?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesGenre = genreFilter === "all" || track.genre === genreFilter
    return matchesSearch && matchesGenre
  })

  const genres = Array.from(new Set(tracks.map(t => t.genre)))
  const stats = {
    total: tracks.length,
    totalPlays: tracks.reduce((sum, t) => sum + (t.plays || 0), 0),
    totalLikes: tracks.reduce((sum, t) => sum + (t.likes || 0), 0),
    artists: new Set(tracks.map(t => t.artist)).size
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
                <Music className="h-8 w-8 text-primary" />
                Music Management
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage music tracks and artist profiles
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedTrack(null)
                setShowModal(true)
              }}
              className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition"
            >
              <Plus className="mr-2 h-4 w-4" />
              Upload Track
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Tracks" value={stats.total} icon={Music} color="bg-purple-500" />
            <StatCard title="Total Plays" value={stats.totalPlays} icon={Play} color="bg-green-500" />
            <StatCard title="Total Likes" value={stats.totalLikes} icon={User} color="bg-pink-500" />
            <StatCard title="Artists" value={stats.artists} icon={User} color="bg-blue-500" />
          </div>

          {/* Filters */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search tracks, artists, albums..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select
                  value={genreFilter}
                  onChange={(e) => setGenreFilter(e.target.value)}
                  className="px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All Genres</option>
                  {genres.map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && <ErrorMessage type="error" title="Error" message={error} />}

          {/* Tracks Table */}
          {!error && filteredTracks.length === 0 ? (
            <EmptyState
              icon={Music}
              title="No tracks found"
              description="Start by uploading your first track"
              action={
                <button
                  onClick={() => setShowModal(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                >
                  Upload Track
                </button>
              }
            />
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Track
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Artist
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Genre
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Stats
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTracks.map((track) => (
                      <tr key={track._id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-lg bg-linear-to-br from-primary/20 to-secondary/20 flex items-center justify-center shrink-0">
                              <Disc className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-foreground">
                                {track.title}
                              </div>
                              {track.album && (
                                <div className="text-xs text-muted-foreground">
                                  {track.album}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-foreground">{track.artist}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary">
                            {track.genre}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div className="flex items-center gap-2">
                              <Play className="h-3 w-3" />
                              {track.plays || 0} plays
                            </div>
                            <div className="flex items-center gap-2">
                              ❤️ {track.likes || 0} likes
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
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
            </div>
          )}

          {/* Pagination */}
          {filteredTracks.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {filteredTracks.length} of {tracks.length} tracks
              </p>
            </div>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <MusicModal
            track={selectedTrack}
            isOpen={showModal}
            onClose={() => {
              setShowModal(false)
              setSelectedTrack(null)
            }}
            onSuccess={() => {
              fetchMusic()
              setShowModal(false)
              setSelectedTrack(null)
            }}
          />
        )}
      </AdminLayout>
    </ProtectedRoute>
  )
}

function StatCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: any; color: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
        </div>
        <div className={`h-12 w-12 rounded-lg ${color}/10 flex items-center justify-center`}>
          <Icon className={`h-6 w-6 ${color.replace('bg-', 'text-')}`} />
        </div>
      </div>
    </div>
  )
}

function MusicModal({ 
  track, 
  isOpen, 
  onClose, 
  onSuccess 
}: { 
  track: MusicTrack | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    title: track?.title || "",
    artist: track?.artist || "",
    album: track?.album || "",
    genre: track?.genre || "Pop",
    duration: track?.duration || 0
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (track) {
        await adminAPI.updateMusic(track._id, formData)
        toast.success("Track updated successfully")
      } else {
        await adminAPI.createMusic(formData)
        toast.success("Track uploaded successfully")
      }
      onSuccess()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Operation failed")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const genres = ["Pop", "Rock", "Hip Hop", "R&B", "Jazz", "Electronic", "Country", "Classical", "Reggae", "Other"]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-lg max-w-2xl w-full p-6">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          {track ? "Edit Track" : "Upload New Track"}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              {loading ? "Saving..." : track ? "Update Track" : "Upload Track"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
