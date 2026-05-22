"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import { adminEventManage } from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import {
  ArrowLeft, Banknote, Calendar, CalendarClock, CheckCircle2, Loader, MapPin,
  Megaphone, Pause, Play, Plus, Ticket as TicketIcon, Trash2, Users, X, XCircle,
} from "lucide-react"

type Tab = "overview" | "tickets" | "attendees" | "checkin" | "promo" | "waitlist" | "comms"

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "tickets", label: "Tickets" },
  { key: "attendees", label: "Attendees" },
  { key: "checkin", label: "Check-in" },
  { key: "promo", label: "Promo codes" },
  { key: "waitlist", label: "Waitlist" },
  { key: "comms", label: "Comms" },
]

const lkr = (n: any) => `LKR ${Number(n || 0).toLocaleString()}`

export default function ManageEventPage() {
  const { user } = useAuth()
  const params = useParams<{ id: string }>()
  const id = params?.id as string

  const [tab, setTab] = useState<Tab>("overview")
  const [event, setEvent] = useState<any>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [postponeOpen, setPostponeOpen] = useState(false)

  const loadEvent = useCallback(async () => {
    try {
      const res = await adminEventManage.get(id)
      setEvent(res.data?.data?.event ?? null)
      setTickets(res.data?.data?.ticket_types ?? [])
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Couldn't load event.")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadEvent() }, [loadEvent])

  const salesPaused = tickets.length > 0 && tickets.every((t) => t.is_active === false)

  const toggleSales = async (resume: boolean) => {
    setBusy(true)
    try {
      await (resume ? adminEventManage.resumeSales(id) : adminEventManage.pauseSales(id))
      toast.success(resume ? "Sales resumed." : "Sales paused.")
      loadEvent()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed.")
    } finally {
      setBusy(false)
    }
  }

  const cancelEvent = async () => {
    const reason = window.prompt("Cancel this event? Confirmed bookings will be queued for refund and attendees notified.\n\nOptional reason:")
    if (reason === null) return
    setBusy(true)
    try {
      await adminEventManage.cancel(id, reason.trim() || undefined)
      toast.success("Event cancelled.")
      loadEvent()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed.")
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={["superadmin"]}>
        <AdminLayout user={user ?? undefined}><PageLoader /></AdminLayout>
      </ProtectedRoute>
    )
  }

  if (!event) {
    return (
      <ProtectedRoute requiredRoles={["superadmin"]}>
        <AdminLayout user={user ?? undefined}>
          <div className="p-6">
            <p className="text-sm text-muted-foreground">Event not found.</p>
            <Link href="/events" className="text-sm text-primary hover:underline">Back to events</Link>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  const when = event.start_time || event.date
  const canManage = ["approved", "pending"].includes(event.approval_status)

  return (
    <ProtectedRoute requiredRoles={["superadmin"]}>
      <AdminLayout user={user ?? undefined}>
        <div className="p-6 space-y-6">
          <Link href={`/events/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to event
          </Link>

          {/* Header + live controls */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
                <span className="rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-xs">Admin override</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="capitalize">{event.approval_status}</span>
                {when && <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{new Date(when).toLocaleString()}</span>}
                {event.venue_name && <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{event.venue_name}</span>}
              </div>
            </div>
            {canManage && event.approval_status !== "cancelled" && (
              <div className="flex flex-wrap gap-2">
                {salesPaused ? (
                  <button type="button" onClick={() => toggleSales(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
                    <Play className="w-4 h-4" /> Resume sales
                  </button>
                ) : (
                  <button type="button" onClick={() => toggleSales(false)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
                    <Pause className="w-4 h-4" /> Pause sales
                  </button>
                )}
                <button type="button" onClick={() => setPostponeOpen(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
                  <CalendarClock className="w-4 h-4" /> Postpone
                </button>
                <button type="button" onClick={cancelEvent} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/15 text-destructive px-3 py-2 text-sm hover:bg-destructive/25 disabled:opacity-50">
                  <XCircle className="w-4 h-4" /> Cancel event
                </button>
              </div>
            )}
          </div>

          {postponeOpen && (
            <PostponeModal
              eventId={id}
              currentStart={event.start_time ?? event.date ?? null}
              currentEnd={event.end_time ?? null}
              onClose={() => setPostponeOpen(false)}
              onDone={(msg) => {
                setPostponeOpen(false)
                toast.success(msg)
                loadEvent()
              }}
            />
          )}

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-border pb-2">
            {TABS.map((t) => (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className={`px-3.5 py-2 text-sm rounded-md transition-colors ${tab === t.key ? "bg-primary/10 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === "overview" && <OverviewTab event={event} tickets={tickets} salesPaused={salesPaused} />}
          {tab === "tickets" && <TicketsTab eventId={id} tickets={tickets} reload={loadEvent} />}
          {tab === "attendees" && <AttendeesTab eventId={id} />}
          {tab === "checkin" && <CheckinTab eventId={id} />}
          {tab === "promo" && <PromoTab eventId={id} />}
          {tab === "waitlist" && <WaitlistTab eventId={id} />}
          {tab === "comms" && <CommsTab eventId={id} />}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-card p-5">{children}</div>
}

function OverviewTab({ event, tickets, salesPaused }: { event: any; tickets: any[]; salesPaused: boolean }) {
  const sold = tickets.reduce((s, t) => s + (t.quantity_sold || 0), 0)
  const cap = tickets.reduce((s, t) => s + (t.quantity_total || 0), 0)
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card><div className="text-xs uppercase tracking-wide text-muted-foreground">Tickets sold</div><div className="mt-1 text-2xl font-bold">{sold}{cap ? ` / ${cap}` : ""}</div></Card>
      <Card><div className="text-xs uppercase tracking-wide text-muted-foreground">Ticket types</div><div className="mt-1 text-2xl font-bold">{tickets.length}</div></Card>
      <Card><div className="text-xs uppercase tracking-wide text-muted-foreground">Sales status</div><div className="mt-1 text-2xl font-bold">{salesPaused ? "Paused" : "Active"}</div></Card>
      <div className="sm:col-span-3"><Card>
        <div className="text-sm font-semibold mb-2">Event</div>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.description || "No description."}</p>
      </Card></div>
    </div>
  )
}

function TicketsTab({ eventId, tickets, reload }: { eventId: string; tickets: any[]; reload: () => void }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<any>({ name: "", price: "", quantity_total: "", per_order_limit: "10", is_active: true })
  const [busy, setBusy] = useState(false)

  const start = (t: any) => { setEditing(t.id); setDraft({ name: t.name, price: String(t.price), quantity_total: String(t.quantity_total), per_order_limit: String(t.per_order_limit), is_active: t.is_active }) }
  const startNew = () => { setEditing("new"); setDraft({ name: "", price: "", quantity_total: "", per_order_limit: "10", is_active: true }) }

  const save = async () => {
    const body = { name: draft.name.trim(), price: Number(draft.price), quantity_total: parseInt(draft.quantity_total, 10), per_order_limit: parseInt(draft.per_order_limit, 10), is_active: draft.is_active, description: draft.description || null }
    setBusy(true)
    try {
      if (editing === "new") await adminEventManage.createTicketType(eventId, body)
      else await adminEventManage.updateTicketType(eventId, editing!, body)
      toast.success("Saved.")
      setEditing(null); reload()
    } catch (e: any) { toast.error(e?.response?.data?.message || "Failed.") } finally { setBusy(false) }
  }
  const del = async (t: any) => {
    if (!confirm(`Delete ticket type "${t.name}"?`)) return
    try { await adminEventManage.deleteTicketType(eventId, t.id); toast.success("Deleted."); reload() }
    catch (e: any) { toast.error(e?.response?.data?.message || "Failed.") }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Ticket types</h2>
        {editing !== "new" && <button type="button" onClick={startNew} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"><Plus className="w-3.5 h-3.5" /> Add</button>}
      </div>
      <ul className="space-y-2">
        {tickets.map((t) => editing === t.id ? (
          <DraftRow key={t.id} draft={draft} setDraft={setDraft} busy={busy} onSave={save} onCancel={() => setEditing(null)} />
        ) : (
          <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <div className="font-medium text-sm">{t.name} {!t.is_active && <span className="text-xs text-muted-foreground">· inactive</span>}</div>
              <div className="text-xs text-muted-foreground">{lkr(t.price)} · {t.quantity_sold}/{t.quantity_total} sold · max {t.per_order_limit}/order</div>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => start(t)} className="px-2 py-1 rounded text-xs border border-border hover:bg-muted">Edit</button>
              <button type="button" onClick={() => del(t)} disabled={t.quantity_sold > 0} className="px-2 py-1 rounded text-xs text-destructive hover:bg-destructive/10 disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </li>
        ))}
        {editing === "new" && <DraftRow draft={draft} setDraft={setDraft} busy={busy} onSave={save} onCancel={() => setEditing(null)} />}
        {tickets.length === 0 && editing !== "new" && <li className="text-sm text-muted-foreground">No ticket types.</li>}
      </ul>
    </Card>
  )
}

function DraftRow({ draft, setDraft, busy, onSave, onCancel }: any) {
  const inp = "rounded-md border border-input bg-background px-2.5 py-2 text-sm w-full"
  return (
    <li className="space-y-2 rounded-lg border border-primary/40 p-3">
      <div className="grid grid-cols-2 gap-2">
        <input className={inp} placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <input className={inp} type="number" placeholder="Price" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
        <input className={inp} type="number" placeholder="Total qty" value={draft.quantity_total} onChange={(e) => setDraft({ ...draft, quantity_total: e.target.value })} />
        <input className={inp} type="number" placeholder="Per-order limit" value={draft.per_order_limit} onChange={(e) => setDraft({ ...draft, per_order_limit: e.target.value })} />
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} /> Active
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded text-xs border border-border hover:bg-muted">Cancel</button>
        <button type="button" onClick={onSave} disabled={busy} className="px-3 py-1.5 rounded text-xs bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
      </div>
    </li>
  )
}

function AttendeesTab({ eventId }: { eventId: string }) {
  const [rows, setRows] = useState<any[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const load = useCallback(async () => {
    try { const r = await adminEventManage.bookings(eventId); setRows(r.data?.data?.bookings ?? []) }
    catch { setRows([]) }
  }, [eventId])
  useEffect(() => { load() }, [load])
  const resend = async (b: any) => { setBusyId(b.id); try { await adminEventManage.resendBooking(eventId, b.id); toast.success("Confirmation resent.") } catch (e: any) { toast.error(e?.response?.data?.message || "Failed.") } finally { setBusyId(null) } }
  const refund = async (b: any) => { if (!confirm(`Refund booking ${b.booking_reference}?`)) return; setBusyId(b.id); try { await adminEventManage.refundBooking(eventId, b.id); toast.success("Refund requested."); load() } catch (e: any) { toast.error(e?.response?.data?.message || "Failed.") } finally { setBusyId(null) } }
  if (!rows) return <Card><Loader className="w-5 h-5 animate-spin text-muted-foreground" /></Card>
  if (rows.length === 0) return <Card><p className="text-sm text-muted-foreground">No bookings yet.</p></Card>
  return (
    <Card>
      <ul className="divide-y divide-border">
        {rows.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className="font-medium text-sm">{b.attendee_info?.name || b.guest_name || "—"} <span className="text-xs text-muted-foreground">· {b.short_code || b.booking_reference}</span></div>
              <div className="text-xs text-muted-foreground">{b.attendee_info?.email || b.guest_email || "—"} · {b.number_of_tickets} ticket(s) · {lkr(b.total_amount)} · {b.status}{b.checked_in_at ? " · checked in" : ""}</div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button type="button" onClick={() => resend(b)} disabled={busyId === b.id} className="px-2 py-1 rounded text-xs border border-border hover:bg-muted disabled:opacity-50">Resend</button>
              {b.status === "Confirmed" && <button type="button" onClick={() => refund(b)} disabled={busyId === b.id} className="px-2 py-1 rounded text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50">Refund</button>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function CheckinTab({ eventId }: { eventId: string }) {
  const [data, setData] = useState<any>(null)
  useEffect(() => { (async () => { try { const r = await adminEventManage.checkInStatus(eventId); setData(r.data?.data ?? null) } catch { setData(null) } })() }, [eventId])
  if (!data) return <Card><Loader className="w-5 h-5 animate-spin text-muted-foreground" /></Card>
  const t = data.totals || {}
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card><div className="text-xs uppercase tracking-wide text-muted-foreground">Checked in</div><div className="mt-1 text-2xl font-bold">{t.checked_in_tickets}/{t.tickets}</div><div className="text-xs text-muted-foreground mt-1">{t.checked_in_pct}%</div></Card>
      <Card><div className="text-xs uppercase tracking-wide text-muted-foreground">Bookings</div><div className="mt-1 text-2xl font-bold">{t.checked_in_bookings}/{t.bookings}</div></Card>
      <div className="sm:col-span-3"><Card>
        <div className="text-sm font-semibold mb-2 inline-flex items-center gap-1.5"><Users className="w-4 h-4" /> Recent check-ins</div>
        {(data.recent ?? []).length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : (
          <ul className="divide-y divide-border">{data.recent.map((r: any) => (
            <li key={r.id} className="flex justify-between py-2 text-sm"><span>{r.name || r.booking_reference}</span><span className="text-muted-foreground text-xs">{r.checked_in_at ? new Date(r.checked_in_at).toLocaleTimeString() : ""}</span></li>
          ))}</ul>
        )}
      </Card></div>
    </div>
  )
}

function PromoTab({ eventId }: { eventId: string }) {
  const [rows, setRows] = useState<any[] | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>({ code: "", discount_type: "percentage", discount_value: "", max_uses: "" })
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { try { const r = await adminEventManage.listPromos(eventId); setRows(r.data?.data?.promo_codes ?? []) } catch { setRows([]) } }, [eventId])
  useEffect(() => { load() }, [load])
  const create = async () => {
    setBusy(true)
    try { await adminEventManage.createPromo(eventId, { code: form.code, discount_type: form.discount_type, discount_value: Number(form.discount_value), max_uses: form.max_uses || undefined }); toast.success("Promo created."); setOpen(false); setForm({ code: "", discount_type: "percentage", discount_value: "", max_uses: "" }); load() }
    catch (e: any) { toast.error(e?.response?.data?.message || "Failed.") } finally { setBusy(false) }
  }
  const del = async (c: any) => { if (!confirm(`Delete code ${c.code}?`)) return; try { await adminEventManage.deletePromo(eventId, c.id); toast.success("Deleted."); load() } catch (e: any) { toast.error(e?.response?.data?.message || "Failed.") } }
  if (!rows) return <Card><Loader className="w-5 h-5 animate-spin text-muted-foreground" /></Card>
  const inp = "rounded-md border border-input bg-background px-2.5 py-2 text-sm w-full"
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Promo codes</h2>
        <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"><Plus className="w-3.5 h-3.5" /> {open ? "Close" : "Add"}</button>
      </div>
      {open && (
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg border border-border p-3">
          <input className={inp} placeholder="CODE" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          <select className={inp} value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}><option value="percentage">Percentage</option><option value="fixed">Fixed (LKR)</option></select>
          <input className={inp} type="number" placeholder="Discount value" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} />
          <input className={inp} type="number" placeholder="Max uses (optional)" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} />
          <div className="col-span-2 flex justify-end"><button type="button" onClick={create} disabled={busy} className="px-3 py-1.5 rounded text-xs bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">{busy ? "Creating…" : "Create"}</button></div>
        </div>
      )}
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No promo codes.</p> : (
        <ul className="divide-y divide-border">{rows.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-2.5 text-sm">
            <div><span className="font-mono font-semibold">{c.code}</span> <span className="text-muted-foreground text-xs">· {c.discount_type === "percentage" ? `${c.discount_value}%` : lkr(c.discount_value)} · used {c.used_count}{c.max_uses ? `/${c.max_uses}` : ""}{c.active ? "" : " · inactive"}</span></div>
            <button type="button" onClick={() => del(c)} className="px-2 py-1 rounded text-xs text-destructive hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5" /></button>
          </li>
        ))}</ul>
      )}
    </Card>
  )
}

function WaitlistTab({ eventId }: { eventId: string }) {
  const [rows, setRows] = useState<any[] | null>(null)
  useEffect(() => { (async () => { try { const r = await adminEventManage.waitlist(eventId); setRows(r.data?.data?.waitlist ?? []) } catch { setRows([]) } })() }, [eventId])
  if (!rows) return <Card><Loader className="w-5 h-5 animate-spin text-muted-foreground" /></Card>
  if (rows.length === 0) return <Card><p className="text-sm text-muted-foreground">No one on the waitlist.</p></Card>
  return (
    <Card>
      <ul className="divide-y divide-border">{rows.map((w) => (
        <li key={w.id} className="flex items-center justify-between py-2.5 text-sm">
          <div><div className="font-medium">{w.name || "—"}</div><div className="text-xs text-muted-foreground">{w.email}{w.phone ? ` · ${w.phone}` : ""} · qty {w.requested_quantity}</div></div>
          <span className="text-xs text-muted-foreground">{w.notified_at ? "Notified" : "Waiting"}</span>
        </li>
      ))}</ul>
    </Card>
  )
}

function CommsTab({ eventId }: { eventId: string }) {
  const [message, setMessage] = useState("")
  const [channel, setChannel] = useState<"email" | "sms" | "both">("email")
  const [busy, setBusy] = useState(false)
  const send = async () => {
    if (!message.trim()) { toast.error("Write a message first."); return }
    if (!confirm(`Send this ${channel} announcement to all confirmed attendees?`)) return
    setBusy(true)
    try { const r = await adminEventManage.announce(eventId, { message: message.trim(), channel }); toast.success(r.data?.message || "Sent."); setMessage("") }
    catch (e: any) { toast.error(e?.response?.data?.message || "Failed.") } finally { setBusy(false) }
  }
  return (
    <Card>
      <h2 className="text-sm font-semibold mb-3 inline-flex items-center gap-1.5"><Megaphone className="w-4 h-4" /> Announce to attendees</h2>
      <div className="space-y-3">
        <select value={channel} onChange={(e) => setChannel(e.target.value as any)} className="rounded-md border border-input bg-background px-2.5 py-2 text-sm">
          <option value="email">Email</option><option value="sms">SMS</option><option value="both">Email + SMS</option>
        </select>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder="Your message to all confirmed attendees…" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <div className="flex justify-end">
          <button type="button" onClick={send} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {busy ? <Loader className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />} Send announcement
          </button>
        </div>
      </div>
    </Card>
  )
}

// ISO timestamp -> value for <input type="datetime-local"> (local time).
function toLocalInput(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Postpone (reschedule) modal — admin override. Picks a new date/time and
// optionally notifies confirmed attendees. Tickets stay valid.
function PostponeModal({
  eventId,
  currentStart,
  currentEnd,
  onClose,
  onDone,
}: {
  eventId: string
  currentStart: string | null
  currentEnd: string | null
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [start, setStart] = useState(toLocalInput(currentStart))
  const [end, setEnd] = useState(toLocalInput(currentEnd))
  const [reason, setReason] = useState("")
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  const submit = async () => {
    if (!start) { setErr("Pick a new date and time."); return }
    if (end && end < start) { setErr("End time must be after the new start time."); return }
    setBusy(true)
    setErr("")
    try {
      const r = await adminEventManage.postpone(eventId, {
        new_start_time: start,
        new_end_time: end || undefined,
        reason: reason.trim() || undefined,
        notify,
      })
      onDone(r.data?.message || "Event postponed.")
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to postpone.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Postpone event</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Move this event to a new date. Existing tickets stay valid.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {err && <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}

        <div className="space-y-4">
          <div>
            <label htmlFor="pp-start" className="mb-1.5 block text-sm font-medium">New start <span className="text-destructive">*</span></label>
            <input id="pp-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="pp-end" className="mb-1.5 block text-sm font-medium">New end <span className="text-muted-foreground">(optional)</span></label>
            <input id="pp-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="pp-reason" className="mb-1.5 block text-sm font-medium">Reason <span className="text-muted-foreground">(optional)</span></label>
            <textarea id="pp-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} placeholder="Shared with attendees in the notification." className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-4 w-4 rounded border-border" />
            Notify confirmed attendees by email &amp; SMS
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">Cancel</button>
          <button type="button" onClick={submit} disabled={busy || !start} className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {busy ? <Loader className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
            {busy ? "Postponing…" : "Postpone event"}
          </button>
        </div>
      </div>
    </div>
  )
}
