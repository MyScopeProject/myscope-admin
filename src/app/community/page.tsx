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
  MessageSquare, 
  Search, 
  Trash2,
  ThumbsUp,
  MessageCircle,
  Flag,
  Eye,
  User,
  Clock
} from "lucide-react"

interface Post {
  _id: string
  content: string
  author: {
    _id: string
    name: string
    email: string
  }
  likes: number
  comments: number
  reports?: number
  status: "active" | "flagged" | "removed"
  createdAt: string
}

export default function CommunityPage() {
  const { user: currentUser } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getPosts()
      setPosts(response.data.posts || response.data || [])
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load posts")
      toast.error("Failed to load posts")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this post? This action cannot be undone.")) return

    try {
      await adminAPI.deletePost(id)
      toast.success("Post deleted successfully")
      fetchPosts()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete post")
    }
  }

  const handleViewDetails = (post: Post) => {
    setSelectedPost(post)
    setShowDetailModal(true)
  }

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.author.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || post.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: posts.length,
    active: posts.filter(p => p.status === "active").length,
    flagged: posts.filter(p => p.status === "flagged").length,
    removed: posts.filter(p => p.status === "removed").length
  }

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={["superadmin", "content-manager", "support"]}>
        <AdminLayout user={currentUser || undefined}>
          <PageLoader />
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requiredRoles={["superadmin", "content-manager", "support"]}>
      <AdminLayout user={currentUser || undefined}>
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <MessageSquare className="h-8 w-8 text-primary" />
              Community Moderation
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor and moderate community posts and discussions
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Posts" value={stats.total} color="bg-blue-500" />
            <StatCard title="Active" value={stats.active} color="bg-green-500" />
            <StatCard title="Flagged" value={stats.flagged} color="bg-yellow-500" />
            <StatCard title="Removed" value={stats.removed} color="bg-red-500" />
          </div>

          {/* Filters */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search posts..."
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
                <option value="active">Active</option>
                <option value="flagged">Flagged</option>
                <option value="removed">Removed</option>
              </select>
            </div>
          </div>

          {/* Error */}
          {error && <ErrorMessage type="error" title="Error" message={error} />}

          {/* Posts List */}
          {!error && filteredPosts.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No posts found"
              description={searchTerm || statusFilter !== "all" 
                ? "Try adjusting your filters"
                : "No community posts yet"
              }
            />
          ) : (
            <div className="space-y-4">
              {filteredPosts.map((post) => (
                <div key={post._id} className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Author */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-full bg-linear-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-semibold">
                          {post.author.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{post.author.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(post.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <p className="text-foreground mb-4 line-clamp-3">{post.content}</p>

                      {/* Stats */}
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <ThumbsUp className="h-4 w-4" />
                          {post.likes} likes
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4" />
                          {post.comments} comments
                        </div>
                        {post.reports && post.reports > 0 && (
                          <div className="flex items-center gap-2 text-red-500">
                            <Flag className="h-4 w-4" />
                            {post.reports} reports
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      {/* Status Badge */}
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        post.status === 'active' ? 'bg-green-500/10 text-green-500' :
                        post.status === 'flagged' ? 'bg-yellow-500/10 text-yellow-500' :
                        'bg-red-500/10 text-red-500'
                      }`}>
                        {post.status}
                      </span>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewDetails(post)}
                          className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(post._id)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition"
                          title="Delete post"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {filteredPosts.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {filteredPosts.length} of {posts.length} posts
              </p>
            </div>
          )}
        </div>

        {/* Detail Modal */}
        {showDetailModal && selectedPost && (
          <PostDetailModal
            post={selectedPost}
            onClose={() => {
              setShowDetailModal(false)
              setSelectedPost(null)
            }}
            onDelete={() => {
              handleDelete(selectedPost._id)
              setShowDetailModal(false)
              setSelectedPost(null)
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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
        </div>
        <div className={`h-12 w-12 rounded-lg ${color}/10 flex items-center justify-center`}>
          <MessageSquare className={`h-6 w-6 ${color.replace('bg-', 'text-')}`} />
        </div>
      </div>
    </div>
  )
}

function PostDetailModal({ 
  post, 
  onClose, 
  onDelete 
}: { 
  post: Post
  onClose: () => void
  onDelete: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-lg max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">Post Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Author Info */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Author</h3>
            <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
              <div className="h-12 w-12 rounded-full bg-linear-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-semibold">
                {post.author.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-foreground">{post.author.name}</p>
                <p className="text-sm text-muted-foreground">{post.author.email}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Content</h3>
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-foreground whitespace-pre-wrap">{post.content}</p>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Created</h3>
              <p className="text-foreground">{new Date(post.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Status</h3>
              <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                post.status === 'active' ? 'bg-green-500/10 text-green-500' :
                post.status === 'flagged' ? 'bg-yellow-500/10 text-yellow-500' :
                'bg-red-500/10 text-red-500'
              }`}>
                {post.status}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-blue-500/10 rounded-lg text-center">
              <ThumbsUp className="h-6 w-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{post.likes}</p>
              <p className="text-xs text-muted-foreground">Likes</p>
            </div>
            <div className="p-4 bg-green-500/10 rounded-lg text-center">
              <MessageCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{post.comments}</p>
              <p className="text-xs text-muted-foreground">Comments</p>
            </div>
            <div className="p-4 bg-red-500/10 rounded-lg text-center">
              <Flag className="h-6 w-6 text-red-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{post.reports || 0}</p>
              <p className="text-xs text-muted-foreground">Reports</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:opacity-90 transition"
            >
              Close
            </button>
            <button
              onClick={onDelete}
              className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:opacity-90 transition"
            >
              Delete Post
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
