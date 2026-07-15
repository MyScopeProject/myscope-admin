"use client"

// ---------------------------------------------------------------------------
// SeatGridCanvas — Excel-style cell grid where every cell is one seat (or
// aisle / stage / label). Click + drag selects a rectangular range; the
// parent page reads `selection` and decides what to do with it (assign to a
// section, mark as stage, …).
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react"
import { ZoomIn, ZoomOut } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  type CellRange,
  type CircleBlock,
  type GeneralSectionBlock,
  type GridCell,
  type LineBlock,
  type SeatGrid,
  type SectionMeta,
  type StageBlock,
  type TextBlock,
  normRange,
} from "./macroLayoutModel"

// Cell sizing — the base is 28px at 100% zoom; multiplied by `zoom` each render.
const BASE_CELL_PX = 28
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.25

// Layout constants for stage overlay positioning. The cell-area origin is
// to the right of the row-label column and below the column-header row.
// Cells use border-spacing: 2, so each grid step is cellPx + 2.
const ROW_LABEL_COL_PX = 36
const COL_HEADER_PX = 24
const CELL_BORDER_SPACING = 2

interface Props {
  grid: SeatGrid
  selection: CellRange | null
  onSelectionChange: (range: CellRange | null) => void
  // Stage selection (mutually exclusive with cell-range selection).
  selectedStageId: string | null
  onStageSelect: (id: string | null) => void
  // Move a stage (cell-unit deltas) — fires on drag end.
  onStageMove: (id: string, dx: number, dy: number) => void
  // Decorative line/circle selection — same mutual-exclusivity as stages.
  selectedLineId: string | null
  onLineSelect: (id: string | null) => void
  onLineMove: (id: string, dx: number, dy: number) => void
  selectedCircleId: string | null
  onCircleSelect: (id: string | null) => void
  onCircleMove: (id: string, dx: number, dy: number) => void
  // Free-standing text caption selection — same mutual-exclusivity pattern.
  selectedTextId: string | null
  onTextSelect: (id: string | null) => void
  onTextMove: (id: string, dx: number, dy: number) => void
  // General-section box selection — same mutual-exclusivity pattern.
  selectedGeneralSectionId: string | null
  onGeneralSectionSelect: (id: string | null) => void
  onGeneralSectionMove: (id: string, dx: number, dy: number) => void
  // Move the currently-selected range by (dr, dc) cells — clamped, copied
  // into the destination, source cleared. Fires once at drag end.
  onMoveSelection: (dr: number, dc: number) => void
  // Inline edits to the spreadsheet headers. `undefined` clears back to
  // the auto-derived default (A/B/C... for rows, 1/2/3... for cols).
  onRowLabelChange: (rowIdx: number, label: string | undefined) => void
  onColLabelChange: (colIdx: number, label: string | undefined) => void
  // Color for a section's default tier — used to color seat cells. If the
  // grid has a tier override on the seat, the parent should resolve that
  // override before calling seatColor.
  seatColor: (ticketTypeId: string) => string
}

