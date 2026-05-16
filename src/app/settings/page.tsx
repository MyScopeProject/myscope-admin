"use client"

import { useState, useEffect, useMemo } from "react"
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
  Shield,
  ToggleLeft,
  Plus,
  Trash2,
  AlertTriangle,
  Loader2,
  Check,
  Wrench,
  X,
  Users,
  Calendar,
  Banknote,
  Eye,
  ShieldAlert,
  Search,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustomRole {
  name: string
  description: string
  permissions: string[]
}

interface Settings {
  features: {
    enableUserRegistration: boolean
    enableEvents: boolean
    requireEmailVerification: boolean
    enableNotifications: boolean
    maintenanceMode: boolean
  }
  roles: {
    permissions: Record<string, string[]>
    customRoles: CustomRole[]
    // Email -> role map. UI shape: { roleName: [email,...] }.
    assignments: Record<string, string[]>
  }
}

type SectionId = "features" | "roles"

// ---------------------------------------------------------------------------
// Permission catalog
// ---------------------------------------------------------------------------
// Grouped, described list shown in the custom-role builder. Keys must match
// what the API stores in roles.permissions arrays.

const PERMISSION_CATALOG: {
  group: string
  icon: any
  permissions: { key: string; label: string; description: string }[]
}[] = [
  {
    group: "Users",
    icon: Users,
    permissions: [
      { key: "manage_users", label: "Manage users", description: "Create, edit, and suspend user accounts." },
      { key: "ban_users", label: "Ban users", description: "Permanently revoke a user's access." },
      { key: "manage_organizers", label: "Manage organizers", description: "Approve or reject organizer applications." },
    ],
  },
  {
    group: "Events",
    icon: Calendar,
    permissions: [
      { key: "manage_events", label: "Manage events", description: "Create, edit, and delete any event." },
      { key: "approve_events", label: "Approve events", description: "Move events from pending to approved state." },
    ],
  },
  {
    group: "Finance",
    icon: Banknote,
    permissions: [
      { key: "manage_payouts", label: "Manage payouts", description: "Process organizer payouts and refunds." },
      { key: "view_reports", label: "View reports", description: "Access revenue and financial reports." },
    ],
  },
  {
    group: "Insights",
    icon: Eye,
    permissions: [
      { key: "view_analytics", label: "View analytics", description: "See platform-wide stats and dashboards." },
    ],
  },
]

const ALL_PERMISSION_KEYS = PERMISSION_CATALOG.flatMap((g) => g.permissions.map((p) => p.key))
const PERMISSION_LABELS: Record<string, string> = Object.fromEntries(
  PERMISSION_CATALOG.flatMap((g) => g.permissions.map((p) => [p.key, p.label])),
)

