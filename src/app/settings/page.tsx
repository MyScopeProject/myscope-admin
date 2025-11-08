"use client"

import { useState, useEffect } from "react"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import toast from "react-hot-toast"
import { 
  Settings, 
  User,
  Shield,
  Globe,
  Mail,
  Bell,
  Palette,
  Database,
  Save
} from "lucide-react"

export default function SettingsPage() {
  const { user: currentUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("profile")

  // Profile settings
  const [profile, setProfile] = useState({
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  })

  // Site settings
  const [siteSettings, setSiteSettings] = useState({
    siteName: "MyScope",
    siteDescription: "Entertainment platform for music, events, and shows",
    contactEmail: "support@myscope.com",
    maintenanceMode: false
  })

  // Notification settings
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    newUserAlerts: true,
    eventAlerts: true,
    reportAlerts: true
  })

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (profile.newPassword && profile.newPassword !== profile.confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    setLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success("Profile updated successfully")
    } catch (err) {
      toast.error("Failed to update profile")
    } finally {
      setLoading(false)
    }
  }

  const handleSiteSettingsUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success("Site settings updated successfully")
    } catch (err) {
      toast.error("Failed to update settings")
    } finally {
      setLoading(false)
    }
  }

  const handleNotificationsUpdate = async () => {
    setLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success("Notification preferences updated")
    } catch (err) {
      toast.error("Failed to update notifications")
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "site", label: "Site Settings", icon: Globe },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Shield }
  ]

  return (
    <ProtectedRoute requiredRoles={["superadmin"]}>
      <AdminLayout user={currentUser || undefined}>
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Settings className="h-8 w-8 text-primary" />
              Settings
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your account and site-wide settings
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Tabs Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-card border border-border rounded-lg p-2 space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        activeTab === tab.id
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{tab.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Content Area */}
            <div className="lg:col-span-3">
              <div className="bg-card border border-border rounded-lg p-6">
                {/* Profile Tab */}
                {activeTab === "profile" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-foreground mb-2">Profile Settings</h2>
                      <p className="text-sm text-muted-foreground">
                        Update your personal information and password
                      </p>
                    </div>

                    <form onSubmit={handleProfileUpdate} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={profile.name}
                          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                          className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={profile.email}
                          onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                          className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          required
                        />
                      </div>

                      <div className="border-t border-border pt-4 mt-6">
                        <h3 className="text-lg font-semibold text-foreground mb-4">Change Password</h3>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                              Current Password
                            </label>
                            <input
                              type="password"
                              value={profile.currentPassword}
                              onChange={(e) => setProfile({ ...profile, currentPassword: e.target.value })}
                              className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                              New Password
                            </label>
                            <input
                              type="password"
                              value={profile.newPassword}
                              onChange={(e) => setProfile({ ...profile, newPassword: e.target.value })}
                              className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                              Confirm New Password
                            </label>
                            <input
                              type="password"
                              value={profile.confirmPassword}
                              onChange={(e) => setProfile({ ...profile, confirmPassword: e.target.value })}
                              className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {loading ? "Saving..." : "Save Changes"}
                      </button>
                    </form>
                  </div>
                )}

                {/* Site Settings Tab */}
                {activeTab === "site" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-foreground mb-2">Site Settings</h2>
                      <p className="text-sm text-muted-foreground">
                        Configure site-wide settings and preferences
                      </p>
                    </div>

                    <form onSubmit={handleSiteSettingsUpdate} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Site Name
                        </label>
                        <input
                          type="text"
                          value={siteSettings.siteName}
                          onChange={(e) => setSiteSettings({ ...siteSettings, siteName: e.target.value })}
                          className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Site Description
                        </label>
                        <textarea
                          value={siteSettings.siteDescription}
                          onChange={(e) => setSiteSettings({ ...siteSettings, siteDescription: e.target.value })}
                          rows={3}
                          className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Contact Email
                        </label>
                        <input
                          type="email"
                          value={siteSettings.contactEmail}
                          onChange={(e) => setSiteSettings({ ...siteSettings, contactEmail: e.target.value })}
                          className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          required
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                        <div>
                          <p className="font-medium text-foreground">Maintenance Mode</p>
                          <p className="text-sm text-muted-foreground">
                            Put the site in maintenance mode
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSiteSettings({ ...siteSettings, maintenanceMode: !siteSettings.maintenanceMode })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            siteSettings.maintenanceMode ? "bg-primary" : "bg-muted"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              siteSettings.maintenanceMode ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {loading ? "Saving..." : "Save Changes"}
                      </button>
                    </form>
                  </div>
                )}

                {/* Notifications Tab */}
                {activeTab === "notifications" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-foreground mb-2">Notification Preferences</h2>
                      <p className="text-sm text-muted-foreground">
                        Manage how you receive notifications
                      </p>
                    </div>

                    <div className="space-y-4">
                      {[
                        { key: "emailNotifications", label: "Email Notifications", desc: "Receive email updates" },
                        { key: "newUserAlerts", label: "New User Alerts", desc: "Get notified when new users register" },
                        { key: "eventAlerts", label: "Event Alerts", desc: "Receive alerts about upcoming events" },
                        { key: "reportAlerts", label: "Report Alerts", desc: "Get notified about user reports" }
                      ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                          <div>
                            <p className="font-medium text-foreground">{item.label}</p>
                            <p className="text-sm text-muted-foreground">{item.desc}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNotifications({ ...notifications, [item.key]: !notifications[item.key as keyof typeof notifications] })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              notifications[item.key as keyof typeof notifications] ? "bg-primary" : "bg-muted"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                notifications[item.key as keyof typeof notifications] ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleNotificationsUpdate}
                      disabled={loading}
                      className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {loading ? "Saving..." : "Save Preferences"}
                    </button>
                  </div>
                )}

                {/* Security Tab */}
                {activeTab === "security" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-foreground mb-2">Security Settings</h2>
                      <p className="text-sm text-muted-foreground">
                        Manage security and authentication settings
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <div className="flex items-start gap-3">
                          <Shield className="h-5 w-5 text-blue-500 mt-0.5" />
                          <div>
                            <p className="font-medium text-foreground mb-1">Two-Factor Authentication</p>
                            <p className="text-sm text-muted-foreground mb-3">
                              Add an extra layer of security to your account
                            </p>
                            <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:opacity-90 transition text-sm">
                              Enable 2FA
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h3 className="font-medium text-foreground mb-2">Active Sessions</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          You are currently logged in on 1 device
                        </p>
                        <button className="px-4 py-2 bg-red-500 text-white rounded-lg hover:opacity-90 transition text-sm">
                          Logout All Sessions
                        </button>
                      </div>

                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h3 className="font-medium text-foreground mb-2">API Keys</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          Manage API keys for external integrations
                        </p>
                        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition text-sm">
                          Generate API Key
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}
