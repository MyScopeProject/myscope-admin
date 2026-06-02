"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import { ErrorMessage } from "@/components/ui/error-message"
import { adminAPI } from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CreditCard,
  ImageIcon,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  Receipt,
  ShieldCheck,
  Store,
  Truck,
  User as UserIcon,
  XOctagon,
} from "lucide-react"

type OrderStatus = "Pending" | "Confirmed" | "Cancelled" | "Refunded"
type FulfillmentStatus = "pending" | "preparing" | "shipped" | "delivered" | "picked_up" | "returned"

interface Buyer { id: string; name: string | null; email: string | null }
interface OrganizerInfo {
  id: string
  business_name: string | null
  profile_image_url: string | null
  phone: string | null
  verified?: boolean
}

interface OrderItem {
  id: string
  product_id: string
  title_snapshot: string
  image_snapshot: string | null
  unit_price: number | string
  quantity: number
  line_total: number | string
}

interface Order {
  id: string
  order_reference: string
  buyer_user_id: string
  organizer_id: string
  status: OrderStatus
  payment_status: "Pending" | "Completed" | "Failed"
  fulfillment_status: FulfillmentStatus
  fulfillment_type: "shipping" | "pickup"
  subtotal: number | string
  discount_amount: number | string
  total_amount: number | string
  currency: string
  promo_code_snapshot: string | null
  shipping_address: {
    name?: string; phone?: string; line1?: string; line2?: string;
    city?: string; postal_code?: string; country?: string; notes?: string;
  } | null
  pickup_note: string | null
  buyer_email: string | null
  buyer_phone: string | null
  payment_ref: string | null
  notes: string | null
  cancelled_at: string | null
  fulfilled_at: string | null
  created_at: string
}

interface Payment {
  id: string
  status: "Pending" | "Success" | "Failed"
  order_id: string | null
  payment_id: string | null
  amount: number | string
  currency: string
  refund_status?: string | null
  completed_at: string | null
  failed_at: string | null
  created_at: string
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
  pending:    "Order received",
  preparing:  "Preparing",
  shipped:    "Shipped",
  delivered:  "Delivered",
  picked_up:  "Picked up",
  returned:   "Returned",
}

function formatMoney(amount: number | string | null | undefined, currency = "LKR") {
  if (amount === null || amount === undefined) return `${currency} —`
  const n = typeof amount === "number" ? amount : Number(amount)
  if (!Number.isFinite(n)) return `${currency} —`
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
  } catch {
    return iso
  }
}

