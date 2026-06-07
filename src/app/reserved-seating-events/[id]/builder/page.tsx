"use client"

/**
 * Reserved seating builder — v3, Excel-style seat grid.
 *
 * Workflow:
 *   1. Admin enters total venue rows × cols → empty cell grid materialises.
 *   2. Admin drags to select a rectangular range of cells.
 *   3. Range actions: assign to a section (existing or new), mark as stage,
 *      mark as aisle (empty), mark as label.
 *   4. Each cell = one seat (or aisle / stage / label). Row letters auto-
 *      derive from the row index but can be customised per row.
 *
 * Save: deriveLayout() emits the same flat event_seats payload the API has
 * accepted since the previous builders, so no DB/API change is needed.
 */

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { PageLoader } from "@/components/ui/loading"
import {
  reservedEventsAPI,
  type ReservedEvent,
  type ReservedEventTicketType,
  type VisualSeatMapDecor,
  type VisualSeatMapPayload,
  type VisualSeatMapSeat,
} from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import { ArrowLeft, Plus, Save, Trash2, Undo2 } from "lucide-react"
import {
  type CellRange,
  type GridCell,
  type SeatGrid,
  type SectionMeta,
  type StageBlock,
  addCol,
  addRow,
  addStage,
  deleteSection,
  deriveLayout,
  emptyGrid,
  hydrateGrid,
  paintRange,
  removeCol,
  removeRow,
  removeStage,
  setColLabel,
  setRowLabel,
  updateStage,
  upsertSection,
} from "./macroLayoutModel"
import { SeatGridCanvas } from "./SpreadsheetCanvas"

let _uidCounter = 0
const uid = (prefix = "id") => `${prefix}_${Date.now().toString(36)}_${(++_uidCounter).toString(36)}`

// Tier swatch palette — must mirror the consumer picker so colors match.
const TIER_PALETTE = ["#7F77DD", "#1D9E75", "#BA7517", "#D85A30", "#185FA5", "#993556", "#6B7280"]
function tierColor(i: number) { return TIER_PALETTE[i % TIER_PALETTE.length] || TIER_PALETTE[0] }

// ---------------------------------------------------------------------------
// Page wrapper — auth + layout
// ---------------------------------------------------------------------------

export default function VisualSeatMapBuilderPage() {
  return (
    <ProtectedRoute requiredRoles={["superadmin"]}>
      <AdminLayout>
        <BuilderInner />
      </AdminLayout>
    </ProtectedRoute>
  )
}