// Default row label: A, B, ..., Z, AA, AB, ...
function defaultRowLabel(i: number): string {
  let s = ""
  let n = i + 1
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function SeatGridCanvas({
  grid, selection, onSelectionChange,
  selectedStageId, onStageSelect, onStageMove,
  selectedLineId, onLineSelect, onLineMove,
  selectedCircleId, onCircleSelect, onCircleMove,
  selectedTextId, onTextSelect, onTextMove,
  selectedGeneralSectionId, onGeneralSectionSelect, onGeneralSectionMove,
  onMoveSelection,
  onRowLabelChange, onColLabelChange,
  seatColor,
}: Props) {
  // Live drag state — null when no drag in progress.
  const [dragAnchor, setDragAnchor] = useState<{ r: number; c: number } | null>(null)
  const [dragCurrent, setDragCurrent] = useState<{ r: number; c: number } | null>(null)
  // Move-mode drag — active when the user mousedowns INSIDE the current
  // selection rather than on an unselected cell. Tracks the origin cell and
  // the current pointer cell; the delta is committed on mouseup.
  const [moveStart, setMoveStart] = useState<{ r: number; c: number } | null>(null)
  const [moveCurrent, setMoveCurrent] = useState<{ r: number; c: number } | null>(null)
  // Zoom level. Drives the cell pixel size — applied to width/height inline
  // styles rather than CSS scale() so the scroll container reports correct
  // dimensions and cells stay pixel-aligned (no fractional gaps).
  const [zoom, setZoom] = useState(1)
  const cellPx = Math.round(BASE_CELL_PX * zoom)
  const zoomIn  = useCallback(() => setZoom(z => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 100) / 100)), [])
  const zoomOut = useCallback(() => setZoom(z => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 100) / 100)), [])

  // Stage overlays are absolute-positioned. To keep them locked to cells at
  // every zoom level we measure where cell (0,0) actually renders inside
  // the wrapper, instead of computing it from constants (which drift when
  // the row-label column auto-sizes to wider labels like "HH" / "AAA").
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const firstCellRef = useRef<HTMLTableCellElement | null>(null)
  const [cellOrigin, setCellOrigin] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const measure = () => {
      const cell = firstCellRef.current
      const wrap = wrapperRef.current
      if (!cell || !wrap) return
      const cellRect = cell.getBoundingClientRect()
      const wrapRect = wrap.getBoundingClientRect()
      setCellOrigin({
        x: cellRect.left - wrapRect.left,
        y: cellRect.top  - wrapRect.top,
      })
    }
    measure()
    // Re-measure whenever the canvas redraws (zoom, grid resize). RAF
    // ensures the DOM is already laid out with the new sizes.
    const id = requestAnimationFrame(measure)
    window.addEventListener("resize", measure)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener("resize", measure)
    }
  }, [cellPx, grid.rows, grid.cols])

  // Non-empty rank maps: grid row/col index → "rank among rows/cols that
  // contain at least one seat" (or -1 for rows/cols with zero seats). The
  // header default labels skip blank gap rows/cols, matching deriveLayout()
  // exactly so what's shown in the sheet == what gets saved on the seats.
  const { rowNonEmptyRank, colNonEmptyRank } = (() => {
    const rRank = Array(grid.rows).fill(-1) as number[]
    const cRank = Array(grid.cols).fill(-1) as number[]
    const rowHas = Array(grid.rows).fill(false) as boolean[]
    const colHas = Array(grid.cols).fill(false) as boolean[]
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (grid.cells[r]?.[c]?.kind === "seat") {
          rowHas[r] = true
          colHas[c] = true
        }
      }
    }
    let n = 0
    for (let r = 0; r < grid.rows; r++) if (rowHas[r]) { rRank[r] = n++ }
    let m = 0
    for (let c = 0; c < grid.cols; c++) if (colHas[c]) { cRank[c] = m++ }
    return { rowNonEmptyRank: rRank, colNonEmptyRank: cRank }
  })()

  // Mouse-up anywhere (even outside the grid) ends a drag — either commits
  // a new range selection or a move of the existing selection.
  useEffect(() => {
    if (!dragAnchor && !moveStart) return
    const onUp = () => {
      if (moveStart && moveCurrent) {
        const dr = moveCurrent.r - moveStart.r
        const dc = moveCurrent.c - moveStart.c
        if (dr !== 0 || dc !== 0) onMoveSelection(dr, dc)
      } else if (dragAnchor && dragCurrent) {
        onSelectionChange(normRange(dragAnchor, dragCurrent))
      }
      setDragAnchor(null)
      setDragCurrent(null)
      setMoveStart(null)
      setMoveCurrent(null)
    }
    window.addEventListener("mouseup", onUp)
    return () => window.removeEventListener("mouseup", onUp)
  }, [dragAnchor, dragCurrent, moveStart, moveCurrent, onSelectionChange, onMoveSelection])

  const currentRange: CellRange | null = (() => {
    if (dragAnchor && dragCurrent) return normRange(dragAnchor, dragCurrent)
    return selection
  })()

  // While the user is dragging an existing selection to a new spot, the
  // selection ring renders at the *destination* (current + delta), so they
  // see where it's about to land.
  const previewRange: CellRange | null = (() => {
    if (!moveStart || !moveCurrent || !selection) return currentRange
    const dr = moveCurrent.r - moveStart.r
    const dc = moveCurrent.c - moveStart.c
    return {
      r1: selection.r1 + dr, c1: selection.c1 + dc,
      r2: selection.r2 + dr, c2: selection.c2 + dc,
    }
  })()

  const cellInRange = useCallback(
    (r: number, c: number) =>
      previewRange != null
        && r >= previewRange.r1 && r <= previewRange.r2
        && c >= previewRange.c1 && c <= previewRange.c2,
    [previewRange],
  )

  // Quick predicate: is (r, c) inside the *current* (pre-drag) selection?
  // Used to decide whether a mousedown starts a move vs. a new selection.
  const cellInActiveSelection = useCallback(
    (r: number, c: number) =>
      selection != null
        && r >= selection.r1 && r <= selection.r2
        && c >= selection.c1 && c <= selection.c2,
    [selection],
  )

  return (
    <div className="flex h-full flex-col">
      {/* Top toolbar — zoom control sits OUTSIDE the grid so it doesn't
          overlap rows / get covered by stages. Stays put while the grid
          itself scrolls. */}
      <div className="flex shrink-0 items-center justify-end gap-2 border-b bg-background/80 px-4 py-2 backdrop-blur">
        <div className="inline-flex items-center gap-1 rounded-md border bg-background px-1 py-1 shadow-xs">
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-muted disabled:opacity-40"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-12 text-center font-mono text-xs tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-muted disabled:opacity-40"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            disabled={zoom === 1}
            className="ml-1 rounded px-1.5 text-[10px] text-muted-foreground hover:bg-muted disabled:opacity-40"
            title="Reset to 100%"
          >
            Reset
          </button>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 select-none overflow-auto p-6"
        // Cancel selection on background click.
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            onSelectionChange(null)
            onStageSelect(null)
            onLineSelect(null)
            onCircleSelect(null)
            onTextSelect(null)
            onGeneralSectionSelect(null)
          }
        }}
      >
      <div ref={wrapperRef} className="relative inline-block">
      {/* Header labels: empty rows / cols are SKIPPED in the auto-derived
          numbering — admin's gap rows don't waste letters. Stays in sync
          with deriveLayout() so what's shown == what gets saved. */}
      {(() => null)()}
      <table className="border-separate" style={{ borderSpacing: CELL_BORDER_SPACING }}>
        <thead>
          <tr>
            <th
              aria-label="Corner"
              style={{ width: ROW_LABEL_COL_PX, height: COL_HEADER_PX }}
            />
            {Array.from({ length: grid.cols }).map((_, c) => {
              const seatStart = grid.seatNumberStart ?? 1
              const colRank = colNonEmptyRank[c]
              const autoCol = colRank >= 0 ? String(seatStart + colRank) : ""
              return (
                <th
                  key={`coltop-${c}`}
                  className="text-center"
                  style={{ width: cellPx, height: COL_HEADER_PX }}
                >
                  <EditableHeader
                    value={grid.colLabels?.[c]}
                    defaultValue={autoCol}
                    onCommit={(v) => onColLabelChange(c, v)}
                    align="center"
                  />
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {grid.cells.map((row, r) => {
            const rowRank = rowNonEmptyRank[r]
            const autoRow = rowRank >= 0 ? defaultRowLabel(rowRank) : ""
            return (
            <tr key={`row-${r}`}>
              <th
                className="pr-1 text-right"
                style={{ width: ROW_LABEL_COL_PX, height: cellPx }}
              >
                <EditableHeader
                  value={grid.rowLabels?.[r]}
                  defaultValue={autoRow}
                  onCommit={(v) => onRowLabelChange(r, v)}
                  align="right"
                />
              </th>
              {row.map((cell, c) => (
                <td
                  key={`cell-${r}-${c}`}
                  // Capture the (0,0) cell so we can read its actual screen
                  // position and lock stage overlays to it across zoom levels.
                  ref={r === 0 && c === 0 ? firstCellRef : undefined}
                  style={{ width: cellPx, height: cellPx }}
                  className="p-0"
                >
                  <Cell
                    cell={cell}
                    section={cell.kind === "seat" ? grid.sections[cell.sectionId] : null}
                    selected={cellInRange(r, c)}
                    seatColor={seatColor}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      // Click+hold inside an existing selection → move mode.
                      // Click on any other cell → start a fresh range drag.
                      if (cellInActiveSelection(r, c)) {
                        setMoveStart({ r, c })
                        setMoveCurrent({ r, c })
                      } else {
                        setDragAnchor({ r, c })
                        setDragCurrent({ r, c })
                      }
                    }}
                    onMouseEnter={() => {
                      if (moveStart) setMoveCurrent({ r, c })
                      else if (dragAnchor) setDragCurrent({ r, c })
                    }}
                  />
                </td>
              ))}
            </tr>
            )
          })}
        </tbody>
      </table>

      {/* Free-form stage overlays — positioned in cell-units, painted as
          absolute divs above the table. Draggable; the parent applies the
          (dx, dy) on drop. */}
      {grid.stages.map(s => (
        <StageOverlay
          key={s.id}
          stage={s}
          cellPx={cellPx}
          stride={cellPx + CELL_BORDER_SPACING}
          originX={cellOrigin.x}
          originY={cellOrigin.y}
          selected={selectedStageId === s.id}
          onSelect={() => {
            onStageSelect(s.id)
            onSelectionChange(null)
          }}
          onCommitMove={(dx, dy) => onStageMove(s.id, dx, dy)}
        />
      ))}

      {/* Free-form decorative lines/circles — design only, same overlay
          mechanics as stages above but never produce seats. */}
      {grid.lines.map(l => (
        <LineOverlay
          key={l.id}
          line={l}
          stride={cellPx + CELL_BORDER_SPACING}
          originX={cellOrigin.x}
          originY={cellOrigin.y}
          selected={selectedLineId === l.id}
          onSelect={() => {
            onLineSelect(l.id)
            onSelectionChange(null)
          }}
          onCommitMove={(dx, dy) => onLineMove(l.id, dx, dy)}
        />
      ))}
      {grid.circles.map(c => (
        <CircleOverlay
          key={c.id}
          circle={c}
          stride={cellPx + CELL_BORDER_SPACING}
          originX={cellOrigin.x}
          originY={cellOrigin.y}
          selected={selectedCircleId === c.id}
          onSelect={() => {
            onCircleSelect(c.id)
            onSelectionChange(null)
          }}
          onCommitMove={(dx, dy) => onCircleMove(c.id, dx, dy)}
        />
      ))}
      {grid.texts.map(t => (
        <TextOverlay
          key={t.id}
          text={t}
          stride={cellPx + CELL_BORDER_SPACING}
          originX={cellOrigin.x}
          originY={cellOrigin.y}
          selected={selectedTextId === t.id}
          onSelect={() => {
            onTextSelect(t.id)
            onSelectionChange(null)
          }}
          onCommitMove={(dx, dy) => onTextMove(t.id, dx, dy)}
        />
      ))}
      {grid.generalSections.map(g => (
        <GeneralSectionOverlay
          key={g.id}
          box={g}
          cellPx={cellPx}
          stride={cellPx + CELL_BORDER_SPACING}
          originX={cellOrigin.x}
          originY={cellOrigin.y}
          selected={selectedGeneralSectionId === g.id}
          onSelect={() => {
            onGeneralSectionSelect(g.id)
            onSelectionChange(null)
          }}
          onCommitMove={(dx, dy) => onGeneralSectionMove(g.id, dx, dy)}
        />
      ))}
      </div>
      </div>
    </div>
  )
}

