"use client"

// Admin "Create event for organizer" — multi-step wizard.
//
// Purpose: bootstrap an event on behalf of an approved organizer who can't
// self-host (partnered events, organizers without web access, etc.). The
// event is pre-approved at the backend so it doesn't sit in the review queue,
// but lands with is_active=false — the organizer still publishes it from
// their dashboard when ready. From that point the event is indistinguishable
// from one the organizer created themselves.
//
// The step flow + visual language mirror the organizer's own create-event
// wizard (myscope-web/src/app/organizer/events/create). The admin app shares
// the same design tokens (bg-card/border-input/text-foreground/primary) and
// the same Button/Input/cn primitives, so the two forms look the same. The
// only structural difference is the extra "Organizer" step at the front.
//
// Contract deviations from the organizer flow (dictated by POST /admin/events):
//   • No seat-map builder for reserved/zoned — the mode is set here, but the
//     seat map / layout is completed by the organizer from their dashboard.
//   • Media step only has a banner (no layout image / trailer fields).
//   • No SMS-reminder / free-seating-tier fields — those aren't part of the
//     admin create payload.

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { adminAPI } from "@/lib/apiEndpoints"
import { useAuth } from "@/contexts/auth-context"
import toast from "react-hot-toast"
import {
  AlertCircle,
  Armchair,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  LayoutGrid,
  Loader,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Tag,
  Ticket,
  Trash2,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// ---------- types ----------

type SeatingMode = "none" | "free" | "zoned" | "reserved"

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

// Mirrors the organizer create-event flow's seating modes (label, description,
// icon) so the admin bootstrap form offers the same four choices with the same
// card UX. Zoned/reserved events are created here; their seat map / layout is
// completed from the organizer dashboard after handoff.
const SEATING_MODES: { value: SeatingMode; label: string; description: string; icon: typeof Ticket }[] = [
  { value: "none",     label: "No seating",       description: "Tickets only — no seat assignment. Best for festivals, workshops, online events.", icon: Ticket },
  { value: "free",     label: "Free seating",     description: "Venue has seats but attendees pick on arrival. Best for open conferences, small halls.", icon: Armchair },
  { value: "zoned",    label: "Zoned seating",    description: "Different sections with separate prices (VIP, GA, Balcony). No exact seat selection.", icon: LayoutGrid },
  { value: "reserved", label: "Reserved seating", description: "Attendees pick their exact seat from a venue map at checkout.", icon: MapPin },
]

const STEPS = ["Organizer", "Details", "Tickets", "Media", "Review"] as const

// Token-styled field controls copied from the organizer wizard so the two
// forms are visually identical (the admin app exposes the same CSS tokens).
const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
const textareaClass =
  "w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"

export default function AdminCreateEventForOrganizerPage() {
  const { user } = useAuth()
  const router = useRouter()

  // ---- wizard ----
  const [step, setStep] = useState(0)
  const lastStep = STEPS.length - 1
  const [error, setError] = useState("")

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

  const isZoned = seatingMode === "zoned"
  const tierLabel = isZoned ? "Zone" : "Ticket"

  // ---- per-step validation (mirrors the organizer wizard's) ----
  const validateStep = (s: number): string => {
    if (s === 0) {
      if (!selectedOrg) return "Pick an organizer to create the event for."
    }
    if (s === 1) {
      if (!title.trim()) return "Event title is required."
      if (!startTime) return "Start time is required."
      if (endTime && new Date(endTime) <= new Date(startTime)) {
        return "End time must be after start time."
      }
    }
    if (s === 2) {
      if (tickets.length === 0) return "Add at least one ticket type."
      for (const [i, t] of tickets.entries()) {
        if (!t.name.trim()) return `${tierLabel} #${i + 1}: name is required.`
        const price = Number(t.price)
        if (!Number.isFinite(price) || price < 0) {
          return `${tierLabel} #${i + 1}: price must be a non-negative number.`
        }
        const qty = Number.parseInt(t.quantity_total, 10)
        if (!Number.isInteger(qty) || qty <= 0) {
          return `${tierLabel} #${i + 1}: quantity must be a positive integer.`
        }
        const limit = t.per_order_limit ? Number.parseInt(t.per_order_limit, 10) : 10
        if (!Number.isInteger(limit) || limit <= 0) {
          return `${tierLabel} #${i + 1}: per-order limit must be a positive integer.`
        }
      }
    }
    return ""
  }

  const goNext = () => {
    const err = validateStep(step)
    if (err) {
      setError(err)
      return
    }
    setError("")
    setStep((s) => Math.min(lastStep, s + 1))
  }

  const goBack = () => {
    setError("")
    setStep((s) => Math.max(0, s - 1))
  }

  // ---- submit ----
  const submit = async () => {
    // Validate every required step regardless of where the user is; jump to
    // the first offending step so the error is in context.
    for (const s of [0, 1, 2]) {
      const err = validateStep(s)
      if (err) {
        setError(err)
        setStep(s)
        return
      }
    }
    setError("")

    const cleanedTickets = tickets.map((t) => ({
      name: t.name.trim(),
      description: t.description.trim() || null,
      price: Number(t.price),
      quantity_total: Number.parseInt(t.quantity_total, 10),
      per_order_limit: t.per_order_limit ? Number.parseInt(t.per_order_limit, 10) : 10,
    }))

    setSubmitting(true)
    try {
      const res = await adminAPI.createEventForOrganizer({
        organizer_id: selectedOrg!.user_id,
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
      const created = res.data as { success: boolean; data?: { event?: { id?: string } } }
      const newId = created?.data?.event?.id
      toast.success("Event created. Organizer notified by email.")
      router.push(newId ? `/events/${newId}` : "/events")
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
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Back */}
          <button
            type="button"
            onClick={() => router.push("/events")}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to events
          </button>

          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Create event for organizer
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Set up an event on behalf of an approved organizer. It&rsquo;s pre-approved when you
              create it — it lands in the organizer&rsquo;s dashboard ready to publish.
            </p>
          </div>

          {/* Stepper */}
          <StepIndicator current={step} steps={STEPS} />

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Step card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-8">
            {/* --- Step 1: Organizer --- */}
            {step === 0 && (
              <div className="space-y-5">
                <StepHeader
                  icon={User}
                  title="Choose organizer"
                  subtitle="Only approved organizers appear here. The event is created on their behalf."
                />
                {orgLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                    <Loader className="h-4 w-4 animate-spin" />
                    Loading organizers…
                  </div>
                ) : organizers.length === 0 ? (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      No approved organizers yet. Approve at least one from the Organizers page first.
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
              </div>
            )}

            {/* --- Step 2: Details --- */}
            {step === 1 && (
              <div className="space-y-6">
                <StepHeader icon={Sparkles} title="Event details" />

                {/* Seating mode */}
                <div className="space-y-2.5">
                  <div>
                    <FieldLabel>Seating mode</FieldLabel>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Pick how attendees take seats. Zoned and reserved events are created here;
                      their seat map / layout is completed from the organizer dashboard after handoff.
                    </p>
                  </div>
                  <div
                    role="radiogroup"
                    aria-label="Seating mode"
                    className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
                  >
                    {SEATING_MODES.map(({ value: mode, label, description, icon: Icon }) => {
                      const selected = seatingMode === mode
                      return (
                        // Native radio (visually hidden) keeps this an accessible
                        // radio group without hand-rolled aria-checked.
                        <label
                          key={mode}
                          className={cn(
                            "group flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-within:ring-2 focus-within:ring-ring/50",
                            selected
                              ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                              : "border-border bg-card hover:border-primary/40 hover:bg-muted/40",
                          )}
                        >
                          <input
                            type="radio"
                            name="seating_mode"
                            value={mode}
                            checked={selected}
                            onChange={() => setSeatingMode(mode)}
                            className="sr-only"
                          />
                          <span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                              selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-foreground">{label}</span>
                              {selected && (
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                  <Check className="h-3 w-3" />
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                              {description}
                            </span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <FieldLabel htmlFor="title" required>Title</FieldLabel>
                  <Input
                    id="title"
                    type="text"
                    maxLength={255}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="The Live Sessions 2026"
                  />
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="category">Category</FieldLabel>
                    <select
                      id="category"
                      aria-label="Event category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Pick one…</option>
                      <option value="Concerts">Concerts</option>
                      <option value="Theatre">Theatre</option>
                      <option value="Sports">Sports</option>
                      <option value="Events">Events</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="capacity">Capacity</FieldLabel>
                    <Input
                      id="capacity"
                      type="number"
                      min={1}
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      placeholder="e.g. 300"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <textarea
                    id="description"
                    rows={5}
                    maxLength={10_000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What should attendees know? Lineup, doors-open time, refund policy…"
                    className={textareaClass}
                  />
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="start_time" required>Start time</FieldLabel>
                    <Input
                      id="start_time"
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="end_time">End time</FieldLabel>
                    <Input
                      id="end_time"
                      type="datetime-local"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <FieldLabel htmlFor="venue_name">Venue name</FieldLabel>
                  <Input
                    id="venue_name"
                    type="text"
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    placeholder="The Warehouse Project"
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel htmlFor="venue_address">Venue address</FieldLabel>
                  <Input
                    id="venue_address"
                    type="text"
                    maxLength={1024}
                    value={venueAddress}
                    onChange={(e) => setVenueAddress(e.target.value)}
                    placeholder="123 Galle Rd, Colombo 03"
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel htmlFor="venue_location_url">Location URL</FieldLabel>
                  <Input
                    id="venue_location_url"
                    type="url"
                    maxLength={2048}
                    value={venueLocationUrl}
                    onChange={(e) => setVenueLocationUrl(e.target.value)}
                    placeholder="https://maps.google.com/..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste a Google Maps link so attendees can find the venue easily.
                  </p>
                </div>
              </div>
            )}

            {/* --- Step 3: Tickets --- */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <Tag className="h-5 w-5 text-primary" />
                    {isZoned ? "Zones" : "Ticket types"}
                  </h2>
                  <Button type="button" variant="outline" size="sm" onClick={addTicket}>
                    <Plus /> {isZoned ? "Add zone" : "Add ticket"}
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground">
                  {isZoned
                    ? "Each zone is a section of your venue with its own capacity and price."
                    : "Each ticket type can have its own price, quantity, and per-order limit."}
                </p>

                <div className="space-y-3">
                  {tickets.map((t, idx) => (
                    <div key={t.id} className="rounded-xl border border-border bg-background/40 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {tierLabel} #{idx + 1}
                        </span>
                        {tickets.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTicket(t.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
                            aria-label={`Remove ${tierLabel.toLowerCase()}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <FieldLabel required>Name</FieldLabel>
                          <Input
                            type="text"
                            maxLength={100}
                            value={t.name}
                            onChange={(e) => updateTicket(t.id, { name: e.target.value })}
                            placeholder={isZoned ? "VIP, GA, Balcony…" : "General, VIP, Early Bird…"}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <FieldLabel required>Price (LKR)</FieldLabel>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={t.price}
                            onChange={(e) => updateTicket(t.id, { price: e.target.value })}
                            placeholder="2500"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <FieldLabel required>Total quantity</FieldLabel>
                          <Input
                            type="number"
                            min={1}
                            value={t.quantity_total}
                            onChange={(e) => updateTicket(t.id, { quantity_total: e.target.value })}
                            placeholder="250"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <FieldLabel>Per-order limit</FieldLabel>
                          <Input
                            type="number"
                            min={1}
                            value={t.per_order_limit}
                            onChange={(e) => updateTicket(t.id, { per_order_limit: e.target.value })}
                            placeholder="10"
                          />
                        </div>
                        <div className="sm:col-span-2 space-y-1.5">
                          <FieldLabel>Description (optional)</FieldLabel>
                          <Input
                            type="text"
                            maxLength={1024}
                            value={t.description}
                            onChange={(e) => updateTicket(t.id, { description: e.target.value })}
                            placeholder="What's included with this ticket?"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- Step 4: Media --- */}
            {step === 3 && (
              <div className="space-y-6">
                <StepHeader
                  icon={ImageIcon}
                  title="Media"
                  subtitle="Upload a banner image. The organizer can swap it from their dashboard later."
                />
                <div className="space-y-1.5">
                  <FieldLabel>Banner image</FieldLabel>
                  <ImageDropzone value={bannerUrl} onChange={setBannerUrl} previewAlt="Banner preview" />
                </div>
              </div>
            )}

            {/* --- Step 5: Review --- */}
            {step === 4 && (
              <div className="space-y-5">
                <StepHeader icon={Check} title="Review" />

                <ReviewBlock title="Organizer">
                  <Row label="Business" value={selectedOrg?.business_name || "—"} />
                  <Row label="Contact" value={selectedOrg?.contact_name || selectedOrg?.email || "—"} />
                </ReviewBlock>

                <ReviewBlock title="Event">
                  <Row label="Title" value={title || "—"} />
                  <Row label="Category" value={category || "—"} />
                  <Row
                    label="Seating"
                    value={SEATING_MODES.find((m) => m.value === seatingMode)?.label || "—"}
                  />
                  <Row label="Starts" value={startTime || "—"} />
                  <Row label="Ends" value={endTime || "—"} />
                  <Row label="Venue" value={venueName || "—"} />
                  <Row label="Address" value={venueAddress || "—"} />
                  <Row label="Location URL" value={venueLocationUrl || "—"} />
                  <Row label="Capacity" value={capacity || "—"} />
                </ReviewBlock>

                <ReviewBlock
                  title={`${isZoned ? "Zones" : "Ticket types"} (${tickets.length}) · ${tickets.reduce(
                    (sum, t) => sum + (Number.parseInt(t.quantity_total, 10) || 0),
                    0,
                  )} total`}
                >
                  {tickets.map((t, i) => (
                    <div key={t.id} className="py-1.5 text-sm">
                      <span className="font-semibold text-foreground">
                        {t.name || `${tierLabel} #${i + 1}`}
                      </span>
                      <span className="text-muted-foreground">
                        {" · "}LKR {t.price || "0"} · {t.quantity_total || "0"} · max{" "}
                        {t.per_order_limit || "10"}/order
                      </span>
                    </div>
                  ))}
                </ReviewBlock>

                <ReviewBlock title="Media">
                  {bannerUrl ? (
                    <div className="space-y-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={bannerUrl}
                        alt="Banner preview"
                        className="h-28 w-auto rounded-lg border border-border bg-muted object-contain"
                        onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                      />
                      <div className="text-[11px] text-muted-foreground">Banner</div>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">No image added</span>
                  )}
                </ReviewBlock>

                {(seatingMode === "zoned" || seatingMode === "reserved") && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      This is a {seatingMode} event. It&rsquo;s created with the mode set, but the
                      seat map / layout is completed by the organizer from their dashboard.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer nav */}
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={goBack} disabled={step === 0}>
              <ChevronLeft /> Back
            </Button>

            {step < lastStep ? (
              <Button type="button" onClick={goNext}>
                Next <ChevronRight />
              </Button>
            ) : (
              <Button type="button" onClick={submit} disabled={submitting} className="min-w-36">
                {submitting ? <Loader className="animate-spin" /> : <Check />}
                {submitting ? "Creating…" : "Create event"}
              </Button>
            )}
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}

// ---------------------------------------------------------------------------
// Sub-components — kept inline so the page is self-contained. Styling mirrors
// the organizer create-event wizard's shared helpers.
// ---------------------------------------------------------------------------

function StepIndicator({ current, steps }: { current: number; steps: readonly string[] }) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                done
                  ? "bg-emerald-500 text-emerald-950"
                  : active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "truncate text-xs font-semibold",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </div>
              <div
                className={cn(
                  "mt-1.5 h-0.5 rounded-full transition-colors",
                  done ? "bg-emerald-500" : active ? "bg-primary" : "bg-border",
                )}
              />
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function StepHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <Icon className="h-5 w-5 text-primary" />
        {title}
      </h2>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  )
}

function FieldLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor?: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
      {children}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </label>
  )
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-foreground">{value}</span>
    </div>
  )
}

// Drag/click-to-upload image tile — posts to POST /admin/events/upload-banner
// and hands back the public Supabase Storage URL. Mirrors the organizer
// wizard's ImageDropzone (myscope-web/src/app/organizer/events/create).
function ImageDropzone({
  value,
  onChange,
  previewAlt,
}: {
  value: string
  onChange: (url: string) => void
  previewAlt: string
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file (PNG, JPG, WebP…).")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be under 5 MB.")
      return
    }
    setUploadError("")
    setUploading(true)
    try {
      const res = await adminAPI.uploadEventBanner(file)
      const data = res.data as { success: boolean; data?: { url: string }; message?: string }
      if (!data?.success || !data.data?.url) throw new Error(data?.message || "Upload failed.")
      onChange(data.data.url)
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } }; message?: string }
      setUploadError(e.response?.data?.message || e.message || "Upload failed.")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div className="space-y-2">
      <label
        className={cn(
          "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          uploading
            ? "border-primary/60"
            : "border-border hover:border-primary/40 hover:bg-muted/40",
        )}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          title="Upload image"
          aria-label="Upload image"
          className="hidden"
          onChange={handleFileChange}
          disabled={uploading}
        />
        {uploading ? (
          <>
            <Loader className="h-7 w-7 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Uploading…</span>
          </>
        ) : (
          <>
            <ImageIcon className="h-10 w-10 text-primary/40" />
            <span className="text-sm font-semibold text-primary">Click to upload image</span>
            <span className="text-xs text-muted-foreground">PNG, JPG, WebP · max 5 MB</span>
          </>
        )}
      </label>

      {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}

      {value && (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={previewAlt}
            className="w-full rounded-xl border border-border bg-muted object-contain"
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs font-medium text-destructive hover:underline"
          >
            Remove image
          </button>
        </div>
      )}
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
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-input bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/40"
      >
        {selected ? (
          <div className="flex min-w-0 items-center gap-3">
            <OrgAvatar org={selected} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">
                {selected.business_name}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {selected.contact_name ? `${selected.contact_name} · ` : ""}
                {selected.email}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            Pick an approved organizer…
          </div>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          <div className="relative border-b border-border">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, business, or email"
              aria-label="Search organizers"
              className="w-full bg-transparent px-9 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoFocus
            />
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {results.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                No organizers match that search.
              </li>
            ) : (
              results.map((o) => (
                <li key={o.user_id}>
                  <button
                    type="button"
                    onClick={() => onPick(o)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted"
                  >
                    <OrgAvatar org={o} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {o.business_name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {o.contact_name ? `${o.contact_name} · ` : ""}
                        {o.email}
                      </div>
                    </div>
                    {selected?.user_id === o.user_id && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
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
        className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border"
      />
    )
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
      {(org.business_name?.[0] ?? "?").toUpperCase()}
    </div>
  )
}
