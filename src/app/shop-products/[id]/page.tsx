"use client"

// Admin shop-product detail + review actions. Reached from the review queue.
// Superadmin/event-manager/content-manager can approve (→ published) or
// reject (→ rejected, with a required reason the organizer sees on their
// product page).

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import { adminAPI } from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import {
  AlertCircle, AlertTriangle, ArrowLeft, Archive, CheckCircle, Clock, ExternalLink, ImageIcon,
  Loader2, Mail, MapPin, Package, RotateCcw, Tag, Trash2, Truck, User, XCircle,
} from "lucide-react"

type ProductStatus = "draft" | "pending_review" | "published" | "sold_out" | "rejected" | "archived"

interface AdminProduct {
  id: string
  title: string
  description: string | null
  product_type: "event_product" | "shop_product"
  event_id: string | null
  price: number | string
  currency: string
  stock_quantity: number
  fulfillment: "shipping" | "pickup" | "both"
  pickup_location: string | null
  pickup_location_url: string | null
  images: string[]
  category: string | null
  status: ProductStatus
  rejection_reason: string | null
  submitted_at: string | null
  reviewed_at: string | null
  approved_at: string | null
  created_at: string
  organizer: { id: string; name: string; email: string } | null
  event: { id: string; title: string } | null
}

const STATUS_META: Record<ProductStatus, { label: string; className: string }> = {
  draft:          { label: "Draft",     className: "bg-muted text-muted-foreground border-border" },
  pending_review: { label: "In review", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  published:      { label: "Live",      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  sold_out:       { label: "Sold out",  className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  rejected:       { label: "Rejected",  className: "bg-destructive/10 text-destructive border-destructive/30" },
  archived:       { label: "Archived",  className: "bg-muted text-muted-foreground border-border" },
}

const FULFILLMENT_LABEL: Record<string, string> = {
  shipping: "Shipping",
  pickup:   "Pickup",
  both:     "Shipping or pickup",
}

function formatMoney(amount: number | string, currency = "LKR") {
  const n = typeof amount === "number" ? amount : Number(amount)
  if (!Number.isFinite(n)) return `${currency} —`
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL || "https://www.myscope.lk"

export default function AdminShopProductDetailPage() {
  const { user } = useAuth()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id

  const [product, setProduct] = useState<AdminProduct | null>(null)
  const [unitsSold, setUnitsSold] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      setError(null)
      const res = await adminAPI.getShopProductById(id)
      setProduct(res.data?.data?.product ?? null)
      setUnitsSold(res.data?.data?.units_sold ?? 0)
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load product")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const approve = async () => {
    if (!product) return
    setActing(true)
    try {
      await adminAPI.approveShopProduct(product.id)
      toast.success("Product approved — now live in the shop.")
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to approve product")
    } finally {
      setActing(false)
    }
  }

  const reject = async () => {
    if (!product || !rejectReason.trim()) return
    setActing(true)
    try {
      await adminAPI.rejectShopProduct(product.id, rejectReason.trim())
      toast.success("Product rejected. The organizer can edit and resubmit.")
      setShowReject(false)
      setRejectReason("")
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to reject product")
    } finally {
      setActing(false)
    }
  }

  const archive = async () => {
    if (!product) return
    setActing(true)
    try {
      await adminAPI.archiveShopProduct(product.id)
      toast.success("Product archived — hidden from the public shop.")
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to archive product")
    } finally {
      setActing(false)
    }
  }

  const restore = async () => {
    if (!product) return
    setActing(true)
    try {
      await adminAPI.restoreShopProduct(product.id)
      toast.success("Product restored to draft.")
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to restore product")
    } finally {
      setActing(false)
    }
  }

  const deletePermanently = async () => {
    if (!product) return
    setDeleting(true)
    try {
      await adminAPI.deleteShopProductPermanently(product.id)
      toast.success("Product permanently deleted.")
      router.push("/shop-products")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete product")
      setShowDeleteModal(false)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={["superadmin", "event-manager", "content-manager"]}>
        <AdminLayout user={user || undefined}><PageLoader /></AdminLayout>
      </ProtectedRoute>
    )
  }

  if (error || !product) {
    return (
      <ProtectedRoute requiredRoles={["superadmin", "event-manager", "content-manager"]}>
        <AdminLayout user={user || undefined}>
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <h2 className="text-xl font-semibold">Product not found</h2>
            <p className="text-muted-foreground">{error}</p>
            <Link href="/shop-products" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" /> Back to products
            </Link>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  const meta = STATUS_META[product.status]
  const isPending = product.status === "pending_review"

  return (
    <ProtectedRoute requiredRoles={["superadmin", "event-manager", "content-manager"]}>
      <AdminLayout user={user || undefined}>
        <div className="max-w-4xl space-y-6">
          <Link href="/shop-products" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to products
          </Link>

          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{product.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold ${meta.className}`}>
                  {meta.label}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-0.5 text-xs font-medium text-muted-foreground">
                  {product.product_type === "event_product" ? "Event product" : "Shop product"}
                </span>
                {product.category && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-0.5 text-xs font-medium text-muted-foreground">
                    <Tag className="h-3 w-3" />{product.category}
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {isPending && (
                <>
                  <button
                    type="button"
                    onClick={approve}
                    disabled={acting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReject(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/20"
                  >
                    <XCircle className="h-4 w-4" /> Reject
                  </button>
                </>
              )}
              {product.status === "published" && (
                <a
                  href={`${WEB_URL}/shop/${product.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  View public <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* Rejection reason (if previously rejected) */}
          {product.status === "rejected" && product.rejection_reason && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-semibold text-destructive">Rejection reason</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{product.rejection_reason}</p>
              </div>
            </div>
          )}

          {/* Images */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {product.images.length > 0 ? (
              product.images.map((src, i) => (
                <div key={i} className="aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`${product.title} ${i + 1}`} className="h-full w-full object-cover" />
                </div>
              ))
            ) : (
              <div className="col-span-2 flex aspect-video items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-muted-foreground sm:col-span-4">
                <ImageIcon className="h-8 w-8" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Description + fulfillment */}
            <div className="space-y-6 lg:col-span-2">
              <Section title="Description">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {product.description || "No description provided."}
                </p>
              </Section>

              <Section title="Fulfillment">
                <div className="space-y-3">
                  <InfoRow icon={Truck} label="Method">{FULFILLMENT_LABEL[product.fulfillment] ?? product.fulfillment}</InfoRow>
                  {product.pickup_location && (
                    <InfoRow icon={MapPin} label="Pickup">{product.pickup_location}</InfoRow>
                  )}
                  {product.pickup_location_url && (
                    <a href={product.pickup_location_url} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                      Map link <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {product.event && (
                    <InfoRow icon={Tag} label="Event">{product.event.title}</InfoRow>
                  )}
                </div>
              </Section>

              {product.organizer && (
                <Section title="Organizer">
                  <div className="space-y-3">
                    <InfoRow icon={User} label="Name">{product.organizer.name}</InfoRow>
                    <InfoRow icon={Mail} label="Email"><span className="truncate">{product.organizer.email}</span></InfoRow>
                  </div>
                </Section>
              )}
            </div>

            {/* Facts sidebar */}
            <div className="space-y-4 lg:col-span-1">
              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product info</h3>
                <InfoRow icon={Tag} label="Price">{formatMoney(product.price, product.currency)}</InfoRow>
                <InfoRow icon={Package} label="Stock">{product.stock_quantity}</InfoRow>
                <InfoRow icon={Package} label="Sold">{unitsSold}</InfoRow>
                <InfoRow icon={Clock} label="Submitted">
                  {product.submitted_at ? new Date(product.submitted_at).toLocaleString() : "—"}
                </InfoRow>
                {product.approved_at && (
                  <InfoRow icon={CheckCircle} label="Approved">
                    {new Date(product.approved_at).toLocaleDateString()}
                  </InfoRow>
                )}
              </div>

              {/* Housekeeping — same archive/restore/delete controls the
                  organizer has on their own listing, usable here on any
                  organizer's product. */}
              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Manage listing</h3>
                {product.status !== "archived" ? (
                  <button
                    type="button"
                    onClick={archive}
                    disabled={acting}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-muted disabled:opacity-60"
                  >
                    {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                    Archive
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={restore}
                      disabled={acting}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-muted disabled:opacity-60"
                    >
                      {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                      Restore to draft
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteModal(true)}
                      disabled={acting || deleting}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive transition hover:bg-destructive/20 disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" /> Delete permanently
                    </button>
                  </>
                )}
                <p className="text-[11px] text-center text-muted-foreground">
                  {product.status !== "archived"
                    ? "Hides it from the public shop. Reversible."
                    : "Permanent delete is blocked if this product has any order history."}
                </p>
              </div>

              {isPending && (
                <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Review decision</h3>
                  <button
                    type="button"
                    onClick={approve}
                    disabled={acting}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    Approve &amp; publish
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReject(true)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive transition hover:bg-destructive/20"
                  >
                    <XCircle className="h-4 w-4" /> Reject
                  </button>
                  <p className="text-[11px] text-center text-muted-foreground">
                    Approving publishes it to the public shop immediately.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reject modal */}
        {showReject && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => { if (!acting) { setShowReject(false); setRejectReason("") } }}
          >
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <XCircle className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold">Reject product</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    The organizer sees this reason and can edit &amp; resubmit.
                  </p>
                </div>
              </div>
              <label htmlFor="reject-reason" className="mb-1.5 block text-sm font-medium">
                Reason <span className="text-destructive">*</span>
              </label>
              <textarea
                id="reject-reason"
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Product images are low quality, or the description is incomplete…"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowReject(false); setRejectReason("") }}
                  disabled={acting}
                  className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={reject}
                  disabled={acting || !rejectReason.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Confirm rejection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete-permanently confirm modal */}
        {showDeleteModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => { if (!deleting) setShowDeleteModal(false) }}
          >
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold">Delete permanently?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">&ldquo;{product.title}&rdquo;</span> will be
                    removed for good — this can&apos;t be undone. Blocked automatically if it has order history.
                    The organizer will be notified.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={deletePermanently}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete permanently
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </div>
  )
}

function InfoRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 font-medium text-foreground">{children}</span>
    </div>
  )
}
