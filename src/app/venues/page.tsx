"use client"

import { useEffect, useState } from "react"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { PageLoader } from "@/components/ui/loading"
import { EmptyState } from "@/components/ui/error-message"
import { useAuth } from "@/contexts/auth-context"
import {
  venueTemplatesAPI,
  type VenueTemplateSummary,
  type VenueTemplateDetail,
  type VenueLayoutData,
} from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import {
  Armchair,
  Loader,
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

export default function VenueTemplatesPage() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<VenueTemplateSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

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

  useEffect(() => {
    fetchTemplates()
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
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              New template
            </button>
          </div>

          {/* List */}
          {loading ? (
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
          )}

          {/* Editor modal */}
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
