"use client"

import { useEffect, useState } from "react"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import { ErrorMessage, EmptyState } from "@/components/ui/error-message"
import { adminAPI } from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import {
  Banknote,
  CheckCircle2,
  Clock,
  Loader,
  XCircle,
} from "lucide-react"

type Status = "requested" | "approved" | "paid" | "rejected"

interface Payout {
  id: string
  amount: number | string
  status: Status
  notes: string | null
  event_id: string | null
  event?: { id: string; title: string } | null
  organizer_id: string
  organizer?: { id: string; name: string; email: string } | null
  requested_at: string
  processed_at: string | null
}

const TABS: { key: Status | "all"; label: string }[] = [
  { key: "approved", label: "Approved" },
  { key: "paid", label: "Paid" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
]

const STATUS_BADGE: Record<Status, { label: string; cls: string; icon: React.ReactNode }> = {
  requested: { label: "Requested", cls: "bg-gray-500/15 text-gray-400", icon: <Clock className="w-3.5 h-3.5" /> },
  approved: { label: "Approved", cls: "bg-purple-500/15 text-purple-400", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  paid: { label: "Paid", cls: "bg-green-500/15 text-green-500", icon: <Banknote className="w-3.5 h-3.5" /> },
  rejected: { label: "Rejected", cls: "bg-red-500/15 text-red-500", icon: <XCircle className="w-3.5 h-3.5" /> },
}

export default function PayoutsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Status | "all">("approved")
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await adminAPI.getPayouts(tab === "all" ? undefined : tab)
      setPayouts(res.data?.data?.payouts ?? [])
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load payouts.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab])

  const markPaid = async (id: string) => {
    const ref = prompt("Bank transfer reference (optional):") ?? undefined
    setPendingId(id)
    try {
      await adminAPI.markPayoutPaid(id, ref || undefined)
      toast.success("Payout marked as paid.")
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed.")
    } finally {
      setPendingId(null)
    }
  }

  const reject = async (id: string) => {
    const reason = prompt("Reason for rejecting this payout:")
    if (!reason?.trim()) return
    setPendingId(id)
    try {
      await adminAPI.rejectPayout(id, reason.trim())
      toast.success("Payout rejected.")
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed.")
    } finally {
      setPendingId(null)
    }
  }

  const allocate = async () => {
    const organizerId = prompt("Organizer user ID:")
    if (!organizerId?.trim()) return
    const amountStr = prompt("Amount (LKR):")
    const amount = Number(amountStr)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Invalid amount.")
      return
    }
    const notes = prompt("Notes (optional):") ?? undefined
    try {
      await adminAPI.createPayout({ organizer_id: organizerId.trim(), amount, notes: notes || undefined })
      toast.success("Payout created.")
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed.")
    }
  }

  return (
    <ProtectedRoute>
      <AdminLayout user={user ?? undefined}>
        <div className="p-6 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Payouts</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Allocate organizer earnings and mark bank transfers as paid.
              </p>
            </div>
            <button
              type="button"
              onClick={allocate}
              className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              <Banknote className="w-4 h-4" /> New payout
            </button>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-border pb-2">
            {TABS.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm rounded-md transition-colors ${
                  tab === t.key
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <PageLoader />
          ) : error ? (
            <div className="space-y-2">
              <ErrorMessage message={error} />
              <button
                type="button"
                onClick={load}
                className="text-xs text-primary hover:underline"
              >
                Retry
              </button>
            </div>
          ) : payouts.length === 0 ? (
            <EmptyState
              title="No payouts found"
              description="When admins allocate payouts to organizers, they show up here."
              icon={Banknote}
            />
          ) : (
            <div className="rounded-xl border border-border overflow-x-auto bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    {["Date", "Organizer", "Event", "Amount", "Status", "Notes", "Actions"].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payouts.map(p => {
                    const meta = STATUS_BADGE[p.status]
                    return (
                      <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-3 text-muted-foreground">{new Date(p.requested_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{p.organizer?.name ?? p.organizer_id.slice(0, 8)}</div>
                          <div className="text-xs text-muted-foreground">{p.organizer?.email}</div>
                        </td>
                        <td className="px-4 py-3">{p.event?.title ?? "—"}</td>
                        <td className="px-4 py-3 font-semibold">LKR {Number(p.amount).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${meta.cls}`}>
                            {meta.icon} {meta.label}
                          </span>
                          {p.processed_at && (
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {new Date(p.processed_at).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate" title={p.notes ?? ""}>{p.notes ?? "—"}</td>
                        <td className="px-4 py-3">
                          {p.status === "approved" && (
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => markPaid(p.id)}
                                disabled={pendingId === p.id}
                                className="px-2 py-1 rounded text-xs bg-green-500/15 text-green-500 hover:bg-green-500/25 disabled:opacity-50"
                              >
                                {pendingId === p.id ? <Loader className="w-3 h-3 animate-spin" /> : "Mark paid"}
                              </button>
                              <button
                                type="button"
                                onClick={() => reject(p.id)}
                                disabled={pendingId === p.id}
                                className="px-2 py-1 rounded text-xs bg-red-500/15 text-red-500 hover:bg-red-500/25 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}
