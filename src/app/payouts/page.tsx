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
  slip_url?: string | null
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
  const [selected, setSelected] = useState<Payout | null>(null)

  // New-payout modal
  const [createOpen, setCreateOpen] = useState(false)
  const [organizers, setOrganizers] = useState<OrganizerOption[]>([])
  const [selectedOrg, setSelectedOrg] = useState("")
  const [orgBalance, setOrgBalance] = useState<BalanceInfo | null>(null)
  const [orgEvents, setOrgEvents] = useState<{ id: string; title: string }[]>([])
  const [createEvent, setCreateEvent] = useState("")
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

  // Mark-paid modal (bank ref + payment-slip image)
  const [payTarget, setPayTarget] = useState<Payout | null>(null)
  const [payReference, setPayReference] = useState("")
  const [paySlipFile, setPaySlipFile] = useState<File | null>(null)
  const [paySlipPreview, setPaySlipPreview] = useState("")
  const [paySaving, setPaySaving] = useState(false)

  const openPay = (p: Payout) => {
    setSelected(null)
    setPayTarget(p)
    setPayReference("")
    setPaySlipFile(null)
    setPaySlipPreview("")
  }

  const onPickSlip = (file: File | null) => {
    setPaySlipFile(file)
    setPaySlipPreview(file ? URL.createObjectURL(file) : "")
  }

  const submitPaid = async () => {
    if (!payTarget) return
    setPaySaving(true)
    try {
      let slipUrl: string | undefined
      if (paySlipFile) {
        const up = await adminAPI.uploadPayoutSlip(paySlipFile)
        slipUrl = up.data?.data?.url
      }
      await adminAPI.markPayoutPaid(payTarget.id, payReference.trim() || undefined, slipUrl)
      toast.success("Payout marked as paid.")
      setPayTarget(null)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed.")
    } finally {
      setPaySaving(false)
    }
  }

  const reject = async (id: string) => {
    const reason = prompt("Reason for rejecting this payout:")
    if (!reason?.trim()) return
    setPendingId(id)
    try {
      await adminAPI.rejectPayout(id, reason.trim())
      toast.success("Payout rejected.")
      setSelected(null)
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
      setSelected(null)
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
    setOrgEvents([])
    setCreateEvent("")
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
    setOrgEvents([])
    setCreateEvent("")
    setCreateAmount("")
    if (!id) return
    setBalanceLoading(true)
    try {
      const res = await adminAPI.getOrganizerBalance(id)
      const bal = res.data?.data?.balance as BalanceInfo
      setOrgBalance(bal)
      setOrgEvents(res.data?.data?.events ?? [])
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
      await adminAPI.createPayout({
        organizer_id: selectedOrg,
        amount,
        event_id: createEvent || undefined,
        notes: createNotes.trim() || undefined,
      })
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
                    {["Date", "Organizer", "Event", "Status", "Actions"].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payouts.map(p => {
                    const meta = STATUS_BADGE[p.status]
                    return (
                      <tr
                        key={p.id}
                        className="border-t border-border hover:bg-muted/20 cursor-pointer"
                        onClick={() => setSelected(p)}
                      >
                        <td className="px-4 py-3 text-muted-foreground">{new Date(p.requested_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{p.organizer?.name ?? p.organizer_id.slice(0, 8)}</div>
                          <div className="text-xs text-muted-foreground">{p.organizer?.email}</div>
                        </td>
                        <td className="px-4 py-3">{p.event?.title ?? "All events"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${meta.cls}`}>
                            {meta.icon} {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelected(p) }}
                            className="px-2.5 py-1 rounded text-xs border border-border hover:bg-muted"
                          >
                            View
                          </button>
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

                {selectedOrg && orgEvents.length > 0 && (
                  <div>
                    <label htmlFor="evt" className="mb-1.5 block text-sm font-medium text-foreground">Event (optional)</label>
                    <select
                      id="evt"
                      value={createEvent}
                      onChange={(e) => setCreateEvent(e.target.value)}
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">All events</option>
                      {orgEvents.map((ev) => (
                        <option key={ev.id} value={ev.id}>{ev.title}</option>
                      ))}
                    </select>
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

        {/* Payout details */}
        {selected && (() => {
          const meta = STATUS_BADGE[selected.status]
          const busy = pendingId === selected.id
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
              onClick={() => !busy && setSelected(null)}
            >
              <div
                className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Payout details</h2>
                    <span className={`mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${meta.cls}`}>
                      {meta.icon} {meta.label}
                    </span>
                  </div>
                  <button type="button" onClick={() => setSelected(null)} aria-label="Close" title="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-5 text-center">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Amount</div>
                  <div className="mt-1 text-3xl font-bold text-foreground">LKR {Number(selected.amount).toLocaleString()}</div>
                </div>

                <div className="mt-5 divide-y divide-border rounded-xl border border-border">
                  <DetailRow label="Organizer" value={selected.organizer?.name || selected.organizer_id} />
                  <DetailRow label="Email" value={selected.organizer?.email || "—"} />
                  <DetailRow label="Event" value={selected.event?.title || "All events"} />
                  <DetailRow label="Requested" value={new Date(selected.requested_at).toLocaleString()} />
                  <DetailRow label="Processed" value={selected.processed_at ? new Date(selected.processed_at).toLocaleString() : "—"} />
                  <DetailRow label="Notes" value={selected.notes || "—"} />
                </div>

                {selected.slip_url && (
                  <a href={selected.slip_url} target="_blank" rel="noopener noreferrer" className="mt-4 block">
                    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Payment slip</div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selected.slip_url} alt="Payment slip" className="w-full rounded-lg border border-border bg-muted object-contain max-h-64" />
                  </a>
                )}

                {(selected.status === "requested" || selected.status === "approved") && (
                  <div className="mt-6 flex justify-end gap-2">
                    {selected.status === "requested" && (
                      <button
                        type="button"
                        onClick={() => approve(selected.id)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                      >
                        {busy ? <Loader className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve
                      </button>
                    )}
                    {selected.status === "approved" && (
                      <button
                        type="button"
                        onClick={() => openPay(selected)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                      >
                        <Banknote className="h-4 w-4" /> Mark paid
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => reject(selected.id)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-md bg-destructive/15 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/25 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Mark-paid modal — bank reference + payment slip image */}
        {payTarget && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => !paySaving && setPayTarget(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Mark payout as paid</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    LKR {Number(payTarget.amount).toLocaleString()} to {payTarget.organizer?.name || "organizer"}
                  </p>
                </div>
                <button type="button" onClick={() => setPayTarget(null)} aria-label="Close" title="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="pay-ref" className="mb-1.5 block text-sm font-medium text-foreground">Bank reference (optional)</label>
                  <input
                    id="pay-ref"
                    type="text"
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                    placeholder="e.g. transfer ID"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Payment slip (image)</label>
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border p-5 text-center hover:border-primary/40">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onPickSlip(e.target.files?.[0] ?? null)}
                    />
                    <span className="text-sm font-medium text-primary">{paySlipFile ? "Change image" : "Upload slip image"}</span>
                    <span className="text-xs text-muted-foreground">PNG, JPG · max 5 MB</span>
                  </label>
                  {paySlipPreview && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={paySlipPreview} alt="Slip preview" className="mt-3 w-full rounded-lg border border-border bg-muted object-contain max-h-56" />
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setPayTarget(null)} disabled={paySaving} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitPaid}
                  disabled={paySaving}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {paySaving ? <Loader className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                  {paySaving ? "Saving…" : "Mark paid"}
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground text-right wrap-break-word max-w-[60%]">{value}</span>
    </div>
  )
}