// One free-form stage overlay — draggable via mouse, click-to-select.
function StageOverlay({
  stage, cellPx, stride, originX, originY,
  selected, onSelect, onCommitMove,
}: {
  stage: StageBlock
  cellPx: number
  stride: number
  originX: number
  originY: number
  selected: boolean
  onSelect: () => void
  onCommitMove: (dx: number, dy: number) => void
}) {
  // Pixel offset accumulated during drag — applied via inline transform so
  // the actual stage.x/y stays unchanged until drop (cheaper renders).
  // The ref mirrors the state so onUp can read the LATEST offset (state-
  // capture inside the effect's closure is stale otherwise — old bug that
  // made every drag commit (0, 0)).
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null)
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  // Latest stride / commit callback for the global listeners. Avoids needing
  // them as effect deps (and avoids re-binding listeners mid-drag).
  const strideRef = useRef(stride)
  const commitRef = useRef(onCommitMove)
  useEffect(() => { strideRef.current = stride }, [stride])
  useEffect(() => { commitRef.current = onCommitMove }, [onCommitMove])

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    startRef.current = { x: e.clientX, y: e.clientY }
    dragOffsetRef.current = { dx: 0, dy: 0 }
    setDragOffset({ dx: 0, dy: 0 })
  }

  useEffect(() => {
    if (!dragOffset || !startRef.current) return
    const onMove = (e: MouseEvent) => {
      if (!startRef.current) return
      const next = {
        dx: e.clientX - startRef.current.x,
        dy: e.clientY - startRef.current.y,
      }
      dragOffsetRef.current = next
      setDragOffset(next)
    }
    const onUp = () => {
      const final = dragOffsetRef.current
      if (final && (Math.abs(final.dx) > 2 || Math.abs(final.dy) > 2)) {
        // Convert pixel deltas back into cell-units via the latest stride.
        commitRef.current(final.dx / strideRef.current, final.dy / strideRef.current)
      }
      dragOffsetRef.current = null
      setDragOffset(null)
      startRef.current = null
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [!!dragOffset])

  const left   = originX + stage.x * stride
  const top    = originY + stage.y * stride
  const width  = Math.max(stride, stage.width  * stride - CELL_BORDER_SPACING)
  const height = Math.max(stride, stage.height * stride - CELL_BORDER_SPACING)

  return (
    <div
      onMouseDown={onMouseDown}
      className={cn(
        "absolute cursor-move select-none rounded-md bg-foreground text-background shadow-md",
        "flex items-center justify-center text-[11px] font-semibold uppercase tracking-[0.2em]",
        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
      )}
      style={{
        left, top, width, height,
        transform: dragOffset ? `translate(${dragOffset.dx}px, ${dragOffset.dy}px)` : undefined,
      }}
      title={stage.label}
    >
      {stage.label || "STAGE"}
    </div>
  )
}

// Shared drag mechanics for the line/circle overlays below — same behavior
// as StageOverlay's inline drag handling, factored out since it's now used
// twice more. StageOverlay itself is left untouched to avoid touching
// working code for an unrelated change.
function useOverlayDrag(stride: number, onSelect: () => void, onCommitMove: (dx: number, dy: number) => void) {
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null)
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const strideRef = useRef(stride)
  const commitRef = useRef(onCommitMove)
  useEffect(() => { strideRef.current = stride }, [stride])
  useEffect(() => { commitRef.current = onCommitMove }, [onCommitMove])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    startRef.current = { x: e.clientX, y: e.clientY }
    dragOffsetRef.current = { dx: 0, dy: 0 }
    setDragOffset({ dx: 0, dy: 0 })
  }, [onSelect])

  useEffect(() => {
    if (!dragOffset || !startRef.current) return
    const onMove = (e: MouseEvent) => {
      if (!startRef.current) return
      const next = { dx: e.clientX - startRef.current.x, dy: e.clientY - startRef.current.y }
      dragOffsetRef.current = next
      setDragOffset(next)
    }
    const onUp = () => {
      const final = dragOffsetRef.current
      if (final && (Math.abs(final.dx) > 2 || Math.abs(final.dy) > 2)) {
        commitRef.current(final.dx / strideRef.current, final.dy / strideRef.current)
      }
      dragOffsetRef.current = null
      setDragOffset(null)
      startRef.current = null
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [!!dragOffset])

  return { dragOffset, onMouseDown }
}

// Decorative line overlay — anchored at (x, y), extends `length` cells to
// the right, then rotated around its own midpoint. Rotation is set via the
// inspector panel's number field (no drag-rotate handle in this HTML/table
// canvas — see LineInspector in page.tsx).
function LineOverlay({
  line, stride, originX, originY, selected, onSelect, onCommitMove,
}: {
  line: LineBlock
  stride: number
  originX: number
  originY: number
  selected: boolean
  onSelect: () => void
  onCommitMove: (dx: number, dy: number) => void
}) {
  const { dragOffset, onMouseDown } = useOverlayDrag(stride, onSelect, onCommitMove)
  const left = originX + line.x * stride
  const top = originY + line.y * stride
  const lengthPx = Math.max(stride * 0.25, line.length * stride)
  const dx = dragOffset ? dragOffset.dx : 0
  const dy = dragOffset ? dragOffset.dy : 0

  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute cursor-move select-none"
      style={{
        left, top, width: lengthPx, height: 12,
        transform: `translate(${dx}px, ${dy}px) rotate(${line.rotation}deg)`,
        transformOrigin: "0 50%",
      }}
      title="Decorative line — drag to move, use the panel to rotate"
    >
      <div
        className={cn("absolute left-0 top-1/2 -translate-y-1/2", selected ? "bg-primary" : "")}
        style={{ width: lengthPx, height: 2, backgroundColor: selected ? undefined : (line.color || "#374151") }}
      />
    </div>
  )
}

