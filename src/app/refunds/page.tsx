"use client"

import { useEffect, useMemo, useState } from "react"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import { ErrorMessage, EmptyState } from "@/components/ui/error-message"
import { adminAPI } from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import {
  Banknote,
  ExternalLink,
  RotateCcw,
  Search,
  Ticket,
  X,
} from "lucide-react"

interface PendingRefund {
  payment_id: string
  booking_id: string
  booking_reference: string
  booking_status: string
  event_title: string
  buyer_name: string | null
  buyer_email: string | null
  buyer_phone: string | null
  number_of_tickets: number
  amount: number | string
  currency: string
  provider: "mpgs" | "koko" | string
  gateway_reference: string | null
  refund_reason: string | null
  requested_at: string
}

const formatLkr = (n: number | string) => {
  const v = typeof n === "string" ? Number(n) : n
  return `LKR ${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Koko's merchant portal has no direct per-order deep link we can construct —
// this just points staff at the login page; the gateway_reference (koko_order_id)
// shown alongside is what they search for once inside.
const KOKO_PORTAL_URL = "https://merchant.paykoko.com"

function ProviderBadge({ provider }: { provider: string }) {
  if (provider === "koko") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400">
        Koko
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      MPGS
    </span>
  )
}

export default function RefundsPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<PendingRefund[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Search + provider filter — client-side only. The pending-refund queue
  // is small by nature (bounded to whatever's currently unresolved), so
  // there's no need for a server-side search endpoint.
  const [search, setSearch] = useState("")
  const [providerFilter, setProviderFilter] = useState<"all" | "mpgs" | "koko">("all")

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (providerFilter !== "all" && r.provider !== providerFilter) return false
      if (!q) return true
      return [r.booking_reference, r.event_title, r.buyer_name, r.buyer_email, r.buyer_phone, r.gateway_reference]
        .some((f) => (f || "").toLowerCase().includes(q))
    })
  }, [rows, search, providerFilter])

  // Action modal — shared by both the MPGS (gateway call) and Koko (manual
  // record) paths, distinguished by `target.provider`.
  const [target, setTarget] = useState<PendingRefund | null>(null)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  // MPGS rows default to the automatic (gateway-calling) path. Staff flip
  // this when they've already refunded the card directly in Seylan's own
  // dashboard — same shape as Koko's always-manual path, just opt-in here
  // since the automatic path should stay the default for MPGS.
  const [manualMode, setManualMode] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await adminAPI.getPendingRefunds()
      setRows(res.data?.data ?? [])
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load pending refunds.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openAction = (row: PendingRefund) => {
    setTarget(row)
    setReason(row.refund_reason || "")
    setManualMode(false)
  }

  const closeAction = () => {
    if (submitting) return
    setTarget(null)
    setReason("")
    setManualMode(false)
  }

  const submit = async () => {
    if (!target) return
    if (!reason.trim()) { toast.error("Enter a reason."); return }
    setSubmitting(true)
    try {
      if (target.provider === "koko") {
        await adminAPI.refundBookingKokoManual(target.booking_id, reason.trim())
        toast.success("Refund recorded.")
      } else if (manualMode) {
        await adminAPI.refundBookingMpgsManual(target.booking_id, reason.trim())
        toast.success("Refund recorded.")
      } else {
        await adminAPI.refundBooking(target.booking_id, reason.trim())
        toast.success("Refund processed via MPGS.")
      }
      setTarget(null)
      setReason("")
      setManualMode(false)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Refund failed.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ProtectedRoute>
      <AdminLayout user={user ?? undefined}>
        <div className="p-6 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Refunds</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Bookings queued for a refund — from buyer requests, organizer/admin actions, or event cancellations.
              </p>
            </div>
            {!loading && !error && rows.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search booking, buyer, event…"
                    className="h-9 w-64 rounded-lg border border-input bg-background pl-8 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex gap-1 rounded-lg border border-border p-0.5">
                  {(["all", "mpgs", "koko"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setProviderFilter(p)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                        providerFilter === p
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <PageLoader />
          ) : error ? (
            <div className="space-y-2">
              <ErrorMessage message={error} />
              <button type="button" onClick={load} className="text-xs text-primary hover:underline">
                Retry
              </button>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="No pending refunds"
              description="Refund requests from buyers, organizers, or event cancellations show up here."
              icon={RotateCcw}
            />
          ) : filteredRows.length === 0 ? (
            <EmptyState
              title="No matching refunds"
              description="Try a different search term or provider filter."
              icon={Search}
            />
          ) : (
            <div className="rounded-xl border border-border overflow-x-auto bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    {["Requested", "Booking", "Buyer", "Tickets", "Amount", "Provider", "Reason", "Actions"].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(r => (
                    <tr key={r.payment_id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(r.requested_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium font-mono text-xs">{r.booking_reference}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-48">{r.event_title}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.buyer_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.buyer_email || r.buyer_phone || ""}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Ticket className="h-3.5 w-3.5" /> {r.number_of_tickets}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                        {formatLkr(r.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <ProviderBadge provider={r.provider} />
                        {r.gateway_reference && (
                          <div className="mt-1 font-mono text-[10px] text-muted-foreground truncate max-w-32" title={r.gateway_reference}>
                            {r.gateway_reference}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-56 truncate text-muted-foreground" title={r.refund_reason || ""}>
                        {r.refund_reason || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openAction(r)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                        >
                          {r.provider === "koko" ? "Mark refunded" : "Process refund"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Action modal */}
        {target && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={closeAction}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">
                  {target.provider === "koko"
                    ? "Mark refunded via Koko"
                    : manualMode
                      ? "Record manual MPGS refund"
                      : "Process MPGS refund"}
                </h2>
                <button type="button" onClick={closeAction} aria-label="Close" title="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
                  <div className="font-medium text-foreground">{target.booking_reference} — {target.event_title}</div>
                  <div className="text-muted-foreground">{target.buyer_name} · {formatLkr(target.amount)}</div>
                </div>

                {target.provider === "koko" ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                    Koko has no refund API — process this refund in Koko's merchant portal <em>first</em>, using the
                    order reference below, then confirm here. This only records that it was done; it does not move any money.
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-background/60 px-2 py-1.5 font-mono text-[11px]">
                      <span className="truncate">{target.gateway_reference || "(no Koko order id on file)"}</span>
                      <a
                        href={KOKO_PORTAL_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
                      >
                        Open portal <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <>
                    {manualMode ? (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                        Use this only if you already refunded this card directly in Seylan's merchant dashboard
                        (Order &amp; Transaction Search). This does <strong>not</strong> call MPGS — it only records the
                        refund in MyScope, cancels the booking, releases inventory, and notifies the buyer. If you
                        haven't refunded on Seylan's side yet, do that first — otherwise the buyer never gets their money.
                        <div className="mt-2 font-mono text-[11px] text-amber-800 dark:text-amber-200">
                          {target.gateway_reference || "(no order id on file)"}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                        This calls MPGS's refund API directly — the buyer's card will actually be refunded when you confirm.
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={manualMode}
                        onChange={(e) => setManualMode(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-input"
                      />
                      I already refunded this manually on Seylan's dashboard
                    </label>
                  </>
                )}

                <div>
                  <label htmlFor="refund-reason" className="mb-1.5 block text-sm font-medium text-foreground">Reason</label>
                  <textarea
                    id="refund-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Why is this being refunded?"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeAction}
                    disabled={submitting}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                  >
                    <Banknote className="h-4 w-4" />
                    {submitting
                      ? "Processing…"
                      : target.provider === "koko" || manualMode
                        ? "Confirm refunded"
                        : "Process refund"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  )
}
