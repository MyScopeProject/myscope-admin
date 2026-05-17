"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import { EmptyState } from "@/components/ui/error-message"
import { adminAPI } from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import {
  Calendar,
  ExternalLink,
  MapPin,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react"

interface Event {
  id: string
  title: string
  description: string
  date: string
  start_time?: string
  location: string
  venue_name?: string | null
  banner_url?: string | null
  category?: string | null
  status: string
  approval_status: "pending" | "approved" | "rejected"
  featured: boolean
  organizer?: { id: string; name: string; email: string } | null
}

export default function HeroCarouselPage() {
  const { user: currentUser } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState("")

  const fetchEvents = async () => {
    try {
      setLoading(true)
      // Pull only approved events — featured can only be turned on for approved ones.
      const res = await adminAPI.getEvents({ approvalStatus: "approved", limit: 200 })
      setEvents(res.data?.data?.events || [])
    } catch {
      toast.error("Failed to load events")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  const featured = useMemo(() => events.filter((e) => e.featured), [events])
  const available = useMemo(
    () =>
      events.filter((e) => {
        if (e.featured) return false
        if (!pickerSearch.trim()) return true
        const q = pickerSearch.toLowerCase()
        return (
          e.title.toLowerCase().includes(q) ||
          (e.venue_name || e.location || "").toLowerCase().includes(q) ||
          (e.organizer?.name ?? "").toLowerCase().includes(q)
        )
      }),
    [events, pickerSearch],
  )

  const setFeatured = async (id: string, value: boolean) => {
    setBusyId(id)
    // Optimistic update — flip locally, roll back on error.
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, featured: value } : e)),
    )
    try {
      await adminAPI.setEventFeatured(id, value)
      toast.success(value ? "Added to hero" : "Removed from hero")
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to update"
      toast.error(msg)
      setEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, featured: !value } : e)),
      )
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={["superadmin", "content-manager"]}>
        <AdminLayout user={currentUser || undefined}>
          <PageLoader />
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requiredRoles={["superadmin", "content-manager"]}>
      <AdminLayout user={currentUser || undefined}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Star className="h-8 w-8 text-primary" />
                Hero Carousel
              </h1>
              <p className="text-muted-foreground mt-1">
                Choose which approved events appear in the home page hero slideshow. The
                default hero is shown when nothing is selected.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Add event
            </button>
          </div>

          {/* Status summary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile label="In carousel" value={featured.length} accent />
            <StatTile label="Approved & available" value={events.length - featured.length} />
            <StatTile
              label="Status"
              value={featured.length > 0 ? "Live" : "Default hero"}
            />
          </div>

          {/* Featured list */}
          {featured.length === 0 ? (
            <EmptyState
              title="No events in the carousel"
              description="Click 'Add event' to choose approved events to feature on the home page. While empty, visitors see the default hero."
            />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border bg-muted/30 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Currently featured ({featured.length})
              </div>
              <ul className="divide-y divide-border">
                {featured.map((e) => (
                  <FeaturedRow
                    key={e.id}
                    event={e}
                    busy={busyId === e.id}
                    onRemove={() => setFeatured(e.id, false)}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Picker modal */}
        {pickerOpen && (
          <PickerModal
            search={pickerSearch}
            onSearchChange={setPickerSearch}
            events={available}
            busyId={busyId}
            onPick={(id) => setFeatured(id, true)}
            onClose={() => {
              setPickerOpen(false)
              setPickerSearch("")
            }}
          />
        )}
      </AdminLayout>
    </ProtectedRoute>
  )
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string
  value: number | string
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-card"
      }`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
    </div>
  )
}

function FeaturedRow({
  event,
  busy,
  onRemove,
}: {
  event: Event
  busy: boolean
  onRemove: () => void
}) {
  const when = event.start_time || event.date
  const dateLabel = when
    ? new Date(when).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—"
  const venue = event.venue_name || event.location || "—"

  return (
    <li className="flex items-center gap-4 px-5 py-4">
      <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-muted">
        {event.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.banner_url}
            alt=""
            className="h-full w-full object-cover"
            onError={(ev) =>
              ((ev.target as HTMLImageElement).style.display = "none")
            }
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">
            No image
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold text-foreground">{event.title}</p>
          {event.category && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {event.category}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {dateLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {venue}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`/events/${event.id}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground transition hover:bg-muted"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View
        </Link>
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-destructive/40 px-3 text-xs font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {busy ? "Removing…" : "Remove"}
        </button>
      </div>
    </li>
  )
}

function PickerModal({
  events,
  search,
  busyId,
  onSearchChange,
  onPick,
  onClose,
}: {
  events: Event[]
  search: string
  busyId: string | null
  onSearchChange: (v: string) => void
  onPick: (id: string) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Add to hero carousel</h2>
            <p className="text-xs text-muted-foreground">
              Pick from approved events. Selected events appear on the home page hero.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-border px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              autoFocus
              placeholder="Search by title, venue, or organizer…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {events.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              {search.trim()
                ? "No events match your search."
                : "No more approved events to feature."}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {events.map((e) => {
                const when = e.start_time || e.date
                const dateLabel = when
                  ? new Date(when).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : "—"
                const venue = e.venue_name || e.location || "—"
                return (
                  <li
                    key={e.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                      {e.banner_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.banner_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {e.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {dateLabel} · {venue}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onPick(e.id)}
                      disabled={busyId === e.id}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {busyId === e.id ? "Adding…" : "Add"}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
