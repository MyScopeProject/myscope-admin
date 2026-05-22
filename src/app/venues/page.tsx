"use client"

import { useEffect, useState } from "react"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { PageLoader } from "@/components/ui/loading"
import { EmptyState } from "@/components/ui/error-message"
import { useAuth } from "@/contexts/auth-context"
import {
  venueTemplatesAPI,
  layoutRequestsAPI,
  type VenueTemplateSummary,
  type VenueTemplateDetail,
  type VenueLayoutData,
  type LayoutRequest,
} from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import {
  Armchair,
  Calendar,
  Check,
  FileText,
  Inbox,
  Loader,
  MapPin,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react"

// Stage placement options accepted by the backend (STAGE_POSITIONS).
const STAGE_POSITIONS = [
  { value: "front", label: "Front" },
  { value: "back", label: "Back" },
  { value: "centre", label: "Centre" },
  { value: "traverse", label: "Traverse" },
  { value: "none", label: "None" },
]

const BUILDER_COLORS = ["#7F77DD", "#1D9E75", "#BA7517", "#D85A30", "#185FA5", "#993556"]

// Spreadsheet-style row labels so templates aren't capped at 26 rows:
// 0 -> A, 25 -> Z, 26 -> AA, 27 -> AB ... (the old organizer builder errored
// past Z; real auditoriums like balconies routinely need AA/AB rows).
function rowLabelFromIndex(n: number): string {
  let s = ""
  let i = n + 1
  while (i > 0) {
    const r = (i - 1) % 26
    s = String.fromCharCode(65 + r) + s
    i = Math.floor((i - 1) / 26)
  }
  return s
}
function rowIndexFromLabel(label: string): number {
  let n = 0
  for (const ch of label.toUpperCase()) {
    if (ch < "A" || ch > "Z") return -1
    n = n * 26 + (ch.charCodeAt(0) - 64)
  }
  return n - 1
}

interface BuilderSection {
  name: string
  color: string
  rows: string
  seatsPerRow: string
  rowStart: string
}

const emptyBuilderSection = (idx: number): BuilderSection => ({
  name: idx === 0 ? "Main Hall" : `Section ${idx + 1}`,
  color: BUILDER_COLORS[idx % BUILDER_COLORS.length],
  rows: "8",
  seatsPerRow: "20",
  rowStart: "A",
})

type Tab = "templates" | "requests"

export default function VenueTemplatesPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>("templates")
  const [templates, setTemplates] = useState<VenueTemplateSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Tier 3 custom-layout requests (reserved events awaiting a seat map).
  const [requests, setRequests] = useState<LayoutRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [fulfilling, setFulfilling] = useState<LayoutRequest | null>(null)

  // `editing` = template id when editing, "new" when creating, null when closed.
  const [editing, setEditing] = useState<string | "new" | null>(null)
  const [editingDetail, setEditingDetail] = useState<VenueTemplateDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const res = await venueTemplatesAPI.list()
      setTemplates(res.data?.data?.templates || [])
    } catch {
      toast.error("Failed to load templates")
    } finally {
      setLoading(false)
    }
  }

  const fetchRequests = async () => {
    try {
      setLoadingRequests(true)
      const res = await layoutRequestsAPI.list()
      setRequests(res.data?.data?.requests || [])
    } catch {
      toast.error("Failed to load layout requests")
    } finally {
      setLoadingRequests(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
    fetchRequests()
  }, [])

  const openCreate = () => {
    setEditingDetail(null)
    setEditing("new")
  }

  const openEdit = async (t: VenueTemplateSummary) => {
    setEditing(t.id)
    setLoadingDetail(true)
    try {
      const res = await venueTemplatesAPI.get(t.id)
      setEditingDetail(res.data?.data?.layout as VenueTemplateDetail)
    } catch {
      toast.error("Couldn't load that template")
      setEditing(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  const closeEditor = () => {
    setEditing(null)
    setEditingDetail(null)
  }

  const handleSaved = async () => {
    await fetchTemplates()
    closeEditor()
  }

  const remove = async (t: VenueTemplateSummary) => {
    if (!window.confirm(`Delete "${t.name}"? Organizers will no longer see it.`)) return
    setBusyId(t.id)
    try {
      await venueTemplatesAPI.remove(t.id)
      setTemplates((prev) => prev.filter((x) => x.id !== t.id))
      toast.success("Template deleted")
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e.response?.data?.message || "Delete failed")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <ProtectedRoute>
      <AdminLayout user={user || undefined}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Venue templates</h1>
              <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                Build seat maps for common venues once. Organizers pick a template in their
                reserved-seating event wizard and just assign prices to each section — no drawing
                required on their side.
              </p>
            </div>
            {tab === "templates" && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                New template
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
            <TabButton active={tab === "templates"} onClick={() => setTab("templates")} label="Templates" />
            <TabButton
              active={tab === "requests"}
              onClick={() => setTab("requests")}
              label="Layout requests"
              count={requests.length}
            />
          </div>

          {/* Templates tab */}
          {tab === "templates" &&
            (loading ? (
              <PageLoader />
            ) : templates.length === 0 ? (
              <EmptyState
                icon={Armchair}
                title="No venue templates yet"
                description="Create your first template — e.g. a real auditorium with its sections and rows. It becomes a reusable pick for every organizer's reserved-seating event."
              />
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    busy={busyId === t.id}
                    onEdit={() => openEdit(t)}
                    onDelete={() => remove(t)}
                  />
                ))}
              </ul>
            ))}

          {/* Layout requests tab */}
          {tab === "requests" &&
            (loadingRequests ? (
              <PageLoader />
            ) : requests.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No layout requests"
                description="When an organizer requests a custom seat map for a reserved event, it appears here. Build the seat map and apply it to put the event on track for approval."
              />
            ) : (
              <ul className="space-y-3">
                {requests.map((r) => (
                  <RequestCard key={r.id} request={r} onFulfil={() => setFulfilling(r)} />
                ))}
              </ul>
            ))}

          {/* Template editor modal */}
          {editing && (
            <TemplateEditor
              isNew={editing === "new"}
              detail={editingDetail}
              loadingDetail={loadingDetail}
              editingId={editing === "new" ? null : editing}
              onClose={closeEditor}
              onSaved={handleSaved}
            />
          )}

          {/* Fulfil-request modal */}
          {fulfilling && (
            <FulfilModal
              request={fulfilling}
              templates={templates}
              onClose={() => setFulfilling(null)}
              onDone={() => {
                setFulfilling(null)
                fetchRequests()
              }}
            />
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}

// ---------------------------------------------------------------------------
// Card — one template in the grid.
// ---------------------------------------------------------------------------
function TemplateCard({
  template,
  busy,
  onEdit,
  onDelete,
}: {
  template: VenueTemplateSummary
  busy: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <li className="flex flex-col rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {template.name}
          </div>
          <div className="mt-0.5 text-xs text-gray-500">
            {template.total_seats.toLocaleString()} seats · stage {template.stage_position}
          </div>
        </div>
        <Armchair className="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600" />
      </div>
      {template.description && (
        <p className="mt-2 line-clamp-2 text-xs text-gray-500">{template.description}</p>
      )}
      <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/30"
        >
          {busy ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Delete
        </button>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Editor modal — section-based grid builder (no drag-and-drop). Creates or
// edits one template. Each section is a uniform block (rows × seats/row); add
// multiple sections for multi-block venues.
// ---------------------------------------------------------------------------
function TemplateEditor({
  isNew,
  detail,
  loadingDetail,
  editingId,
  onClose,
  onSaved,
}: {
  isNew: boolean
  detail: VenueTemplateDetail | null
  loadingDetail: boolean
  editingId: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [stagePosition, setStagePosition] = useState("front")
  const [sections, setSections] = useState<BuilderSection[]>([emptyBuilderSection(0)])
  const [saving, setSaving] = useState(false)

  // Hydrate the form when editing an existing template. Templates built here are
  // uniform grids, so we reverse them by reading row count + first row's seat
  // count per section.
  useEffect(() => {
    if (!detail) return
    setName(detail.name)
    setDescription(detail.description ?? "")
    setStagePosition(detail.stage_position || "front")
    const secs = (detail.layout_data?.sections || []).map((s, i): BuilderSection => {
      const rows = s.rows || []
      return {
        name: s.name,
        color: s.color || BUILDER_COLORS[i % BUILDER_COLORS.length],
        rows: String(rows.length || 1),
        seatsPerRow: String(rows[0]?.seats?.length || 1),
        rowStart: rows[0]?.label || "A",
      }
    })
    setSections(secs.length > 0 ? secs : [emptyBuilderSection(0)])
  }, [detail])

  const updSection = (i: number, patch: Partial<BuilderSection>) => {
    setSections((prev) => {
      const next = prev.slice()
      next[i] = { ...next[i], ...patch }
      return next
    })
  }

  const totalSeats = sections.reduce((acc, s) => {
    const rows = parseInt(s.rows, 10) || 0
    const seats = parseInt(s.seatsPerRow, 10) || 0
    return acc + rows * seats
  }, 0)

  const buildLayoutData = (): VenueLayoutData | { error: string } => {
    const out: VenueLayoutData = { sections: [] }
    const usedNames = new Set<string>()
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i]
      const sectionName = s.name.trim()
      if (!sectionName) return { error: `Section #${i + 1}: name is required.` }
      if (usedNames.has(sectionName)) return { error: `Duplicate section name "${sectionName}".` }
      usedNames.add(sectionName)

      const rowCount = parseInt(s.rows, 10)
      const seatsPerRow = parseInt(s.seatsPerRow, 10)
      if (!Number.isInteger(rowCount) || rowCount <= 0) {
        return { error: `Section "${sectionName}": rows must be a positive integer.` }
      }
      if (!Number.isInteger(seatsPerRow) || seatsPerRow <= 0) {
        return { error: `Section "${sectionName}": seats per row must be a positive integer.` }
      }
      const startIdx = rowIndexFromLabel((s.rowStart || "A").trim())
      if (startIdx < 0) {
        return { error: `Section "${sectionName}": start row must be letters A–Z (e.g. A, or AA).` }
      }

      out.sections.push({
        id: `s${i + 1}`,
        name: sectionName,
        color: s.color,
        rows: Array.from({ length: rowCount }, (_, r) => ({
          label: rowLabelFromIndex(startIdx + r),
          seats: Array.from({ length: seatsPerRow }, (_, j) => ({
            number: String(j + 1),
            type: "standard",
          })),
        })),
      })
    }
    return out
  }

  const save = async () => {
    if (!name.trim()) {
      toast.error("Template name is required.")
      return
    }
    const built = buildLayoutData()
    if ("error" in built) {
      toast.error(built.error)
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        stage_position: stagePosition,
        layout_data: built,
      }
      if (isNew || !editingId) {
        await venueTemplatesAPI.create(payload)
        toast.success("Template created")
      } else {
        await venueTemplatesAPI.update(editingId, payload)
        toast.success("Template updated")
      }
      onSaved()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e.response?.data?.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => !saving && onClose()}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-6 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold">
              {isNew ? "New venue template" : "Edit template"}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Add a section per seating block. Each block is a grid of rows × seats. Pricing is set
              by organizers per event.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Meta */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Template name">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={255}
                    placeholder="e.g. Nelum Pokuna Main Hall"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                  />
                </Field>
                <Field label="Stage position">
                  <select
                    value={stagePosition}
                    onChange={(e) => setStagePosition(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                  >
                    {STAGE_POSITIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Description (optional)">
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2048}
                  placeholder="Notes for organizers picking this venue"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                />
              </Field>

              {/* Sections */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Sections
                  </h3>
                  <span className="text-xs font-medium text-gray-500">
                    {totalSeats.toLocaleString()} seats total
                  </span>
                </div>

                {sections.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={s.color}
                        onChange={(e) => updSection(i, { color: e.target.value })}
                        aria-label="Section colour"
                        className="h-8 w-8 shrink-0 cursor-pointer rounded border border-gray-300 bg-transparent dark:border-gray-600"
                      />
                      <input
                        type="text"
                        value={s.name}
                        onChange={(e) => updSection(i, { name: e.target.value })}
                        placeholder="Section name"
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                      />
                      {sections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSections((prev) => prev.filter((_, idx) => idx !== i))}
                          className="shrink-0 rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                          aria-label="Remove section"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <Field label="Rows" small>
                        <input
                          type="number"
                          min={1}
                          value={s.rows}
                          onChange={(e) => updSection(i, { rows: e.target.value })}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                        />
                      </Field>
                      <Field label="Seats / row" small>
                        <input
                          type="number"
                          min={1}
                          value={s.seatsPerRow}
                          onChange={(e) => updSection(i, { seatsPerRow: e.target.value })}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                        />
                      </Field>
                      <Field label="Start row" small>
                        <input
                          type="text"
                          value={s.rowStart}
                          onChange={(e) => updSection(i, { rowStart: e.target.value.toUpperCase() })}
                          maxLength={3}
                          placeholder="A"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase dark:border-gray-600 dark:bg-gray-800"
                        />
                      </Field>
                    </div>

                    <div className="mt-1 text-[11px] text-gray-400">
                      {(() => {
                        const rows = parseInt(s.rows, 10) || 0
                        const seats = parseInt(s.seatsPerRow, 10) || 0
                        const startIdx = rowIndexFromLabel((s.rowStart || "A").trim())
                        if (rows <= 0 || seats <= 0 || startIdx < 0) return "—"
                        const last = rowLabelFromIndex(startIdx + rows - 1)
                        return `Rows ${rowLabelFromIndex(startIdx)}–${last} · ${(rows * seats).toLocaleString()} seats`
                      })()}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setSections((prev) => [...prev, emptyBuilderSection(prev.length)])}
                  className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:text-gray-300"
                >
                  <Plus className="h-4 w-4" />
                  Add section
                </button>
              </div>

              {/* Preview */}
              <SeatPreview sections={sections} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-gray-100 p-4 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || loadingDetail}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : isNew ? "Create template" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  )
}

// Compact dot grid so the admin can sanity-check the geometry before saving.
// Caps the rendered dots per section to keep big venues from flooding the DOM —
// the seat count above is always exact.
function SeatPreview({ sections }: { sections: BuilderSection[] }) {
  const MAX_ROWS = 12
  const MAX_SEATS = 30
  const drawable = sections.some((s) => (parseInt(s.rows, 10) || 0) > 0 && (parseInt(s.seatsPerRow, 10) || 0) > 0)
  if (!drawable) return null

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="mb-3 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Stage
      </div>
      <div className="space-y-3 overflow-x-auto">
        {sections.map((s, i) => {
          const rows = parseInt(s.rows, 10) || 0
          const seats = parseInt(s.seatsPerRow, 10) || 0
          if (rows <= 0 || seats <= 0) return null
          const showRows = Math.min(rows, MAX_ROWS)
          const showSeats = Math.min(seats, MAX_SEATS)
          return (
            <div key={i} className="min-w-fit">
              <div className="mb-1 text-[11px] font-medium text-gray-500">{s.name || `Section ${i + 1}`}</div>
              <div className="space-y-1">
                {Array.from({ length: showRows }).map((_, r) => (
                  <div key={r} className="flex gap-1">
                    {Array.from({ length: showSeats }).map((_, c) => (
                      <span
                        key={c}
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: s.color }}
                      />
                    ))}
                    {seats > MAX_SEATS && <span className="text-[10px] text-gray-400">+{seats - MAX_SEATS}</span>}
                  </div>
                ))}
                {rows > MAX_ROWS && (
                  <div className="text-[10px] text-gray-400">+{rows - MAX_ROWS} more rows</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Field({
  label,
  small,
  children,
}: {
  label: string
  small?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        className={`mb-1.5 block font-medium uppercase tracking-wider text-gray-500 ${
          small ? "text-[10px]" : "text-xs"
        }`}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative -mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-blue-600 text-blue-600 dark:text-blue-400"
          : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Layout request card — one reserved event awaiting a custom seat map.
// ---------------------------------------------------------------------------
function RequestCard({ request, onFulfil }: { request: LayoutRequest; onFulfil: () => void }) {
  const when = request.start_time || request.date
  return (
    <li className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:flex-row">
      {/* Floor plan thumb */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-gray-100 dark:bg-gray-700 sm:w-44 sm:shrink-0">
        {request.layout_floor_plan_url ? (
          <a href={request.layout_floor_plan_url} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={request.layout_floor_plan_url}
              alt="Floor plan"
              className="h-full w-full object-cover"
            />
          </a>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-gray-400">
            <FileText className="h-6 w-6" />
            <span className="text-[10px]">No floor plan</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{request.title}</div>
        <div className="mt-1 space-y-1 text-xs text-gray-500">
          {request.venue_name && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {request.venue_name}
            </div>
          )}
          {when && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {new Date(when).toLocaleString()}
            </div>
          )}
          {request.organizer && (
            <div className="truncate">
              By {request.organizer.name} · {request.organizer.email}
            </div>
          )}
        </div>
        {request.layout_request_note && (
          <p className="mt-2 rounded-md bg-gray-50 p-2 text-xs italic text-gray-600 dark:bg-gray-700/50 dark:text-gray-300">
            “{request.layout_request_note}”
          </p>
        )}
      </div>

      {/* Action */}
      <div className="flex shrink-0 items-start">
        <button
          type="button"
          onClick={onFulfil}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Armchair className="h-4 w-4" />
          Build &amp; apply
        </button>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Fulfil modal — pick a template, map each section to one of the event's ticket
// types, and apply it. Applying generates event_seats and clears the event's
// pending-layout flag (so it can be approved). Build the template first in the
// Templates tab if none matches the venue.
// ---------------------------------------------------------------------------
interface EventTicketType {
  id: string
  name: string
  price: number | string
}

function FulfilModal({
  request,
  templates,
  onClose,
  onDone,
}: {
  request: LayoutRequest
  templates: VenueTemplateSummary[]
  onClose: () => void
  onDone: () => void
}) {
  const [ticketTypes, setTicketTypes] = useState<EventTicketType[]>([])
  const [loadingTT, setLoadingTT] = useState(true)
  const [templateId, setTemplateId] = useState("")
  const [templateDetail, setTemplateDetail] = useState<VenueTemplateDetail | null>(null)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  // section name -> ticket_type id
  const [sectionMap, setSectionMap] = useState<Record<string, string>>({})
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await layoutRequestsAPI.ticketTypes(request.id)
        if (!cancelled) setTicketTypes(res.data?.data?.ticket_types || [])
      } catch {
        if (!cancelled) toast.error("Couldn't load the event's ticket types")
      } finally {
        if (!cancelled) setLoadingTT(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [request.id])

  const pickTemplate = async (id: string) => {
    setTemplateId(id)
    setTemplateDetail(null)
    setSectionMap({})
    if (!id) return
    setLoadingTemplate(true)
    try {
      const res = await venueTemplatesAPI.get(id)
      setTemplateDetail(res.data?.data?.layout as VenueTemplateDetail)
    } catch {
      toast.error("Couldn't load that template")
    } finally {
      setLoadingTemplate(false)
    }
  }

  const sections = templateDetail?.layout_data?.sections || []
  const allMapped = sections.length > 0 && sections.every((s) => sectionMap[s.name])

  const apply = async () => {
    if (!templateId || !templateDetail) {
      toast.error("Pick a template first.")
      return
    }
    if (!allMapped) {
      toast.error("Assign a ticket type to every section.")
      return
    }
    setApplying(true)
    try {
      await venueTemplatesAPI.applyToEvent(templateId, {
        event_id: request.id,
        section_ticket_map: sectionMap,
      })
      toast.success("Seat map applied — event is ready for approval")
      onDone()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e.response?.data?.message || "Apply failed")
    } finally {
      setApplying(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => !applying && onClose()}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-6 dark:border-gray-700">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">Apply a seat map</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {request.title}
              {request.venue_name ? ` · ${request.venue_name}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {request.layout_floor_plan_url && (
            <a
              href={request.layout_floor_plan_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              <FileText className="h-3.5 w-3.5" />
              View the organizer&rsquo;s floor plan
            </a>
          )}
          {request.layout_request_note && (
            <p className="rounded-md bg-gray-50 p-2 text-xs italic text-gray-600 dark:bg-gray-700/50 dark:text-gray-300">
              “{request.layout_request_note}”
            </p>
          )}

          {/* Template picker */}
          <Field label="Venue template">
            {templates.length === 0 ? (
              <p className="text-sm text-gray-500">
                No templates yet — create one in the Templates tab first, then come back.
              </p>
            ) : (
              <select
                aria-label="Venue template"
                value={templateId}
                onChange={(e) => pickTemplate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
              >
                <option value="">Pick a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.total_seats} seats)
                  </option>
                ))}
              </select>
            )}
          </Field>

          {/* Section -> ticket type mapping */}
          {loadingTemplate ? (
            <div className="flex items-center justify-center py-6 text-gray-400">
              <Loader className="h-5 w-5 animate-spin" />
            </div>
          ) : sections.length > 0 ? (
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                Assign pricing to each section
              </div>
              {loadingTT ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader className="h-4 w-4 animate-spin" /> Loading ticket types…
                </div>
              ) : ticketTypes.length === 0 ? (
                <p className="text-sm text-red-600">
                  This event has no ticket types — it can&rsquo;t be priced.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {sections.map((section) => (
                    <div key={section.name} className="flex flex-wrap items-center gap-3">
                      <span
                        className="h-3 w-3 shrink-0 rounded"
                        style={{ background: section.color || "#9ca3af" }}
                        aria-hidden
                      />
                      <span className="w-32 shrink-0 text-sm font-medium text-gray-800 dark:text-gray-200">
                        {section.name}
                      </span>
                      <select
                        aria-label={`Ticket type for section ${section.name}`}
                        value={sectionMap[section.name] || ""}
                        onChange={(e) =>
                          setSectionMap((prev) => ({ ...prev, [section.name]: e.target.value }))
                        }
                        className="h-9 min-w-[200px] flex-1 rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                      >
                        <option value="">Pick a ticket type…</option>
                        {ticketTypes.map((tt) => (
                          <option key={tt.id} value={tt.id}>
                            {tt.name} — LKR {Number(tt.price).toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 p-4 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={applying || !allMapped || ticketTypes.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {applying ? <Loader className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {applying ? "Applying…" : "Apply seat map"}
          </button>
        </div>
      </div>
    </div>
  )
}
