"use client"

// Admin moderation queue for organizer-proposed edits to LIVE (approved)
// events. The PATCH endpoint queues changes into event_pending_edits rather
// than applying them directly — this page lets admins review each diff and
// either approve (apply to events row) or decline (discard with reason).

import * as React from "react"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import { ErrorMessage, EmptyState } from "@/components/ui/error-message"
import { adminAPI } from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Loader,
  ArrowRight,
} from "lucide-react"

interface PendingEditRow {
  id: string
  event_id: string
  submitted_by: string
  submitted_at: string
  status: "pending" | "approved" | "declined"
  // Action type — the queue stores edits, postpones, pause/resume-sales,
  // and ticket-tier CRUD proposals. Render differently per kind so the
  // admin doesn't see an empty "diff" for actions that have no field-
  // level payload (e.g. pause/resume) or a misleading diff for actions
  // that aren't field edits at all (e.g. ticket-tier delete).
  kind?:
    | "edit"
    | "postpone"
    | "pause_sales"
    | "resume_sales"
    | "ticket_type_create"
    | "ticket_type_update"
    | "ticket_type_delete"
  changes: Record<string, unknown>
  events: { id: string; title: string; organizer_id: string; banner_url: string | null } | null
}

const KIND_LABEL: Record<NonNullable<PendingEditRow["kind"]>, string> = {
  edit: "Field edit",
  postpone: "Postpone",
  pause_sales: "Pause sales",
  resume_sales: "Resume sales",
  ticket_type_create: "Add ticket tier",
  ticket_type_update: "Update ticket tier",
  ticket_type_delete: "Delete ticket tier",
}

// Field renderers — convert raw DB values into something the admin can
// scan-read in a diff column. Keep the formatting intentionally simple so
// admins don't have to guess what they're seeing.
const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return String(value)
  if (typeof value === "string") {
    if (!value) return "—"
    // ISO timestamps → local date/time
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const d = new Date(value)
      if (!isNaN(d.getTime())) {
        return d.toLocaleString("en-US", {
          month: "short", day: "numeric", year: "numeric",
          hour: "numeric", minute: "2-digit",
        })
      }
    }
    return value.length > 140 ? value.slice(0, 140) + "…" : value
  }
  return JSON.stringify(value)
}

// Permissive equality used to drop unchanged rows from the diff table.
// Backend already strips matching fields when persisting, but stale
// pending rows from before that fix still get filtered here so the
// admin never sees a noisy "20 fields changed" diff that's actually one.
const isSameValue = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (a == null && b == null) return true
  if (typeof a === "string" && typeof b === "string") {
    const da = Date.parse(a)
    const db = Date.parse(b)
    if (!Number.isNaN(da) && !Number.isNaN(db)) return da === db
  }
  return false
}

