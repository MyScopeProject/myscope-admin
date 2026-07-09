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
  Calendar,
  CheckCircle2,
  Clock,
  Loader,
  ShoppingBag,
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
  product_id: string | null
  product?: { id: string; title: string } | null
  organizer_id: string
  // The underlying user row (kept for fallback / email lookup if no profile).
  organizer?: { id: string; name: string; email: string } | null
  // The organizer BRAND profile — what admins actually want to see when
  // reviewing payouts (business name + bank details). Nullable for legacy
  // payouts whose organizer hasn't completed registration.
  organizer_profile?: {
    user_id: string
    business_name: string | null
    business_type: string | null
    profile_image_url: string | null
    phone: string | null
    bank_name: string | null
    bank_account_number: string | null
    bank_account_name: string | null
    branch_name: string | null
    bank_code: string | null
    branch_code: string | null
  } | null
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

// Payouts come from three sources now:
//   - event_id IS NOT NULL   → event payout (per-event revenue)
//   - product_id IS NOT NULL → product payout (per-product shop revenue)
//   - both NULL              → legacy combined-shop payout (pre-migration
//                              rows from before per-product tracking existed)
function PayoutSourcePill({ payout }: { payout: Payout }) {
  if (payout.event_id && payout.event?.title) {
    return (
      <span className="inline-flex max-w-56 items-center gap-1 truncate rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        <Calendar className="h-3 w-3 shrink-0" />
        <span className="truncate">{payout.event.title}</span>
      </span>
    )
  }
  if (payout.product_id && payout.product?.title) {
    return (
      <span className="inline-flex max-w-56 items-center gap-1 truncate rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
        <ShoppingBag className="h-3 w-3 shrink-0" />
        <span className="truncate">{payout.product.title}</span>
      </span>
    )
  }
  if (payout.event_id) {
    // event_id present but no joined title — likely a deleted event.
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        <Calendar className="h-3 w-3" />
        Event {payout.event_id.slice(0, 6)}
      </span>
    )
  }
  if (payout.product_id) {
    // product_id present but no joined title — likely a deleted product.
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        <ShoppingBag className="h-3 w-3" />
        Product {payout.product_id.slice(0, 6)}
      </span>
    )
  }
  // Neither set — legacy combined-shop payout, predates per-product tracking.
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <ShoppingBag className="h-3 w-3" />
      Shop revenue (legacy)
    </span>
  )
}

