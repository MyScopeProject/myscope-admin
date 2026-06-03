"use client"

// Per-event communications card for the admin event detail page. Mirror of
// the same component on myscope-web: same backend shape, same UX. Kept as a
// separate copy here because the admin app has its own styling tokens
// (gray-50/dark:gray-800 etc) and we don't want to share a component across
// apps with different design vocabularies.

import { useEffect, useState } from "react"
import { AlertCircle, Loader, Mail, MessageSquare } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

interface TypeCount {
  type: string
  count: number
}

interface ChannelSummary {
  total: number
  by_type: TypeCount[]
}

interface CommunicationsSummary {
  total: number
  email: ChannelSummary
  sms: ChannelSummary
}

const TYPE_LABELS: Record<string, string> = {
  booking_confirmation:    "Booking confirmations",
  booking_cancellation:    "Booking cancellations",
  event_reminder:          "Event reminders",
  event_postponed:         "Postponement notices",
  organizer_announcement:  "Organizer announcements",
  event_approved:          "Event approved",
  event_rejected:          "Event rejected",
  event_created_by_admin:  "Admin handoff",
  event_invitation:        "Invitations",
  waitlist_opening:        "Waitlist openings",
  payout_paid:             "Payout notifications",
  check_in:                "Gate check-ins",
}

function labelFor(type: string): string {
  if (TYPE_LABELS[type]) return TYPE_LABELS[type]
  return type
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ")
}

export function EventCommunicationsCard({
  eventId,
  title = "Communications sent",
  subtitle = "Every email and SMS triggered by this event.",
}: {
  eventId: string
  title?: string
  subtitle?: string
}) {
  const [summary, setSummary] = useState<CommunicationsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    // Hit the API directly (rather than through the adminAPI axios client)
    // so we can apply cache: 'no-store' — the dashboard should never serve
    // stale counts when a reminder cron just fired in the background.
    fetch(`${API_URL}/api/admin/events/${eventId}/communications`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return
        if (body?.success) {
          setSummary(body.data as CommunicationsSummary)
        } else {
          setError(body?.message || "Failed to load communications.")
        }
      })
      .catch(() => {
        if (!cancelled) setError("Network error.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [eventId])

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {loading ? <Loader className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : !summary ? (
        loading ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : (
          <div className="text-xs text-muted-foreground">No data yet.</div>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <ChannelTile
              icon={Mail}
              label="Emails sent"
              total={summary.email.total}
              types={summary.email.by_type}
            />
            <ChannelTile
              icon={MessageSquare}
              label="SMS sent"
              total={summary.sms.total}
              types={summary.sms.by_type}
            />
          </div>

          {summary.total === 0 ? (
            <p className="mt-4 text-xs text-muted-foreground">
              No messages have been sent for this event yet. Counts update in real time as bookings,
              reminders, and announcements go out.
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}

function ChannelTile({
  icon: Icon,
  label,
  total,
  types,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  total: number
  types: TypeCount[]
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
      <div className="mt-2 text-2xl font-bold leading-tight text-foreground">
        {total.toLocaleString()}
      </div>

      {types.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs">
          {types.slice(0, 6).map((t) => (
            <li key={t.type} className="flex items-center justify-between gap-2">
              <span className="truncate text-muted-foreground">{labelFor(t.type)}</span>
              <span className="shrink-0 font-mono font-semibold text-foreground">{t.count}</span>
            </li>
          ))}
          {types.length > 6 ? (
            <li className="pt-1 text-[11px] italic text-muted-foreground">
              + {types.length - 6} more types
            </li>
          ) : null}
        </ul>
      ) : (
        <div className="mt-3 text-[11px] italic text-muted-foreground">No sends yet.</div>
      )}
    </div>
  )
}