// Fallback built-in roles shown when the API hasn't been restarted yet or the
// settings row hasn't been seeded. Keeps the page useful instead of empty.
const DEFAULT_BUILTIN_ROLES: Record<string, string[]> = {
  superadmin: ["*"],
  "content-manager": ["manage_events", "approve_events", "view_reports"],
  "event-manager": ["manage_events", "manage_payouts", "view_analytics"],
  moderator: ["approve_events", "ban_users", "view_reports"],
  organizer: ["manage_events"],
  user: [],
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { user: currentUser } = useAuth()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [section, setSection] = useState<SectionId>("roles")
  const [resetting, setResetting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  // Features working copy
  const [features, setFeatures] = useState<Settings["features"]>({
    enableUserRegistration: true,
    enableEvents: true,
    requireEmailVerification: false,
    enableNotifications: true,
    maintenanceMode: false,
  })

  // Custom-role form
  const [newRoleName, setNewRoleName] = useState("")
  const [newRoleDescription, setNewRoleDescription] = useState("")
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([])
  const [creatingRole, setCreatingRole] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getSettings()
      const data = response.data.data as Settings
      setSettings(data)
      setFeatures({
        enableUserRegistration: data.features?.enableUserRegistration ?? true,
        enableEvents: data.features?.enableEvents ?? true,
        requireEmailVerification: data.features?.requireEmailVerification ?? false,
        enableNotifications: data.features?.enableNotifications ?? true,
        maintenanceMode: data.features?.maintenanceMode ?? false,
      })
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load settings")
    } finally {
      setLoading(false)
    }
  }

  const featuresDirty = useMemo(() => {
    if (!settings) return false
    return JSON.stringify(features) !== JSON.stringify(featuresFromSettings(settings))
  }, [features, settings])

  const handleSaveFeatures = async () => {
    try {
      setSaving(true)
      await adminAPI.updateFeatures(features)
      toast.success("Feature settings saved")
      fetchSettings()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleCreateCustomRole = async () => {
    if (!newRoleName.trim() || newRolePermissions.length === 0) {
      toast.error("Provide a role name and at least one permission")
      return
    }
    try {
      setCreatingRole(true)
      await adminAPI.createCustomRole({
        name: newRoleName.trim(),
        permissions: newRolePermissions,
        description: newRoleDescription.trim(),
      })
      toast.success("Custom role created")
      setNewRoleName("")
      setNewRoleDescription("")
      setNewRolePermissions([])
      fetchSettings()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create role")
    } finally {
      setCreatingRole(false)
    }
  }

  const handleDeleteCustomRole = async (name: string) => {
    if (!confirm(`Delete the custom role "${name}"?`)) return
    try {
      await adminAPI.deleteCustomRole(name)
      toast.success("Custom role deleted")
      fetchSettings()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete role")
    }
  }

  const handleAddAssignment = async (roleName: string, email: string) => {
    try {
      const res = await adminAPI.addRoleAssignment(roleName, email)
      setSettings(res.data.data as Settings)
      toast.success(`${email} added to ${roleName}`)
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to assign email")
    }
  }

  const handleRemoveAssignment = async (roleName: string, email: string) => {
    try {
      const res = await adminAPI.removeRoleAssignment(roleName, email)
      setSettings(res.data.data as Settings)
      toast.success(`${email} removed from ${roleName}`)
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to remove assignment")
    }
  }

  const handleReset = async () => {
    try {
      setResetting(true)
      await adminAPI.resetSettings()
      toast.success("Settings reset to defaults")
      setConfirmReset(false)
      fetchSettings()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to reset")
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={["superadmin"]}>
        <AdminLayout user={currentUser || undefined}>
          <PageLoader />
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requiredRoles={["superadmin"]}>
      <AdminLayout user={currentUser || undefined}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <SettingsIcon className="h-8 w-8 text-primary" />
                Settings
              </h1>
              <p className="text-muted-foreground mt-1">
                Configure platform features and access control.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-2 self-start rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to defaults
            </button>
          </div>

          {/* Maintenance banner */}
          {features.maintenanceMode && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
              <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-sm">
                <p className="font-semibold text-amber-900 dark:text-amber-200">Maintenance mode is ON</p>
                <p className="text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                  The public site shows a maintenance page. Admin panel is unaffected.
                </p>
              </div>
            </div>
          )}

          {/* Sidebar + content layout */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
            <aside className="lg:sticky lg:top-20 lg:self-start">
              <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 lg:flex-col lg:overflow-visible">
                <SectionNav
                  icon={Shield}
                  label="Roles & Access"
                  hint="Permissions & custom roles"
                  active={section === "roles"}
                  onClick={() => setSection("roles")}
                />
                <SectionNav
                  icon={ToggleLeft}
                  label="Features"
                  hint="Toggle platform modules"
                  active={section === "features"}
                  dirty={featuresDirty}
                  onClick={() => setSection("features")}
                />
              </nav>
            </aside>

            <div className="min-w-0 space-y-6">
              {section === "roles" && (
                <RolesSection
                  settings={settings}
                  newRoleName={newRoleName}
                  newRoleDescription={newRoleDescription}
                  newRolePermissions={newRolePermissions}
                  setNewRoleName={setNewRoleName}
                  setNewRoleDescription={setNewRoleDescription}
                  setNewRolePermissions={setNewRolePermissions}
                  onCreate={handleCreateCustomRole}
                  onDelete={handleDeleteCustomRole}
                  creating={creatingRole}
                  onAddAssignment={handleAddAssignment}
                  onRemoveAssignment={handleRemoveAssignment}
                />
              )}

              {section === "features" && (
                <FeaturesSection
                  features={features}
                  onChange={setFeatures}
                  onSave={handleSaveFeatures}
                  dirty={featuresDirty}
                  saving={saving}
                />
              )}
            </div>
          </div>
        </div>

        {/* Reset modal */}
        {confirmReset && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => !resetting && setConfirmReset(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Reset all settings?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This restores feature flags and roles to their factory defaults. Custom roles
                    you&rsquo;ve created will be removed. This can&rsquo;t be undone.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  disabled={resetting}
                  className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={resetting}
                  className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 transition disabled:opacity-50"
                >
                  {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Reset everything
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  )
}

// ---------------------------------------------------------------------------
// Roles & Access section
// ---------------------------------------------------------------------------

function RolesSection({
  settings,
  newRoleName,
  newRoleDescription,
  newRolePermissions,
  setNewRoleName,
  setNewRoleDescription,
  setNewRolePermissions,
  onCreate,
  onDelete,
  creating,
  onAddAssignment,
  onRemoveAssignment,
}: {
  settings: Settings | null
  newRoleName: string
  newRoleDescription: string
  newRolePermissions: string[]
  setNewRoleName: (v: string) => void
  setNewRoleDescription: (v: string) => void
  setNewRolePermissions: (v: string[]) => void
  onCreate: () => void
  onDelete: (name: string) => void
  creating: boolean
  onAddAssignment: (roleName: string, email: string) => Promise<void>
  onRemoveAssignment: (roleName: string, email: string) => Promise<void>
}) {
  const [query, setQuery] = useState("")

  const togglePerm = (perm: string) => {
    if (newRolePermissions.includes(perm)) {
      setNewRolePermissions(newRolePermissions.filter((p) => p !== perm))
    } else {
      setNewRolePermissions([...newRolePermissions, perm])
    }
  }

  const selectAllInGroup = (groupPerms: string[]) => {
    const missing = groupPerms.filter((p) => !newRolePermissions.includes(p))
    if (missing.length > 0) {
      setNewRolePermissions([...newRolePermissions, ...missing])
    } else {
      setNewRolePermissions(newRolePermissions.filter((p) => !groupPerms.includes(p)))
    }
  }

  // Defensive fallbacks: when the API is unreachable, returns the legacy
  // flat shape, or hasn't been seeded, render the section against defaults
  // instead of going blank.
  const permissionsMap =
    settings?.roles?.permissions && Object.keys(settings.roles.permissions).length > 0
      ? settings.roles.permissions
      : DEFAULT_BUILTIN_ROLES
  const builtInRoles = Object.entries(permissionsMap)
  const customRoles = Array.isArray(settings?.roles?.customRoles) ? settings.roles.customRoles : []
  const assignments =
    settings?.roles?.assignments && typeof settings.roles.assignments === "object"
      ? settings.roles.assignments
      : {}

  // Flat list of every role name (built-in + custom) so we can show one
  // assignment panel per role and let admins pick from a single source.
  const allRoleNames = [
    ...builtInRoles.map(([name]) => name),
    ...customRoles.map((r) => r.name),
  ]

  const totalAssigned = Object.values(assignments).reduce(
    (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
    0,
  )

  // Stats strip
  const stats = {
    builtIn: builtInRoles.length,
    custom: customRoles.length,
    assigned: totalAssigned,
  }

  return (
    <div className="space-y-6">
      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={ShieldAlert} label="Built-in roles" value={stats.builtIn} hint="Cannot be deleted" />
        <StatCard icon={Shield} label="Custom roles" value={stats.custom} hint="Created by you" />
        <StatCard icon={Check} label="Permissions" value={ALL_PERMISSION_KEYS.length} hint="Available to assign" />
        <StatCard icon={Users} label="Assigned emails" value={stats.assigned} hint="Across all roles" />
      </div>

      {/* Team access — email -> role assignments */}
      <SectionCard
        title="Team access"
        description="Add a team member's Gmail to a role. They'll get the role's permissions the next time they log in."
      >
        <div className="space-y-3">
          {allRoleNames.map((roleName) => (
            <RoleAssignmentRow
              key={roleName}
              roleName={roleName}
              emails={assignments[roleName] || []}
              onAdd={(email) => onAddAssignment(roleName, email)}
              onRemove={(email) => onRemoveAssignment(roleName, email)}
            />
          ))}
        </div>
      </SectionCard>

      {/* Built-in roles */}
      <SectionCard
        title="Built-in roles"
        description="Default roles shipped with the platform. Permissions are managed in code."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {builtInRoles.map(([role, permissions]) => {
            const isAll = permissions[0] === "*"
            return (
              <div
                key={role}
                className="group rounded-xl border border-border bg-muted/30 p-4 transition-colors hover:border-primary/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold capitalize text-foreground">{role.replace(/-/g, " ")}</h4>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      isAll ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isAll ? "Full access" : `${permissions.length} perms`}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {isAll ? (
                    <span className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
                      All permissions
                    </span>
                  ) : permissions.length === 0 ? (
                    <span className="text-xs italic text-muted-foreground">No permissions</span>
                  ) : (
                    permissions.map((p) => (
                      <span
                        key={p}
                        title={p}
                        className="rounded-md bg-background px-2 py-1 text-xs text-foreground/80 ring-1 ring-border"
                      >
                        {PERMISSION_LABELS[p] || p.replace(/_/g, " ")}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </SectionCard>

      {/* Custom roles list */}
      <SectionCard
        title="Custom roles"
        description="Combine permissions to create roles tailored to your team's workflow."
      >
        {customRoles.length === 0 ? (
          <EmptyCustomRoles />
        ) : (
          <div className="space-y-2">
            {customRoles.map((role) => (
              <CustomRoleRow key={role.name} role={role} onDelete={() => onDelete(role.name)} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Create custom role */}
      <SectionCard
        title="Create a custom role"
        description={`${newRolePermissions.length} of ${ALL_PERMISSION_KEYS.length} permissions selected.`}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Role name" required>
            <Input value={newRoleName} onChange={setNewRoleName} placeholder="e.g. Finance auditor" />
          </Field>
          <Field label="Description" hint="Optional — appears in the role list.">
            <Input
              value={newRoleDescription}
              onChange={setNewRoleDescription}
              placeholder="What is this role for?"
            />
          </Field>
        </div>

        {/* Search permissions */}
        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">Permissions</p>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search permissions"
                className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Grouped permissions */}
          <div className="mt-3 space-y-3">
            {PERMISSION_CATALOG.map((group) => {
              const filtered = group.permissions.filter((p) =>
                query
                  ? p.label.toLowerCase().includes(query.toLowerCase()) ||
                    p.description.toLowerCase().includes(query.toLowerCase()) ||
                    p.key.toLowerCase().includes(query.toLowerCase())
                  : true,
              )
              if (filtered.length === 0) return null
              const groupKeys = group.permissions.map((p) => p.key)
              const allSelected = groupKeys.every((k) => newRolePermissions.includes(k))
              const someSelected = groupKeys.some((k) => newRolePermissions.includes(k))

              return (
                <div key={group.group} className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <group.icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                        {group.group}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectAllInGroup(groupKeys)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {allSelected ? "Clear all" : someSelected ? "Select all" : "Select all"}
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {filtered.map((p) => {
                      const on = newRolePermissions.includes(p.key)
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => togglePerm(p.key)}
                          className={`group flex items-start gap-2.5 rounded-lg border p-3 text-left transition ${
                            on
                              ? "border-primary/40 bg-primary/5"
                              : "border-border bg-background hover:border-primary/30"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                              on
                                ? "bg-primary text-primary-foreground"
                                : "border border-input bg-background"
                            }`}
                          >
                            {on && <Check className="h-3 w-3" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-foreground">{p.label}</span>
                            <span className="block text-xs text-muted-foreground">{p.description}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-2 border-t border-border pt-4">
          {(newRoleName || newRoleDescription || newRolePermissions.length > 0) && (
            <button
              type="button"
              onClick={() => {
                setNewRoleName("")
                setNewRoleDescription("")
                setNewRolePermissions([])
              }}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onCreate}
            disabled={!newRoleName.trim() || newRolePermissions.length === 0 || creating}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {creating ? "Creating…" : "Create role"}
          </button>
        </div>
      </SectionCard>
    </div>
  )
}

function CustomRoleRow({ role, onDelete }: { role: CustomRole; onDelete: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-foreground">{role.name}</h4>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Custom
          </span>
        </div>
        {role.description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{role.description}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {role.permissions.map((p) => (
            <span
              key={p}
              title={p}
              className="rounded-md bg-background px-2 py-1 text-xs text-foreground/80 ring-1 ring-border"
            >
              {PERMISSION_LABELS[p] || p.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${role.name}`}
        className="rounded-md p-2 text-destructive hover:bg-destructive/10 transition"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

function EmptyCustomRoles() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/10 p-8 text-center">
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Shield className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-foreground">No custom roles yet</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Use the form below to create your first one.
      </p>
    </div>
  )
}

function RoleAssignmentRow({
  roleName,
  emails,
  onAdd,
  onRemove,
}: {
  roleName: string
  emails: string[]
  onAdd: (email: string) => Promise<void>
  onRemove: (email: string) => Promise<void>
}) {
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const value = input.trim()
    if (!value) return
    setBusy(true)
    try {
      await onAdd(value)
      setInput("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Shield className="h-3.5 w-3.5" />
          </span>
          <h4 className="truncate text-sm font-semibold capitalize text-foreground">
            {roleName.replace(/-/g, " ")}
          </h4>
        </div>
        <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border">
          {emails.length} {emails.length === 1 ? "email" : "emails"}
        </span>
      </div>

      {/* Email chips */}
      {emails.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {emails.map((email) => (
            <span
              key={email}
              className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-xs text-foreground ring-1 ring-border"
            >
              {email}
              <button
                type="button"
                onClick={() => onRemove(email)}
                aria-label={`Remove ${email}`}
                className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add form */}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="teammate@gmail.com"
          aria-label={`Add email to ${roleName}`}
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!input.trim() || busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Features section
// ---------------------------------------------------------------------------

function FeaturesSection({
  features,
  onChange,
  onSave,
  dirty,
  saving,
}: {
  features: Settings["features"]
  onChange: (next: Settings["features"]) => void
  onSave: () => void
  dirty: boolean
  saving: boolean
}) {
  const set = <K extends keyof Settings["features"]>(key: K, value: Settings["features"][K]) =>
    onChange({ ...features, [key]: value })

  return (
    <div className="space-y-6">
      <SectionCard
        title="Platform features"
        description="Toggle behaviour for the public site and signup flow."
        footer={<SaveBar dirty={dirty} saving={saving} onSave={onSave} />}
      >
        <div className="space-y-3">
          <ToggleRow
            title="User registration"
            description="Allow new users to sign up. Turn off to temporarily close registration."
            checked={features.enableUserRegistration}
            onChange={(v) => set("enableUserRegistration", v)}
          />
          <ToggleRow
            title="Events"
            description="Master switch for organizer event listings. Disabling hides all events."
            checked={features.enableEvents}
            onChange={(v) => set("enableEvents", v)}
          />
          <ToggleRow
            title="Email verification required"
            description="New users must verify their email before they can purchase tickets."
            checked={features.requireEmailVerification}
            onChange={(v) => set("requireEmailVerification", v)}
          />
          <ToggleRow
            title="Notifications"
            description="Send transactional emails (purchase confirmations, approvals, etc.)."
            checked={features.enableNotifications}
            onChange={(v) => set("enableNotifications", v)}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Danger zone"
        description="Operational controls that affect the whole platform."
        variant="danger"
      >
        <div
          className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
            features.maintenanceMode
              ? "border-amber-500/40 bg-amber-500/10"
              : "border-border bg-muted/30"
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                features.maintenanceMode
                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Wrench className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-foreground">Maintenance mode</p>
              <p className="text-sm text-muted-foreground">
                Replaces the public site with a maintenance page. The admin panel keeps working.
              </p>
            </div>
          </div>
          <Switch
            checked={features.maintenanceMode}
            onChange={(v) => set("maintenanceMode", v)}
            label="Maintenance mode"
          />
        </div>
      </SectionCard>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function featuresFromSettings(s: Settings): Settings["features"] {
  return {
    enableUserRegistration: s.features?.enableUserRegistration ?? true,
    enableEvents: s.features?.enableEvents ?? true,
    requireEmailVerification: s.features?.requireEmailVerification ?? false,
    enableNotifications: s.features?.enableNotifications ?? true,
    maintenanceMode: s.features?.maintenanceMode ?? false,
  }
}

// ---------------------------------------------------------------------------
// UI primitives
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: any
  label: string
  value: number
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-xl font-bold text-foreground">{value}</p>
        </div>
      </div>
      {hint && <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function SectionNav({
  icon: Icon,
  label,
  hint,
  active,
  dirty,
  onClick,
}: {
  icon: any
  label: string
  hint?: string
  active: boolean
  dirty?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
      }`}
    >
      <span
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
          active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground group-hover:text-foreground"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-medium">
          {label}
          {dirty && (
            <span
              title="Unsaved changes"
              aria-label="Unsaved changes"
              className="h-1.5 w-1.5 rounded-full bg-amber-500"
            />
          )}
        </span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
    </button>
  )
}

function SectionCard({
  title,
  description,
  children,
  footer,
  variant = "default",
}: {
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  variant?: "default" | "danger"
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border bg-card ${
        variant === "danger" ? "border-destructive/30" : "border-border"
      }`}
    >
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </header>
      <div className="px-6 py-5">{children}</div>
      {footer && (
        <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/30 px-6 py-3">
          {footer}
        </div>
      )}
    </section>
  )
}

function SaveBar({ dirty, saving, onSave }: { dirty: boolean; saving: boolean; onSave: () => void }) {
  return (
    <>
      <span className="text-xs text-muted-foreground">
        {dirty ? "You have unsaved changes." : "All changes saved."}
      </span>
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || saving}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? "Saving…" : "Save changes"}
      </button>
    </>
  )
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 p-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  )
}

function Switch({
  checked,
  onChange,
  label = "Toggle",
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  // Native checkbox styled as a switch — the input handles aria-checked
  // implicitly so we avoid the jsx-a11y/aria-proptypes literal-value rule.
  return (
    <label
      title={label}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-muted ring-1 ring-border"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="sr-only"
      />
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </label>
  )
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  )
}

function Input({
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    />
  )
}
