"use client"

/**
 * Reserved seating canvas builder — v2, structured-section model.
 *
 * Each section is a declarative grid block (`SectionSpec`) with rows × cols,
 * spacing, default tier, per-cell tier overrides, and per-cell "skip" flags
 * for irregular bottom edges. Individual seats are NEVER stored — they're
 * derived from the section spec at render + save time.
 *
 * Row letters and seat numbers are derived globally from seat Y / X positions
 * via `seatMapModel.deriveLabels`:
 *   - Sections at the same row Y share a row letter (cross-section rows).
 *   - Seats are numbered left-to-right across sections in the same row.
 *   - A large Y-gap (>2.5× median row gap) starts a new zone with its own
 *     label scheme (single letters → double → triple). Matches the
 *     reference layout's A-U (top) / AA-MM (balcony) convention.
 *
 * On save we run derive → label → ship to the existing /seat-map endpoint
 * (no API changes). On hydrate we reverse-engineer SectionSpec[] from the
 * stored event_seats rows so re-edits don't start blank.
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
  Image as ImageIcon,
  LayoutGrid,
  Plus,
  Save,
  Square,
  Trash2,
  Type as TypeIcon,
  Undo2,
  X,
} from "lucide-react"
import {
  deriveSeats,
  deriveLabels,
  reverseEngineerSections,
  type SectionSpec,
} from "./seatMapModel"
import type { EditorDecor, Selection } from "./BuilderCanvas"

// react-konva needs the whole canvas subtree mounted atomically — dynamic-
// importing each sub-component separately leaves the Stage with React
// placeholders that Konva's reconciler can't resolve. One dynamic import of
// the whole BuilderCanvas keeps it as a single client-only chunk.
const BuilderCanvas = dynamic(() => import("./BuilderCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
      Loading canvas…
    </div>
  ),
})

// Tier swatch palette — indexed by ticket-type position in `ticket_types`.
const TIER_PALETTE = ["#7F77DD", "#1D9E75", "#BA7517", "#D85A30", "#185FA5", "#993556", "#6B7280"]
function tierColor(tierIndex: number) {
  return TIER_PALETTE[tierIndex % TIER_PALETTE.length] || TIER_PALETTE[0]
}

const DEFAULT_VIEWBOX = { width: 1600, height: 1200 }
const DEFAULT_SEAT_SPACING = 22

let _uidCounter = 0
const uid = (prefix = "id") => `${prefix}_${Date.now().toString(36)}_${(++_uidCounter).toString(36)}`

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

  // Canvas state — sections + decor are the source of truth. Seats are
  // derived for rendering and save; admin never edits a seat list directly.
  const [sections, setSections] = useState<SectionSpec[]>([])
  const [decor, setDecor] = useState<EditorDecor[]>([])
  const [selection, setSelection] = useState<Selection>(null)
  const [viewbox, setViewbox] = useState<{ width: number; height: number }>(DEFAULT_VIEWBOX)
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)
  const [lockedSeats, setLockedSeats] = useState(0)

  // Undo history. One snapshot per user mutation — capped at 50.
  const [history, setHistory] = useState<Array<{ sections: SectionSpec[]; decor: EditorDecor[] }>>([])
  const [dirty, setDirty] = useState(false)

  const pushHistory = useCallback(() => {
    setHistory(h => {
      const next = h.length >= 50 ? h.slice(1) : h.slice()
      next.push({ sections, decor })
      return next
    })
    setDirty(true)
  }, [sections, decor])

  const undo = useCallback(() => {
    setHistory(h => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      setSections(prev.sections)
      setDecor(prev.decor)
      setSelection(null)
      return h.slice(0, -1)
    })
  }, [])

  // Modals
  const [showAddSection, setShowAddSection] = useState(false)

  // Background upload
  const [bgUploading, setBgUploading] = useState(false)
  const bgFileInputRef = useRef<HTMLInputElement | null>(null)
  const uploadBackground = useCallback(async (file: File) => {
    setBgUploading(true)
    try {
      const res = await reservedEventsAPI.uploadLayoutDoc(file)
      const url = res?.data?.data?.url
      if (!url) throw new Error("Upload returned no URL")
      pushHistory()
      setBackgroundUrl(url)
      toast.success("Background uploaded")
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }, message?: string })?.response?.data?.message
        || (err as Error)?.message
        || "Upload failed"
      toast.error(msg)
    } finally {
      setBgUploading(false)
    }
  }, [pushHistory])
  const clearBackground = useCallback(() => {
    if (!backgroundUrl) return
    pushHistory()
    setBackgroundUrl(null)
  }, [backgroundUrl, pushHistory])

  // Resize the canvas viewport — the white rectangle sections sit on. Used
  // to match the canvas shape to the actual venue (wide arena vs tall
  // auditorium). Clamped to a sensible range; min keeps a usable area, max
  // avoids runaway memory in Konva when zoomed out.
  const setViewboxDim = useCallback((axis: "width" | "height", value: number) => {
    const v = Math.max(200, Math.min(10000, Math.round(value) || 0))
    if (viewbox[axis] === v) return
    pushHistory()
    setViewbox(prev => ({ ...prev, [axis]: v }))
  }, [viewbox, pushHistory])

  // Stage transform — pan + zoom. stageRef lives inside BuilderCanvas.
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [stageScale, setStageScale] = useState(1)
  const [stageSize, setStageSize] = useState({ width: 1200, height: 700 })
  const containerRef = useRef<HTMLDivElement | null>(null)

  // ----- Load event + ticket types + reverse-engineer sections ----------

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
          // Reverse-engineer SectionSpec[] from the flat event_seats list.
          const recovered = reverseEngineerSections(sm.seats || [], uid)
          setSections(recovered)
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

  // Stage size — measured once the canvas container is mounted (PageLoader
  // swap pulls the container into the DOM, ResizeObserver picks up the rest).
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
    return () => { ro.disconnect(); window.removeEventListener("resize", update) }
  }, [loading])

  // Keyboard shortcuts. Delete on a section removes the section; on a decor
  // it removes the decor; on a derived seat it toggles skip. Cmd/Ctrl+Z
  // pops one history entry.
  const removeSectionRef = useRef<((id: string) => void) | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const inField = !!(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT"))
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
        if (inField) return
        e.preventDefault()
        undo()
        return
      }
      if (e.key !== "Delete" && e.key !== "Backspace") return
      if (inField || !selection) return
      e.preventDefault()
      if (selection.kind === "section") {
        removeSectionRef.current?.(selection.id)
        return
      }
      if (selection.kind === "decor") {
        pushHistory()
        setDecor(d => d.filter(x => x.id !== selection.id))
        setSelection(null)
      }
      if (selection.kind === "seat") {
        // Parse "sectionId#r#c" and toggle skip.
        const [sectionId, rStr, cStr] = selection.derivedId.split("#")
        const r = Number(rStr); const c = Number(cStr)
        if (!Number.isFinite(r) || !Number.isFinite(c)) return
        pushHistory()
        setSections(arr => arr.map(s => {
          if (s.id !== sectionId) return s
          const key = `${r},${c}`
          const next = { ...s.skipSeats }
          next[key] = true
          return { ...s, skipSeats: next }
        }))
        setSelection(null)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selection, undo, pushHistory])

  // ----- Section mutations ------------------------------------------------

  const addSection = useCallback((opts: {
    name: string
    rows: number
    cols: number
    spacing: number
    ticket_type_id: string
  }) => {
    // Drop new section at the canvas viewport centre.
    const center = stageToCanvas({
      x: stageSize.width / 2,
      y: stageSize.height / 2,
    }, stagePos, stageScale)
    const blockWidth  = (opts.cols - 1) * opts.spacing
    const blockHeight = (opts.rows - 1) * opts.spacing
    const spec: SectionSpec = {
      id: uid("section"),
      name: opts.name,
      x: Math.round(center.x - blockWidth  / 2),
      y: Math.round(center.y - blockHeight / 2),
      rows: opts.rows,
      cols: opts.cols,
      rowSpacing: opts.spacing,
      seatSpacing: opts.spacing,
      defaultTicketTypeId: opts.ticket_type_id,
      tierOverrides: {},
      skipSeats: {},
    }
    pushHistory()
    setSections(prev => [...prev, spec])
    toast.success(`Added section "${opts.name}" (${opts.rows * opts.cols} seats)`)
  }, [stagePos, stageScale, stageSize, pushHistory])

  const moveSection = useCallback((sectionId: string, dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return
    pushHistory()
    setSections(arr => arr.map(s =>
      s.id === sectionId
        ? { ...s, x: Math.round(s.x + dx), y: Math.round(s.y + dy) }
        : s))
  }, [pushHistory])

  // Section resize via Konva Transformer scales the row + seat spacing
  // (rows/cols unchanged). Translation is baked into x/y.
  const resizeSection = useCallback((
    sectionId: string,
    nx: number, ny: number,
    sx: number, sy: number,
  ) => {
    pushHistory()
    setSections(arr => arr.map(s => {
      if (s.id !== sectionId) return s
      return {
        ...s,
        x: Math.round(nx),
        y: Math.round(ny),
        rowSpacing:  Math.max(6, Math.round(s.rowSpacing  * sy)),
        seatSpacing: Math.max(6, Math.round(s.seatSpacing * sx)),
      }
    }))
  }, [pushHistory])

  const removeSection: (id: string) => void = useCallback((sectionId: string) => {
    const target = sections.find(s => s.id === sectionId)
    if (!target) return
    const seatCount = target.rows * target.cols - Object.keys(target.skipSeats).length
    const ok = typeof window === "undefined"
      ? true
      : window.confirm(`Remove section "${target.name}" (${seatCount} seat${seatCount === 1 ? "" : "s"})?`)
    if (!ok) return
    pushHistory()
    setSections(arr => arr.filter(s => s.id !== sectionId))
    setSelection(sel => (sel?.kind === "section" && sel.id === sectionId) ? null : sel)
    toast.success(`Removed section "${target.name}"`)
  }, [sections, pushHistory])
  useEffect(() => { removeSectionRef.current = removeSection }, [removeSection])

  const updateSection = useCallback((sectionId: string, patch: Partial<SectionSpec>) => {
    pushHistory()
    setSections(arr => arr.map(s => s.id === sectionId ? { ...s, ...patch } : s))
  }, [pushHistory])

  // Toggle a cell's "skip" flag. Double-clicked on canvas or via Delete on
  // a selected seat cell — useful for carving irregular bottom edges.
  const toggleSkipSeat = useCallback((sectionId: string, r: number, c: number) => {
    pushHistory()
    setSections(arr => arr.map(s => {
      if (s.id !== sectionId) return s
      const key = `${r},${c}`
      const next = { ...s.skipSeats }
      if (next[key]) delete next[key]
      else next[key] = true
      return { ...s, skipSeats: next }
    }))
  }, [pushHistory])

  // Override a cell's ticket tier. `tierId` = "" means clear the override.
  const setCellTier = useCallback((sectionId: string, r: number, c: number, tierId: string) => {
    pushHistory()
    setSections(arr => arr.map(s => {
      if (s.id !== sectionId) return s
      const key = `${r},${c}`
      const next = { ...s.tierOverrides }
      if (!tierId || tierId === s.defaultTicketTypeId) delete next[key]
      else next[key] = tierId
      return { ...s, tierOverrides: next }
    }))
  }, [pushHistory])

  // ----- Decor mutations --------------------------------------------------

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

  const handleDecorMove = useCallback((decorId: string, x: number, y: number) => {
    pushHistory()
    setDecor(arr => arr.map(d => d.id === decorId ? { ...d, x, y } : d))
  }, [pushHistory])

  // ----- Save -------------------------------------------------------------

  const save = useCallback(async () => {
    if (!eventId || !event) return
    // Derive seats + labels right before save so the API receives a flat
    // event_seats payload with row_label and seat_number computed from the
    // current visual positions.
    const derived = deriveSeats(sections)
    if (derived.length === 0) {
      toast.error("Add at least one section before saving.")
      return
    }
    const orphans = derived.filter(s => !s.ticketTypeId)
    if (orphans.length > 0) {
      toast.error(`${orphans.length} seat(s) have no ticket type assigned.`)
      return
    }
    const labels = deriveLabels(derived)
    setSaving(true)
    try {
      const payload: VisualSeatMapPayload = {
        viewbox_width:  viewbox.width,
        viewbox_height: viewbox.height,
        background_image_url: backgroundUrl,
        decor: decor.map<VisualSeatMapDecor>(d => ({
          id: d.id, kind: d.kind,
          x: d.x, y: d.y,
          width: d.width, height: d.height,
          label: d.label, fill: d.fill, color: d.color,
        })),
        seats: derived.map<VisualSeatMapSeat>(s => {
          const lab = labels[s.id]
          return {
            section: s.sectionName,
            row_label: lab?.row_label || "?",
            seat_number: lab?.seat_number || "?",
            seat_label: `${lab?.row_label || "?"}-${lab?.seat_number || "?"}`,
            x: s.x,
            y: s.y,
            ticket_type_id: s.ticketTypeId,
            seat_type: "standard",
          }
        }),
      }
      const res = await reservedEventsAPI.buildSeatMap(eventId, payload)
      const out = res?.data?.data
      toast.success(`Saved (${out?.seats_created ?? derived.length} seats)`)
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
  }, [eventId, event, sections, decor, viewbox, backgroundUrl, router])

  const goBack = useCallback(() => {
    const targetUrl = "/reserved-seating-events"
    if (!dirty || sections.length === 0) {
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
    save()
  }, [dirty, sections.length, lockedSeats, router, save])

  // ----- Render -----------------------------------------------------------

  if (loading) return <PageLoader />
  if (!event)  return <div className="p-8 text-center text-muted-foreground">Event not found.</div>

  const tierIndexById = (id: string) => ticketTypes.findIndex(t => t.id === id)
  const totalSeats = sections.reduce(
    (sum, s) => sum + (s.rows * s.cols - Object.keys(s.skipSeats).length),
    0,
  )

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
          {dirty && sections.length > 0 ? "Save & back" : "Back"}
        </button>
        <div className="h-5 w-px bg-border" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate flex items-center gap-2">
            <span className="truncate">{event.title}</span>
            {dirty && <span className="shrink-0 text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">Unsaved</span>}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {event.venue_name ?? "Venue TBA"} · {sections.length} section{sections.length === 1 ? "" : "s"} · {totalSeats} seat{totalSeats === 1 ? "" : "s"} · {decor.length} decor item{decor.length === 1 ? "" : "s"}
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
          disabled={saving || sections.length === 0 || lockedSeats > 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save seat map"}
        </button>
      </div>

      {/* Body — toolbar | canvas | inspector */}
      <div className="flex-1 flex min-h-0">
        {/* Toolbar */}
        <aside className="w-56 border-r bg-muted/30 flex flex-col gap-1 p-2 text-sm overflow-y-auto">
          <button
            type="button"
            onClick={() => setShowAddSection(true)}
            className="inline-flex items-center gap-2 rounded px-3 py-2 hover:bg-accent text-left"
          >
            <LayoutGrid className="h-4 w-4" /> Add section
          </button>
          <button
            type="button"
            onClick={() => addDecor("rect", "STAGE")}
            className="inline-flex items-center gap-2 rounded px-3 py-2 hover:bg-accent text-left"
          >
            <Square className="h-4 w-4" /> Add stage / decor rect
          </button>
          <button
            type="button"
            onClick={() => addDecor("text", "Label")}
            className="inline-flex items-center gap-2 rounded px-3 py-2 hover:bg-accent text-left"
          >
            <TypeIcon className="h-4 w-4" /> Add text label
          </button>

          <div className="mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Background
          </div>
          <div className="px-2 flex flex-col gap-1">
            <input
              ref={bgFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              aria-label="Background image"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) uploadBackground(f)
                if (e.target) e.target.value = ""
              }}
            />
            <button
              type="button"
              onClick={() => bgFileInputRef.current?.click()}
              disabled={bgUploading}
              className="inline-flex items-center gap-2 rounded px-3 py-2 hover:bg-accent text-left disabled:opacity-50"
            >
              <ImageIcon className="h-4 w-4" />
              {bgUploading ? "Uploading…" : backgroundUrl ? "Replace background" : "Upload background"}
            </button>
            {backgroundUrl && (
              <button
                type="button"
                onClick={clearBackground}
                className="inline-flex items-center gap-2 rounded px-3 py-2 hover:bg-accent text-left text-destructive"
              >
                <X className="h-4 w-4" /> Clear background
              </button>
            )}
          </div>

          {/* Canvas viewport size — match the white area to the actual
              venue shape. Larger canvas = more room to place sections;
              the SVG/Konva renderer scales to fit on screen regardless. */}
          <div className="mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Canvas size
          </div>
          <div className="px-2 grid grid-cols-2 gap-2">
            <Field label="Width">
              <input
                aria-label="Canvas width"
                type="number" min={200} max={10000} step={50}
                value={viewbox.width}
                onChange={e => setViewboxDim("width", Number(e.target.value))}
                className="w-full px-2 py-1 text-sm border rounded bg-background"
              />
            </Field>
            <Field label="Height">
              <input
                aria-label="Canvas height"
                type="number" min={200} max={10000} step={50}
                value={viewbox.height}
                onChange={e => setViewboxDim("height", Number(e.target.value))}
                className="w-full px-2 py-1 text-sm border rounded bg-background"
              />
            </Field>
          </div>

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
                <span
                  aria-hidden="true"
                  className="inline-block w-3 h-3 rounded-full shrink-0"
                  style={{ background: tierColor(i) }}
                />
                <span className="flex-1 truncate">{tt.name}</span>
                <span className="text-muted-foreground">{Number(tt.price).toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="mt-auto px-3 py-2 text-[11px] text-muted-foreground border-t border-border/50 space-y-0.5">
            <div>Scroll: zoom · Drag empty: pan</div>
            <div>Click section: select + drag · Click seat: select</div>
            <div>Double-click seat: skip / unskip</div>
            <div>Ctrl/Cmd+Z: undo</div>
          </div>
        </aside>

        {/* Canvas */}
        <div
          ref={containerRef}
          className="flex-1 relative bg-[radial-gradient(circle_at_1px_1px,_rgba(0,0,0,0.06)_1px,_transparent_0)] [background-size:20px_20px]"
        >
          <BuilderCanvas
            viewbox={viewbox}
            stageSize={stageSize}
            stagePos={stagePos}
            stageScale={stageScale}
            setStagePos={setStagePos}
            setStageScale={setStageScale}
            sections={sections}
            decor={decor}
            backgroundUrl={backgroundUrl}
            selection={selection}
            setSelection={setSelection}
            seatColor={(id) => tierColor(tierIndexById(id))}
            onSectionMove={moveSection}
            onSectionResize={resizeSection}
            onDecorMove={handleDecorMove}
            onToggleSkipSeat={toggleSkipSeat}
          />

          <button
            type="button"
            onClick={() => { setStagePos({ x: 0, y: 0 }); setStageScale(1) }}
            className="absolute bottom-3 left-3 rounded-md bg-background border px-2.5 py-1 text-xs shadow-sm hover:bg-accent"
          >
            Reset view
          </button>
        </div>

        {/* Inspector */}
        <aside className="w-72 border-l bg-muted/30 flex flex-col overflow-y-auto">
          {selection?.kind === "section" ? (
            <SectionInspector
              section={sections.find(s => s.id === selection.id)!}
              ticketTypes={ticketTypes}
              onPatch={(patch) => updateSection(selection.id, patch)}
              onRemove={() => removeSection(selection.id)}
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
          ) : selection?.kind === "seat" ? (
            <SeatCellInspector
              derivedId={selection.derivedId}
              sections={sections}
              ticketTypes={ticketTypes}
              onToggleSkip={(sid, r, c) => toggleSkipSeat(sid, r, c)}
              onSetTier={(sid, r, c, tier) => setCellTier(sid, r, c, tier)}
            />
          ) : (
            <div className="p-4 text-sm text-muted-foreground">
              Click a section, seat, or decor item to edit it.
            </div>
          )}

          <div className="mt-auto border-t p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Sections in this map
            </div>
            <SectionSummary
              sections={sections}
              ticketTypes={ticketTypes}
              onSelect={(id) => setSelection({ kind: "section", id })}
              onRemove={removeSection}
            />
          </div>
        </aside>
      </div>

      {showAddSection && (
        <AddSectionModal
          ticketTypes={ticketTypes}
          existingNames={sections.map(s => s.name)}
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

function SectionInspector({
  section, ticketTypes, onPatch, onRemove,
}: {
  section: SectionSpec
  ticketTypes: ReservedEventTicketType[]
  onPatch: (patch: Partial<SectionSpec>) => void
  onRemove: () => void
}) {
  // Draft is null while the user isn't actively editing — the displayed value
  // falls through to `section.name`, so selecting a different section
  // automatically refreshes the input without a useEffect sync.
  const [draft, setDraft] = useState<string | null>(null)
  const draftName = draft ?? section.name
  const seatCount = section.rows * section.cols - Object.keys(section.skipSeats).length

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
          aria-label="Section name"
          value={draftName}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => {
            const trimmed = draftName.trim()
            if (trimmed && trimmed !== section.name) onPatch({ name: trimmed })
            setDraft(null)
          }}
          onKeyDown={e => {
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur()
            if (e.key === "Escape") setDraft(null)
          }}
          className="w-full px-2 py-1 text-sm border rounded bg-background"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Rows">
          <input
            aria-label="Section rows"
            type="number" min={1} max={200}
            value={section.rows}
            onChange={e => onPatch({ rows: Math.max(1, Number(e.target.value) || 1) })}
            className="w-full px-2 py-1 text-sm border rounded bg-background"
          />
        </Field>
        <Field label="Cols">
          <input
            aria-label="Section cols"
            type="number" min={1} max={200}
            value={section.cols}
            onChange={e => onPatch({ cols: Math.max(1, Number(e.target.value) || 1) })}
            className="w-full px-2 py-1 text-sm border rounded bg-background"
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Row spacing">
          <input
            aria-label="Row spacing"
            type="number" min={6}
            value={section.rowSpacing}
            onChange={e => onPatch({ rowSpacing: Math.max(6, Number(e.target.value) || 6) })}
            className="w-full px-2 py-1 text-sm border rounded bg-background"
          />
        </Field>
        <Field label="Seat spacing">
          <input
            aria-label="Seat spacing"
            type="number" min={6}
            value={section.seatSpacing}
            onChange={e => onPatch({ seatSpacing: Math.max(6, Number(e.target.value) || 6) })}
            className="w-full px-2 py-1 text-sm border rounded bg-background"
          />
        </Field>
      </div>
      <Field label="Default ticket type">
        <select
          aria-label="Default ticket type"
          value={section.defaultTicketTypeId}
          onChange={e => onPatch({ defaultTicketTypeId: e.target.value })}
          className="w-full px-2 py-1 text-sm border rounded bg-background"
        >
          {ticketTypes.map(tt => (
            <option key={tt.id} value={tt.id}>{tt.name} — {Number(tt.price).toLocaleString()}</option>
          ))}
        </select>
      </Field>
      <div className="text-xs text-muted-foreground">
        {seatCount} seat{seatCount === 1 ? "" : "s"} · {Object.keys(section.skipSeats).length} skipped · {Object.keys(section.tierOverrides).length} tier override{Object.keys(section.tierOverrides).length === 1 ? "" : "s"}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Drag the section&rsquo;s outline to move it. Drag a corner handle to
        scale spacing. Double-click an individual seat on the canvas to skip
        / unskip it.
      </p>
    </div>
  )
}

function SeatCellInspector({
  derivedId, sections, ticketTypes, onToggleSkip, onSetTier,
}: {
  derivedId: string
  sections: SectionSpec[]
  ticketTypes: ReservedEventTicketType[]
  onToggleSkip: (sectionId: string, r: number, c: number) => void
  onSetTier:    (sectionId: string, r: number, c: number, tierId: string) => void
}) {
  const [sectionId, rStr, cStr] = derivedId.split("#")
  const r = Number(rStr); const c = Number(cStr)
  const section = sections.find(s => s.id === sectionId)
  if (!section) return <div className="p-4 text-sm text-muted-foreground">Seat no longer exists.</div>
  const key = `${r},${c}`
  const isSkipped = !!section.skipSeats[key]
  const currentTier = section.tierOverrides[key] ?? section.defaultTicketTypeId

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Seat</h3>
      </div>
      <div className="text-xs text-muted-foreground">
        {section.name} · row index {r}, col index {c}
      </div>
      <Field label="Ticket type">
        <select
          aria-label="Seat ticket type"
          value={currentTier}
          onChange={e => onSetTier(sectionId, r, c, e.target.value)}
          className="w-full px-2 py-1 text-sm border rounded bg-background"
        >
          {ticketTypes.map(tt => (
            <option key={tt.id} value={tt.id}>{tt.name} — {Number(tt.price).toLocaleString()}</option>
          ))}
        </select>
      </Field>
      <button
        type="button"
        onClick={() => onToggleSkip(sectionId, r, c)}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded border px-3 py-2 text-sm hover:bg-accent"
      >
        {isSkipped ? "Restore seat" : "Mark missing (skip)"}
      </button>
      <p className="text-[11px] text-muted-foreground">
        Row letters and seat numbers are computed automatically on save based
        on the seat&rsquo;s visual position — multiple sections at the same row
        share a letter and seat numbering continues across them.
      </p>
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
        <button
          type="button"
          onClick={onDelete}
          title="Remove"
          className="text-destructive hover:bg-destructive/10 rounded p-1.5"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <Field label="Label">
        <input
          aria-label="Decor label"
          value={decor.label ?? ""}
          onChange={e => onChange({ label: e.target.value })}
          className="w-full px-2 py-1 text-sm border rounded bg-background"
        />
      </Field>
      {decor.kind === "rect" && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Width">
            <input
              aria-label="Width"
              type="number" min={20}
              value={decor.width ?? 200}
              onChange={e => onChange({ width: Math.max(20, Number(e.target.value)) })}
              className="w-full px-2 py-1 text-sm border rounded bg-background"
            />
          </Field>
          <Field label="Height">
            <input
              aria-label="Height"
              type="number" min={20}
              value={decor.height ?? 60}
              onChange={e => onChange({ height: Math.max(20, Number(e.target.value)) })}
              className="w-full px-2 py-1 text-sm border rounded bg-background"
            />
          </Field>
        </div>
      )}
      <Field label="Fill">
        <input
          aria-label="Fill color"
          type="color"
          value={decor.fill ?? "#111827"}
          onChange={e => onChange({ fill: e.target.value })}
          className="w-full h-8 rounded border"
        />
      </Field>
      <Field label="Text color">
        <input
          aria-label="Text color"
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
  sections, ticketTypes, onSelect, onRemove,
}: {
  sections: SectionSpec[]
  ticketTypes: ReservedEventTicketType[]
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}) {
  const rows = useMemo(() => sections.map(s => {
    const tierIdx = ticketTypes.findIndex(t => t.id === s.defaultTicketTypeId)
    const count = s.rows * s.cols - Object.keys(s.skipSeats).length
    return { id: s.id, name: s.name, count, tierIdx }
  }), [sections, ticketTypes])
  if (rows.length === 0) {
    return <div className="text-xs text-muted-foreground">No sections yet.</div>
  }
  return (
    <ul className="space-y-1 text-xs">
      {rows.map(r => (
        <li key={r.id} className="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent">
          <span
            aria-hidden="true"
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: tierColor(r.tierIdx) }}
          />
          <button
            type="button"
            onClick={() => onSelect(r.id)}
            title="Select section"
            className="flex-1 min-w-0 text-left truncate"
          >
            {r.name}
          </button>
          <span className="text-muted-foreground tabular-nums">{r.count}</span>
          <button
            type="button"
            onClick={() => onRemove(r.id)}
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
  ticketTypes, existingNames, onCancel, onSubmit,
}: {
  ticketTypes: ReservedEventTicketType[]
  existingNames: string[]
  onCancel: () => void
  onSubmit: (opts: { name: string; rows: number; cols: number; spacing: number; ticket_type_id: string }) => void
}) {
  const [name, setName] = useState("")
  const [rows, setRows] = useState(8)
  const [cols, setCols] = useState(12)
  const [spacing, setSpacing] = useState(DEFAULT_SEAT_SPACING)
  const [ticketTypeId, setTicketTypeId] = useState(ticketTypes[0]?.id ?? "")

  const submit = () => {
    if (!name.trim()) { toast.error("Section name required"); return }
    if (!ticketTypeId) { toast.error("Pick a ticket type"); return }
    if (rows < 1 || cols < 1) { toast.error("Rows and cols must be positive"); return }
    onSubmit({
      name: name.trim(),
      rows, cols, spacing,
      ticket_type_id: ticketTypeId,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="font-semibold">Add section</h3>
          <button
            type="button"
            onClick={onCancel}
            title="Close"
            className="p-1 rounded hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Section name">
            <input
              aria-label="Section name"
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Orchestra Left"
              list="existing-sections"
              className="w-full px-3 py-2 text-sm border rounded bg-background"
            />
            <datalist id="existing-sections">
              {existingNames.map(s => <option key={s} value={s} />)}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rows">
              <input
                aria-label="Rows"
                type="number" min={1}
                value={rows}
                onChange={e => setRows(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm border rounded bg-background"
              />
            </Field>
            <Field label="Cols">
              <input
                aria-label="Cols"
                type="number" min={1}
                value={cols}
                onChange={e => setCols(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm border rounded bg-background"
              />
            </Field>
          </div>
          <Field label="Seat spacing (px)">
            <input
              aria-label="Seat spacing"
              type="number" min={10}
              value={spacing}
              onChange={e => setSpacing(Math.max(10, Number(e.target.value)))}
              className="w-full px-3 py-2 text-sm border rounded bg-background"
            />
          </Field>
          <Field label="Ticket type">
            <select
              aria-label="Ticket type"
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
            Generates {rows * cols} seats at the canvas center. Row letters
            and seat numbers are computed automatically based on visual
            position — drop sections side-by-side and they&rsquo;ll share row
            letters and continue seat numbering across them.
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-muted/30">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
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
