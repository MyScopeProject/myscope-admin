"use client"

// Admin "Create event for organizer" page.
//
// Purpose: bootstrap an event on behalf of an approved organizer who can't
// self-host (partnered events, organizers without web access, etc.). The
// event is pre-approved at the backend so it doesn't sit in the review queue,
// but lands with is_active=false — the organizer still publishes it from
// their dashboard when ready. From that point the event is indistinguishable
// from one the organizer created themselves.

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { adminAPI } from "@/lib/apiEndpoints"
import { useAuth } from "@/contexts/auth-context"
import toast from "react-hot-toast"
import {
  AlertCircle,
  Calendar,
  Check,
  ChevronDown,
  Loader,
  Plus,
  Search,
  Trash2,
  User,
} from "lucide-react"

// ---------- types ----------

type SeatingMode = "none" | "free"

interface Organizer {
  user_id: string
  business_name: string
  contact_name: string | null
  email: string | null
  profile_image: string | null
}

interface TicketTypeDraft {
  id: string // local-only key for React list rendering
  name: string
  description: string
  price: string
  quantity_total: string
  per_order_limit: string
}

const emptyTicket = (): TicketTypeDraft => ({
  id: Math.random().toString(36).slice(2, 9),
  name: "",
  description: "",
  price: "",
  quantity_total: "",
  per_order_limit: "10",
})

const SEATING_OPTIONS: { value: SeatingMode; label: string; hint: string }[] = [
  { value: "none", label: "General admission", hint: "No assigned seating." },
  { value: "free", label: "Free seating",      hint: "Open seating area within the venue." },
]

