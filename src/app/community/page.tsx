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
  Heart,
  MessageCircle,
  AlertTriangle,
  Pin,
  PinOff,
  UserX
} from "lucide-react"

interface Post {
  _id: string
  content: string
  mediaUrl?: string
  mediaType: "image" | "video" | "audio" | "none"
  likes: string[]
  comments: Array<{
    _id: string
    author: {
      _id: string
      name: string
      email: string
    }
    content: string
    createdAt: string
  }>
  reports: Array<{
    reportedBy: {
      _id: string
      name: string
      email: string
    }
    reason: string
    createdAt: string
  }>
  author?: {
    _id: string
    name: string
    email: string
    role: string
  }
  tags: string[]
  pinned: boolean
  createdAt: string
}

export default function CommunityPage() {
  const { user: currentUser } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getPosts()
      // Backend returns response.data.data as the posts array directly
      setPosts(response.data?.data || [])
      setError("")
    } catch (err: any) {
      console.error("Error fetching posts:", err)
      setError(err.response?.data?.message || "Failed to load posts")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this post? This action cannot be undone.")) {
      return
    }

    try {
      await adminAPI.deletePost(id)
      toast.success("Post deleted successfully")
      fetchPosts()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete post")
    }
  }

  const handleTogglePin = async (id: string) => {
    try {
      await adminAPI.togglePinPost(id)
      toast.success("Pin status updated")
      fetchPosts()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update pin status")
    }
  }

  const handleBanAuthor = async (id: string, authorName: string) => {
    if (!confirm(`Are you sure you want to ban ${authorName}? This will prevent them from posting.`)) {
      return
    }

    try {
      await adminAPI.banPostAuthor(id)
      toast.success(`${authorName} has been banned successfully`)
      fetchPosts()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to ban user")
    }
  }

  const filteredPosts = posts.filter(post => {
    const matchesSearch = 
      post.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.author?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))

    return matchesSearch
  })

  const stats = {
    total: posts.length,
    withReports: posts.filter(p => p.reports.length > 0).length,
    totalLikes: posts.reduce((sum, p) => sum + p.likes.length, 0),
    totalComments: posts.reduce((sum, p) => sum + p.comments.length, 0)
  }

  if (loading) return <PageLoader />

  return (
    <ProtectedRoute>
      <AdminLayout user={currentUser || undefined}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Community Management</h1>
              <p className="text-muted-foreground mt-1">
                Moderate community posts and manage user content
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Total Posts" value={stats.total} color="bg-blue-500" />
            <StatCard title="Reported Posts" value={stats.withReports} color="bg-red-500" />
            <StatCard title="Total Likes" value={stats.totalLikes} color="bg-pink-500" />
            <StatCard title="Total Comments" value={stats.totalComments} color="bg-green-500" />
          </div>

          {/* Search */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search posts by content, author, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Posts List */}
          <div className="space-y-4">
            {error ? (
              <ErrorMessage message={error} />
            ) : filteredPosts.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No posts found"
                description="Community posts will appear here"
              />
            ) : (
              filteredPosts.map((post) => (
                <div key={post._id} className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                        <span className="text-sm font-semibold text-foreground">
                          {post.author?.name?.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{post.author?.name || 'Unknown User'}</p>
                        <p className="text-xs text-muted-foreground">{post.author?.email || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(post.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {post.pinned && (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-500/10 text-purple-500">
                          Pinned
                        </span>
                      )}
                      {post.reports.length > 0 && (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-500/10 text-red-500 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {post.reports.length} Reports
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="mb-4">
                    <p className="text-foreground whitespace-pre-wrap">
                      {post.content.length > 300 
                        ? `${post.content.substring(0, 300)}...` 
                        : post.content}
                    </p>
                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {post.tags.map((tag, index) => (
                          <span key={index} className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 mb-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4" />
                      <span>{post.likes.length} Likes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      <span>{post.comments.length} Comments</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t border-border">
                    <button
                      onClick={() => handleTogglePin(post._id)}
                      className={`flex items-center gap-2 px-3 py-2 text-sm ${
                        post.pinned ? 'bg-purple-500/10 text-purple-500' : 'bg-muted text-foreground'
                      } rounded-lg hover:opacity-80 transition`}
                      title={post.pinned ? "Unpin post" : "Pin post"}
                    >
                      {post.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      {post.pinned ? "Unpin" : "Pin"}
                    </button>
                    <button
                      onClick={() => handleBanAuthor(post._id, post.author?.name || 'Unknown User')}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-yellow-500/10 text-yellow-600 rounded-lg hover:bg-yellow-500/20 transition"
                      title="Ban author"
                    >
                      <UserX className="h-4 w-4" />
                      Ban User
                    </button>
                    <button
                      onClick={() => handleDelete(post._id)}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition ml-auto"
                      title="Delete post"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>

                  {/* Reports Section */}
                  {post.reports.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <h4 className="text-sm font-semibold text-foreground mb-2">Reports:</h4>
                      <div className="space-y-2">
                        {post.reports.map((report, index) => (
                          <div key={index} className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                            <span className="font-medium">{report.reportedBy.name}</span> reported for{" "}
                            <span className="font-medium text-red-500">{report.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
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