// Decorative circle overlay — centered at (x, y), diameter = radius * 2.
function CircleOverlay({
  circle, stride, originX, originY, selected, onSelect, onCommitMove,
}: {
  circle: CircleBlock
  stride: number
  originX: number
  originY: number
  selected: boolean
  onSelect: () => void
  onCommitMove: (dx: number, dy: number) => void
}) {
  const { dragOffset, onMouseDown } = useOverlayDrag(stride, onSelect, onCommitMove)
  const diameterPx = Math.max(stride * 0.5, circle.radius * 2 * stride)
  const cx = originX + circle.x * stride
  const cy = originY + circle.y * stride
  const dx = dragOffset ? dragOffset.dx : 0
  const dy = dragOffset ? dragOffset.dy : 0

  return (
    <div
      onMouseDown={onMouseDown}
      className={cn(
        "absolute flex cursor-move select-none items-center justify-center rounded-full text-[10px] font-semibold",
        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
      )}
      style={{
        left: cx - diameterPx / 2,
        top: cy - diameterPx / 2,
        width: diameterPx,
        height: diameterPx,
        backgroundColor: circle.fill || "#111827",
        color: circle.color || "#FFFFFF",
        transform: `translate(${dx}px, ${dy}px)`,
      }}
      title={circle.label || "Decorative circle"}
    >
      {circle.label}
    </div>
  )
}