function ShopOrderDetailInner() {
  const params = useParams()
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params!.id[0] : ""
  const { user } = useAuth()
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [buyer, setBuyer] = useState<Buyer | null>(null)
  const [organizer, setOrganizer] = useState<OrganizerInfo | null>(null)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const load = async () => {
    if (!id) return
    try {
      setLoading(true)
      setError(null)
      const res = await adminAPI.getShopOrderById(id)
      const data = res.data?.data
      setOrder(data?.order || null)
      setItems(data?.items || [])
      setBuyer(data?.buyer || null)
      setOrganizer(data?.organizer || null)
      setPayment(data?.payment || null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load order"
      setError(msg)
      toast.error("Failed to load order")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleForceCancel = async () => {
    if (!order) return
    const reason = window.prompt("Reason for cancelling this order (required, logged for audit):")
    if (!reason || !reason.trim()) return
    if (!window.confirm(`Force-cancel ${order.order_reference}? Stock will be released. This does NOT refund the buyer.`)) return

    setCancelling(true)
    try {
      await adminAPI.forceCancelShopOrder(order.id, reason.trim())
      toast.success("Order cancelled.")
      await load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to cancel order"
      toast.error(msg)
    } finally {
      setCancelling(false)
    }
  }

  if (loading) return <PageLoader />

  if (error || !order) {
    return (
      <AdminLayout user={user || undefined}>
        <ErrorMessage message={error || "Order not found."} onRetry={load} />
        <div className="mt-4">
          <Link href="/shop-orders" className="text-sm text-primary hover:underline">← Back to orders</Link>
        </div>
      </AdminLayout>
    )
  }

  const canCancel = order.status !== "Cancelled"

  return (
    <AdminLayout user={user || undefined}>
      <div className="space-y-6">
        <Link
          href="/shop-orders"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to orders
        </Link>

        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              <h1 className="font-mono text-2xl font-semibold tracking-tight">{order.order_reference}</h1>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[order.status]}`}>
                {STATUS_LABEL[order.status]}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>Placed {formatDate(order.created_at)}</span>
              <span>·</span>
              <span className="capitalize">{order.fulfillment_type}</span>
              {order.status === "Confirmed" && (
                <>
                  <span>·</span>
                  <span>{FULFILLMENT_LABEL[order.fulfillment_status]}</span>
                </>
              )}
            </div>
          </div>

          {canCancel && (
            <button
              type="button"
              onClick={handleForceCancel}
              disabled={cancelling}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-destructive/40 px-3 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XOctagon className="h-4 w-4" />}
              Force-cancel
            </button>
          )}
        </header>

        {order.status === "Cancelled" && (
          <div className="flex items-start gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-300">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <span>This order is cancelled{order.cancelled_at ? ` (${formatDate(order.cancelled_at)})` : ""}. A refund, if owed, must be issued separately.</span>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Items */}
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Items</h2>
              <ul className="mt-3 divide-y divide-border">
                {items.map((it) => (
                  <li key={it.id} className="flex items-center gap-3 py-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                      {it.image_snapshot ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.image_snapshot} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-full w-full p-3 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{it.title_snapshot}</div>
                      <div className="text-xs text-muted-foreground">
                        Qty {it.quantity} · {formatMoney(it.unit_price, order.currency)} each
                      </div>
                    </div>
                    <div className="text-sm font-semibold">{formatMoney(it.line_total, order.currency)}</div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Address / pickup info */}
            {order.fulfillment_type === "shipping" && order.shipping_address && (
              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <Truck className="h-4 w-4" />
                  Shipping to
                </h2>
                <div className="mt-2 text-sm">
                  <p className="font-medium">{order.shipping_address.name}</p>
                  <p className="text-muted-foreground">{order.shipping_address.phone}</p>
                  <p className="mt-2 whitespace-pre-line">
                    {[order.shipping_address.line1, order.shipping_address.line2, order.shipping_address.city, order.shipping_address.postal_code, order.shipping_address.country]
                      .filter(Boolean).join("\n")}
                  </p>
                  {order.shipping_address.notes && (
                    <p className="mt-2 text-xs text-muted-foreground">Notes: {order.shipping_address.notes}</p>
                  )}
                </div>
              </section>
            )}
            {order.fulfillment_type === "pickup" && (
              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <Package className="h-4 w-4" />
                  Pickup
                </h2>
                <p className="mt-2 text-sm">{order.pickup_note || "No pickup note from buyer."}</p>
              </section>
            )}

            {order.notes && (
              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Internal notes</h2>
                <pre className="mt-2 whitespace-pre-wrap text-sm">{order.notes}</pre>
              </section>
            )}
          </div>

          <aside className="space-y-4 lg:col-span-1">
            {/* Summary */}
            <section className="rounded-xl border border-border bg-card p-5 space-y-2 text-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Summary</h2>
              <Row label="Subtotal" value={formatMoney(order.subtotal, order.currency)} />
              {Number(order.discount_amount) > 0 && (
                <Row
                  label={order.promo_code_snapshot ? `Promo ${order.promo_code_snapshot}` : "Discount"}
                  value={`-${formatMoney(order.discount_amount, order.currency)}`}
                />
              )}
              <div className="border-t border-border pt-2">
                <Row
                  label={<span className="font-semibold">Total</span>}
                  value={<span className="font-semibold">{formatMoney(order.total_amount, order.currency)}</span>}
                />
              </div>
            </section>

            {/* Payment */}
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                Payment
              </h2>
              {payment ? (
                <div className="mt-3 space-y-1.5 text-sm">
                  <Row label="Status" value={payment.status} />
                  <Row label="Amount" value={formatMoney(payment.amount, payment.currency)} />
                  {payment.payment_id && <Row label="Gateway ref" value={<span className="font-mono text-xs">{payment.payment_id}</span>} />}
                  {payment.completed_at && <Row label="Completed" value={formatDate(payment.completed_at)} />}
                  {payment.failed_at && <Row label="Failed" value={formatDate(payment.failed_at)} />}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No payment record found for this order.</p>
              )}
            </section>

            {/* Buyer */}
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Buyer</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {(buyer?.name || order.shipping_address?.name) && (
                  <li className="flex items-center gap-2">
                    <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{buyer?.name || order.shipping_address?.name}</span>
                  </li>
                )}
                {(buyer?.email || order.buyer_email) && (
                  <li className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <a className="hover:underline" href={`mailto:${buyer?.email || order.buyer_email}`}>
                      {buyer?.email || order.buyer_email}
                    </a>
                  </li>
                )}
                {(order.buyer_phone || order.shipping_address?.phone) && (
                  <li className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <a className="hover:underline" href={`tel:${order.buyer_phone || order.shipping_address?.phone}`}>
                      {order.buyer_phone || order.shipping_address?.phone}
                    </a>
                  </li>
                )}
              </ul>
            </section>

            {/* Organizer */}
            {organizer && (
              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Seller</h2>
                <div className="mt-3 flex items-start gap-3">
                  {organizer.profile_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={organizer.profile_image_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Store className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{organizer.business_name || "Organizer"}</span>
                      {organizer.verified && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    </div>
                    {organizer.phone && (
                      <a href={`tel:${organizer.phone}`} className="text-xs text-muted-foreground hover:underline">
                        {organizer.phone}
                      </a>
                    )}
                  </div>
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </AdminLayout>
  )
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  )
}

export default function ShopOrderDetailPage() {
  return (
    <ProtectedRoute>
      <ShopOrderDetailInner />
    </ProtectedRoute>
  )
}
