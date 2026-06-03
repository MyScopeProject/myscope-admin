"use client"

// Per-event communications billing config card. Lives on the admin manage
// event page (Comms tab). Admins toggle SMS / email billing independently
// and pick which message types get billed; the global rate (defaults to
// 0.5 LKR each) is shown for context but isn't edited here — that lives on
// the Settings page.
//
// Changes take effect FORWARD ONLY: existing event_communications rows keep
// the billable / rate snapshot they were stamped with at send time. So
// disabling billing here doesn't refund past charges, and enabling it
// doesn't retroactively bill past sends.

import { useEffect, useState } from "react"
import { adminEventManage } from "@/lib/apiEndpoints"
import { Card } from "@/components/ui/card"
import toast from "react-hot-toast"
import { AlertCircle, Loader, Mail, MessageSquare, Save, Wallet } from "lucide-react"

interface BillingConfig {
  sms_enabled: boolean
  email_enabled: boolean
  sms_billable_types: string[]
  email_billable_types: string[]
}

interface Rates { smsRateLkr: number; emailRateLkr: number }
interface Totals {
  total_lkr: number
  sms: { count: number; total_lkr: number }
  email: { count: number; total_lkr: number }
}
interface Catalogue { email: string[]; sms: string[] }

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
  check_in:                "Gate check-ins",
}

function labelFor(type: string) {
  if (TYPE_LABELS[type]) return TYPE_LABELS[type]
  return type
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ")
}

const formatLkr = (n: number) =>
  `LKR ${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function EventCommBillingCard({ eventId }: { eventId: string }) {
  const [config, setConfig] = useState<BillingConfig | null>(null)
  const [rates, setRates] = useState<Rates>({ smsRateLkr: 0.5, emailRateLkr: 0.5 })
  const [totals, setTotals] = useState<Totals | null>(null)
  const [catalogue, setCatalogue] = useState<Catalogue>({ email: [], sms: [] })
  const [defaults, setDefaults] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const res = await adminEventManage.getCommBilling(eventId)
      const d = res.data.data
      setConfig(d.config)
      setRates(d.rates)
      setTotals(d.totals)
      setCatalogue(d.catalogue)
      setDefaults(d.defaults.billable_types)
      setError(null)
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load billing config.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  // Flip a channel on/off. When turning a channel ON for the first time we
  // preselect the default billable types (announcements/reminders/postponements)
  // so admins don't have to remember the full set — they can untick anything
  // they don't want.
  const toggleChannel = (channel: "sms" | "email") => {
    if (!config) return
    const enabledKey = channel === "sms" ? "sms_enabled" : "email_enabled"
    const typesKey   = channel === "sms" ? "sms_billable_types" : "email_billable_types"
    const nowEnabled = !config[enabledKey]
    const channelCatalogue = channel === "sms" ? catalogue.sms : catalogue.email
    const filteredDefaults = defaults.filter((t) => channelCatalogue.includes(t))
    setConfig({
      ...config,
      [enabledKey]: nowEnabled,
      // Only preselect when turning on AND the current list is empty.
      [typesKey]: nowEnabled && config[typesKey].length === 0 ? filteredDefaults : config[typesKey],
    })
  }

  const toggleType = (channel: "sms" | "email", type: string) => {
    if (!config) return
    const key = channel === "sms" ? "sms_billable_types" : "email_billable_types"
    const set = new Set(config[key])
    if (set.has(type)) set.delete(type)
    else set.add(type)
    setConfig({ ...config, [key]: Array.from(set) })
  }

  const save = async () => {
    if (!config) return
    setSaving(true)
    try {
      await adminEventManage.updateCommBilling(eventId, config)
      toast.success("Billing config saved.")
      // Re-pull totals — saving doesn't change them retroactively, but a
      // fresh fetch is cheap and keeps numbers honest.
      await load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Save failed.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
          <Loader className="h-4 w-4 animate-spin" /> Loading billing config…
        </div>
      </Card>
    )
  }
  if (error || !config) {
    return (
      <Card>
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error || "Billing config unavailable."}</span>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <Wallet className="h-4 w-4 text-primary" /> Communications billing
          </h2>
          <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
            Charge the organizer per SMS / email this event sends. Changes apply forward only —
            past sends keep their original billable status and rate.
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current rates</div>
          <div className="mt-0.5 font-mono">
            SMS {formatLkr(rates.smsRateLkr)} · Email {formatLkr(rates.emailRateLkr)} per send
          </div>
        </div>
      </div>

      {/* Running totals for THIS event (only billable rows count) */}
      {totals ? (
        <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
          <SmallTile
            label="Billable SMS"
            top={`${totals.sms.count.toLocaleString()} sends`}
            sub={formatLkr(totals.sms.total_lkr)}
          />
          <SmallTile
            label="Billable email"
            top={`${totals.email.count.toLocaleString()} sends`}
            sub={formatLkr(totals.email.total_lkr)}
          />
          <SmallTile
            label="Total charged"
            top={formatLkr(totals.total_lkr)}
            sub="Deducted at payout"
            highlight
          />
        </div>
      ) : null}

      {/* Two columns: SMS on the left, Email on the right */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChannelColumn
          icon={MessageSquare}
          title="SMS"
          enabled={config.sms_enabled}
          onToggle={() => toggleChannel("sms")}
          types={catalogue.sms}
          billable={config.sms_billable_types}
          onToggleType={(t) => toggleType("sms", t)}
        />
        <ChannelColumn
          icon={Mail}
          title="Email"
          enabled={config.email_enabled}
          onToggle={() => toggleChannel("email")}
          types={catalogue.email}
          billable={config.email_billable_types}
          onToggleType={(t) => toggleType("email", t)}
        />
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : "Save billing config"}
        </button>
      </div>
    </Card>
  )
}

function SmallTile({
  label, top, sub, highlight = false,
}: { label: string; top: string; sub: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-2.5 ${highlight ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30"}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{top}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  )
}

function ChannelColumn({
  icon: Icon,
  title,
  enabled,
  onToggle,
  types,
  billable,
  onToggleType,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  enabled: boolean
  onToggle: () => void
  types: string[]
  billable: string[]
  onToggleType: (type: string) => void
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <label className="mb-3 flex cursor-pointer items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4 text-primary" /> {title} billing
        </span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={onToggle}
          className="h-4 w-4 cursor-pointer accent-primary"
        />
      </label>

      <p className="mb-2 text-[11px] text-muted-foreground">
        Pick which {title.toLowerCase()} types to charge for. Disabled when billing is off.
      </p>

      <ul className={`space-y-1.5 ${enabled ? "" : "opacity-50 pointer-events-none"}`}>
        {types.map((t) => {
          const checked = billable.includes(t)
          return (
            <li key={t}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-xs hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleType(t)}
                  className="h-3.5 w-3.5 cursor-pointer accent-primary"
                />
                <span className="text-foreground">{labelFor(t)}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
