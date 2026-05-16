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
  Users, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Ban, 
  CheckCircle2,
  XCircle,
  Filter,
  Download,
  Mail
} from "lucide-react"

interface User {
  id: string
  name: string
  email: string
  role: string
  status?: string
  created_at: string
  last_login?: string
}

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getUsers()
      // Backend returns response.data.data.users
      setUsers(response.data?.data?.users || [])
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load users")
      toast.error("Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return
    }

    try {
      await adminAPI.deleteUser(userId)
      toast.success("User deleted successfully")
      fetchUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete user")
    }
  }

  const handleBanUser = async (userId: string) => {
    if (!confirm("Are you sure you want to ban this user?")) {
      return
    }
    
    try {
      await adminAPI.banUser(userId)
      toast.success("User banned successfully")
      fetchUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to ban user")
    }
  }

  const handleUnbanUser = async (userId: string) => {
    try {
      await adminAPI.unbanUser(userId)
      toast.success("User unbanned successfully")
      fetchUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to unban user")
    }
  }

  const handlePromoteToModerator = async (userId: string) => {
    if (!confirm("Promote this user to Content Manager role?")) {
      return
    }
    
    try {
      await adminAPI.updateUser(userId, { role: "content-manager" })
      toast.success("User promoted to Content Manager")
      fetchUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to promote user")
    }
  }

  const handleEditUser = (user: User) => {
    setSelectedUser(user)
    setShowEditModal(true)
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  const stats = {
    total: users.length,
    artists: users.filter(u => u.role === "artist").length,
    moderators: users.filter(u => u.role === "moderator").length,
    admins: users.filter(u => ["superadmin", "event-manager", "content-manager", "support"].includes(u.role)).length,
    active: users.filter(u => u.status !== "banned").length,
    banned: users.filter(u => u.status === "banned").length
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
                <Users className="h-8 w-8 text-primary" />
                User Management
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage user accounts, roles, and permissions
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <StatCard title="Total Users" value={stats.total} color="bg-blue-500" />
            <StatCard title="Artists" value={stats.artists} color="bg-pink-500" />
            <StatCard title="Moderators" value={stats.moderators} color="bg-orange-500" />
            <StatCard title="Admins" value={stats.admins} color="bg-purple-500" />
            <StatCard title="Active" value={stats.active} color="bg-green-500" />
            <StatCard title="Banned" value={stats.banned} color="bg-red-500" />
          </div>

          {/* Filters and Search */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All Roles</option>
                  <option value="user">Users</option>
                  <option value="organizer">Organizers</option>
                  <option value="scanner">Scanners</option>
                  <option value="artist">Artists</option>
                  <option value="moderator">Moderators</option>
                  <option value="support">Support</option>
                  <option value="content-manager">Content Manager</option>
                  <option value="event-manager">Event Manager</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>
              <button className="inline-flex items-center px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 transition">
                <Download className="mr-2 h-4 w-4" />
                Export
              </button>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <ErrorMessage
              type="error"
              title="Error loading users"
              message={error}
            />
          )}

          {/* Users Table */}
          {!error && filteredUsers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users found"
              description={searchTerm || roleFilter !== "all" 
                ? "Try adjusting your filters"
                : "Get started by adding your first user"
              }
              action={
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                >
                  Add User
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
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Joined
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-linear-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-semibold">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-foreground">
                                {user.name}
                              </div>
                              <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.role === 'superadmin' ? 'bg-purple-500/10 text-purple-500' :
                            user.role === 'artist' ? 'bg-pink-500/10 text-pink-500' :
                            user.role === 'moderator' ? 'bg-orange-500/10 text-orange-500' :
                            user.role === 'event-manager' ? 'bg-blue-500/10 text-blue-500' :
                            user.role === 'content-manager' ? 'bg-green-500/10 text-green-500' :
                            user.role === 'support' ? 'bg-yellow-500/10 text-yellow-500' :
                            'bg-gray-500/10 text-gray-500'
                          }`}>
                            {user.role.replace('-', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.status === 'banned' ? (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-500/10 text-red-500">
                              <XCircle className="mr-1 h-3 w-3" />
                              Banned
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-500/10 text-green-500">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditUser(user)}
                              className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition"
                              title="Edit user"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            {user.role === 'user' && (
                              <button
                                onClick={() => handlePromoteToModerator(user.id)}
                                className="p-2 text-purple-500 hover:bg-purple-500/10 rounded-lg transition"
                                title="Promote to Moderator"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                            )}
                            {user.status === 'banned' ? (
                              <button
                                onClick={() => handleUnbanUser(user.id)}
                                className="p-2 text-green-500 hover:bg-green-500/10 rounded-lg transition"
                                title="Unban user"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleBanUser(user.id)}
                                className="p-2 text-yellow-500 hover:bg-yellow-500/10 rounded-lg transition"
                                title="Ban user"
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition"
                              title="Delete user"
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
          {filteredUsers.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {filteredUsers.length} of {users.length} users
              </p>
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        {(showCreateModal || showEditModal) && (
          <UserModal
            user={selectedUser}
            isOpen={showCreateModal || showEditModal}
            onClose={() => {
              setShowCreateModal(false)
              setShowEditModal(false)
              setSelectedUser(null)
            }}
            onSuccess={() => {
              fetchUsers()
              setShowCreateModal(false)
              setShowEditModal(false)
              setSelectedUser(null)
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
          <Users className={`h-6 w-6 ${color.replace('bg-', 'text-')}`} />
        </div>
      </div>
    </div>
  )
}

function UserModal({ 
  user, 
  isOpen, 
  onClose, 
  onSuccess 
}: { 
  user: User | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    role: user?.role || "user",
    password: ""
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (user) {
        // Update existing user
        await adminAPI.updateUser(user.id, formData)
        toast.success("User updated successfully")
      } else {
        // Create new user
        await adminAPI.createUser(formData)
        toast.success("User created successfully")
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          {user ? "Edit User" : "Create New User"}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="user">User</option>
              <option value="organizer">Organizer</option>
              <option value="scanner">Scanner</option>
              <option value="artist">Artist</option>
              <option value="moderator">Moderator</option>
              <option value="support">Support</option>
              <option value="content-manager">Content Manager</option>
              <option value="event-manager">Event Manager</option>
              <option value="superadmin">Super Admin</option>
            </select>
          </div>

          {!user && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required={!user}
                minLength={6}
              />
            </div>
          )}

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
              {loading ? "Saving..." : user ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