// Free-standing text caption overlay — anchored at (x, y), draggable.
function TextOverlay({
  text, stride, originX, originY, selected, onSelect, onCommitMove,
}: {
  text: TextBlock
  stride: number
  originX: number
  originY: number
  selected: boolean
  onSelect: () => void
  onCommitMove: (dx: number, dy: number) => void
}) {
  const { dragOffset, onMouseDown } = useOverlayDrag(stride, onSelect, onCommitMove)
  const left = originX + text.x * stride
  const top = originY + text.y * stride
  const dx = dragOffset ? dragOffset.dx : 0
  const dy = dragOffset ? dragOffset.dy : 0

  return (
    <div
      onMouseDown={onMouseDown}
      className={cn(
        "absolute cursor-move select-none whitespace-nowrap rounded px-1 text-sm font-semibold",
        selected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "",
      )}
      style={{
        left, top,
        color: text.color || "#374151",
        transform: `translate(${dx}px, ${dy}px)`,
      }}
      title="Text caption — drag to move"
    >
      {text.text || "Text"}
    </div>
  )
}

// General-section box overlay — same mechanics as StageOverlay, distinct
// styling so it doesn't get confused for the real stage. Purely a labeled
// area; never marks cells as seats.
function GeneralSectionOverlay({
  box, cellPx, stride, originX, originY, selected, onSelect, onCommitMove,
}: {
  box: GeneralSectionBlock
  cellPx: number
  stride: number
  originX: number
  originY: number
  selected: boolean
  onSelect: () => void
  onCommitMove: (dx: number, dy: number) => void
}) {
  const { dragOffset, onMouseDown } = useOverlayDrag(stride, onSelect, onCommitMove)
  const left   = originX + box.x * stride
  const top    = originY + box.y * stride
  const width  = Math.max(stride, box.width  * stride - CELL_BORDER_SPACING)
  const height = Math.max(stride, box.height * stride - CELL_BORDER_SPACING)
  const dx = dragOffset ? dragOffset.dx : 0
  const dy = dragOffset ? dragOffset.dy : 0

  return (
    <div
      onMouseDown={onMouseDown}
      className={cn(
        "absolute cursor-move select-none rounded-md border-2 border-dashed border-blue-400 bg-blue-600/90 text-white shadow-md",
        "flex items-center justify-center text-[11px] font-semibold uppercase tracking-[0.15em]",
        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
      )}
      style={{
        left, top, width, height,
        transform: dragOffset ? `translate(${dx}px, ${dy}px)` : undefined,
      }}
      title={box.label}
    >
      {box.label || "GENERAL SECTION"}
    </div>
  )
}

