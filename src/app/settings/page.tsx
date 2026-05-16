"use client"

import { useState, useEffect } from "react"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import { adminAPI } from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import { 
  Settings as SettingsIcon, 
  Save,
  RotateCcw,
  Globe,
  Shield,
  Bell,
  Users,
  ToggleLeft,
  ToggleRight,
  Plus,
  Trash2,
  AlertTriangle
} from "lucide-react"

interface Settings {
  siteConfig: {
    platformName: string
    platformDescription: string
    defaultTheme: string
    logo: string
    favicon: string
    supportEmail: string
    termsUrl: string
    privacyUrl: string
  }
  features: {
    enableUserRegistration: boolean
    enableMusicUpload: boolean
    enableCommunityPosts: boolean
    enableEvents: boolean
    enableShows: boolean
    enableComments: boolean
    requireEmailVerification: boolean
    enableNotifications: boolean
    maintenanceMode: boolean
  }
  roles: {
    permissions: {
      superadmin: string[]
      'content-manager': string[]
      moderator: string[]
      artist: string[]
      user: string[]
    }
    customRoles: Array<{
      name: string
      permissions: string[]
      description: string
    }>
  }
  notifications: {
    emailNotifications: {
      enabled: boolean
      newUserSignup: boolean
      newContentUpload: boolean
      reportedContent: boolean
      systemAlerts: boolean
    }
    pushNotifications: {
      enabled: boolean
      newFollower: boolean
      newComment: boolean
      newLike: boolean
    }
    adminNotifications: {
      emailDigest: string
      reportThreshold: number
    }
  }
  moderation: {
    autoModeration: {
      enabled: boolean
      profanityFilter: boolean
      spamDetection: boolean
    }
    approvalRequired: {
      music: boolean
      events: boolean
      shows: boolean
      posts: boolean
    }
  }
}

type TabType = 'site-config' | 'features' | 'roles' | 'notifications' | 'moderation'

