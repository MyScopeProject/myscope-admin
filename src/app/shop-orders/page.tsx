"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import { ErrorMessage, EmptyState } from "@/components/ui/error-message"
import { adminAPI } from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import {
  AlertTriangle,
  Calendar,
  Eye,
  Package,
  Receipt,
  Search,
  ShoppingBag,
  Truck,
} from "lucide-react"

type OrderStatus = "Pending" | "Confirmed" | "Cancelled" | "Refunded"
type FulfillmentStatus = "pending" | "preparing" | "shipped" | "delivered" | "picked_up" | "returned"

interface Order {
  id: string
  order_reference: string
  buyer_user_id: string
  organizer_id: string
  status: OrderStatus
  payment_status: "Pending" | "Completed" | "Failed"
  fulfillment_status: FulfillmentStatus
  fulfillment_type: "shipping" | "pickup"
  total_amount: number | string
  currency: string
  buyer_email: string | null
  shipping_address: { name?: string } | null
  created_at: string
}

interface SummaryStats {
  total_orders: number
  confirmed_orders: number
  pending_orders: number
  confirmed_revenue: number
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  Pending:   "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  Confirmed: "bg-green-500/15 text-green-700 dark:text-green-300",
  Cancelled: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
  Refunded:  "bg-red-500/15 text-red-700 dark:text-red-300",
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  Pending:   "Awaiting payment",
  Confirmed: "Paid",
  Cancelled: "Cancelled",
  Refunded:  "Refunded",
}

const FULFILLMENT_LABEL: Record<FulfillmentStatus, string> = {
  pending:    "New",
  preparing:  "Preparing",
  shipped:    "Shipped",
  delivered:  "Delivered",
  picked_up:  "Picked up",
  returned:   "Returned",
}

function formatMoney(amount: number | string, currency = "LKR") {
  const n = typeof amount === "number" ? amount : Number(amount)
  if (!Number.isFinite(n)) return `${currency} —`
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return iso
  }
}

function ShopOrdersInner() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [summary, setSummary] = useState<SummaryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all")

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const [ordersRes, summaryRes] = await Promise.all([
        adminAPI.getShopOrders({ limit: 200 }),
        adminAPI.getShopOrdersSummary(),
      ])
      setOrders(ordersRes.data?.data?.orders || [])
      setSummary(summaryRes.data?.data || null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load shop orders"
      setError(msg)
      toast.error("Failed to load shop orders")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    let result = orders
    if (statusFilter !== "all") {
      result = result.filter((o) => o.status === statusFilter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((o) =>
        o.order_reference.toLowerCase().includes(q) ||
        o.buyer_email?.toLowerCase().includes(q) ||
        o.shipping_address?.name?.toLowerCase().includes(q),
      )
    }
    return result
  }, [orders, statusFilter, search])

  if (loading) return <PageLoader />

  return (
    <AdminLayout user={user || undefined}>
      <div className="space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <ShoppingBag className="h-6 w-6 text-primary" />
              Shop Orders
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Oversight across every organizer storefront. Read-mostly — force-cancel only for support escalations.
            </p>
          </div>
        </header>

        {/* Summary tiles */}
        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryTile label="Total orders" value={summary.total_orders} icon={Receipt} />
            <SummaryTile label="Paid" value={summary.confirmed_orders} icon={Truck} tone="success" />
            <SummaryTile label="Awaiting payment" value={summary.pending_orders} icon={Calendar} tone="warning" />
            <SummaryTile label="Paid revenue" value={formatMoney(summary.confirmed_revenue)} icon={Package} />
          </div>
        )}

        {error && <ErrorMessage message={error} onRetry={load} />}

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search by order ref, buyer name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | OrderStatus)}
            aria-label="Filter by status"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <option value="all">All statuses</option>
            <option value="Pending">Awaiting payment</option>
            <option value="Confirmed">Paid</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Refunded">Refunded</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title={orders.length === 0 ? "No shop orders yet" : "Nothing matches your filter"}
            description={
              orders.length === 0
                ? "Shop orders will appear here once buyers start checking out."
                : "Try a different status or clear the search."
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Buyer</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Fulfillment</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{o.order_reference}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {o.shipping_address?.name || o.buyer_email || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[o.status]}`}>
                        {STATUS_LABEL[o.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="capitalize">{o.fulfillment_type}</span>
                      {o.status === "Confirmed" && (
                        <span className="ml-1 text-xs">· {FULFILLMENT_LABEL[o.fulfillment_status]}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground">{formatMoney(o.total_amount, o.currency)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(o.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Link
                          href={`/shop-orders/${o.id}`}
                          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs font-medium hover:bg-muted"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

function SummaryTile({
  label, value, icon: Icon, tone,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  tone?: "success" | "warning"
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold tracking-tight ${
        tone === "success" ? "text-green-600 dark:text-green-400" :
        tone === "warning" ? "text-yellow-600 dark:text-yellow-400" :
        "text-foreground"
      }`}>
        {value}
      </div>
    </div>
  )
}

export default function ShopOrdersPage() {
  return (
    <ProtectedRoute>
      <ShopOrdersInner />
    </ProtectedRoute>
  )
}