const formatLkr = (n: number | string) => {
  const v = typeof n === "string" ? Number(n) : n
  return `LKR ${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
  const [orgProducts, setOrgProducts] = useState<{ id: string; title: string }[]>([])
  const [createEvent, setCreateEvent] = useState("")
  const [createProduct, setCreateProduct] = useState("")
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
    setOrgProducts([])
    setCreateEvent("")
    setCreateProduct("")
    setCreateAmount("")
    if (!id) return
    setBalanceLoading(true)
    try {
      const res = await adminAPI.getOrganizerBalance(id)
      const bal = res.data?.data?.balance as BalanceInfo
      setOrgBalance(bal)
      setOrgEvents(res.data?.data?.events ?? [])
      setOrgProducts(res.data?.data?.products ?? [])
      setCreateAmount(bal ? String(bal.pending) : "")
    } catch {
      toast.error("Couldn't load balance.")
    } finally {
      setBalanceLoading(false)
    }
  }

  // Single <select> encodes the choice as "event:<id>" / "product:<id>" / ""
  // (legacy combined-shop) — parsed here into the two mutually-exclusive
  // id states the create payload actually needs.
  const onSelectSource = (value: string) => {
    if (value.startsWith("event:")) {
      setCreateEvent(value.slice(6))
      setCreateProduct("")
    } else if (value.startsWith("product:")) {
      setCreateProduct(value.slice(8))
      setCreateEvent("")
    } else {
      setCreateEvent("")
      setCreateProduct("")
    }
  }
  const sourceValue = createEvent ? `event:${createEvent}` : createProduct ? `product:${createProduct}` : ""

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
        product_id: createProduct || undefined,
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
                    {["Date", "Organizer", "Source", "Amount", "Status", "Actions"].map(h => (
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
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {new Date(p.requested_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          {/* Show organizer BRAND (business_name), with the
                              user name + email as a smaller fallback context
                              line. Admins reviewing payouts know the brand,
                              not the personal account behind it. */}
                          <div className="font-medium">
                            {p.organizer_profile?.business_name
                              ?? p.organizer?.name
                              ?? p.organizer_id.slice(0, 8)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {p.organizer?.email}
                            {p.organizer_profile?.business_type && (
                              <> · {p.organizer_profile.business_type}</>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <PayoutSourcePill payout={p} />
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                          {formatLkr(p.amount)}
                        </td>
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

                {selectedOrg && (
                  <div>
                    <label htmlFor="evt" className="mb-1.5 block text-sm font-medium text-foreground">Source</label>
                    <select
                      id="evt"
                      value={sourceValue}
                      onChange={(e) => onSelectSource(e.target.value)}
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Shop revenue (legacy, storefront-wide)</option>
                      {orgEvents.length > 0 && (
                        <optgroup label="Events">
                          {orgEvents.map((ev) => (
                            <option key={ev.id} value={`event:${ev.id}`}>{ev.title}</option>
                          ))}
                        </optgroup>
                      )}
                      {orgProducts.length > 0 && (
                        <optgroup label="Products">
                          {orgProducts.map((p) => (
                            <option key={p.id} value={`product:${p.id}`}>{p.title}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Pick an event or product to draw the payout from that specific balance. The legacy
                      shop-wide option only applies to pre-migration payouts.
                    </p>
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
                className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Sticky header — status, source, close button. The amount
                    moves up here so the most important info is always visible
                    even when the body scrolls. */}
                <div className="flex items-start justify-between gap-3 border-b border-border bg-muted/30 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${meta.cls}`}>
                        {meta.icon} {meta.label}
                      </span>
                      <PayoutSourcePill payout={selected} />
                    </div>
                    <div className="mt-3">
                      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Amount</div>
                      <div className="mt-0.5 text-3xl font-bold text-foreground">{formatLkr(selected.amount)}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    aria-label="Close"
                    title="Close"
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Scrollable body — grouped sections instead of one long
                    table. Each section has its own card so admins can
                    scan/match each block (organizer · payout meta · bank). */}
                <div className="flex-1 space-y-5 overflow-y-auto p-5">
                  {/* Organizer section */}
                  <section>
                    <SectionLabel icon={<Banknote className="h-3.5 w-3.5" />}>Organizer</SectionLabel>
                    <div className="mt-2 rounded-xl border border-border">
                      <div className="flex items-start gap-3 p-4">
                        {selected.organizer_profile?.profile_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={selected.organizer_profile.profile_image_url}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {(selected.organizer_profile?.business_name
                              ?? selected.organizer?.name
                              ?? "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-foreground">
                            {selected.organizer_profile?.business_name
                              || selected.organizer?.name
                              || selected.organizer_id}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {selected.organizer?.email}
                            {selected.organizer_profile?.business_type && (
                              <> · {selected.organizer_profile.business_type}</>
                            )}
                          </div>
                          {selected.organizer_profile?.phone && (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {selected.organizer_profile.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Payout meta — source/timing/notes. Source title repeated
                      here in full (the pill in the header is the visual cue). */}
                  <section>
                    <SectionLabel icon={<Clock className="h-3.5 w-3.5" />}>Payout</SectionLabel>
                    <div className="mt-2 divide-y divide-border rounded-xl border border-border">
                      <DetailRow
                        label="Source"
                        value={
                          selected.event_id
                            ? (selected.event?.title || `Event ${selected.event_id.slice(0, 8)}`)
                            : selected.product_id
                              ? (selected.product?.title || `Product ${selected.product_id.slice(0, 8)}`)
                              : "Shop revenue (legacy, storefront-wide)"
                        }
                      />
                      <DetailRow label="Requested" value={new Date(selected.requested_at).toLocaleString()} />
                      <DetailRow
                        label="Processed"
                        value={selected.processed_at ? new Date(selected.processed_at).toLocaleString() : "—"}
                      />
                      {selected.notes && <DetailRow label="Notes" value={selected.notes} />}
                    </div>
                  </section>

                  {/* Bank details. Empty-state when missing reads as a clear
                      callout instead of disappearing — admins shouldn't
                      silently miss that an organizer hasn't entered banking. */}
                  <section>
                    <SectionLabel icon={<Banknote className="h-3.5 w-3.5" />}>Bank details</SectionLabel>
                    {selected.organizer_profile?.bank_account_number ? (
                      <div className="mt-2 divide-y divide-border rounded-xl border border-border">
                        <DetailRow label="Bank" value={selected.organizer_profile.bank_name || "—"} />
                        <DetailRow label="Branch" value={selected.organizer_profile.branch_name || "—"} />
                        <DetailRow label="Account holder" value={selected.organizer_profile.bank_account_name || "—"} />
                        <DetailRow label="Account number" value={selected.organizer_profile.bank_account_number} />
                        {selected.organizer_profile.bank_code && (
                          <DetailRow label="Bank code" value={selected.organizer_profile.bank_code} />
                        )}
                        {selected.organizer_profile.branch_code && (
                          <DetailRow label="Branch code" value={selected.organizer_profile.branch_code} />
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 rounded-xl border border-dashed border-destructive/40 bg-destructive/5 px-4 py-3 text-xs text-destructive">
                        Organizer hasn't added bank details yet. Reach out before approving.
                      </div>
                    )}
                  </section>

                  {/* Payment slip — only after the payout is paid */}
                  {selected.slip_url && (
                    <section>
                      <SectionLabel icon={<CheckCircle2 className="h-3.5 w-3.5" />}>Payment slip</SectionLabel>
                      <a href={selected.slip_url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selected.slip_url}
                          alt="Payment slip"
                          className="w-full rounded-xl border border-border bg-muted object-contain max-h-64"
                        />
                      </a>
                    </section>
                  )}
                </div>

                {/* Sticky action footer — pinned so the admin can always see
                    the approve/reject buttons even on a long card. Only shown
                    for actionable states. */}
                {(selected.status === "requested" || selected.status === "approved") && (
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-card p-4">
                    <button
                      type="button"
                      onClick={() => reject(selected.id)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-md bg-destructive/15 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/25 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" /> Reject
                    </button>
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
                    {formatLkr(payTarget.amount)} to {payTarget.organizer_profile?.business_name || payTarget.organizer?.name || "organizer"}
                    {!payTarget.event_id && (
                      <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                        <ShoppingBag className="h-2.5 w-2.5" />
                        {payTarget.product?.title || "Shop"}
                      </span>
                    )}
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

// Compact section header used inside the payout detail card.
function SectionLabel({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {icon}
      {children}
    </div>
  )
}

