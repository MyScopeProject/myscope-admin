"use client"

import { useEffect, useMemo, useState } from "react"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import { ErrorMessage, EmptyState } from "@/components/ui/error-message"
import { adminAPI } from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import {
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  Phone,
  Landmark,
  IdCard,
  Loader,
} from "lucide-react"

type Status = "pending" | "approved" | "rejected"

interface OrganizerProfile {
  id: string
  user_id: string
  business_name: string
  business_type: string | null
  nic_or_br: string | null
  phone: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_account_name: string | null
  verification_status: Status
  rejection_reason: string | null
  verified_at: string | null
  created_at: string
  users?: {
    id: string
    name: string
    email: string
    profile_image: string | null
    created_at: string
  } | null
}

const TABS: { key: Status; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
]

export default function OrganizersPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Status>("pending")
  const [profiles, setProfiles] = useState<OrganizerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [rejectingFor, setRejectingFor] = useState<OrganizerProfile | null>(null)

  const fetchProfiles = async (status: Status) => {
    try {
      setLoading(true)
      const res = await adminAPI.getOrganizers(status)
      setProfiles(res.data?.data?.profiles ?? [])
      setError(null)
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load organizer applications")
      toast.error("Failed to load organizers")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfiles(tab)
  }, [tab])

  const handleApprove = async (profile: OrganizerProfile) => {
    if (!confirm(`Approve "${profile.business_name}"? This promotes the user to organizer role.`)) {
      return
    }
    setPendingActionId(profile.id)
    try {
      await adminAPI.approveOrganizer(profile.id)
      toast.success("Organizer approved")
      // Remove from current tab (would no longer match the filter)
      setProfiles((prev) => prev.filter((p) => p.id !== profile.id))
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to approve")
    } finally {
      setPendingActionId(null)
    }
  }

  const submitRejection = async (reason: string) => {
    if (!rejectingFor) return
    setPendingActionId(rejectingFor.id)
    try {
      await adminAPI.rejectOrganizer(rejectingFor.id, reason)
      toast.success("Organizer rejected")
      setProfiles((prev) => prev.filter((p) => p.id !== rejectingFor.id))
      setRejectingFor(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to reject")
    } finally {
      setPendingActionId(null)
    }
  }

  const counts = useMemo(() => ({ shown: profiles.length }), [profiles])

  return (
    <ProtectedRoute requiredRoles={["superadmin", "content-manager", "event-manager"]}>
      <AdminLayout user={user || undefined}>
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              Organizer Applications
            </h1>
            <p className="text-muted-foreground mt-1">
              Review business details, then approve or reject applications.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-border">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
            <div className="ml-auto text-xs text-muted-foreground py-2">
              {!loading && `${counts.shown} shown`}
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <PageLoader />
          ) : error ? (
            <ErrorMessage type="error" title="Error loading organizers" message={error} />
          ) : profiles.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={`No ${tab} applications`}
              description={
                tab === "pending"
                  ? "Nothing waiting for review right now."
                  : `No applications have been ${tab} yet.`
              }
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {profiles.map((p) => (
                <ProfileCard
                  key={p.id}
                  profile={p}
                  busy={pendingActionId === p.id}
                  showActions={tab === "pending"}
                  onApprove={() => handleApprove(p)}
                  onReject={() => setRejectingFor(p)}
                />
              ))}
            </div>
          )}
        </div>

        {rejectingFor && (
          <RejectModal
            profile={rejectingFor}
            busy={pendingActionId === rejectingFor.id}
            onClose={() => setRejectingFor(null)}
            onSubmit={submitRejection}
          />
        )}
      </AdminLayout>
    </ProtectedRoute>
  )
}

function ProfileCard({
  profile,
  busy,
  showActions,
  onApprove,
  onReject,
}: {
  profile: OrganizerProfile
  busy: boolean
  showActions: boolean
  onApprove: () => void
  onReject: () => void
}) {
  const u = profile.users
  return (
    <div className="bg-card border border-border rounded-lg p-5 flex flex-col">
      {/* Header row */}
      <div className="flex items-start gap-3 mb-4">
        <div className="h-12 w-12 rounded-full bg-linear-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-semibold shrink-0">
          {(u?.name || profile.business_name).charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{profile.business_name}</h3>
          <p className="text-xs text-muted-foreground capitalize">
            {profile.business_type || "type not specified"}
          </p>
        </div>
        <StatusBadge status={profile.verification_status} />
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <DetailRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={u?.email} />
        <DetailRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={profile.phone} />
        <DetailRow icon={<IdCard className="h-3.5 w-3.5" />} label="NIC / BR" value={profile.nic_or_br} />
        <DetailRow
          icon={<Landmark className="h-3.5 w-3.5" />}
          label="Bank"
          value={
            profile.bank_name && profile.bank_account_number
              ? `${profile.bank_name} · ${profile.bank_account_number}`
              : profile.bank_name || null
          }
        />
      </div>

      {profile.bank_account_name && (
        <div className="text-xs text-muted-foreground mt-2">
          Account holder: {profile.bank_account_name}
        </div>
      )}

      {profile.rejection_reason && (
        <div className="mt-3 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          <span className="font-semibold">Rejection reason: </span>
          {profile.rejection_reason}
        </div>
      )}

      <div className="text-xs text-muted-foreground mt-3">
        Applied {new Date(profile.created_at).toLocaleString()}
      </div>

      {showActions && (
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onApprove}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50"
          >
            {busy ? <Loader className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Approve
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 transition disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </button>
        </div>
      )}
    </div>
  )
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="flex items-start gap-2 text-muted-foreground">
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide">{label}</div>
        <div className="text-foreground truncate">{value || "—"}</div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { classes: string; icon: React.ReactNode; label: string }> = {
    pending: {
      classes: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      icon: <Clock className="h-3 w-3" />,
      label: "Pending",
    },
    approved: {
      classes: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Approved",
    },
    rejected: {
      classes: "bg-destructive/10 text-destructive",
      icon: <XCircle className="h-3 w-3" />,
      label: "Rejected",
    },
  }
  const c = map[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${c.classes}`}>
      {c.icon}
      {c.label}
    </span>
  )
}

function RejectModal({
  profile,
  busy,
  onClose,
  onSubmit,
}: {
  profile: OrganizerProfile
  busy: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = useState("")
  const trimmed = reason.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-foreground mb-1">Reject application</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {profile.business_name} — the applicant will see this reason and can re-apply with edits.
        </p>

        <label className="block text-sm font-medium text-foreground mb-2">Reason</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          placeholder="e.g. NIC/BR number does not match the registered business name."
          maxLength={1000}
          autoFocus
        />
        <div className="text-xs text-muted-foreground mt-1">{trimmed.length} / 1000</div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:opacity-90 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !trimmed}
            onClick={() => onSubmit(trimmed)}
            className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:opacity-90 transition disabled:opacity-50"
          >
            {busy ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  )
}
