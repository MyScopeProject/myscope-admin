"use client"

// Admin shop-product review queue. Organizers submit products for review
// (draft → pending_review); this page lets admins scan the queue and open
// each one to approve (→ published/live) or reject (→ rejected, with a
// reason the organizer sees). Defaults to the pending tab since that's the
// actionable work; other statuses are viewable via the filter.

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import { ErrorMessage, EmptyState } from "@/components/ui/error-message"
import { adminAPI } from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import { Clock, ImageIcon, Search, ShoppingBag } from "lucide-react"

type ProductStatus = "draft" | "pending_review" | "published" | "sold_out" | "rejected" | "archived"

interface AdminProduct {
  id: string
  title: string
  product_type: "event_product" | "shop_product"
  price: number | string
  currency: string
  stock_quantity: number
  images: string[]
  category: string | null
  status: ProductStatus
  submitted_at: string | null
  created_at: string
  organizer: { id: string; name: string; email: string } | null
  event: { id: string; title: string } | null
}

const STATUS_META: Record<ProductStatus, { label: string; className: string }> = {
  draft:          { label: "Draft",     className: "bg-muted text-muted-foreground" },
  pending_review: { label: "In review", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  published:      { label: "Live",      className: "bg-green-500/15 text-green-700 dark:text-green-300" },
  sold_out:       { label: "Sold out",  className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  rejected:       { label: "Rejected",  className: "bg-red-500/15 text-red-700 dark:text-red-300" },
  archived:       { label: "Archived",  className: "bg-gray-500/15 text-gray-600 dark:text-gray-400" },
}

const FILTERS: Array<{ value: "pending_review" | "all" | ProductStatus; label: string }> = [
  { value: "pending_review", label: "In review" },
  { value: "published",      label: "Live" },
  { value: "rejected",       label: "Rejected" },
  { value: "draft",          label: "Drafts" },
  { value: "all",            label: "All" },
]

function formatMoney(amount: number | string, currency = "LKR") {
  const n = typeof amount === "number" ? amount : Number(amount)
  if (!Number.isFinite(n)) return `${currency} —`
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return iso
  }
}

export default function ShopProductsReviewPage() {
  const { user } = useAuth()
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"pending_review" | "all" | ProductStatus>("pending_review")

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [listRes, summaryRes] = await Promise.all([
        adminAPI.getShopProducts(statusFilter === "all" ? { limit: 300 } : { status: statusFilter as ProductStatus, limit: 300 }),
        adminAPI.getShopProductsSummary(),
      ])
      setProducts(listRes.data?.data?.products || [])
      setPendingCount(summaryRes.data?.data?.pending_review ?? 0)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load products"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const q = search.trim().toLowerCase()
    return products.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      p.organizer?.name?.toLowerCase().includes(q) ||
      p.organizer?.email?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q),
    )
  }, [products, search])

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={["superadmin", "event-manager", "content-manager"]}>
        <AdminLayout user={user || undefined}><PageLoader /></AdminLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requiredRoles={["superadmin", "event-manager", "content-manager"]}>
      <AdminLayout user={user || undefined}>
        <div className="space-y-6">
          <header className="flex items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <ShoppingBag className="h-6 w-6 text-primary" />
                Shop Products
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Review organizer products before they go live. Approve to publish, or reject with a reason.
              </p>
            </div>
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-sm font-medium text-amber-700 dark:text-amber-300">
                <Clock className="h-4 w-4" />
                {pendingCount} awaiting review
              </span>
            )}
          </header>

          {error && <ErrorMessage message={error} onRetry={load} />}

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search by product, organizer or category…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === f.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="Nothing here"
              description={statusFilter === "pending_review" ? "No products are awaiting review." : "No products match this view."}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Organizer</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((p) => {
                    const cover = Array.isArray(p.images) && p.images[0]
                    const meta = STATUS_META[p.status]
                    return (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <Link href={`/shop-products/${p.id}`} className="group flex items-center gap-3">
                            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                              {cover ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={cover} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <ImageIcon className="h-full w-full p-3 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-medium text-foreground group-hover:text-primary">{p.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {p.product_type === "event_product" ? "Event product" : "Shop product"}
                                {p.category ? ` · ${p.category}` : ""}
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-foreground">{p.organizer?.name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{p.organizer?.email}</div>
                        </td>
                        <td className="px-4 py-3 text-foreground">{formatMoney(p.price, p.currency)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.stock_quantity}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(p.submitted_at ?? p.created_at)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}>
                            {meta.label}
                          </span>
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
