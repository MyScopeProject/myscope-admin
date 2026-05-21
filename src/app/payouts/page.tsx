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
  X,
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
  { key: "requested", label: "Requested" },
  { key: "approved", label: "Approved" },
  { key: "paid", label: "Paid" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
]

interface OrganizerOption {
  id: string
  name?: string | null
  email?: string | null
}

interface BalanceInfo {
  gross: number
  fee: number
  net: number
  refunded: number
  paid_out: number
  pending: number
  platform_fee_pct: number
}

const STATUS_BADGE: Record<Status, { label: string; cls: string; icon: React.ReactNode }> = {
  requested: { label: "Requested", cls: "bg-muted text-muted-foreground", icon: <Clock className="w-3.5 h-3.5" /> },
  approved: { label: "Approved", cls: "bg-primary/15 text-primary", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  paid: { label: "Paid", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", icon: <Banknote className="w-3.5 h-3.5" /> },
  rejected: { label: "Rejected", cls: "bg-destructive/15 text-destructive", icon: <XCircle className="w-3.5 h-3.5" /> },
}

export default function PayoutsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Status | "all">("requested")
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  // New-payout modal
  const [createOpen, setCreateOpen] = useState(false)
  const [organizers, setOrganizers] = useState<OrganizerOption[]>([])
  const [selectedOrg, setSelectedOrg] = useState("")
  const [orgBalance, setOrgBalance] = useState<BalanceInfo | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [createAmount, setCreateAmount] = useState("")
  const [createNotes, setCreateNotes] = useState("")
  const [creating, setCreating] = useState(false)

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

  const approve = async (id: string) => {
    setPendingId(id)
    try {
      await adminAPI.approvePayout(id)
      toast.success("Payout approved.")
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed.")
    } finally {
      setPendingId(null)
    }
  }

  const openCreate = async () => {
    setCreateOpen(true)
    setSelectedOrg("")
    setOrgBalance(null)
    setCreateAmount("")
    setCreateNotes("")
    if (organizers.length === 0) {
      try {
        const res = await adminAPI.getUsers({ role: "organizer", limit: 200 })
        setOrganizers(res.data?.data?.users ?? res.data?.data ?? [])
      } catch {
        toast.error("Couldn't load organizers.")
      }
    }
  }

  const onSelectOrg = async (id: string) => {
    setSelectedOrg(id)
    setOrgBalance(null)
    setCreateAmount("")
    if (!id) return
    setBalanceLoading(true)
    try {
      const res = await adminAPI.getOrganizerBalance(id)
      const bal = res.data?.data?.balance as BalanceInfo
      setOrgBalance(bal)
      setCreateAmount(bal ? String(bal.pending) : "")
    } catch {
      toast.error("Couldn't load balance.")
    } finally {
      setBalanceLoading(false)
    }
  }

  const submitCreate = async () => {
    const amount = Number(createAmount)
    if (!selectedOrg) { toast.error("Pick an organizer."); return }
    if (!Number.isFinite(amount) || amount <= 0) { toast.error("Invalid amount."); return }
    if (orgBalance && amount > orgBalance.pending) {
      toast.error(`Amount exceeds available balance (LKR ${orgBalance.pending.toLocaleString()}).`)
      return
    }
    setCreating(true)
    try {
      await adminAPI.createPayout({ organizer_id: selectedOrg, amount, notes: createNotes.trim() || undefined })
      toast.success("Payout created.")
      setCreateOpen(false)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed.")
    } finally {
      setCreating(false)
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
              onClick={openCreate}
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
                          {p.status === "requested" && (
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => approve(p.id)}
                                disabled={pendingId === p.id}
                                className="px-2 py-1 rounded text-xs bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-50"
                              >
                                {pendingId === p.id ? <Loader className="w-3 h-3 animate-spin" /> : "Approve"}
                              </button>
                              <button
                                type="button"
                                onClick={() => reject(p.id)}
                                disabled={pendingId === p.id}
                                className="px-2 py-1 rounded text-xs bg-destructive/15 text-destructive hover:bg-destructive/25 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                          {p.status === "approved" && (
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => markPaid(p.id)}
                                disabled={pendingId === p.id}
                                className="px-2 py-1 rounded text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50"
                              >
                                {pendingId === p.id ? <Loader className="w-3 h-3 animate-spin" /> : "Mark paid"}
                              </button>
                              <button
                                type="button"
                                onClick={() => reject(p.id)}
                                disabled={pendingId === p.id}
                                className="px-2 py-1 rounded text-xs bg-destructive/15 text-destructive hover:bg-destructive/25 disabled:opacity-50"
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

        {/* New payout modal */}
        {createOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => !creating && setCreateOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">New payout</h2>
                <button type="button" onClick={() => setCreateOpen(false)} aria-label="Close" title="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="org" className="mb-1.5 block text-sm font-medium text-foreground">Organizer</label>
                  <select
                    id="org"
                    value={selectedOrg}
                    onChange={(e) => onSelectOrg(e.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select an organizer…</option>
                    {organizers.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name || "(no name)"}{o.email ? ` — ${o.email}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedOrg && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                    {balanceLoading ? (
                      <span className="inline-flex items-center gap-2 text-muted-foreground">
                        <Loader className="h-3.5 w-3.5 animate-spin" /> Loading balance…
                      </span>
                    ) : orgBalance ? (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Available to pay out</span>
                        <span className="font-semibold text-foreground">LKR {orgBalance.pending.toLocaleString()}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No balance data.</span>
                    )}
                  </div>
                )}

                <div>
                  <label htmlFor="amt" className="mb-1.5 block text-sm font-medium text-foreground">Amount (LKR)</label>
                  <input
                    id="amt"
                    type="number"
                    min={1}
                    max={orgBalance?.pending}
                    value={createAmount}
                    onChange={(e) => setCreateAmount(e.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-foreground">Notes (optional)</label>
                  <input
                    id="notes"
                    type="text"
                    value={createNotes}
                    onChange={(e) => setCreateNotes(e.target.value)}
                    placeholder="Internal note"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setCreateOpen(false)} disabled={creating} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitCreate}
                  disabled={creating || !selectedOrg}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {creating ? <Loader className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                  Create payout
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  )
}
