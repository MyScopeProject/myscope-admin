/**
 * Example: Using RBAC in Music Management Page
 * This demonstrates various RBAC patterns
 */

"use client"

import { useState, useEffect } from "react"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { RoleGuard, SuperadminOnly } from "@/components/auth/RoleGuard"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { useRBAC } from "@/hooks/useRBAC"
import { PageLoader } from "@/components/ui/loading"
import { adminAPI } from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import { Music as MusicIcon, Upload, Edit, Trash2, Check, X, Star } from "lucide-react"

export default function MusicManagementExample() {
  const { user: currentUser } = useAuth()
  const { 
    canApproveContent, 
    canDeleteContent, 
    canToggleFeatured,
    isSuperAdmin,
    canManageMusic,
    hasPermission 
  } = useRBAC()

  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTracks()
  }, [])

  const fetchTracks = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getMusic()
      setTracks(response.data.data)
    } catch (err: any) {
      toast.error('Failed to load music tracks')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      await adminAPI.approveMusic(id)
      toast.success('Track approved successfully')
      fetchTracks()
    } catch (err: any) {
      toast.error('Failed to approve track')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this track?')) return
    
    try {
      await adminAPI.deleteMusic(id)
      toast.success('Track deleted successfully')
      fetchTracks()
    } catch (err: any) {
      toast.error('Failed to delete track')
    }
  }

  if (loading) return <PageLoader />

  return (
    // Route protection with role requirement
    <ProtectedRoute requiredRoles={['superadmin', 'content-manager']}>
      <AdminLayout user={currentUser || undefined}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Music Management</h1>
            
            {/* Only show upload button if user has permission */}
            <RoleGuard requiredPermission="upload_music">
              <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg">
                <Upload className="h-4 w-4" />
                Upload Music
              </button>
            </RoleGuard>
          </div>

          {/* Show admin stats only to superadmin */}
          <SuperadminOnly>
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <p className="text-sm text-purple-600">
                🔒 Superadmin View: Advanced statistics and controls
              </p>
            </div>
          </SuperadminOnly>

          <div className="space-y-4">
            {tracks.map((track: any) => (
              <div key={track._id} className="p-4 bg-card border border-border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <MusicIcon className="h-8 w-8 text-primary" />
                    <div>
                      <h3 className="font-semibold">{track.title}</h3>
                      <p className="text-sm text-muted-foreground">{track.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Approval buttons - only show if user can approve content */}
                    <RoleGuard requiredAction="approveContent">
                      {track.approvalStatus === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(track._id)}
                            className="p-2 text-green-500 hover:bg-green-500/10 rounded-lg"
                            title="Approve track"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {}}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                            title="Reject track"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </RoleGuard>

                    {/* Feature toggle - check permission using hook */}
                    {canToggleFeatured && (
                      <button
                        onClick={() => {}}
                        className={`p-2 ${track.featured ? 'text-yellow-500' : 'text-muted-foreground'} hover:bg-yellow-500/10 rounded-lg`}
                        title="Toggle featured"
                      >
                        <Star className={`h-4 w-4 ${track.featured ? 'fill-current' : ''}`} />
                      </button>
                    )}

                    {/* Edit button - show to all content managers */}
                    <RoleGuard minimumRole="content-manager">
                      <button className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg">
                        <Edit className="h-4 w-4" />
                      </button>
                    </RoleGuard>

                    {/* Delete button - only if user can delete content */}
                    <RoleGuard 
                      requiredAction="deleteContent"
                      fallback={
                        <button 
                          disabled 
                          className="p-2 text-muted-foreground/50 rounded-lg cursor-not-allowed"
                          title="You don't have permission to delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      }
                    >
                      <button
                        onClick={() => handleDelete(track._id)}
                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </RoleGuard>
                  </div>
                </div>

                {/* Advanced options - superadmin only */}
                <SuperadminOnly>
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      Advanced Options (Superadmin Only)
                    </p>
                  </div>
                </SuperadminOnly>
              </div>
            ))}
          </div>

          {/* Danger Zone - superadmin only */}
          <SuperadminOnly>
            <div className="mt-8 p-6 bg-destructive/10 border-2 border-destructive/20 rounded-lg">
              <h3 className="text-lg font-semibold text-destructive mb-4">Danger Zone</h3>
              <button className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg">
                Reset All Music Data
              </button>
            </div>
          </SuperadminOnly>

          {/* Show forbidden message if user tries to access restricted feature */}
          <RoleGuard 
            allowedRoles={['superadmin']} 
            showForbidden
          >
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm">This section is only visible to superadmins</p>
            </div>
          </RoleGuard>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}