function BuilderInner() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const eventId = params?.id

  const [event, setEvent] = useState<ReservedEvent | null>(null)
  const [ticketTypes, setTicketTypes] = useState<ReservedEventTicketType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Grid state. Null until the admin either hydrates an existing map OR
  // submits the "configure venue size" form on the first visit.
  const [grid, setGrid] = useState<SeatGrid | null>(null)
  const [selection, setSelection] = useState<CellRange | null>(null)
  // Stage selection is mutually exclusive with cell selection — only one
  // panel shows on the right at a time.
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const [lockedSeats, setLockedSeats] = useState(0)

  // Undo history — snapshot of the previous grid per mutation, capped at 50.
  const [history, setHistory] = useState<SeatGrid[]>([])
  const [dirty, setDirty] = useState(false)

  const updateGrid = useCallback((next: SeatGrid) => {
    setHistory(h => {
      if (!grid) return h
      const trimmed = h.length >= 50 ? h.slice(1) : h.slice()
      trimmed.push(grid)
      return trimmed
    })
    setGrid(next)
    setDirty(true)
  }, [grid])

  const undo = useCallback(() => {
    setHistory(h => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      setGrid(prev)
      setSelection(null)
      return h.slice(0, -1)
    })
  }, [])

  // ----- Load event + ticket types + hydrate grid -------------------------

  useEffect(() => {
    if (!eventId) return
    let cancelled = false
    ;(async () => {
      try {
        const [evRes, ttRes, smRes] = await Promise.all([
          reservedEventsAPI.list(),
          reservedEventsAPI.ticketTypes(eventId),
          reservedEventsAPI.getSeatMap(eventId).catch(() => null),
        ])
        if (cancelled) return
        const events = (evRes.data?.data?.events || []) as ReservedEvent[]
        const ev = events.find((e: ReservedEvent) => e.id === eventId) ?? null
        setEvent(ev)
        setTicketTypes(ttRes.data?.data?.ticket_types || [])

        const sm = smRes?.data?.data
        if (sm) {
          const apiSeats = sm.seats || []
          const apiDecor = sm.layout?.decor || []
          if (apiSeats.length > 0 || apiDecor.length > 0) {
            setGrid(hydrateGrid(apiSeats, apiDecor, uid))
          }
          const locked = apiSeats.filter(
            s => s.status === "held" || s.status === "booked",
          ).length
          setLockedSeats(locked)
        }
        setHistory([])
        setDirty(false)
      } catch {
        toast.error("Failed to load event")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [eventId])

  // ----- Keyboard: Ctrl/Cmd+Z = undo --------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const inField = !!(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT"))
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
        if (inField) return
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [undo])

  // ----- Save -------------------------------------------------------------

  const save = useCallback(async () => {
    if (!eventId || !event || !grid) return
    const derived = deriveLayout(grid)
    if (derived.seats.length === 0) {
      toast.error("Add at least one seat before saving.")
      return
    }
    const orphans = derived.seats.filter(s => !s.ticket_type_id)
    if (orphans.length > 0) {
      toast.error(`${orphans.length} seat(s) have no ticket type assigned.`)
      return
    }
    setSaving(true)
    try {
      const payload: VisualSeatMapPayload = {
        viewbox_width:  derived.viewbox.width,
        viewbox_height: derived.viewbox.height,
        background_image_url: null,
        decor: derived.decor.map<VisualSeatMapDecor>(d => ({
          kind: d.kind,
          x: d.x, y: d.y,
          width: d.width, height: d.height,
          label: d.label, fill: d.fill, color: d.color,
        })),
        seats: derived.seats.map<VisualSeatMapSeat>(s => ({
          section: s.section,
          row_label: s.row_label,
          seat_number: s.seat_number,
          seat_label: s.seat_label,
          x: s.x,
          y: s.y,
          ticket_type_id: s.ticket_type_id,
          seat_type: "standard",
        })),
      }
      const res = await reservedEventsAPI.buildSeatMap(eventId, payload)
      const out = res?.data?.data
      toast.success(`Saved (${out?.seats_created ?? derived.seats.length} seats)`)
      setDirty(false)
      setHistory([])
      router.push("/reserved-seating-events")
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }, message?: string })?.response?.data?.message
        || (err as Error)?.message
        || "Save failed"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }, [eventId, event, grid, router])

  // ----- Render -----------------------------------------------------------

  if (loading) return <PageLoader />
  if (!event)  return <div className="p-8 text-center text-muted-foreground">Event not found.</div>

  // First-visit setup — admin enters total venue rows × cols.
  if (!grid) {
    return (
      <SetupScreen
        event={event}
        onCancel={() => router.push("/reserved-seating-events")}
        onSubmit={(rows, cols) => {
          const fresh = emptyGrid()
          // Replace defaults with user-chosen dimensions.
          const cells: GridCell[][] = []
          for (let r = 0; r < rows; r++) {
            cells.push(Array.from({ length: cols }, () => ({ kind: "empty" }) as GridCell))
          }
          setGrid({ ...fresh, rows, cols, cells })
        }}
      />
    )
  }

  const tierIndexById = (id: string) => ticketTypes.findIndex(t => t.id === id)
  const seatColor = (id: string) => tierColor(tierIndexById(id))

  const sectionList = Object.values(grid.sections)
  // Walk every cell once and compute both per-section and per-tier counts.
  // A seat's effective tier = explicit override on the cell, else the
  // owning section's default tier.
  const seatsPerSection: Record<string, number> = {}
  const seatsPerTier: Record<string, number> = {}
  for (const row of grid.cells) {
    for (const cell of row) {
      if (cell.kind !== "seat") continue
      seatsPerSection[cell.sectionId] = (seatsPerSection[cell.sectionId] ?? 0) + 1
      const sec = grid.sections[cell.sectionId]
      const tier = cell.tierOverride ?? sec?.defaultTicketTypeId ?? ""
      if (tier) seatsPerTier[tier] = (seatsPerTier[tier] ?? 0) + 1
    }
  }
  const totalSeats = Object.values(seatsPerSection).reduce((a, b) => a + b, 0)

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b bg-background px-4 py-2.5">
        <button
          type="button"
          onClick={() => router.push("/reserved-seating-events")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="h-5 w-px bg-border" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 truncate font-semibold">
            <span className="truncate">{event.title}</span>
            {dirty && <span className="shrink-0 text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">Unsaved</span>}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {event.venue_name ?? "Venue TBA"} · {grid.rows} × {grid.cols} grid · {totalSeats} seat{totalSeats === 1 ? "" : "s"} · {sectionList.length} section{sectionList.length === 1 ? "" : "s"}
          </div>
        </div>
        {lockedSeats > 0 && (
          <div className="hidden items-center gap-1.5 rounded-md bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 md:inline-flex dark:bg-amber-500/15 dark:text-amber-300" title="Saving will fail until these are released.">
            {lockedSeats} seat{lockedSeats === 1 ? "" : "s"} held/booked
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            if (!grid) return
            const stage: StageBlock = {
              id: uid("stage"),
              x: Math.max(0, Math.floor(grid.cols / 2) - 3),
              y: 0,
              width: 6,
              height: 1.5,
              label: "STAGE",
            }
            updateGrid(addStage(grid, stage))
            setSelectedStageId(stage.id)
            setSelection(null)
          }}
          title="Add a custom-sized stage"
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent"
        >
          <Plus className="h-4 w-4" /> Add stage
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={history.length === 0}
          title="Undo (Ctrl/Cmd+Z)"
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Undo2 className="h-4 w-4" /> Undo
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || totalSeats === 0 || lockedSeats > 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save seat map"}
        </button>
      </div>

      {/* Body — canvas | inspector */}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-hidden bg-muted/20">
          <SeatGridCanvas
            grid={grid}
            selection={selection}
            onSelectionChange={(r) => {
              setSelection(r)
              if (r) setSelectedStageId(null)
            }}
            selectedStageId={selectedStageId}
            onStageSelect={(id) => {
              setSelectedStageId(id)
              if (id) setSelection(null)
            }}
            onStageMove={(id, dx, dy) => {
              const s = grid.stages.find(x => x.id === id)
              if (!s) return
              const nx = Math.max(0, Math.min(grid.cols - s.width, Math.round((s.x + dx) * 4) / 4))
              const ny = Math.max(0, Math.min(grid.rows - s.height, Math.round((s.y + dy) * 4) / 4))
              if (nx === s.x && ny === s.y) return
              updateGrid(updateStage(grid, id, { x: nx, y: ny }))
            }}
            onMoveSelection={(dr, dc) => {
              if (!selection || (dr === 0 && dc === 0)) return
              const newR1 = selection.r1 + dr
              const newR2 = selection.r2 + dr
              const newC1 = selection.c1 + dc
              const newC2 = selection.c2 + dc
              if (newR1 < 0 || newR2 >= grid.rows || newC1 < 0 || newC2 >= grid.cols) {
                toast.error("Can't move outside the grid.")
                return
              }
              // Snapshot the source range, clear it, then paint into the
              // destination. Order matters when source and destination
              // overlap — clearing first guarantees no stale cells linger.
              const snapshot: { r: number; c: number; cell: GridCell }[] = []
              for (let r = selection.r1; r <= selection.r2; r++) {
                for (let c = selection.c1; c <= selection.c2; c++) {
                  snapshot.push({ r, c, cell: grid.cells[r][c] })
                }
              }
              const nextCells = grid.cells.map(row => row.slice())
              for (const { r, c } of snapshot) {
                nextCells[r][c] = { kind: "empty" }
              }
              for (const { r, c, cell } of snapshot) {
                nextCells[r + dr][c + dc] = cell
              }
              updateGrid({ ...grid, cells: nextCells })
              setSelection({ r1: newR1, c1: newC1, r2: newR2, c2: newC2 })
            }}
            onRowLabelChange={(r, label) => updateGrid(setRowLabel(grid, r, label))}
            onColLabelChange={(c, label) => updateGrid(setColLabel(grid, c, label))}
            seatColor={seatColor}
          />
        </div>

        <aside className="flex w-80 flex-col overflow-y-auto border-l bg-muted/30">
          <RightPanel
            grid={grid}
            ticketTypes={ticketTypes}
            selection={selection}
            selectedStageId={selectedStageId}
            sectionList={sectionList}
            seatsPerSection={seatsPerSection}
            onClearSelection={() => setSelection(null)}
            onClearStageSelection={() => setSelectedStageId(null)}
            onPaintRange={(paint) => {
              if (!selection) return
              updateGrid(paintRange(grid, selection, paint))
            }}
            onPaintWithSectionUpsert={(section, paint) => {
              if (!selection) return
              const withSection = upsertSection(grid, section)
              const painted = paintRange(withSection, selection, paint)
              updateGrid(painted)
            }}
            onDeleteSection={(sectionId) => {
              updateGrid(deleteSection(grid, sectionId))
            }}
            onStagePatch={(id, patch) => updateGrid(updateStage(grid, id, patch))}
            onStageRemove={(id) => {
              updateGrid(removeStage(grid, id))
              setSelectedStageId(null)
            }}
            onPatchGrid={(next) => updateGrid(next)}
            onAddRow={(at, side) => updateGrid(addRow(grid, at, side))}
            onRemoveRow={(at) => updateGrid(removeRow(grid, at))}
            onAddCol={(at, side) => updateGrid(addCol(grid, at, side))}
            onRemoveCol={(at) => updateGrid(removeCol(grid, at))}
          />

          <div className="mt-auto space-y-1 border-t p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ticket tiers
            </div>
            {ticketTypes.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                Add ticket types on the event first.
              </div>
            ) : ticketTypes.map((tt, i) => {
              const adminCount = seatsPerTier[tt.id] ?? 0
              const organizerCap = Number(tt.quantity_total ?? 0)
              const hasCap = Number.isFinite(organizerCap) && organizerCap > 0
              // Highlight when the painted seat count doesn't match the
              // organizer's declared cap — too many or too few.
              const mismatch = hasCap && adminCount !== organizerCap
              return (
                <div key={tt.id} className="space-y-0.5 py-0.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="inline-block h-3 w-3 shrink-0 rounded-full"
                      style={{ background: tierColor(i) }}
                    />
                    <span className="flex-1 truncate font-medium text-foreground">{tt.name}</span>
                    {tt.is_free_seating && (
                      <span className="shrink-0 rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        Free
                      </span>
                    )}
                    <span className="shrink-0 text-muted-foreground">
                      LKR {Number(tt.price).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pl-5 text-[11px] tabular-nums">
                    <span className={mismatch ? "text-amber-600 dark:text-amber-400" : "text-foreground"}>
                      <span className="font-semibold">{adminCount}</span> built
                    </span>
                    {hasCap && (
                      <>
                        <span className="text-muted-foreground/60">/</span>
                        <span className="text-muted-foreground">
                          <span className="font-semibold text-foreground">{organizerCap}</span> requested
                        </span>
                      </>
                    )}
                    {mismatch && (
                      <span className="ml-auto text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        {adminCount > organizerCap ? "+over" : "under"}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </aside>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Setup screen — first visit, asks for total venue rows × cols.
// ---------------------------------------------------------------------------

function SetupScreen({
  event, onSubmit, onCancel,
}: {
  event: ReservedEvent
  onSubmit: (rows: number, cols: number) => void
  onCancel: () => void
}) {
  const [rows, setRows] = useState(20)
  const [cols, setCols] = useState(24)

  return (
    <div className="flex h-[calc(100vh-80px)] items-center justify-center bg-muted/10 p-6">
      <div className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            New seat map
          </div>
          <h1 className="text-lg font-semibold text-foreground">{event.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the total rows and columns of your venue. You can change
            this later by adding or removing rows / columns on the grid.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Rows
            </span>
            <input
              aria-label="Total rows"
              type="number"
              min={1} max={200}
              value={rows}
              onChange={e => setRows(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              className="w-full rounded border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Columns
            </span>
            <input
              aria-label="Total columns"
              type="number"
              min={1} max={200}
              value={cols}
              onChange={e => setCols(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              className="w-full rounded border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(rows, cols)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Create grid
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Right rail — selection-aware actions + section list.
// ---------------------------------------------------------------------------

function RightPanel({
  grid, ticketTypes, selection, selectedStageId, sectionList, seatsPerSection,
  onClearSelection,
  onClearStageSelection,
  onPaintRange,
  onPaintWithSectionUpsert,
  onDeleteSection,
  onStagePatch,
  onStageRemove,
  onPatchGrid,
}: {
  grid: SeatGrid
  ticketTypes: ReservedEventTicketType[]
  selection: CellRange | null
  selectedStageId: string | null
  sectionList: SectionMeta[]
  seatsPerSection: Record<string, number>
  onClearSelection: () => void
  onClearStageSelection: () => void
  onPaintRange: (paint: (cell: GridCell) => GridCell) => void
  onPaintWithSectionUpsert: (section: SectionMeta, paint: (cell: GridCell) => GridCell) => void
  onDeleteSection: (sectionId: string) => void
  onStagePatch: (id: string, patch: Partial<StageBlock>) => void
  onStageRemove: (id: string) => void
  onPatchGrid: (next: SeatGrid) => void
  onAddRow: (at: number, side: "above" | "below") => void
  onRemoveRow: (at: number) => void
  onAddCol: (at: number, side: "left" | "right") => void
  onRemoveCol: (at: number) => void
}) {
  if (selectedStageId) {
    const stage = grid.stages.find(s => s.id === selectedStageId)
    if (stage) {
      return (
        <StageInspector
          stage={stage}
          maxX={grid.cols}
          maxY={grid.rows}
          onPatch={(patch) => onStagePatch(stage.id, patch)}
          onRemove={() => onStageRemove(stage.id)}
          onDeselect={onClearStageSelection}
        />
      )
    }
  }
  if (selection) {
    return (
      <RangeActions
        grid={grid}
        ticketTypes={ticketTypes}
        selection={selection}
        sectionList={sectionList}
        onClearSelection={onClearSelection}
        onPaintRange={onPaintRange}
        onPaintWithSectionUpsert={onPaintWithSectionUpsert}
      />
    )
  }
  return (
    <div className="space-y-4 p-4">
      <SectionList
        sections={sectionList}
        ticketTypes={ticketTypes}
        seatsPerSection={seatsPerSection}
        onDeleteSection={onDeleteSection}
      />
      <GridSizeEditor grid={grid} onPatchGrid={onPatchGrid} />
      <SeatNumberStartField grid={grid} onPatchGrid={onPatchGrid} />
      <p className="text-[11px] leading-snug text-muted-foreground">
        Click any row letter or column number in the sheet to set a custom
        label. Clear it back to empty to use the default.
      </p>
    </div>
  )
}

// Resize the whole spreadsheet during editing. New rows / cols append at
// the bottom-right; existing seats, labels, and stages are preserved.
// Shrinking is allowed but warns first if it would delete seat cells.
function GridSizeEditor({
  grid, onPatchGrid,
}: {
  grid: SeatGrid
  onPatchGrid: (next: SeatGrid) => void
}) {
  const [rowsDraft, setRowsDraft] = useState(grid.rows)
  const [colsDraft, setColsDraft] = useState(grid.cols)
  useEffect(() => { setRowsDraft(grid.rows) }, [grid.rows])
  useEffect(() => { setColsDraft(grid.cols) }, [grid.cols])

  const dirty = rowsDraft !== grid.rows || colsDraft !== grid.cols
  const willShrinkRows = rowsDraft < grid.rows
  const willShrinkCols = colsDraft < grid.cols

  // Count seat cells that would be discarded by the resize so we can ask
  // for confirmation before dropping data.
  const lostSeats = (() => {
    if (!willShrinkRows && !willShrinkCols) return 0
    let n = 0
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (r >= rowsDraft || c >= colsDraft) {
          if (grid.cells[r][c].kind === "seat") n += 1
        }
      }
    }
    return n
  })()

  const apply = () => {
    const newRows = Math.max(1, Math.min(200, rowsDraft))
    const newCols = Math.max(1, Math.min(200, colsDraft))
    if (newRows === grid.rows && newCols === grid.cols) return
    if (lostSeats > 0) {
      const ok = window.confirm(
        `Shrinking will drop ${lostSeats} seat${lostSeats === 1 ? "" : "s"} from the grid. Continue?`,
      )
      if (!ok) return
    }
    const cells: GridCell[][] = []
    for (let r = 0; r < newRows; r++) {
      const row: GridCell[] = []
      for (let c = 0; c < newCols; c++) {
        row.push(grid.cells[r]?.[c] ?? { kind: "empty" })
      }
      cells.push(row)
    }
    // Truncate label arrays to match new dimensions.
    const rowLabels = grid.rowLabels?.slice(0, newRows)
    const colLabels = grid.colLabels?.slice(0, newCols)
    onPatchGrid({ ...grid, rows: newRows, cols: newCols, cells, rowLabels, colLabels })
  }

  const bump = (axis: "rows" | "cols", delta: number) => {
    if (axis === "rows") setRowsDraft(r => Math.max(1, Math.min(200, r + delta)))
    else                 setColsDraft(c => Math.max(1, Math.min(200, c + delta)))
  }

  return (
    <div className="space-y-1.5 rounded-md border bg-background p-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Grid size
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground">Rows</span>
          <div className="flex items-stretch rounded border">
            <button type="button" onClick={() => bump("rows", -1)} className="px-2 text-sm hover:bg-muted" aria-label="Decrease rows">−</button>
            <input
              aria-label="Total rows"
              type="number" min={1} max={200}
              value={rowsDraft}
              onChange={e => setRowsDraft(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              className="min-w-0 flex-1 bg-transparent px-1 text-center text-sm focus:outline-none"
            />
            <button type="button" onClick={() => bump("rows", 1)} className="px-2 text-sm hover:bg-muted" aria-label="Increase rows">+</button>
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground">Cols</span>
          <div className="flex items-stretch rounded border">
            <button type="button" onClick={() => bump("cols", -1)} className="px-2 text-sm hover:bg-muted" aria-label="Decrease cols">−</button>
            <input
              aria-label="Total cols"
              type="number" min={1} max={200}
              value={colsDraft}
              onChange={e => setColsDraft(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              className="min-w-0 flex-1 bg-transparent px-1 text-center text-sm focus:outline-none"
            />
            <button type="button" onClick={() => bump("cols", 1)} className="px-2 text-sm hover:bg-muted" aria-label="Increase cols">+</button>
          </div>
        </div>
      </div>
      {dirty && lostSeats > 0 && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          {lostSeats} seat{lostSeats === 1 ? "" : "s"} will be dropped.
        </p>
      )}
      <button
        type="button"
        onClick={apply}
        disabled={!dirty}
        className="w-full rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
      >
        Apply ({grid.rows}×{grid.cols} → {rowsDraft}×{colsDraft})
      </button>
    </div>
  )
}

// Inspector for a free-form stage — set label, width, height, position in
// cell units. Width/height accept fractional cells for fine-tuning.
function StageInspector({
  stage, maxX, maxY, onPatch, onRemove, onDeselect,
}: {
  stage: StageBlock
  maxX: number
  maxY: number
  onPatch: (patch: Partial<StageBlock>) => void
  onRemove: () => void
  onDeselect: () => void
}) {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Stage</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDeselect}
            className="text-xs text-muted-foreground underline"
          >
            Deselect
          </button>
          <button
            type="button"
            onClick={onRemove}
            title="Remove stage"
            className="rounded p-1 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Drag the stage on the canvas to move it. Use these fields to set
        precise dimensions and position (in cell units).
      </p>
      <label className="block space-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Caption</span>
        <input
          aria-label="Stage caption"
          value={stage.label}
          onChange={e => onPatch({ label: e.target.value })}
          className="w-full rounded border bg-background px-2 py-1 text-sm"
        />
      </label>
      {/* Width / Height only — position is set by dragging the stage on
          the canvas. Removing X/Y inputs avoids them fighting the drag
          handler (and the user said "let admin drag and place it"). */}
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Width (cells)"
          ariaLabel="Stage width"
          value={stage.width}
          step={0.5}
          min={1}
          max={Math.max(1, maxX - stage.x)}
          onCommit={(v) => onPatch({ width: clamp(v, 1, Math.max(1, maxX - stage.x)) })}
        />
        <NumberField
          label="Height (cells)"
          ariaLabel="Stage height"
          value={stage.height}
          step={0.5}
          min={1}
          max={Math.max(1, maxY - stage.y)}
          onCommit={(v) => onPatch({ height: clamp(v, 1, Math.max(1, maxY - stage.y)) })}
        />
      </div>
    </div>
  )
}

// Robust number field for the stage inspector. Controlled-number-input
// spinner arrows are unreliable in React when the value is at a non-step-
// aligned float (which happens after dragging), so we replace them with
// explicit ± buttons and treat the text field as a draft that commits on
// blur or Enter.
function NumberField({
  label, ariaLabel, value, step, min, max, onCommit,
}: {
  label: string
  ariaLabel: string
  value: number
  step: number
  min: number
  max: number
  onCommit: (v: number) => void
}) {
  // Local draft so the field doesn't fight the user mid-edit.
  const [draft, setDraft] = useState<string>(formatNum(value))
  useEffect(() => { setDraft(formatNum(value)) }, [value])

  const commitFromDraft = () => {
    const v = parseFloat(draft)
    if (Number.isNaN(v)) { setDraft(formatNum(value)); return }
    const c = Math.max(min, Math.min(max, v))
    onCommit(c)
    setDraft(formatNum(c))
  }

  // Round to step alignment so consecutive clicks never get stuck on a
  // non-aligned float (e.g., 3.142 after drag → first click jumps to 3.0,
  // not 3.142+0.5).
  const stepTo = (delta: 1 | -1) => {
    const next = Math.round(((value + delta * step) / step)) * step
    const c = Math.max(min, Math.min(max, Number(next.toFixed(4))))
    onCommit(c)
  }

  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex items-stretch rounded border bg-background">
        <button
          type="button"
          onClick={() => stepTo(-1)}
          disabled={value <= min}
          className="px-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-40"
          aria-label={`Decrease ${ariaLabel}`}
        >−</button>
        <input
          aria-label={ariaLabel}
          type="number"
          min={min}
          max={max}
          step={step}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitFromDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur()
          }}
          className="min-w-0 flex-1 bg-transparent px-1 py-1 text-center text-sm focus:outline-none"
        />
        <button
          type="button"
          onClick={() => stepTo(1)}
          disabled={value >= max}
          className="px-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-40"
          aria-label={`Increase ${ariaLabel}`}
        >+</button>
      </div>
    </label>
  )
}

// Format a number with up to 2 decimal places, dropping trailing zeros.
function formatNum(n: number): string {
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : "0"
}

// What the admin can do with a selected range.
function RangeActions({
  grid, ticketTypes, selection, sectionList,
  onClearSelection,
  onPaintRange,
  onPaintWithSectionUpsert,
}: {
  grid: SeatGrid
  ticketTypes: ReservedEventTicketType[]
  selection: CellRange
  sectionList: SectionMeta[]
  onClearSelection: () => void
  onPaintRange: (paint: (cell: GridCell) => GridCell) => void
  onPaintWithSectionUpsert: (section: SectionMeta, paint: (cell: GridCell) => GridCell) => void
}) {
  const w = selection.c2 - selection.c1 + 1
  const h = selection.r2 - selection.r1 + 1
  const total = w * h

  const [newName, setNewName] = useState("")
  const [newTier, setNewTier] = useState(ticketTypes[0]?.id ?? "")
  const [labelText, setLabelText] = useState("Label")

  const assignToExisting = (sectionId: string) => {
    onPaintRange(() => ({ kind: "seat", sectionId }))
  }
  const createSection = () => {
    if (!newName.trim()) { toast.error("Section name required"); return }
    if (!newTier) { toast.error("Pick a ticket tier"); return }
    const section: SectionMeta = {
      id: uid("section"),
      name: newName.trim(),
      defaultTicketTypeId: newTier,
    }
    onPaintWithSectionUpsert(section, () => ({ kind: "seat", sectionId: section.id }))
    setNewName("")
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Selection</h3>
        <button
          type="button"
          onClick={onClearSelection}
          className="text-xs text-muted-foreground underline"
        >
          Deselect
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        {total} cell{total === 1 ? "" : "s"} · rows {selection.r1 + 1}–{selection.r2 + 1}, cols {selection.c1 + 1}–{selection.c2 + 1}
      </p>

      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Assign to existing section
        </div>
        {sectionList.length === 0 ? (
          <p className="text-xs text-muted-foreground">No sections yet.</p>
        ) : (
          <div className="grid gap-1">
            {sectionList.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => assignToExisting(s.id)}
                className="flex items-center gap-2 rounded border bg-background px-2.5 py-1.5 text-left text-sm hover:bg-accent"
              >
                <TierDotById id={s.defaultTicketTypeId} ticketTypes={ticketTypes} />
                <span className="flex-1 truncate">{s.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5 rounded-md border bg-background p-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Create new section
        </div>
        <input
          aria-label="New section name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="e.g. Gold"
          className="w-full rounded border bg-background px-2 py-1 text-sm"
        />
        <select
          aria-label="New section tier"
          value={newTier}
          onChange={e => setNewTier(e.target.value)}
          className="w-full rounded border bg-background px-2 py-1 text-sm"
        >
          {ticketTypes.length === 0
            ? <option value="">Add ticket types first</option>
            : ticketTypes.map(tt => (
              <option key={tt.id} value={tt.id}>
                {tt.name} — {Number(tt.price).toLocaleString()}
              </option>
            ))
          }
        </select>
        <button
          type="button"
          onClick={createSection}
          disabled={!ticketTypes.length}
          className="w-full rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Create &amp; assign
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Other actions
        </div>
        <button
          type="button"
          onClick={() => onPaintRange(() => ({ kind: "empty" }))}
          className="w-full rounded border bg-background px-3 py-1.5 text-left text-sm hover:bg-accent"
        >
          Mark as <strong>aisle</strong> (empty)
        </button>
        <div className="flex items-stretch gap-1.5">
          <input
            aria-label="Label text"
            value={labelText}
            onChange={e => setLabelText(e.target.value)}
            placeholder="Label text"
            className="flex-1 rounded border bg-background px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => onPaintRange(() => ({ kind: "label", text: labelText }))}
            className="rounded border bg-background px-3 py-1.5 text-sm hover:bg-accent"
          >
            Mark
          </button>
        </div>
      </div>
    </div>
  )
}

function SectionList({
  sections, ticketTypes, seatsPerSection, onDeleteSection,
}: {
  sections: SectionMeta[]
  ticketTypes: ReservedEventTicketType[]
  seatsPerSection: Record<string, number>
  onDeleteSection: (sectionId: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Sections
      </div>
      {sections.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Drag across a range of cells to assign them to a section.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {sections.map(s => {
            const count = seatsPerSection[s.id] ?? 0
            const tt = ticketTypes.find(t => t.id === s.defaultTicketTypeId)
            return (
              <li key={s.id} className="flex items-center gap-2 rounded-md border bg-background p-2 text-sm">
                <TierDotById id={s.defaultTicketTypeId} ticketTypes={ticketTypes} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">{s.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">{count}</span>
                    {" "}seat{count === 1 ? "" : "s"}
                    {tt && <span> · {tt.name} · LKR {Number(tt.price).toLocaleString()}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Remove section "${s.name}" and clear its ${count} seat${count === 1 ? "" : "s"}?`)) {
                      onDeleteSection(s.id)
                    }
                  }}
                  title="Remove section"
                  className="rounded p-1 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// Sole grid-level setting now that row + column labels are edited inline
// in the sheet headers. Default 1; values other than 1 are stored.
function SeatNumberStartField({
  grid, onPatchGrid,
}: {
  grid: SeatGrid
  onPatchGrid: (next: SeatGrid) => void
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Seat number start (default column 1)
      </span>
      <input
        aria-label="Seat number start"
        type="number" min={1}
        value={grid.seatNumberStart ?? 1}
        onChange={e => {
          const v = Math.max(1, Number(e.target.value) || 1)
          onPatchGrid({ ...grid, seatNumberStart: v === 1 ? undefined : v })
        }}
        className="w-full rounded border bg-background px-2 py-1 text-sm"
      />
    </label>
  )
}

function TierDotById({ id, ticketTypes }: { id: string; ticketTypes: ReservedEventTicketType[] }) {
  const idx = ticketTypes.findIndex(t => t.id === id)
  const c = tierColor(idx >= 0 ? idx : 0)
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3 w-3 shrink-0 rounded-full"
      style={{ background: c }}
    />
  )
}
