"use client"

/**
 * Visual canvas seat-map editor — P2 of the MyTickets-quality reserved-seating
 * rework. Per-seat (x, y) positioning on a Konva canvas, decor shapes for stage
 * / walls / labels, section + ticket-type assignment, saves via the new
 * POST /api/organizer/events/:id/seat-map endpoint.
 *
 * MVP scope (this iteration):
 *   - Single canvas with pan + zoom (Konva Stage drag + wheel scaling)
 *   - "Add section" tool: name + rows + cols + spacing + ticket type → drops a
 *     grid of seats at top-left, admin drags individual seats to fit
 *   - "Add decor" tools: stage rectangle (rect+label), text label
 *   - Click selects (seat or decor); Delete / Backspace removes selected
 *   - Color-by-tier in the editor (matches the user-facing renderer's palette)
 *   - Save button validates + POSTs the payload
 *
 * Not yet (worth adding later):
 *   - Multi-select drag (move a whole section as a group)
 *   - Background floor-plan image upload
 *   - Undo/redo
 *   - Rotation
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import dynamic from "next/dynamic"
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
import {
  ArrowLeft,
  LayoutGrid,
  Plus,
  Save,
  Square,
  Trash2,
  Type as TypeIcon,
  Undo2,
  X,
} from "lucide-react"
import type { EditorSeat, EditorDecor, Selection } from "./BuilderCanvas"

// react-konva uses the browser's window AND has a custom React reconciler
// that needs its full subtree mounted synchronously. We dynamic-import the
// whole canvas as one chunk (ssr:false) instead of dynamic-importing each
// react-konva sub-component, which would leave the Stage with placeholder
// children and render nothing until every import resolved.
const BuilderCanvas = dynamic(() => import("./BuilderCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
      Loading canvas…
    </div>
  ),
})

// Palette for ticket-type swatches. Indexed by tier position; auditoriums
// rarely have >6 tiers so this comfortably covers them. Matches BUILDER_COLORS
// from the existing grid builder for visual continuity.
const TIER_PALETTE = ["#7F77DD", "#1D9E75", "#BA7517", "#D85A30", "#185FA5", "#993556", "#6B7280"]

const DEFAULT_VIEWBOX = { width: 1600, height: 1200 }
const DEFAULT_SEAT_SPACING = 22 // px between seats in generated rows

// Spreadsheet-style row labels (A, B, …, Z, AA, AB, …)
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

// Editor state types live in BuilderCanvas.tsx since they're the input
// contract for the renderer; re-imported above.

// ----- Helpers -----------------------------------------------------------

let _uidCounter = 0
const uid = (prefix = "id") => `${prefix}_${Date.now().toString(36)}_${(++_uidCounter).toString(36)}`

function tierColor(tierIndex: number) {
  return TIER_PALETTE[tierIndex % TIER_PALETTE.length]
}

// ----- Component ---------------------------------------------------------

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

  // Canvas state
  const [seats, setSeats] = useState<EditorSeat[]>([])
  const [decor, setDecor] = useState<EditorDecor[]>([])
  const [selection, setSelection] = useState<Selection>(null)
  // Per-event viewport — defaulted from the loaded seat-map state so a
  // previously-built map keeps its canvas dimensions and background image.
  const [viewbox, setViewbox] = useState<{ width: number; height: number }>(DEFAULT_VIEWBOX)
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)
  // Seats the server reports as held/booked — saving would refuse, so we
  // surface a banner instead of letting the admin discover it on submit.
  const [lockedSeats, setLockedSeats] = useState(0)

  // Undo history — snapshot of (seats, decor) right BEFORE each mutation.
  // Capped at 50 entries to bound memory; older snapshots roll off.
  const [history, setHistory] = useState<Array<{ seats: EditorSeat[]; decor: EditorDecor[] }>>([])
  // Dirty since last save/hydration. Drives the auto-save-on-back behaviour
  // and (later) a "unsaved changes" indicator. Reset to false in save success
  // and after the hydration effect finishes loading existing state.
  const [dirty, setDirty] = useState(false)

  // Snapshot (seats, decor) onto the undo stack. Called BEFORE each user
  // mutation; on undo we pop the most recent snapshot back into place.
  const pushHistory = useCallback(() => {
    setHistory(h => {
      const next = h.length >= 50 ? h.slice(1) : h.slice()
      next.push({ seats, decor })
      return next
    })
    setDirty(true)
  }, [seats, decor])

  const undo = useCallback(() => {
    setHistory(h => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      setSeats(prev.seats)
      setDecor(prev.decor)
      setSelection(null)
      return h.slice(0, -1)
    })
  }, [])

  // Modals
  const [showAddSection, setShowAddSection] = useState(false)

  // Stage transform — pan + zoom. stageRef lives inside BuilderCanvas now.
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [stageScale, setStageScale] = useState(1)
  const [stageSize, setStageSize] = useState({ width: 1200, height: 700 })

  const containerRef = useRef<HTMLDivElement | null>(null)

  // ----- Load event + ticket types ----------------------------------------

  useEffect(() => {
    if (!eventId) return
    let cancelled = false
    ;(async () => {
      try {
        // Three parallel calls — event meta + ticket types + existing seat-map
        // state. The seat-map fetch tolerates a 404 (returns empty seats) so a
        // brand-new event still opens a blank canvas instead of erroring.
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

        // Hydrate canvas state from the server. We only restore seats that
        // already have (x, y) — a grid-mode event whose seats are positionless
        // would otherwise stack on top of each other at the origin.
        const sm = smRes?.data?.data
        if (sm) {
          if (sm.layout) {
            setViewbox({
              width:  Number(sm.layout.viewbox_width)  || DEFAULT_VIEWBOX.width,
              height: Number(sm.layout.viewbox_height) || DEFAULT_VIEWBOX.height,
            })
            setBackgroundUrl(sm.layout.background_image_url || null)
            const decorHydrated: EditorDecor[] = (sm.layout.decor || [])
              .filter(d => d.kind === "rect" || d.kind === "text")
              .map((d, i) => ({
                id: d.id || uid("decor"),
                kind: d.kind as "rect" | "text",
                x: Number(d.x ?? 0),
                y: Number(d.y ?? 0),
                width:  d.width  != null ? Number(d.width)  : undefined,
                height: d.height != null ? Number(d.height) : undefined,
                label: d.label || (d.kind === "rect" ? `STAGE_${i}` : "Label"),
                fill:  d.fill  || undefined,
                color: d.color || undefined,
              }))
            setDecor(decorHydrated)
          }
          const positioned = (sm.seats || []).filter(s => s.x != null && s.y != null)
          const seatsHydrated: EditorSeat[] = positioned.map(s => ({
            id: uid("seat"),
            section: s.section || "General",
            row_label: s.row_label || "A",
            seat_number: String(s.seat_number ?? ""),
            x: Number(s.x),
            y: Number(s.y),
            ticket_type_id: s.ticket_type_id || "",
          }))
          setSeats(seatsHydrated)
          const locked = (sm.seats || []).filter(
            s => s.status === "held" || s.status === "booked",
          ).length
          setLockedSeats(locked)
        }
        // Hydration is the baseline — nothing to undo yet, nothing dirty.
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

  // Resize stage to fit container. ResizeObserver picks up the first layout
  // tick after PageLoader→canvas swap, plus any subsequent panel resizes.
  // (A plain "measure on mount" effect doesn't work: the container isn't in
  // the DOM until `loading` flips false, so the initial measurement would
  // miss and the Stage would be stuck at its 1200×700 default forever.)
  useEffect(() => {
    if (loading) return
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w > 0 && h > 0) setStageSize({ width: w, height: h })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener("resize", update)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", update)
    }
  }, [loading])

  // removeSection is declared later (after addSection etc.) but the keyboard
  // effect needs it now. A ref keeps the latest closure without dragging
  // removeSection into the effect's deps, which would also force a TDZ here.
  const removeSectionRef = useRef<((name: string) => void) | null>(null)

  // Keyboard: Delete removes the selected item.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const inField = !!(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT"))

      // Cmd/Ctrl+Z → undo. Cmd/Ctrl+Shift+Z is left alone (browser redo).
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
        if (inField) return
        e.preventDefault()
        undo()
        return
      }

      if (e.key !== "Delete" && e.key !== "Backspace") return
      if (inField) return
      if (!selection) return
      e.preventDefault()
      if (selection.kind === "seat") {
        pushHistory()
        setSeats(s => s.filter(x => x.id !== selection.id))
      }
      if (selection.kind === "decor") {
        pushHistory()
        setDecor(d => d.filter(x => x.id !== selection.id))
      }
      // For section selection the delete shortcut routes to removeSection
      // (which already prompts + pushes history). Read via the ref so the
      // effect doesn't depend on a not-yet-declared callback.
      if (selection.kind === "section") {
        removeSectionRef.current?.(selection.name)
        return
      }
      setSelection(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selection, undo, pushHistory])

  // ----- Tools ------------------------------------------------------------

  const addSection = useCallback((opts: {
    name: string
    rows: number
    cols: number
    spacing: number
    ticket_type_id: string
    startRow?: number
  }) => {
    const { name, rows, cols, spacing, ticket_type_id, startRow = 0 } = opts
    // Drop at center of current viewport (in stage coords).
    const center = stageToCanvas({
      x: stageSize.width / 2,
      y: stageSize.height / 2,
    }, stagePos, stageScale)
    const blockWidth  = (cols - 1) * spacing
    const blockHeight = (rows - 1) * spacing
    const originX = Math.round(center.x - blockWidth  / 2)
    const originY = Math.round(center.y - blockHeight / 2)

    const next: EditorSeat[] = []
    for (let r = 0; r < rows; r++) {
      const rowLabel = rowLabelFromIndex(startRow + r)
      for (let c = 0; c < cols; c++) {
        next.push({
          id: uid("seat"),
          section: name,
          row_label: rowLabel,
          seat_number: String(c + 1),
          x: originX + c * spacing,
          y: originY + r * spacing,
          ticket_type_id,
        })
      }
    }
    pushHistory()
    setSeats(prev => [...prev, ...next])
    toast.success(`Added section "${name}" (${next.length} seats)`)
  }, [stagePos, stageScale, stageSize, pushHistory])

  // Bake a section drag's delta into each seat's absolute (x, y) and push
  // one undo entry for the whole move.
  const moveSection = useCallback((sectionName: string, dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return
    pushHistory()
    setSeats(arr => arr.map(s =>
      s.section === sectionName
        ? { ...s, x: Math.round(s.x + dx), y: Math.round(s.y + dy) }
        : s))
  }, [pushHistory])

  // Drag handlers — each wraps a single history snapshot so undo backs out
  // one move at a time. Called from BuilderCanvas.
  const handleSeatMove = useCallback((seatId: string, x: number, y: number) => {
    pushHistory()
    setSeats(arr => arr.map(s => s.id === seatId ? { ...s, x, y } : s))
  }, [pushHistory])

  const handleDecorMove = useCallback((decorId: string, x: number, y: number) => {
    pushHistory()
    setDecor(arr => arr.map(d => d.id === decorId ? { ...d, x, y } : d))
  }, [pushHistory])

  // Remove every seat that belongs to a section. Called from the Section
  // Summary trash icon; clears any selection that referenced that section.
  const removeSection: (sectionName: string) => void = useCallback((sectionName: string) => {
    const count = seats.filter(s => s.section === sectionName).length
    if (count === 0) return
    const ok = typeof window === "undefined"
      ? true
      : window.confirm(`Remove section "${sectionName}" (${count} seat${count === 1 ? "" : "s"})?`)
    if (!ok) return
    pushHistory()
    setSeats(arr => arr.filter(s => s.section !== sectionName))
    setSelection(sel => (sel?.kind === "section" && sel.name === sectionName) ? null : sel)
    toast.success(`Removed section "${sectionName}"`)
  }, [seats, pushHistory])

  // Keep the keyboard-handler ref pointing at the freshest removeSection so
  // pressing Delete on a selected section deletes it via the same prompt.
  useEffect(() => { removeSectionRef.current = removeSection }, [removeSection])

  const addDecor = useCallback((kind: "rect" | "text", label = "") => {
    const center = stageToCanvas({
      x: stageSize.width / 2,
      y: stageSize.height / 2,
    }, stagePos, stageScale)
    const id = uid("decor")
    pushHistory()
    if (kind === "rect") {
      setDecor(prev => [...prev, {
        id, kind: "rect",
        x: Math.round(center.x - 200), y: Math.round(center.y - 30),
        width: 400, height: 60,
        label: label || "STAGE",
        fill: "#111827", color: "#FFFFFF",
      }])
    } else {
      setDecor(prev => [...prev, {
        id, kind: "text",
        x: Math.round(center.x), y: Math.round(center.y),
        label: label || "LABEL",
        color: "#374151",
      }])
    }
    setSelection({ kind: "decor", id })
  }, [stagePos, stageScale, stageSize, pushHistory])

  // Wheel-zoom + drag-pan are owned by BuilderCanvas (it has access to the
  // Konva stage ref). The page only stores the resulting pos / scale.

  // ----- Save -------------------------------------------------------------

  const save = useCallback(async () => {
    if (!eventId || !event) return
    if (seats.length === 0) {
      toast.error("Add at least one section before saving.")
      return
    }
    // Validate: every seat has a ticket_type
    const orphans = seats.filter(s => !s.ticket_type_id)
    if (orphans.length > 0) {
      toast.error(`${orphans.length} seat(s) have no ticket type assigned.`)
      return
    }
    setSaving(true)
    try {
      const payload: VisualSeatMapPayload = {
        viewbox_width:  viewbox.width,
        viewbox_height: viewbox.height,
        background_image_url: backgroundUrl,
        decor: decor.map<VisualSeatMapDecor>(d => ({
          id: d.id,
          kind: d.kind,
          x: d.x,
          y: d.y,
          width: d.width,
          height: d.height,
          label: d.label,
          fill: d.fill,
          color: d.color,
        })),
        seats: seats.map<VisualSeatMapSeat>(s => ({
          section: s.section,
          row_label: s.row_label,
          seat_number: s.seat_number,
          seat_label: `${s.row_label}-${s.seat_number}`,
          x: s.x,
          y: s.y,
          ticket_type_id: s.ticket_type_id,
          seat_type: "standard",
        })),
      }
      const res = await reservedEventsAPI.buildSeatMap(eventId, payload)
      const out = res?.data?.data
      toast.success(`Saved (${out?.seats_created ?? seats.length} seats)`)
      setDirty(false)
      setHistory([])
      router.push("/reserved-seating-events")
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Save failed"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }, [eventId, event, seats, decor, viewbox, backgroundUrl, router])

  // Back-button handler — auto-save if there are unsaved changes, otherwise
  // navigate straight away. Save() already navigates on success, so for the
  // dirty path we just call it.
  const goBack = useCallback(() => {
    const targetUrl = "/reserved-seating-events"
    if (!dirty || seats.length === 0) {
      router.push(targetUrl)
      return
    }
    if (lockedSeats > 0) {
      const ok = window.confirm(
        `Can't save — ${lockedSeats} seat${lockedSeats === 1 ? "" : "s"} held/booked. Leave without saving?`,
      )
      if (ok) router.push(targetUrl)
      return
    }
    // Save will toast on error and stay on this page; on success it pushes
    // to the list. setDirty(false) inside save() prevents a double-prompt
    // from any subsequent navigation.
    save()
  }, [dirty, seats.length, lockedSeats, router, save])

  // ----- Render -----------------------------------------------------------

  if (loading) return <PageLoader />
  if (!event)  return <div className="p-8 text-center text-muted-foreground">Event not found.</div>

  const tierIndexById = (id: string) => ticketTypes.findIndex(t => t.id === id)

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Top bar */}
      <div className="border-b bg-background flex items-center gap-3 px-4 py-2.5">
        <button
          type="button"
          onClick={goBack}
          title={dirty ? "Save and go back" : "Back"}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {dirty && seats.length > 0 ? "Save & back" : "Back"}
        </button>
        <div className="h-5 w-px bg-border" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate flex items-center gap-2">
            <span className="truncate">{event.title}</span>
            {dirty && <span className="shrink-0 text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">Unsaved</span>}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {event.venue_name ?? "Venue TBA"} · {seats.length} seat{seats.length === 1 ? "" : "s"} · {decor.length} decor item{decor.length === 1 ? "" : "s"}
          </div>
        </div>
        {lockedSeats > 0 && (
          <div
            className="hidden md:inline-flex items-center gap-1.5 rounded-md bg-amber-100 dark:bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300"
            title="Saving will fail until these are released. Wait for hold expiry or refund the bookings."
          >
            {lockedSeats} seat{lockedSeats === 1 ? "" : "s"} held/booked — save will refuse
          </div>
        )}
        <button
          type="button"
          onClick={undo}
          disabled={history.length === 0}
          title="Undo (Ctrl/Cmd+Z)"
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Undo2 className="h-4 w-4" /> Undo
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || seats.length === 0 || lockedSeats > 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save seat map"}
        </button>
      </div>

      {/* Body — toolbar | canvas | inspector */}
      <div className="flex-1 flex min-h-0">
        {/* Toolbar */}
        <aside className="w-56 border-r bg-muted/30 flex flex-col gap-1 p-2 text-sm">
          <button
            onClick={() => setShowAddSection(true)}
            className="inline-flex items-center gap-2 rounded px-3 py-2 hover:bg-accent text-left"
          >
            <LayoutGrid className="h-4 w-4" /> Add section
          </button>
          <button
            onClick={() => addDecor("rect", "STAGE")}
            className="inline-flex items-center gap-2 rounded px-3 py-2 hover:bg-accent text-left"
          >
            <Square className="h-4 w-4" /> Add stage / decor rect
          </button>
          <button
            onClick={() => addDecor("text", "Label")}
            className="inline-flex items-center gap-2 rounded px-3 py-2 hover:bg-accent text-left"
          >
            <TypeIcon className="h-4 w-4" /> Add text label
          </button>

          <div className="mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ticket tiers
          </div>
          <div className="px-2 flex flex-col gap-1">
            {ticketTypes.length === 0 ? (
              <div className="px-1 text-xs text-muted-foreground">
                No ticket types yet — add them on the event before building the seat map.
              </div>
            ) : ticketTypes.map((tt, i) => (
              <div key={tt.id} className="flex items-center gap-2 text-xs px-1 py-1">
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: tierColor(i) }} />
                <span className="flex-1 truncate">{tt.name}</span>
                <span className="text-muted-foreground">{Number(tt.price).toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="mt-auto px-3 py-2 text-[11px] text-muted-foreground border-t border-border/50">
            Scroll: zoom · Drag empty: pan · Click seat: select · Delete: remove
          </div>
        </aside>

        {/* Canvas */}
        <div
          ref={containerRef}
          className="flex-1 relative bg-[radial-gradient(circle_at_1px_1px,_rgba(0,0,0,0.06)_1px,_transparent_0)]"
          style={{ backgroundSize: "20px 20px" }}
        >
          <BuilderCanvas
            viewbox={viewbox}
            stageSize={stageSize}
            stagePos={stagePos}
            stageScale={stageScale}
            setStagePos={setStagePos}
            setStageScale={setStageScale}
            seats={seats}
            decor={decor}
            selection={selection}
            setSelection={setSelection}
            seatColor={(id) => tierColor(tierIndexById(id))}
            onSeatMove={handleSeatMove}
            onDecorMove={handleDecorMove}
            onSectionMove={moveSection}
          />

          {/* Stage transform reset button */}
          <button
            onClick={() => { setStagePos({ x: 0, y: 0 }); setStageScale(1) }}
            className="absolute bottom-3 left-3 rounded-md bg-background border px-2.5 py-1 text-xs shadow-sm hover:bg-accent"
          >
            Reset view
          </button>
        </div>

        {/* Inspector */}
        <aside className="w-72 border-l bg-muted/30 flex flex-col">
          {selection?.kind === "seat" ? (
            <SeatInspector
              seat={seats.find(s => s.id === selection.id)!}
              ticketTypes={ticketTypes}
              onChange={patch => {
                pushHistory()
                setSeats(arr => arr.map(s => s.id === selection.id ? { ...s, ...patch } : s))
              }}
              onDelete={() => {
                pushHistory()
                setSeats(arr => arr.filter(s => s.id !== selection.id))
                setSelection(null)
              }}
            />
          ) : selection?.kind === "decor" ? (
            <DecorInspector
              decor={decor.find(d => d.id === selection.id)!}
              onChange={patch => {
                pushHistory()
                setDecor(arr => arr.map(d => d.id === selection.id ? { ...d, ...patch } : d))
              }}
              onDelete={() => {
                pushHistory()
                setDecor(arr => arr.filter(d => d.id !== selection.id))
                setSelection(null)
              }}
            />
          ) : selection?.kind === "section" ? (
            <SectionInspector
              sectionName={selection.name}
              seats={seats}
              ticketTypes={ticketTypes}
              onRename={(newName) => {
                if (!newName.trim() || newName === selection.name) return
                if (seats.some(s => s.section === newName)) {
                  toast.error(`A section named "${newName}" already exists.`)
                  return
                }
                pushHistory()
                setSeats(arr => arr.map(s => s.section === selection.name ? { ...s, section: newName } : s))
                setSelection({ kind: "section", name: newName })
              }}
              onBulkTier={(ticketTypeId) => {
                pushHistory()
                setSeats(arr => arr.map(s => s.section === selection.name ? { ...s, ticket_type_id: ticketTypeId } : s))
              }}
              onRemove={() => removeSection(selection.name)}
            />
          ) : (
            <div className="p-4 text-sm text-muted-foreground">
              Click a seat, section, or decor item to edit it.
            </div>
          )}

          {/* Section summary */}
          <div className="mt-auto border-t p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Sections in this map
            </div>
            <SectionSummary
              seats={seats}
              ticketTypes={ticketTypes}
              onSelect={(name) => setSelection({ kind: "section", name })}
              onRemove={removeSection}
            />
          </div>
        </aside>
      </div>

      {showAddSection && (
        <AddSectionModal
          ticketTypes={ticketTypes}
          existingSections={[...new Set(seats.map(s => s.section))]}
          onCancel={() => setShowAddSection(false)}
          onSubmit={opts => { setShowAddSection(false); addSection(opts) }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inspector panels
// ---------------------------------------------------------------------------

function SeatInspector({
  seat, ticketTypes, onChange, onDelete,
}: {
  seat: EditorSeat
  ticketTypes: ReservedEventTicketType[]
  onChange: (patch: Partial<EditorSeat>) => void
  onDelete: () => void
}) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Seat</h3>
        <button onClick={onDelete} className="text-destructive hover:bg-destructive/10 rounded p-1.5">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <Field label="Section">
        <input
          value={seat.section}
          onChange={e => onChange({ section: e.target.value })}
          className="w-full px-2 py-1 text-sm border rounded bg-background"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Row">
          <input
            value={seat.row_label}
            onChange={e => onChange({ row_label: e.target.value.toUpperCase() })}
            className="w-full px-2 py-1 text-sm border rounded bg-background"
          />
        </Field>
        <Field label="Number">
          <input
            value={seat.seat_number}
            onChange={e => onChange({ seat_number: e.target.value })}
            className="w-full px-2 py-1 text-sm border rounded bg-background"
          />
        </Field>
      </div>
      <Field label="Ticket type">
        <select
          value={seat.ticket_type_id}
          onChange={e => onChange({ ticket_type_id: e.target.value })}
          className="w-full px-2 py-1 text-sm border rounded bg-background"
        >
          {ticketTypes.map(tt => (
            <option key={tt.id} value={tt.id}>
              {tt.name} — {Number(tt.price).toLocaleString()}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="X"><span className="text-xs px-2 py-1 bg-background rounded inline-block">{seat.x}</span></Field>
        <Field label="Y"><span className="text-xs px-2 py-1 bg-background rounded inline-block">{seat.y}</span></Field>
      </div>
    </div>
  )
}

function DecorInspector({
  decor, onChange, onDelete,
}: {
  decor: EditorDecor
  onChange: (patch: Partial<EditorDecor>) => void
  onDelete: () => void
}) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{decor.kind === "rect" ? "Stage / Rect" : "Text label"}</h3>
        <button onClick={onDelete} className="text-destructive hover:bg-destructive/10 rounded p-1.5">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <Field label="Label">
        <input
          value={decor.label ?? ""}
          onChange={e => onChange({ label: e.target.value })}
          className="w-full px-2 py-1 text-sm border rounded bg-background"
        />
      </Field>
      {decor.kind === "rect" && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Width">
            <input
              type="number"
              value={decor.width ?? 200}
              onChange={e => onChange({ width: Math.max(20, Number(e.target.value)) })}
              className="w-full px-2 py-1 text-sm border rounded bg-background"
            />
          </Field>
          <Field label="Height">
            <input
              type="number"
              value={decor.height ?? 60}
              onChange={e => onChange({ height: Math.max(20, Number(e.target.value)) })}
              className="w-full px-2 py-1 text-sm border rounded bg-background"
            />
          </Field>
        </div>
      )}
      <Field label="Fill">
        <input
          type="color"
          value={decor.fill ?? "#111827"}
          onChange={e => onChange({ fill: e.target.value })}
          className="w-full h-8 rounded border"
        />
      </Field>
      <Field label="Text color">
        <input
          type="color"
          value={decor.color ?? "#FFFFFF"}
          onChange={e => onChange({ color: e.target.value })}
          className="w-full h-8 rounded border"
        />
      </Field>
    </div>
  )
}

function SectionSummary({
  seats, ticketTypes, onSelect, onRemove,
}: {
  seats: EditorSeat[]
  ticketTypes: ReservedEventTicketType[]
  onSelect: (name: string) => void
  onRemove: (name: string) => void
}) {
  const summary = useMemo(() => {
    const map = new Map<string, { count: number; tierName: string; tierIdx: number }>()
    for (const s of seats) {
      const idx = ticketTypes.findIndex(t => t.id === s.ticket_type_id)
      const tierName = idx >= 0 ? ticketTypes[idx].name : "—"
      const cur = map.get(s.section)
      if (cur) cur.count += 1
      else map.set(s.section, { count: 1, tierName, tierIdx: idx })
    }
    return Array.from(map.entries()).map(([name, info]) => ({ name, ...info }))
  }, [seats, ticketTypes])
  if (summary.length === 0) {
    return <div className="text-xs text-muted-foreground">No sections yet.</div>
  }
  return (
    <ul className="space-y-1 text-xs">
      {summary.map(s => (
        <li key={s.name} className="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: tierColor(s.tierIdx) }}
          />
          <button
            type="button"
            onClick={() => onSelect(s.name)}
            title="Select section"
            className="flex-1 min-w-0 text-left truncate"
          >
            {s.name}
          </button>
          <span className="text-muted-foreground tabular-nums">{s.count}</span>
          <button
            type="button"
            onClick={() => onRemove(s.name)}
            title="Remove section"
            className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 rounded p-1 transition-opacity"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// SectionInspector — appears when a whole section is selected (clicked on its
// bbox or label on the canvas). Lets the admin rename the section, bulk-assign
// a different ticket tier to every seat, or remove the whole thing.
// ---------------------------------------------------------------------------
function SectionInspector({
  sectionName, seats, ticketTypes, onRename, onBulkTier, onRemove,
}: {
  sectionName: string
  seats: EditorSeat[]
  ticketTypes: ReservedEventTicketType[]
  onRename: (newName: string) => void
  onBulkTier: (ticketTypeId: string) => void
  onRemove: () => void
}) {
  const sectionSeats = seats.filter(s => s.section === sectionName)
  // Mixed-tier sections show "—" so onBulkTier doesn't silently overwrite.
  const tierIds = new Set(sectionSeats.map(s => s.ticket_type_id))
  const currentTier = tierIds.size === 1 ? [...tierIds][0] : ""
  // Local-edited name so the user can type without each keystroke pushing
  // history. Commit happens on Enter or blur.
  const [draftName, setDraftName] = useState(sectionName)
  useEffect(() => { setDraftName(sectionName) }, [sectionName])

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Section</h3>
        <button
          type="button"
          onClick={onRemove}
          title="Remove section"
          className="text-destructive hover:bg-destructive/10 rounded p-1.5"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <Field label="Name">
        <input
          value={draftName}
          onChange={e => setDraftName(e.target.value)}
          onBlur={() => onRename(draftName.trim())}
          onKeyDown={e => {
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur()
            if (e.key === "Escape") setDraftName(sectionName)
          }}
          className="w-full px-2 py-1 text-sm border rounded bg-background"
        />
      </Field>
      <div className="text-xs text-muted-foreground">
        {sectionSeats.length} seat{sectionSeats.length === 1 ? "" : "s"}
      </div>
      <Field label={tierIds.size > 1 ? "Bulk ticket type (mixed)" : "Ticket type"}>
        <select
          aria-label="Section ticket type"
          value={currentTier}
          onChange={e => onBulkTier(e.target.value)}
          className="w-full px-2 py-1 text-sm border rounded bg-background"
        >
          {tierIds.size > 1 && <option value="" disabled>— mixed —</option>}
          {ticketTypes.map(tt => (
            <option key={tt.id} value={tt.id}>
              {tt.name} — {Number(tt.price).toLocaleString()}
            </option>
          ))}
        </select>
      </Field>
      <p className="text-[11px] text-muted-foreground">
        Drag the section&rsquo;s outline (the empty space inside its bounds) to move
        every seat together. Individual seats can still be nudged one at a time.
      </p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  )
}

// ---------------------------------------------------------------------------
// Add Section modal
// ---------------------------------------------------------------------------

function AddSectionModal({
  ticketTypes, existingSections, onCancel, onSubmit,
}: {
  ticketTypes: ReservedEventTicketType[]
  existingSections: string[]
  onCancel: () => void
  onSubmit: (opts: { name: string; rows: number; cols: number; spacing: number; ticket_type_id: string; startRow?: number }) => void
}) {
  const [name, setName] = useState("")
  const [rows, setRows] = useState(8)
  const [cols, setCols] = useState(12)
  const [spacing, setSpacing] = useState(DEFAULT_SEAT_SPACING)
  const [ticketTypeId, setTicketTypeId] = useState(ticketTypes[0]?.id ?? "")
  const [startRow, setStartRow] = useState(0)

  const submit = () => {
    if (!name.trim()) { toast.error("Section name required"); return }
    if (!ticketTypeId) { toast.error("Pick a ticket type"); return }
    if (rows < 1 || cols < 1) { toast.error("Rows and cols must be positive"); return }
    onSubmit({
      name: name.trim(),
      rows, cols, spacing,
      ticket_type_id: ticketTypeId,
      startRow,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="font-semibold">Add section</h3>
          <button onClick={onCancel} className="p-1 rounded hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Section name">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Floor 2 Left"
              list="existing-sections"
              className="w-full px-3 py-2 text-sm border rounded bg-background"
            />
            <datalist id="existing-sections">
              {existingSections.map(s => <option key={s} value={s} />)}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rows">
              <input type="number" min={1} value={rows} onChange={e => setRows(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm border rounded bg-background" />
            </Field>
            <Field label="Cols">
              <input type="number" min={1} value={cols} onChange={e => setCols(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm border rounded bg-background" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Seat spacing (px)">
              <input type="number" min={10} value={spacing} onChange={e => setSpacing(Math.max(10, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm border rounded bg-background" />
            </Field>
            <Field label="Start row at (A=0)">
              <input type="number" min={0} value={startRow} onChange={e => setStartRow(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm border rounded bg-background" />
            </Field>
          </div>
          <Field label="Ticket type">
            <select
              value={ticketTypeId}
              onChange={e => setTicketTypeId(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded bg-background"
            >
              {ticketTypes.length === 0 ? (
                <option value="">No ticket types — add them first</option>
              ) : ticketTypes.map(tt => (
                <option key={tt.id} value={tt.id}>{tt.name} — {Number(tt.price).toLocaleString()}</option>
              ))}
            </select>
          </Field>
          <div className="text-xs text-muted-foreground">
            Generates {rows * cols} seats at the canvas center. You can drag individual seats to fit afterwards.
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-muted/30">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded hover:bg-accent">Cancel</button>
          <button
            onClick={submit}
            disabled={ticketTypes.length === 0}
            className="inline-flex items-center gap-1.5 rounded bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stageToCanvas(
  pt: { x: number; y: number },
  stagePos: { x: number; y: number },
  stageScale: number,
) {
  return {
    x: (pt.x - stagePos.x) / stageScale,
    y: (pt.y - stagePos.y) / stageScale,
  }
}