// Inline-editable spreadsheet header cell. Click to edit, blur or Enter to
// commit, Escape to cancel. An empty value clears back to the auto-derived
// default (passed via `defaultValue`).
function EditableHeader({
  value, defaultValue, onCommit, align,
}: {
  value: string | undefined
  defaultValue: string
  onCommit: (next: string | undefined) => void
  align: "right" | "center"
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string>(value ?? "")
  useEffect(() => { if (!editing) setDraft(value ?? "") }, [value, editing])

  if (editing) {
    return (
      <input
        autoFocus
        aria-label={`Edit label (default ${defaultValue})`}
        placeholder={defaultValue}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          // Preserve blank strings (the user might want a blank header for
          // an aisle row / gap column). Untouched cells stay `undefined` and
          // fall back to the auto-derived default.
          onCommit(draft)
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur()
          if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false) }
        }}
        className={cn(
          "w-full rounded border bg-background px-0.5 py-0 font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-primary",
          align === "right" ? "text-right" : "text-center",
        )}
        // Don't let the click bubble to start a cell-range drag selection.
        onMouseDown={(e) => e.stopPropagation()}
      />
    )
  }

  // Three states:
  //   value === undefined  → auto-derive (show default, muted)
  //   value === ""         → explicitly blank (no glyph, still clickable)
  //   value === "X"        → custom override (show value, foreground)
  const hasOverride = value !== undefined
  const display = hasOverride ? value : defaultValue
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setEditing(true) }}
      onMouseDown={(e) => e.stopPropagation()}
      title={
        value === undefined
          ? "Click to set a custom label (leave empty for blank)"
          : value === ""
            ? "Blank label (click to edit)"
            : `Custom label: ${value} (click to edit)`
      }
      className={cn(
        "block w-full min-h-[14px] rounded px-0.5 font-mono text-[10px] transition-colors",
        hasOverride ? "text-foreground" : "text-muted-foreground",
        "hover:bg-muted hover:text-foreground",
        align === "right" ? "text-right" : "text-center",
      )}
    >
      {display === "" ? " " : display}
    </button>
  )
}

