"use client"

// Admin Earnings dashboard. Per-event end-to-end summary of every cash flow
// the platform touches: customer revenue, convenience fees, platform fees,
// refunds, comm billing, payouts, and the resulting organizer balance. Each
// row mirrors what the corresponding payouts dashboard shows the organizer
// (same math, no drift). Grand totals at the top.

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { PageLoader } from "@/components/ui/loading"
import { useAuth } from "@/contexts/auth-context"
import { adminAPI } from "@/lib/apiEndpoints"
import {
  AlertCircle,
  ArrowUpRight,
  Banknote,
  Calendar,
  Coins,
  MapPin,
  Search,
  Wallet,
} from "lucide-react"

interface Rates {
  platform_fee_pct: number
  convenience_fee_pct: number
}

interface Totals {
  gross_revenue: number
  organizer_subtotal: number
  convenience_fees_net: number
  platform_fees: number
  comm_billing: number
  refunds_total: number
  payouts_paid: number
  payouts_pending: number
  admin_earnings_total: number
}

interface EventBreakdown {
  event: {
    id: string
    title: string
    banner_url: string | null
    start_time: string | null
    venue_name: string | null
    organizer_id: string
    approval_status: string
    status: string
  }
  counts: {
    bookings_confirmed: number
    bookings_refunded: number
    payouts_total: number
  }
  gross_revenue: number
  organizer_subtotal: number
  convenience_fees: { gross: number; refunded: number; net: number }
  refunds: { subtotal: number; convenience: number; total: number }
  platform_fees: { pct: number; total: number }
  comm_billing: {
    total: number
    sms_count: number
    sms_total: number
    email_count: number
    email_total: number
  }
  payouts: { paid: number; pending: number }
  organizer: { net: number; balance: number }
  admin_earnings_total: number
}

