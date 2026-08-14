"use client"

// Full user profile page — replaces the old bare-fields modal. Fetches the
// user's activity (event bookings + shop orders) alongside the base profile
// so an admin can see everything relevant to one account in one place.

import Image from "next/image"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import { adminAPI } from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  CalendarDays,
  CheckCircle2,
  IdCard,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  ShieldAlert,
  Ticket,
  XCircle,
} from "lucide-react"

interface UserDetail {
  id: string
  name: string
  email: string
  role: string
  status?: string
  phone?: string | null
  phone_verified?: boolean
  city?: string | null
  nic?: string | null
  profile_image?: string | null
  provider?: string
  created_at: string
}

interface BookingRow {
  id: string
  booking_reference: string
  status: string
  payment_status: string
  number_of_tickets: number
  total_amount: number | string
  created_at: string
  event: { id: string; title: string; start_time: string | null; venue_name: string | null }
}

interface ShopOrderRow {
  id: string
  order_reference: string
  status: string
  payment_status: string
  total_amount: number | string
  created_at: string
}

function formatMoney(amount: number | string) {
  const n = Number(amount) || 0
  return `LKR ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function UserDetailPage() {
  const params = useParams<{ id: string }>()
  const userId = params?.id as string
  const { user: currentUser } = useAuth()

  const [user, setUser] = useState<UserDetail | null>(null)
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [shopOrders, setShopOrders] = useState<ShopOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({ name: "", email: "", role: "user" })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminAPI.getUserActivity(userId)
      const d = res.data?.data
      setUser(d?.user ?? null)
      setBookings(d?.bookings ?? [])
      setShopOrders(d?.shopOrders ?? [])
      setFormData({ name: d?.user?.name || "", email: d?.user?.email || "", role: d?.user?.role || "user" })
      setError(null)
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(message || "Failed to load user")
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  const isSelf = !!currentUser?.id && currentUser.id === userId

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await adminAPI.updateUser(userId, formData)
      toast.success("User updated successfully")
      setEditing(false)
      load()
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(message || "Update failed")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={["superadmin", "content-manager"]}>
        <AdminLayout user={currentUser || undefined}><PageLoader /></AdminLayout>
      </ProtectedRoute>
    )
  }

  if (error || !user) {
    return (
      <ProtectedRoute requiredRoles={["superadmin", "content-manager"]}>
        <AdminLayout user={currentUser || undefined}>
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <ShieldAlert className="h-10 w-10 text-destructive" />
            <h2 className="text-xl font-semibold">User not found</h2>
            <p className="text-muted-foreground">{error}</p>
            <Link href="/users" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" /> Back to users
            </Link>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requiredRoles={["superadmin", "content-manager"]}>
      <AdminLayout user={currentUser || undefined}>
        <div className="max-w-5xl space-y-6">
          <Link href="/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to users
          </Link>

          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-primary/10">
                {user.profile_image ? (
                  <Image src={user.profile_image} alt={user.name} width={64} height={64} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-primary text-primary-foreground text-xl font-semibold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{user.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full capitalize ${roleBadgeClass(user.role)}`}>
                    {user.role.replace("-", " ")}
                  </span>
                  {user.status === "banned" ? (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-destructive/10 text-destructive">
                      <XCircle className="mr-1 h-3 w-3" /> Banned
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Active
                    </span>
                  )}
                </div>
              </div>
            </div>
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                <Pencil className="h-4 w-4" /> Edit name / email / role
              </button>
            )}
          </div>

          {editing ? (
            <div className="rounded-2xl border border-border bg-card p-5">
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    disabled={isSelf}
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                  >
                    <option value="user">User</option>
                    <option value="organizer">Organizer</option>
                    <option value="scanner">Scanner</option>
                    <option value="moderator">Moderator</option>
                    <option value="support">Support</option>
                    <option value="content-manager">Content Manager</option>
                    <option value="event-manager">Event Manager</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                  {isSelf && (
                    <p className="text-xs text-muted-foreground mt-1">You can&apos;t change your own role.</p>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false)
                      setFormData({ name: user.name || "", email: user.email || "", role: user.role })
                    }}
                    className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:opacity-90 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <DetailRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={user.email} />
                <DetailRow
                  icon={<Phone className="h-3.5 w-3.5" />}
                  label="Phone"
                  value={user.phone || null}
                  badge={user.phone ? (
                    user.phone_verified ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <BadgeCheck className="h-3 w-3" /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        <ShieldAlert className="h-3 w-3" /> Not verified
                      </span>
                    )
                  ) : undefined}
                />
                <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="City" value={user.city || null} />
                <DetailRow icon={<IdCard className="h-3.5 w-3.5" />} label="NIC / Passport" value={user.nic || null} />
                <DetailRow
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Joined"
                  value={user.created_at ? new Date(user.created_at).toLocaleDateString() : null}
                />
                <DetailRow
                  icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  label="Sign-in method"
                  value={user.provider === "google" ? "Google" : "Email & password"}
                />
              </div>
            </div>
          )}

          {/* Booked events */}
          <section className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Ticket className="h-4 w-4 text-primary" /> Booked events
                <span className="text-xs font-normal text-muted-foreground">({bookings.length})</span>
              </h2>
            </div>
            {bookings.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No event bookings yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">Event</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">Tickets</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">Amount</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">Booked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {bookings.map((b) => (
                      <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/events/${b.event.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                            {b.event.title}
                          </Link>
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays className="h-3 w-3 shrink-0" />
                            {b.event.start_time ? new Date(b.event.start_time).toLocaleDateString() : "—"}
                            {b.event.venue_name ? ` · ${b.event.venue_name}` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{b.number_of_tickets}</td>
                        <td className="px-4 py-3 text-foreground">{formatMoney(b.total_amount)}</td>
                        <td className="px-4 py-3">
                          <StatusPill status={b.status} paymentStatus={b.payment_status} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Shop orders */}
          <section className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Package className="h-4 w-4 text-primary" /> Shop orders
                <span className="text-xs font-normal text-muted-foreground">({shopOrders.length})</span>
              </h2>
            </div>
            {shopOrders.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No shop orders yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">Order</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">Amount</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">Placed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {shopOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{o.order_reference}</td>
                        <td className="px-4 py-3 text-foreground">{formatMoney(o.total_amount)}</td>
                        <td className="px-4 py-3">
                          <StatusPill status={o.status} paymentStatus={o.payment_status} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}

function DetailRow({
  icon,
  label,
  value,
  badge,
}: {
  icon: React.ReactNode
  label: string
  value: string | null | undefined
  badge?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2 text-muted-foreground">
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide">{label}</div>
        <div className="text-foreground truncate">{value || "—"}</div>
        {badge}
      </div>
    </div>
  )
}

function StatusPill({ status, paymentStatus }: { status: string; paymentStatus: string }) {
  const s = (status || "").toLowerCase()
  const tone =
    s === "confirmed" || s === "completed" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : s === "cancelled" || s === "failed" ? "bg-destructive/10 text-destructive"
    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`inline-flex w-fit items-center px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${tone}`}>
        {status}
      </span>
      {paymentStatus && paymentStatus.toLowerCase() !== status?.toLowerCase() && (
        <span className="text-[11px] text-muted-foreground">Payment: {paymentStatus}</span>
      )}
    </div>
  )
}

function roleBadgeClass(role: string): string {
  switch (role) {
    case "superadmin":       return "bg-primary/15 text-primary"
    case "event-manager":    return "bg-sky-500/10 text-sky-600 dark:text-sky-400"
    case "content-manager":  return "bg-violet-500/10 text-violet-600 dark:text-violet-400"
    case "support":          return "bg-teal-500/10 text-teal-600 dark:text-teal-400"
    case "moderator":        return "bg-amber-500/10 text-amber-600 dark:text-amber-400"
    case "organizer":        return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
    case "scanner":          return "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
    default:                 return "bg-muted text-muted-foreground"
  }
}