function Cell({
  cell, section, selected, seatColor, onMouseDown, onMouseEnter,
}: {
  cell: GridCell
  section: SectionMeta | null
  selected: boolean
  seatColor: (ticketTypeId: string) => string
  onMouseDown: (e: React.MouseEvent) => void
  onMouseEnter: () => void
}) {
  const base = "flex h-full w-full items-center justify-center rounded-[3px] text-[9px] font-mono transition-shadow"
  const sel = selected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""

  if (cell.kind === "empty") {
    return (
      <div
        onMouseDown={onMouseDown}
        onMouseEnter={onMouseEnter}
        className={cn(base, sel, "border border-dashed border-border bg-background hover:border-primary/40")}
        title="Empty (aisle / gap)"
      />
    )
  }
  if (cell.kind === "label") {
    return (
      <div
        onMouseDown={onMouseDown}
        onMouseEnter={onMouseEnter}
        className={cn(base, sel, "border border-border bg-background text-foreground")}
        title={`Label: ${cell.text}`}
      >
        T
      </div>
    )
  }
  // Seat
  const tierId = cell.tierOverride ?? section?.defaultTicketTypeId ?? ""
  const fill = tierId ? seatColor(tierId) : "#9CA3AF"
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      className={cn(base, sel, "text-white")}
      title={section ? `${section.name} seat` : "Seat"}
      style={{ backgroundColor: fill }}
    />
  )
}