const formatLkr = (n: number) =>
  `LKR ${(Number(n) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const formatPct = (n: number) => {
  const v = n * 100
  return `${v.toFixed(v % 1 === 0 ? 0 : 1)}%`
}

const formatDate = (iso: string | null) => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
}

export default function AdminEarningsPage() {
  const { user } = useAuth()
  const [rates, setRates] = useState<Rates | null>(null)
  const [totals, setTotals] = useState<Totals | null>(null)
  const [events, setEvents] = useState<EventBreakdown[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    adminAPI
      .listEarnings(statusFilter === "all" ? undefined : { approval_status: statusFilter })
      .then((res) => {
        if (cancelled) return
        const d = res.data?.data
        if (!d) {
          setError("Empty response from earnings endpoint.")
          return
        }
        setRates(d.rates)
        setTotals(d.totals)
        setEvents(d.events ?? [])
      })
      .catch((err: any) => {
        if (cancelled) return
        setError(err?.response?.data?.message || "Failed to load earnings.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [statusFilter])

  // Client-side title search. The dataset is small enough that pagination
  // isn't worth the complexity — admins typically want a single scrollable
  // page they can ctrl+F through anyway.
  const visibleEvents = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return events
    return events.filter((b) => b.event.title.toLowerCase().includes(q))
  }, [events, search])

  return (
    <ProtectedRoute requiredRoles={["superadmin", "event-manager"]}>
      <AdminLayout user={user || undefined}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Earnings</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Per-event end-to-end summary: customer revenue, convenience fees, platform fees,
                refunds, comm billing, and payouts. Admin earnings = convenience fees + platform
                fees + comm billing for the event.
              </p>
            </div>
            {rates ? (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Active rates
                </div>
                <div className="mt-0.5 font-mono">
                  Convenience {formatPct(rates.convenience_fee_pct)} · Platform{" "}
                  {formatPct(rates.platform_fee_pct)}
                </div>
              </div>
            ) : null}
          </div>

          {/* Top-level totals */}
          {totals ? (
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <TotalTile
                icon={Coins}
                label="Admin earnings"
                value={formatLkr(totals.admin_earnings_total)}
                hint="Convenience + platform + comm billing"
                highlight
              />
              <TotalTile
                icon={Wallet}
                label="Convenience fees (net)"
                value={formatLkr(totals.convenience_fees_net)}
                hint="Customer-paid, less refunds"
              />
              <TotalTile
                icon={Coins}
                label="Platform fees"
                value={formatLkr(totals.platform_fees)}
                hint={`${formatPct(rates?.platform_fee_pct ?? 0.04)} of organizer subtotal`}
              />
              <TotalTile
                icon={Banknote}
                label="Payouts paid"
                value={formatLkr(totals.payouts_paid)}
                hint={
                  totals.payouts_pending > 0
                    ? `+ ${formatLkr(totals.payouts_pending)} pending`
                    : "Cash sent to organizers"
                }
              />
              <TotalTile
                icon={ArrowUpRight}
                label="Gross revenue"
                value={formatLkr(totals.gross_revenue)}
                hint="What customers paid in total"
              />
              <TotalTile
                icon={ArrowUpRight}
                label="Organizer subtotal"
                value={formatLkr(totals.organizer_subtotal)}
                hint="Ticket revenue (before fees)"
              />
              <TotalTile
                icon={Coins}
                label="Comm billing"
                value={formatLkr(totals.comm_billing)}
                hint="SMS / email charges"
              />
              <TotalTile
                icon={AlertCircle}
                label="Refunds"
                value={formatLkr(totals.refunds_total)}
                hint="Returned to customers"
              />
            </section>
          ) : null}

          {/* Search + status filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by event title…"
                className="h-10 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by approval status"
              className="h-10 rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All approval statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
              <option value="draft">Draft</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Body */}
          {loading ? (
            <PageLoader />
          ) : error ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : visibleEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
              <Coins className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-3 text-base font-semibold text-foreground">No events to show</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                {search ? "No events match that search." : "Earnings appear here once events generate bookings."}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {visibleEvents.map((b) => (
                <EventEarningsRow key={b.event.id} breakdown={b} />
              ))}
            </ul>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}

function EventEarningsRow({ breakdown: b }: { breakdown: EventBreakdown }) {
  const [open, setOpen] = useState(false)
  const dateLabel = formatDate(b.event.start_time)

  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-wrap items-center gap-4 p-4 text-left hover:bg-muted/40"
      >
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          {b.event.banner_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.event.banner_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <Calendar className="h-full w-full p-3 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold text-foreground">{b.event.title}</span>
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {b.event.approval_status}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {dateLabel ? (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {dateLabel}
              </span>
            ) : null}
            {b.event.venue_name ? (
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0" /> {b.event.venue_name}
              </span>
            ) : null}
            <span>
              {b.counts.bookings_confirmed} confirmed
              {b.counts.bookings_refunded > 0 ? ` · ${b.counts.bookings_refunded} refunded` : ""}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Admin earnings
          </div>
          <div className="font-mono text-base font-bold text-foreground">
            {formatLkr(b.admin_earnings_total)}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Gross {formatLkr(b.gross_revenue)}
          </div>
        </div>
      </button>

      {/* Expandable breakdown */}
      {open ? (
        <div className="border-t border-border bg-muted/20 p-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
            <Stat label="Gross revenue"        value={formatLkr(b.gross_revenue)} hint="Customer paid" />
            <Stat label="Organizer subtotal"   value={formatLkr(b.organizer_subtotal)} hint="Before fees" />
            <Stat label="Convenience fees"     value={formatLkr(b.convenience_fees.net)} hint={`Gross ${formatLkr(b.convenience_fees.gross)} · refunded ${formatLkr(b.convenience_fees.refunded)}`} />
            <Stat label="Platform fees"        value={formatLkr(b.platform_fees.total)} hint={`${formatPct(b.platform_fees.pct)} of subtotal`} />
            <Stat
              label="Comm billing"
              value={formatLkr(b.comm_billing.total)}
              hint={`SMS ${b.comm_billing.sms_count} · Email ${b.comm_billing.email_count}`}
            />
            <Stat label="Refunds"              value={formatLkr(b.refunds.total)} hint={`Tickets ${formatLkr(b.refunds.subtotal)} · fee ${formatLkr(b.refunds.convenience)}`} />
            <Stat label="Payouts paid"         value={formatLkr(b.payouts.paid)} hint={`+ ${formatLkr(b.payouts.pending)} pending`} />
            <Stat label="Organizer balance"    value={formatLkr(b.organizer.balance)} hint={`Net ${formatLkr(b.organizer.net)} · ${b.counts.payouts_total} payout${b.counts.payouts_total === 1 ? "" : "s"}`} highlight />
          </div>
          <div className="mt-4 flex justify-end">
            <Link
              href={`/events/${b.event.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              Open event detail <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      ) : null}
    </li>
  )
}

function TotalTile({
  icon: Icon,
  label,
  value,
  hint,
  highlight = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint?: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-xl border bg-card p-4 shadow-sm ${
        highlight ? "border-primary/40" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-1 truncate text-xl font-bold text-foreground">{value}</div>
        </div>
        <span
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
            highlight ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {hint ? <p className="mt-2 truncate text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  highlight = false,
}: {
  label: string
  value: string
  hint?: string
  highlight?: boolean
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 font-mono text-sm font-semibold ${
          highlight ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div> : null}
    </div>
  )
}