export default function AdminCreateEventForOrganizerPage() {
  const { user } = useAuth()
  const router = useRouter()

  // ---- organizer picker ----
  const [organizers, setOrganizers] = useState<Organizer[]>([])
  const [orgLoading, setOrgLoading] = useState(true)
  const [orgQuery, setOrgQuery] = useState("")
  const [orgPickerOpen, setOrgPickerOpen] = useState(false)
  const [selectedOrg, setSelectedOrg] = useState<Organizer | null>(null)

  // ---- event fields ----
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [venueName, setVenueName] = useState("")
  const [venueAddress, setVenueAddress] = useState("")
  const [venueLocationUrl, setVenueLocationUrl] = useState("")
  const [capacity, setCapacity] = useState("")
  const [seatingMode, setSeatingMode] = useState<SeatingMode>("none")
  const [bannerUrl, setBannerUrl] = useState("")

  // ---- tickets ----
  const [tickets, setTickets] = useState<TicketTypeDraft[]>([emptyTicket()])

  const [submitting, setSubmitting] = useState(false)

  // ---- load organizers ----
  useEffect(() => {
    let cancelled = false
    setOrgLoading(true)
    adminAPI
      .listApprovedOrganizers()
      .then((res) => {
        if (cancelled) return
        setOrganizers(res.data?.data?.organizers ?? [])
      })
      .catch(() => {
        if (cancelled) return
        toast.error("Failed to load organizers")
      })
      .finally(() => {
        if (!cancelled) setOrgLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filteredOrgs = useMemo(() => {
    const q = orgQuery.trim().toLowerCase()
    if (!q) return organizers
    return organizers.filter((o) => {
      return (
        o.business_name.toLowerCase().includes(q) ||
        (o.contact_name ?? "").toLowerCase().includes(q) ||
        (o.email ?? "").toLowerCase().includes(q)
      )
    })
  }, [organizers, orgQuery])

  // ---- ticket edits ----
  const updateTicket = (id: string, patch: Partial<TicketTypeDraft>) =>
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  const addTicket = () => setTickets((prev) => [...prev, emptyTicket()])
  const removeTicket = (id: string) =>
    setTickets((prev) => (prev.length <= 1 ? prev : prev.filter((t) => t.id !== id)))

  // ---- submit ----
  const submit = async () => {
    if (!selectedOrg) {
      toast.error("Pick an organizer to create the event for.")
      return
    }
    if (!title.trim()) {
      toast.error("Event title is required.")
      return
    }
    if (!startTime) {
      toast.error("Start time is required.")
      return
    }
    if (endTime && new Date(endTime) <= new Date(startTime)) {
      toast.error("End time must be after start time.")
      return
    }

    // Validate tickets locally before round-tripping.
    const cleanedTickets: Array<{
      name: string
      description?: string | null
      price: number
      quantity_total: number
      per_order_limit?: number
    }> = []
    for (const t of tickets) {
      const name = t.name.trim()
      if (!name) {
        toast.error("Each ticket type needs a name.")
        return
      }
      const price = Number(t.price)
      if (!Number.isFinite(price) || price < 0) {
        toast.error(`Ticket "${name}": price must be a non-negative number.`)
        return
      }
      const qty = Number.parseInt(t.quantity_total, 10)
      if (!Number.isInteger(qty) || qty <= 0) {
        toast.error(`Ticket "${name}": quantity must be a positive integer.`)
        return
      }
      const perOrder = t.per_order_limit ? Number.parseInt(t.per_order_limit, 10) : 10
      if (!Number.isInteger(perOrder) || perOrder <= 0) {
        toast.error(`Ticket "${name}": per-order limit must be a positive integer.`)
        return
      }
      cleanedTickets.push({
        name,
        description: t.description.trim() || null,
        price,
        quantity_total: qty,
        per_order_limit: perOrder,
      })
    }

    setSubmitting(true)
    try {
      const res = await adminAPI.createEventForOrganizer({
        organizer_id: selectedOrg.user_id,
        title: title.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        venue_name: venueName.trim() || null,
        venue_address: venueAddress.trim() || null,
        venue_location_url: venueLocationUrl.trim() || null,
        banner_url: bannerUrl.trim() || null,
        start_time: new Date(startTime).toISOString(),
        end_time: endTime ? new Date(endTime).toISOString() : null,
        capacity: capacity ? Number.parseInt(capacity, 10) : null,
        seating_mode: seatingMode,
        ticket_types: cleanedTickets,
      })
      const created = (res.data as { success: boolean; data?: { event?: { id?: string } } })
      const newId = created?.data?.event?.id
      toast.success(`Event created. Organizer notified by email.`)
      if (newId) {
        router.push(`/events/${newId}`)
      } else {
        router.push(`/events`)
      }
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e.response?.data?.message || "Failed to create event.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ProtectedRoute>
      <AdminLayout user={user || undefined}>
        <div className="space-y-8 max-w-4xl">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create event for organizer</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              Set up an event on behalf of an approved organizer. The event is pre-approved when you
              save — it lands in the organizer's dashboard ready to publish. From there it behaves
              the same as an event they created themselves.
            </p>
          </div>

          {/* Organizer picker */}
          <section className="space-y-2">
            <SectionLabel
              step={1}
              label="Choose organizer"
              hint="Only approved organizers appear in the list."
            />

            {orgLoading ? (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 dark:border-gray-600">
                <Loader className="h-4 w-4 animate-spin" />
                Loading organizers…
              </div>
            ) : organizers.length === 0 ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  No approved organizers yet. Approve at least one organizer from the Organizers
                  page first.
                </span>
              </div>
            ) : (
              <OrganizerPicker
                selected={selectedOrg}
                open={orgPickerOpen}
                setOpen={setOrgPickerOpen}
                query={orgQuery}
                setQuery={setOrgQuery}
                results={filteredOrgs}
                onPick={(o) => {
                  setSelectedOrg(o)
                  setOrgPickerOpen(false)
                }}
              />
            )}
          </section>

          {/* Event details */}
          <section className="space-y-4">
            <SectionLabel step={2} label="Event details" />
            <Field label="Title" required>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={255}
                className={inputClass}
                placeholder="e.g. The Live Sessions 2026"
              />
            </Field>

            <Field label="Category">
              {/* Dropdown mirrors the organizer create-event flow's category
                  options so admin-created events use the same canonical set. */}
              <select
                aria-label="Event category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass}
              >
                <option value="">Pick one…</option>
                <option value="Concerts">Concerts</option>
                <option value="Theatre">Theatre</option>
                <option value="Sports">Sports</option>
                <option value="Events">Events</option>
              </select>
            </Field>

            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={10_000}
                rows={4}
                className={`${inputClass} resize-y`}
                placeholder="What's the show about?"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Start time" required>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="End time">
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </section>

          {/* Venue */}
          <section className="space-y-4">
            <SectionLabel step={3} label="Venue" />
            <Field label="Venue name">
              <input
                type="text"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                maxLength={255}
                className={inputClass}
                placeholder="Nelum Pokuna Mahinda Rajapaksa Theatre"
              />
            </Field>
            <Field label="Address">
              <input
                type="text"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                maxLength={1024}
                className={inputClass}
                placeholder="No. 12, Ananda Coomaraswamy Mawatha, Colombo 07"
              />
            </Field>
            <Field label="Map link (Google Maps URL)">
              <input
                type="url"
                value={venueLocationUrl}
                onChange={(e) => setVenueLocationUrl(e.target.value)}
                maxLength={2048}
                className={inputClass}
                placeholder="https://maps.app.goo.gl/…"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Capacity">
                <input
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className={inputClass}
                  placeholder="Optional"
                />
              </Field>
              <Field
                label="Seating mode"
                hint="Reserved/zoned seating is set up from the organizer dashboard after handoff."
              >
                <select
                  value={seatingMode}
                  onChange={(e) => setSeatingMode(e.target.value as SeatingMode)}
                  className={inputClass}
                >
                  {SEATING_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label} — {o.hint}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          {/* Media */}
          <section className="space-y-4">
            <SectionLabel step={4} label="Cover image" hint="Paste a URL — the organizer can swap it later." />
            <Field label="Banner image URL">
              <input
                type="url"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                maxLength={2048}
                className={inputClass}
                placeholder="https://…/banner.jpg"
              />
            </Field>
            {bannerUrl ? (
              <div className="relative h-48 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bannerUrl}
                  alt="Banner preview"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display = "none"
                  }}
                />
              </div>
            ) : null}
          </section>

          {/* Tickets */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <SectionLabel
                step={5}
                label="Ticket types"
                hint="At least one is required. The organizer can refine or add more later."
              />
              <button
                type="button"
                onClick={addTicket}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add ticket type
              </button>
            </div>

            <ul className="space-y-3">
              {tickets.map((t, i) => (
                <li
                  key={t.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      Ticket type #{i + 1}
                    </div>
                    {tickets.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeTicket(t.id)}
                        title="Remove ticket type"
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Name" required>
                      <input
                        type="text"
                        value={t.name}
                        onChange={(e) => updateTicket(t.id, { name: e.target.value })}
                        maxLength={100}
                        className={inputClass}
                        placeholder="Early bird"
                      />
                    </Field>
                    <Field label="Price (LKR)" required>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={t.price}
                        onChange={(e) => updateTicket(t.id, { price: e.target.value })}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Quantity" required>
                      <input
                        type="number"
                        min={1}
                        value={t.quantity_total}
                        onChange={(e) => updateTicket(t.id, { quantity_total: e.target.value })}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Per-order limit">
                      <input
                        type="number"
                        min={1}
                        value={t.per_order_limit}
                        onChange={(e) => updateTicket(t.id, { per_order_limit: e.target.value })}
                        className={inputClass}
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Description">
                        <input
                          type="text"
                          value={t.description}
                          onChange={(e) => updateTicket(t.id, { description: e.target.value })}
                          maxLength={1024}
                          className={inputClass}
                          placeholder="Optional perks or restrictions"
                        />
                      </Field>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Submit */}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 pt-6 dark:border-gray-700">
            <button
              type="button"
              onClick={() => router.push("/events")}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {submitting ? "Creating…" : "Create event"}
            </button>
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}

// ---------------------------------------------------------------------------
// Sub-components — kept inline so the page is self-contained.
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"

function SectionLabel({
  step,
  label,
  hint,
}: {
  step: number
  label: string
  hint?: string
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
        {step}
      </span>
      <div>
        <div className="text-base font-semibold tracking-tight">{label}</div>
        {hint ? <div className="text-xs text-gray-500">{hint}</div> : null}
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-500">
        {label}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[11px] text-gray-500">{hint}</p> : null}
    </div>
  )
}

function OrganizerPicker({
  selected,
  open,
  setOpen,
  query,
  setQuery,
  results,
  onPick,
}: {
  selected: Organizer | null
  open: boolean
  setOpen: (v: boolean) => void
  query: string
  setQuery: (v: string) => void
  results: Organizer[]
  onPick: (o: Organizer) => void
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-left hover:border-blue-400 dark:border-gray-600 dark:bg-gray-800"
      >
        {selected ? (
          <div className="flex min-w-0 items-center gap-3">
            <OrgAvatar org={selected} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                {selected.business_name}
              </div>
              <div className="truncate text-xs text-gray-500">
                {selected.contact_name ? `${selected.contact_name} · ` : ""}
                {selected.email}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <User className="h-4 w-4" />
            Pick an approved organizer…
          </div>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="relative border-b border-gray-200 dark:border-gray-700">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, business, or email"
              className="w-full bg-transparent px-9 py-2.5 text-sm focus:outline-none"
              autoFocus
            />
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {results.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-gray-500">
                No organizers match that search.
              </li>
            ) : (
              results.map((o) => (
                <li key={o.user_id}>
                  <button
                    type="button"
                    onClick={() => onPick(o)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <OrgAvatar org={o} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                        {o.business_name}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {o.contact_name ? `${o.contact_name} · ` : ""}
                        {o.email}
                      </div>
                    </div>
                    {selected?.user_id === o.user_id ? (
                      <Check className="h-4 w-4 shrink-0 text-blue-600" />
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function OrgAvatar({ org }: { org: Organizer }) {
  if (org.profile_image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={org.profile_image}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700"
      />
    )
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
      {(org.business_name?.[0] ?? "?").toUpperCase()}
    </div>
  )
}
