"use client"

import { useEffect, useState } from "react"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import { ErrorMessage, EmptyState } from "@/components/ui/error-message"
import { adminAPI } from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import { Film, Plus, Search, Star, Trash2, Edit, X } from "lucide-react"

interface Movie {
  id: string
  title: string
  description?: string
  genre?: string[] | string
  language?: string
  duration?: string
  rating?: string
  poster?: string
  trailer?: string
  featured?: boolean
  source?: string
  created_at?: string
}

const formatGenre = (g?: string[] | string) =>
  Array.isArray(g) ? g.join(", ") : g || ""

export default function MoviesPage() {
  const { user: currentUser } = useAuth()
  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Movie | null>(null)

  useEffect(() => { fetchMovies() }, [])

  const fetchMovies = async () => {
    try {
      setLoading(true)
      const res = await adminAPI.getMovies()
      setMovies(res.data?.data?.movies || [])
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load movies")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this movie?")) return
    try {
      await adminAPI.deleteMovie(id)
      toast.success("Movie deleted")
      fetchMovies()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete")
    }
  }

  const handleToggleFeatured = async (id: string) => {
    try {
      await adminAPI.toggleMovieFeatured(id)
      fetchMovies()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update")
    }
  }

  const filtered = movies.filter(m =>
    !search || m.title.toLowerCase().includes(search.toLowerCase()) ||
    formatGenre(m.genre).toLowerCase().includes(search.toLowerCase())
  )

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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Film className="h-8 w-8 text-primary" />
                Movies
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage the movie catalogue powering /movies on the public site.
              </p>
            </div>
            <button
              onClick={() => { setEditing(null); setShowModal(true) }}
              className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition"
            >
              <Plus className="mr-2 h-4 w-4" /> Add Movie
            </button>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by title or genre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {error && <ErrorMessage type="error" title="Error" message={error} />}

          {!error && filtered.length === 0 ? (
            <EmptyState
              icon={Film}
              title="No movies found"
              description={search ? "Try a different search term." : "Add your first movie."}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filtered.map((movie) => (
                <div key={movie.id} className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors">
                  <div className="h-56 bg-muted relative">
                    {movie.poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={movie.poster} alt={movie.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Film className="h-16 w-16 text-muted-foreground/40" />
                      </div>
                    )}
                    {movie.featured && (
                      <span className="absolute top-2 left-2 bg-amber-500 text-amber-950 text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1 shadow">
                        <Star className="h-3 w-3" /> Featured
                      </span>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <h3 className="font-semibold text-foreground line-clamp-1">{movie.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {formatGenre(movie.genre) || '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[movie.language, movie.duration, movie.rating].filter(Boolean).join(' · ') || '—'}
                    </p>
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => { setEditing(movie); setShowModal(true) }}
                        className="flex-1 px-3 py-2 text-sm bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition flex items-center justify-center gap-1"
                      >
                        <Edit className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleFeatured(movie.id)}
                        className={`px-3 py-2 text-sm rounded-md transition flex items-center justify-center ${
                          movie.featured
                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                        title={movie.featured ? 'Unfeature' : 'Feature'}
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(movie.id)}
                        className="px-3 py-2 text-sm bg-destructive/10 text-destructive rounded-md hover:bg-destructive/20 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showModal && (
          <MovieModal
            movie={editing}
            onClose={() => { setShowModal(false); setEditing(null) }}
            onSuccess={() => { setShowModal(false); setEditing(null); fetchMovies() }}
          />
        )}
      </AdminLayout>
    </ProtectedRoute>
  )
}

function MovieModal({ movie, onClose, onSuccess }: { movie: Movie | null; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    title: movie?.title || "",
    description: movie?.description || "",
    genre: formatGenre(movie?.genre),
    language: movie?.language || "",
    duration: movie?.duration || "",
    rating: movie?.rating || "",
    poster: movie?.poster || "",
    trailer: movie?.trailer || "",
    featured: !!movie?.featured,
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        genre: form.genre ? form.genre.split(",").map(s => s.trim()).filter(Boolean) : [],
      }
      if (movie) {
        await adminAPI.updateMovie(movie.id, payload)
        toast.success("Movie updated")
      } else {
        await adminAPI.createMovie(payload)
        toast.success("Movie created")
      }
      onSuccess()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">{movie ? "Edit Movie" : "Add Movie"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Title" required value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <Field label="Description" textarea value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Genre (comma separated)" value={form.genre} onChange={(v) => setForm({ ...form, genre: v })} />
            <Field label="Language" value={form.language} onChange={(v) => setForm({ ...form, language: v })} />
            <Field label="Duration" placeholder="2h 30min" value={form.duration} onChange={(v) => setForm({ ...form, duration: v })} />
            <Field label="Rating" placeholder="PG-13" value={form.rating} onChange={(v) => setForm({ ...form, rating: v })} />
          </div>
          <Field label="Poster URL" value={form.poster} onChange={(v) => setForm({ ...form, poster: v })} />
          <Field label="Trailer URL" value={form.trailer} onChange={(v) => setForm({ ...form, trailer: v })} />
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm({ ...form, featured: e.target.checked })}
            />
            Featured
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:opacity-90 transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition disabled:opacity-50">
              {saving ? "Saving..." : movie ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, required, textarea, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; textarea?: boolean; placeholder?: string;
}) {
  const cls = "w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1">{label}{required && <span className="text-destructive ml-0.5">*</span>}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} rows={3} className={cls} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} className={cls} />
      )}
    </div>
  )
}