export default function SettingsPage() {
  const { user: currentUser } = useAuth()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('site-config')
  const [hasChanges, setHasChanges] = useState(false)

  // Form states
  const [siteConfig, setSiteConfig] = useState<Settings['siteConfig']>({
    platformName: '',
    platformDescription: '',
    defaultTheme: 'system',
    logo: '',
    favicon: '',
    supportEmail: '',
    termsUrl: '',
    privacyUrl: ''
  })
  
  const [features, setFeatures] = useState<Settings['features']>({
    enableUserRegistration: true,
    enableMusicUpload: true,
    enableCommunityPosts: true,
    enableEvents: true,
    enableShows: true,
    enableComments: true,
    requireEmailVerification: false,
    enableNotifications: true,
    maintenanceMode: false
  })

  const [notifications, setNotifications] = useState<Settings['notifications']>({
    emailNotifications: {
      enabled: true,
      newUserSignup: true,
      newContentUpload: true,
      reportedContent: true,
      systemAlerts: true
    },
    pushNotifications: {
      enabled: false,
      newFollower: true,
      newComment: true,
      newLike: true
    },
    adminNotifications: {
      emailDigest: 'daily',
      reportThreshold: 5
    }
  })

  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDescription, setNewRoleDescription] = useState('')
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([])

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getSettings()
      const data = response.data.data
      setSettings(data)
      setSiteConfig(data.siteConfig)
      setFeatures(data.features)
      setNotifications(data.notifications)
    } catch (err: any) {
      console.error('Error fetching settings:', err)
      toast.error(err.response?.data?.message || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSiteConfig = async () => {
    try {
      setSaving(true)
      await adminAPI.updateSiteConfig(siteConfig)
      toast.success('Site configuration updated successfully')
      setHasChanges(false)
      fetchSettings()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update site configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveFeatures = async () => {
    try {
      setSaving(true)
      await adminAPI.updateFeatures(features)
      toast.success('Feature settings updated successfully')
      setHasChanges(false)
      fetchSettings()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update feature settings')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveNotifications = async () => {
    try {
      setSaving(true)
      await adminAPI.updateNotifications(notifications)
      toast.success('Notification settings updated successfully')
      setHasChanges(false)
      fetchSettings()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update notification settings')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateCustomRole = async () => {
    if (!newRoleName || newRolePermissions.length === 0) {
      toast.error('Please provide role name and at least one permission')
      return
    }

    try {
      await adminAPI.createCustomRole({
        name: newRoleName,
        permissions: newRolePermissions,
        description: newRoleDescription
      })
      toast.success('Custom role created successfully')
      setNewRoleName('')
      setNewRoleDescription('')
      setNewRolePermissions([])
      fetchSettings()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create custom role')
    }
  }

  const handleDeleteCustomRole = async (roleName: string) => {
    if (!confirm(`Are you sure you want to delete the role "${roleName}"?`)) return

    try {
      await adminAPI.deleteCustomRole(roleName)
      toast.success('Custom role deleted successfully')
      fetchSettings()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete custom role')
    }
  }

  const handleResetSettings = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
      return
    }

    try {
      setSaving(true)
      await adminAPI.resetSettings()
      toast.success('Settings reset to defaults successfully')
      fetchSettings()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reset settings')
    } finally {
      setSaving(false)
    }
  }

  const availablePermissions = [
    'manage_music',
    'manage_events',
    'manage_shows',
    'manage_posts',
    'approve_content',
    'delete_content',
    'view_analytics',
    'delete_posts',
    'delete_comments',
    'ban_users',
    'view_reports',
    'upload_music',
    'create_events',
    'create_shows',
    'create_posts',
    'comment',
    'like',
    'follow'
  ]

  if (loading) return <PageLoader />

  return (
    <ProtectedRoute>
      <AdminLayout user={currentUser || undefined}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground mt-1">
                Configure platform settings and preferences
              </p>
            </div>
            <button
              onClick={handleResetSettings}
              className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Defaults
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-border">
            <div className="flex gap-4 overflow-x-auto">
              <TabButton
                icon={Globe}
                label="Site Config"
                active={activeTab === 'site-config'}
                onClick={() => setActiveTab('site-config')}
              />
              <TabButton
                icon={ToggleLeft}
                label="Features"
                active={activeTab === 'features'}
                onClick={() => setActiveTab('features')}
              />
              <TabButton
                icon={Shield}
                label="Roles & Permissions"
                active={activeTab === 'roles'}
                onClick={() => setActiveTab('roles')}
              />
              <TabButton
                icon={Bell}
                label="Notifications"
                active={activeTab === 'notifications'}
                onClick={() => setActiveTab('notifications')}
              />
              <TabButton
                icon={AlertTriangle}
                label="Moderation"
                active={activeTab === 'moderation'}
                onClick={() => setActiveTab('moderation')}
              />
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-card border border-border rounded-lg p-6">
            {activeTab === 'site-config' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-foreground">Site Configuration</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Platform Name
                    </label>
                    <input
                      type="text"
                      value={siteConfig.platformName}
                      onChange={(e) => {
                        setSiteConfig({ ...siteConfig, platformName: e.target.value })
                        setHasChanges(true)
                      }}
                      className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Support Email
                    </label>
                    <input
                      type="email"
                      value={siteConfig.supportEmail}
                      onChange={(e) => {
                        setSiteConfig({ ...siteConfig, supportEmail: e.target.value })
                        setHasChanges(true)
                      }}
                      className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Platform Description
                    </label>
                    <textarea
                      value={siteConfig.platformDescription}
                      onChange={(e) => {
                        setSiteConfig({ ...siteConfig, platformDescription: e.target.value })
                        setHasChanges(true)
                      }}
                      rows={3}
                      className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Default Theme
                    </label>
                    <select
                      value={siteConfig.defaultTheme}
                      onChange={(e) => {
                        setSiteConfig({ ...siteConfig, defaultTheme: e.target.value })
                        setHasChanges(true)
                      }}
                      className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="system">System Default</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Logo URL
                    </label>
                    <input
                      type="text"
                      value={siteConfig.logo}
                      onChange={(e) => {
                        setSiteConfig({ ...siteConfig, logo: e.target.value })
                        setHasChanges(true)
                      }}
                      placeholder="https://example.com/logo.png"
                      className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Terms of Service URL
                    </label>
                    <input
                      type="text"
                      value={siteConfig.termsUrl}
                      onChange={(e) => {
                        setSiteConfig({ ...siteConfig, termsUrl: e.target.value })
                        setHasChanges(true)
                      }}
                      placeholder="https://example.com/terms"
                      className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Privacy Policy URL
                    </label>
                    <input
                      type="text"
                      value={siteConfig.privacyUrl}
                      onChange={(e) => {
                        setSiteConfig({ ...siteConfig, privacyUrl: e.target.value })
                        setHasChanges(true)
                      }}
                      placeholder="https://example.com/privacy"
                      className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveSiteConfig}
                  disabled={!hasChanges || saving}
                  className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}

            {activeTab === 'features' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-foreground">Feature Toggles</h2>
                
                <div className="space-y-4">
                  <ToggleRow
                    label="User Registration"
                    description="Allow new users to register on the platform"
                    checked={features.enableUserRegistration}
                    onChange={(checked) => {
                      setFeatures({ ...features, enableUserRegistration: checked })
                      setHasChanges(true)
                    }}
                  />
                  
                  <ToggleRow
                    label="Music Upload"
                    description="Allow users to upload music tracks"
                    checked={features.enableMusicUpload}
                    onChange={(checked) => {
                      setFeatures({ ...features, enableMusicUpload: checked })
                      setHasChanges(true)
                    }}
                  />
                  
                  <ToggleRow
                    label="Community Posts"
                    description="Enable community posting features"
                    checked={features.enableCommunityPosts}
                    onChange={(checked) => {
                      setFeatures({ ...features, enableCommunityPosts: checked })
                      setHasChanges(true)
                    }}
                  />
                  
                  <ToggleRow
                    label="Events"
                    description="Enable event creation and management"
                    checked={features.enableEvents}
                    onChange={(checked) => {
                      setFeatures({ ...features, enableEvents: checked })
                      setHasChanges(true)
                    }}
                  />
                  
                  <ToggleRow
                    label="Shows"
                    description="Enable show/video content features"
                    checked={features.enableShows}
                    onChange={(checked) => {
                      setFeatures({ ...features, enableShows: checked })
                      setHasChanges(true)
                    }}
                  />
                  
                  <ToggleRow
                    label="Comments"
                    description="Allow users to comment on content"
                    checked={features.enableComments}
                    onChange={(checked) => {
                      setFeatures({ ...features, enableComments: checked })
                      setHasChanges(true)
                    }}
                  />
                  
                  <ToggleRow
                    label="Email Verification"
                    description="Require users to verify their email address"
                    checked={features.requireEmailVerification}
                    onChange={(checked) => {
                      setFeatures({ ...features, requireEmailVerification: checked })
                      setHasChanges(true)
                    }}
                  />
                  
                  <ToggleRow
                    label="Notifications"
                    description="Enable platform notifications"
                    checked={features.enableNotifications}
                    onChange={(checked) => {
                      setFeatures({ ...features, enableNotifications: checked })
                      setHasChanges(true)
                    }}
                  />
                  
                  <ToggleRow
                    label="Maintenance Mode"
                    description="Put the platform in maintenance mode (users cannot access)"
                    checked={features.maintenanceMode}
                    onChange={(checked) => {
                      setFeatures({ ...features, maintenanceMode: checked })
                      setHasChanges(true)
                    }}
                    variant="warning"
                  />
                </div>

                <button
                  onClick={handleSaveFeatures}
                  disabled={!hasChanges || saving}
                  className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}

            {activeTab === 'roles' && settings && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-foreground">Roles & Permissions</h2>
                
                {/* Default Roles */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-foreground">Default Roles</h3>
                  
                  {Object.entries(settings.roles.permissions).map(([role, permissions]) => (
                    <div key={role} className="p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-foreground capitalize">{role.replace('-', ' ')}</h4>
                        <span className="text-sm text-muted-foreground">
                          {permissions.length} {permissions[0] === '*' ? 'All Permissions' : 'Permissions'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {permissions[0] === '*' ? (
                          <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded">
                            All Permissions
                          </span>
                        ) : (
                          permissions.map((perm) => (
                            <span key={perm} className="px-2 py-1 text-xs bg-accent text-accent-foreground rounded">
                              {perm.replace(/_/g, ' ')}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Custom Roles */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-foreground">Custom Roles</h3>
                  
                  {settings.roles.customRoles.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No custom roles created yet.</p>
                  ) : (
                    settings.roles.customRoles.map((role) => (
                      <div key={role.name} className="p-4 bg-muted/30 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-foreground">{role.name}</h4>
                            {role.description && (
                              <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomRole(role.name)}
                            className="p-2 text-destructive hover:bg-destructive/10 rounded-md transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {role.permissions.map((perm) => (
                            <span key={perm} className="px-2 py-1 text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded">
                              {perm.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}

                  {/* Create Custom Role */}
                  <div className="p-4 bg-muted/30 rounded-lg space-y-4">
                    <h4 className="font-medium text-foreground">Create Custom Role</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Role Name
                        </label>
                        <input
                          type="text"
                          value={newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
                          placeholder="e.g., Editor"
                          className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Description (Optional)
                        </label>
                        <input
                          type="text"
                          value={newRoleDescription}
                          onChange={(e) => setNewRoleDescription(e.target.value)}
                          placeholder="Brief description"
                          className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Permissions
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {availablePermissions.map((perm) => (
                          <button
                            key={perm}
                            onClick={() => {
                              if (newRolePermissions.includes(perm)) {
                                setNewRolePermissions(newRolePermissions.filter(p => p !== perm))
                              } else {
                                setNewRolePermissions([...newRolePermissions, perm])
                              }
                            }}
                            className={`px-3 py-1 text-sm rounded-lg transition ${
                              newRolePermissions.includes(perm)
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                          >
                            {perm.replace(/_/g, ' ')}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleCreateCustomRole}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
                    >
                      <Plus className="h-4 w-4" />
                      Create Role
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-foreground">Notification Settings</h2>
                
                {/* Email Notifications */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-foreground">Email Notifications</h3>
                  
                  <ToggleRow
                    label="Enable Email Notifications"
                    description="Master toggle for all email notifications"
                    checked={notifications.emailNotifications.enabled}
                    onChange={(checked) => {
                      setNotifications({
                        ...notifications,
                        emailNotifications: { ...notifications.emailNotifications, enabled: checked }
                      })
                      setHasChanges(true)
                    }}
                  />
                  
                  <ToggleRow
                    label="New User Signup"
                    description="Notify admins when new users register"
                    checked={notifications.emailNotifications.newUserSignup}
                    onChange={(checked) => {
                      setNotifications({
                        ...notifications,
                        emailNotifications: { ...notifications.emailNotifications, newUserSignup: checked }
                      })
                      setHasChanges(true)
                    }}
                    disabled={!notifications.emailNotifications.enabled}
                  />
                  
                  <ToggleRow
                    label="New Content Upload"
                    description="Notify when new content is uploaded"
                    checked={notifications.emailNotifications.newContentUpload}
                    onChange={(checked) => {
                      setNotifications({
                        ...notifications,
                        emailNotifications: { ...notifications.emailNotifications, newContentUpload: checked }
                      })
                      setHasChanges(true)
                    }}
                    disabled={!notifications.emailNotifications.enabled}
                  />
                  
                  <ToggleRow
                    label="Reported Content"
                    description="Notify when content is reported"
                    checked={notifications.emailNotifications.reportedContent}
                    onChange={(checked) => {
                      setNotifications({
                        ...notifications,
                        emailNotifications: { ...notifications.emailNotifications, reportedContent: checked }
                      })
                      setHasChanges(true)
                    }}
                    disabled={!notifications.emailNotifications.enabled}
                  />
                  
                  <ToggleRow
                    label="System Alerts"
                    description="Notify about critical system events"
                    checked={notifications.emailNotifications.systemAlerts}
                    onChange={(checked) => {
                      setNotifications({
                        ...notifications,
                        emailNotifications: { ...notifications.emailNotifications, systemAlerts: checked }
                      })
                      setHasChanges(true)
                    }}
                    disabled={!notifications.emailNotifications.enabled}
                  />
                </div>

                {/* Push Notifications */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-foreground">Push Notifications</h3>
                  
                  <ToggleRow
                    label="Enable Push Notifications"
                    description="Master toggle for all push notifications"
                    checked={notifications.pushNotifications.enabled}
                    onChange={(checked) => {
                      setNotifications({
                        ...notifications,
                        pushNotifications: { ...notifications.pushNotifications, enabled: checked }
                      })
                      setHasChanges(true)
                    }}
                  />
                  
                  <ToggleRow
                    label="New Follower"
                    description="Notify users when someone follows them"
                    checked={notifications.pushNotifications.newFollower}
                    onChange={(checked) => {
                      setNotifications({
                        ...notifications,
                        pushNotifications: { ...notifications.pushNotifications, newFollower: checked }
                      })
                      setHasChanges(true)
                    }}
                    disabled={!notifications.pushNotifications.enabled}
                  />
                  
                  <ToggleRow
                    label="New Comment"
                    description="Notify users about new comments on their content"
                    checked={notifications.pushNotifications.newComment}
                    onChange={(checked) => {
                      setNotifications({
                        ...notifications,
                        pushNotifications: { ...notifications.pushNotifications, newComment: checked }
                      })
                      setHasChanges(true)
                    }}
                    disabled={!notifications.pushNotifications.enabled}
                  />
                  
                  <ToggleRow
                    label="New Like"
                    description="Notify users when their content is liked"
                    checked={notifications.pushNotifications.newLike}
                    onChange={(checked) => {
                      setNotifications({
                        ...notifications,
                        pushNotifications: { ...notifications.pushNotifications, newLike: checked }
                      })
                      setHasChanges(true)
                    }}
                    disabled={!notifications.pushNotifications.enabled}
                  />
                </div>

                {/* Admin Notifications */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-foreground">Admin Notifications</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Email Digest Frequency
                      </label>
                      <select
                        value={notifications.adminNotifications.emailDigest}
                        onChange={(e) => {
                          setNotifications({
                            ...notifications,
                            adminNotifications: { ...notifications.adminNotifications, emailDigest: e.target.value }
                          })
                          setHasChanges(true)
                        }}
                        className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="never">Never</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Report Threshold
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={notifications.adminNotifications.reportThreshold}
                        onChange={(e) => {
                          setNotifications({
                            ...notifications,
                            adminNotifications: { ...notifications.adminNotifications, reportThreshold: Number(e.target.value) }
                          })
                          setHasChanges(true)
                        }}
                        className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Alert when content receives this many reports
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveNotifications}
                  disabled={!hasChanges || saving}
                  className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}

            {activeTab === 'moderation' && settings && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-foreground">Content Moderation</h2>
                
                {/* Auto Moderation */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-foreground">Auto Moderation</h3>
                  
                  <ToggleRow
                    label="Enable Auto Moderation"
                    description="Automatically moderate content using AI/filters"
                    checked={settings.moderation.autoModeration.enabled}
                    onChange={async (checked) => {
                      try {
                        await adminAPI.updateModeration({
                          autoModeration: { ...settings.moderation.autoModeration, enabled: checked }
                        })
                        toast.success('Moderation settings updated')
                        fetchSettings()
                      } catch (err: any) {
                        toast.error('Failed to update moderation settings')
                      }
                    }}
                  />
                  
                  <ToggleRow
                    label="Profanity Filter"
                    description="Filter out profane language from content"
                    checked={settings.moderation.autoModeration.profanityFilter}
                    onChange={async (checked) => {
                      try {
                        await adminAPI.updateModeration({
                          autoModeration: { ...settings.moderation.autoModeration, profanityFilter: checked }
                        })
                        toast.success('Moderation settings updated')
                        fetchSettings()
                      } catch (err: any) {
                        toast.error('Failed to update moderation settings')
                      }
                    }}
                  />
                  
                  <ToggleRow
                    label="Spam Detection"
                    description="Automatically detect and flag spam content"
                    checked={settings.moderation.autoModeration.spamDetection}
                    onChange={async (checked) => {
                      try {
                        await adminAPI.updateModeration({
                          autoModeration: { ...settings.moderation.autoModeration, spamDetection: checked }
                        })
                        toast.success('Moderation settings updated')
                        fetchSettings()
                      } catch (err: any) {
                        toast.error('Failed to update moderation settings')
                      }
                    }}
                  />
                </div>

                {/* Approval Required */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-foreground">Approval Required</h3>
                  
                  <ToggleRow
                    label="Music Approval"
                    description="Require admin approval before music is published"
                    checked={settings.moderation.approvalRequired.music}
                    onChange={async (checked) => {
                      try {
                        await adminAPI.updateModeration({
                          approvalRequired: { ...settings.moderation.approvalRequired, music: checked }
                        })
                        toast.success('Moderation settings updated')
                        fetchSettings()
                      } catch (err: any) {
                        toast.error('Failed to update moderation settings')
                      }
                    }}
                  />
                  
                  <ToggleRow
                    label="Events Approval"
                    description="Require admin approval before events are published"
                    checked={settings.moderation.approvalRequired.events}
                    onChange={async (checked) => {
                      try {
                        await adminAPI.updateModeration({
                          approvalRequired: { ...settings.moderation.approvalRequired, events: checked }
                        })
                        toast.success('Moderation settings updated')
                        fetchSettings()
                      } catch (err: any) {
                        toast.error('Failed to update moderation settings')
                      }
                    }}
                  />
                  
                  <ToggleRow
                    label="Shows Approval"
                    description="Require admin approval before shows are published"
                    checked={settings.moderation.approvalRequired.shows}
                    onChange={async (checked) => {
                      try {
                        await adminAPI.updateModeration({
                          approvalRequired: { ...settings.moderation.approvalRequired, shows: checked }
                        })
                        toast.success('Moderation settings updated')
                        fetchSettings()
                      } catch (err: any) {
                        toast.error('Failed to update moderation settings')
                      }
                    }}
                  />
                  
                  <ToggleRow
                    label="Posts Approval"
                    description="Require admin approval before posts are published"
                    checked={settings.moderation.approvalRequired.posts}
                    onChange={async (checked) => {
                      try {
                        await adminAPI.updateModeration({
                          approvalRequired: { ...settings.moderation.approvalRequired, posts: checked }
                        })
                        toast.success('Moderation settings updated')
                        fetchSettings()
                      } catch (err: any) {
                        toast.error('Failed to update moderation settings')
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}

function TabButton({ 
  icon: Icon, 
  label, 
  active, 
  onClick 
}: { 
  icon: any
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 border-b-2 transition whitespace-nowrap ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  variant = 'default'
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  variant?: 'default' | 'warning'
}) {
  return (
    <div className={`flex items-center justify-between p-4 rounded-md ${
      variant === 'warning' ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-muted/30 border border-border'
    } ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex-1">
        <h4 className="font-medium text-foreground">{label}</h4>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`ml-4 p-1 rounded-md transition ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        {checked ? (
          <ToggleRight className={`h-8 w-8 ${variant === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}`} />
        ) : (
          <ToggleLeft className="h-8 w-8 text-muted-foreground" />
        )}
      </button>
    </div>
  )
}