const labelFor = (key: string): string => {
  // Map snake_case DB fields to friendly labels. Anything unknown falls back
  // to a Title-Case version of the key.
  const map: Record<string, string> = {
    title: "Title",
    description: "Description",
    category: "Category",
    venue_name: "Venue name",
    venue_address: "Venue address",
    venue_location_url: "Venue location URL",
    start_time: "Start time",
    end_time: "End time",
    capacity: "Capacity",
    banner_url: "Banner image",
    layout_image_url: "Layout image",
    trailer_url: "Trailer URL",
    sms_reminders: "SMS reminders",
  }
  if (map[key]) return map[key]
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

export default function PendingEditsPage() {
  return (
    <ProtectedRoute>
      <PendingEditsContent />
    </ProtectedRoute>
  )
}

function PendingEditsContent() {
  const { user, isLoading: authLoading } = useAuth()
  const [rows, setRows] = React.useState<PendingEditRow[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  // Per-row current-event snapshot, lazy-loaded on first expand so we can
  // render before/after diffs without an N+1 on the initial list fetch.
  const [currentByEditId, setCurrentByEditId] = React.useState<Record<string, Record<string, unknown>>>({})
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  // Decline modal state.
  const [declineTarget, setDeclineTarget] = React.useState<PendingEditRow | null>(null)
  const [declineReason, setDeclineReason] = React.useState("")

  const load = React.useCallback(async () => {
    setError(null)
    try {
      const res = await adminAPI.listPendingEdits()
      const data = res.data
      if (data?.success) {
        setRows(data.data.pending_edits as PendingEditRow[])
      } else {
        setError("Couldn't load the moderation queue.")
      }
    } catch {
      setError("Network error loading the queue.")
    }
  }, [])

  React.useEffect(() => {
    if (!authLoading && user) load()
  }, [authLoading, user, load])

  const expand = async (row: PendingEditRow) => {
    setExpandedId(prev => (prev === row.id ? null : row.id))
    if (currentByEditId[row.id]) return  // already loaded
    try {
      const res = await adminAPI.getPendingEdit(row.id) as {
        data?: { success?: boolean; data?: { event?: Record<string, unknown> } }
      }
      const evt = res.data?.data?.event
      if (evt) setCurrentByEditId(prev => ({ ...prev, [row.id]: evt }))
    } catch {
      // soft-fail; we'll show "—" for "current" until the admin retries
    }
  }

  const approve = async (row: PendingEditRow) => {
    if (!window.confirm("Apply these changes to the live event?")) return
    setBusyId(row.id)
    try {
      const res = await adminAPI.approvePendingEdit(row.id) as {
        data?: { success?: boolean; message?: string }
      }
      if (res.data?.success) {
        toast.success(res.data.message || "Changes applied.")
        await load()
      } else {
        toast.error(res.data?.message || "Couldn't approve.")
      }
    } catch {
      toast.error("Network error.")
    } finally {
      setBusyId(null)
    }
  }

  const submitDecline = async () => {
    if (!declineTarget) return
    setBusyId(declineTarget.id)
    try {
      const res = await adminAPI.declinePendingEdit(declineTarget.id, declineReason.trim() || undefined) as {
        data?: { success?: boolean; message?: string }
      }
      if (res.data?.success) {
        toast.success(res.data.message || "Declined.")
        setDeclineTarget(null)
        setDeclineReason("")
        await load()
      } else {
        toast.error(res.data?.message || "Couldn't decline.")
      }
    } catch {
      toast.error("Network error.")
    } finally {
      setBusyId(null)
    }
  }

  if (authLoading || rows === null) {
    return (
      <AdminLayout user={user ?? undefined}>
        <PageLoader />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout user={user ?? undefined}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <CalendarCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Edit Review</h1>
            <p className="text-sm text-muted-foreground">
              Organizer-proposed changes to live events. Approve to apply; decline to discard.
            </p>
          </div>
        </div>

        {error && <ErrorMessage message={error} onRetry={load} />}

        {!error && rows.length === 0 ? (
          <EmptyState
            title="No pending edits"
            description="Organizer-submitted changes to live events will appear here for review."
          />
        ) : (
          <ul className="space-y-3">
            {rows.map(row => {
              const event = row.events
              const proposed = row.changes
              const current = currentByEditId[row.id] ?? {}
              const isExpanded = expandedId === row.id
              const busy = busyId === row.id
              const kind = row.kind ?? "edit"
              const allFields = Object.keys(proposed)
              // When the current event snapshot is loaded for this row,
              // drop fields whose proposed value matches the live one —
              // those are no-op carryovers and clutter the diff. Until
              // the snapshot loads we render all fields; once loaded we
              // render only actually-different rows.
              const hasCurrent = Object.keys(current).length > 0
              const fields = hasCurrent
                ? allFields.filter(f => !isSameValue(proposed[f], current[f]))
                : allFields
              const kindLabel = KIND_LABEL[kind]
              // Render differently per kind so the page doesn't lie:
              //   - postpone has a small fixed payload (date / reason / flags)
              //   - pause/resume have no payload at all
              //   - ticket_type_* describe a CRUD op on a tier, not a
              //     field diff against the live event
              const isAction = kind === "postpone" || kind === "pause_sales" || kind === "resume_sales"
              const isTicketTierAction =
                kind === "ticket_type_create" ||
                kind === "ticket_type_update" ||
                kind === "ticket_type_delete"
              return (
                <li
                  key={row.id}
                  className="overflow-hidden rounded-xl border border-border bg-card shadow-xs"
                >
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground truncate">
                          {event?.title ?? "(deleted event)"}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                          <Clock className="h-3 w-3" /> Pending
                        </span>
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                          {kindLabel}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {kind === "edit"
                          ? <>{fields.length} field{fields.length === 1 ? "" : "s"} changed</>
                          : kind === "postpone"
                            ? "Postpone request"
                            : kind === "pause_sales"
                              ? "Pause all ticket sales"
                              : kind === "resume_sales"
                                ? "Resume all ticket sales"
                                : kind === "ticket_type_create"
                                  ? `New tier: ${String(proposed.name ?? "(unnamed)")}`
                                  : kind === "ticket_type_update"
                                    ? "Ticket tier update"
                                    : `Delete tier${proposed.name ? `: ${String(proposed.name)}` : ""}`}
                        {" · submitted "}
                        {new Date(row.submitted_at).toLocaleString("en-US", {
                          month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {/* Pause/resume sales and ticket-tier deletes have no
                          payload to view — the action IS the intent. Other
                          kinds get the diff/details toggle. */}
                      {!(kind === "pause_sales" || kind === "resume_sales" || kind === "ticket_type_delete") && (
                        <button
                          type="button"
                          onClick={() => expand(row)}
                          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
                        >
                          {isExpanded
                            ? (isTicketTierAction || isAction ? "Hide details" : "Hide diff")
                            : (isTicketTierAction || isAction ? "View details" : "View diff")}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => approve(row)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {busy ? <Loader className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => { setDeclineTarget(row); setDeclineReason("") }}
                        className="inline-flex items-center gap-1.5 rounded-md bg-destructive/15 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/25 disabled:opacity-50"
                      >
                        <XCircle className="h-3 w-3" /> Decline
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border bg-muted/20 p-4">
                      {kind === "postpone" ? (
                        // Postpone shows the requested settings inline — there's
                        // no field-by-field "before" because the source-of-truth
                        // postpone state is encoded across multiple events columns.
                        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
                          {Object.entries({
                            new_start_time: "New start time",
                            reason: "Reason",
                            notify: "Notify attendees",
                            close_sales: "Close sales",
                          }).map(([key, label]) => (
                            <React.Fragment key={key}>
                              <dt className="font-medium text-muted-foreground">{label}</dt>
                              <dd className="text-foreground">
                                {key === "new_start_time" && !proposed[key]
                                  ? "Date to be announced"
                                  : formatValue(proposed[key])}
                              </dd>
                            </React.Fragment>
                          ))}
                        </dl>
                      ) : kind === "ticket_type_create" ? (
                        // Tier-create: show the full proposed tier payload
                        // as a property list. There's no "current" — this
                        // tier doesn't exist yet on the live event.
                        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
                          {[
                            ["name", "Name"],
                            ["description", "Description"],
                            ["price", "Price (LKR)"],
                            ["quantity_total", "Quantity"],
                            ["per_order_limit", "Per-order limit"],
                            ["is_free_seating", "Free seating tier"],
                            ["is_active", "Active"],
                            ["sale_start", "Sale starts"],
                            ["sale_end", "Sale ends"],
                          ]
                            .filter(([key]) => proposed[key] !== undefined && proposed[key] !== null && proposed[key] !== "")
                            .map(([key, label]) => (
                              <React.Fragment key={key}>
                                <dt className="font-medium text-muted-foreground">{label}</dt>
                                <dd className="text-foreground">{formatValue(proposed[key])}</dd>
                              </React.Fragment>
                            ))}
                        </dl>
                      ) : kind === "ticket_type_update" ? (
                        // Tier-update: payload is { id, ...changedFields }.
                        // Pull the live tier from current event's ticket
                        // types (admin already has it via the /pending-edits/:id
                        // endpoint when expanded — we read it through a
                        // separate fetch if needed; for now show proposed
                        // changes only since the backend already strips
                        // unchanged fields).
                        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
                          {Object.entries(proposed)
                            .filter(([key]) => key !== "id")
                            .map(([key, value]) => (
                              <React.Fragment key={key}>
                                <dt className="font-medium text-muted-foreground">{labelFor(key)}</dt>
                                <dd className="text-foreground">{formatValue(value)}</dd>
                              </React.Fragment>
                            ))}
                        </dl>
                      ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                            <tr>
                              <th className="pb-2 pr-4 font-medium">Field</th>
                              <th className="pb-2 pr-4 font-medium">Current (live)</th>
                              <th className="pb-2 font-medium">Proposed</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fields.map(field => (
                              <tr key={field} className="border-t border-border align-top">
                                <td className="py-2 pr-4 font-medium text-foreground">{labelFor(field)}</td>
                                <td className="py-2 pr-4 text-muted-foreground">{formatValue(current[field])}</td>
                                <td className="py-2 text-foreground">
                                  <span className="inline-flex items-center gap-1.5">
                                    <ArrowRight className="h-3 w-3 text-primary" />
                                    {formatValue(proposed[field])}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Decline modal — small overlay with optional reason. */}
      {declineTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !busyId && setDeclineTarget(null)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                <XCircle className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-foreground">Decline these changes?</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  The live event stays unchanged. The organizer will see your reason on their edit page.
                </p>
                <textarea
                  rows={3}
                  value={declineReason}
                  onChange={e => setDeclineReason(e.target.value)}
                  placeholder="Reason (optional but helpful)"
                  className="mt-3 w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeclineTarget(null)}
                disabled={!!busyId}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitDecline}
                disabled={!!busyId}
                className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 disabled:opacity-50"
              >
                {busyId ? <Loader className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
