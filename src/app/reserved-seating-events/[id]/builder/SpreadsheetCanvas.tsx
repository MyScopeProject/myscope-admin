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
  type GridCell,
  type SeatGrid,
  type SectionMeta,
  type StageBlock,
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
  seatColor,
}: Props) {
  // Live drag state — null when no drag in progress.
  const [dragAnchor, setDragAnchor] = useState<{ r: number; c: number } | null>(null)
  const [dragCurrent, setDragCurrent] = useState<{ r: number; c: number } | null>(null)
  // Zoom level. Drives the cell pixel size — applied to width/height inline
  // styles rather than CSS scale() so the scroll container reports correct
  // dimensions and cells stay pixel-aligned (no fractional gaps).
  const [zoom, setZoom] = useState(1)
  const cellPx = Math.round(BASE_CELL_PX * zoom)
  const zoomIn  = useCallback(() => setZoom(z => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 100) / 100)), [])
  const zoomOut = useCallback(() => setZoom(z => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 100) / 100)), [])

  // Mouse-up anywhere (even outside the grid) ends the drag.
  useEffect(() => {
    if (!dragAnchor) return
    const onUp = () => {
      if (dragAnchor && dragCurrent) {
        onSelectionChange(normRange(dragAnchor, dragCurrent))
      }
      setDragAnchor(null)
      setDragCurrent(null)
    }
    window.addEventListener("mouseup", onUp)
    return () => window.removeEventListener("mouseup", onUp)
  }, [dragAnchor, dragCurrent, onSelectionChange])

  const currentRange: CellRange | null = (() => {
    if (dragAnchor && dragCurrent) return normRange(dragAnchor, dragCurrent)
    return selection
  })()

  const cellInRange = useCallback(
    (r: number, c: number) =>
      currentRange != null
        && r >= currentRange.r1 && r <= currentRange.r2
        && c >= currentRange.c1 && c <= currentRange.c2,
    [currentRange],
  )

  return (
    <div className="relative h-full">
      {/* Floating zoom toolbar — sticky to the canvas viewport so it stays
          reachable as the admin scrolls a wide grid. */}
      <div className="pointer-events-none absolute right-4 top-4 z-10 flex items-center gap-1">
        <div className="pointer-events-auto inline-flex items-center gap-1 rounded-md border bg-background px-1 py-1 shadow-sm">
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
        className="h-full select-none overflow-auto p-6"
        // Cancel selection on background click.
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            onSelectionChange(null)
            onStageSelect(null)
          }
        }}
      >
      <div className="relative inline-block">
      <table className="border-separate" style={{ borderSpacing: CELL_BORDER_SPACING }}>
        <thead>
          <tr>
            <th
              aria-label="Corner"
              style={{ width: ROW_LABEL_COL_PX, height: COL_HEADER_PX }}
            />
            {Array.from({ length: grid.cols }).map((_, c) => (
              <th
                key={`coltop-${c}`}
                className="px-1 text-center text-[10px] font-medium text-muted-foreground"
                style={{ width: cellPx, height: COL_HEADER_PX }}
              >
                {c + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.cells.map((row, r) => (
            <tr key={`row-${r}`}>
              <th
                className="pr-2 text-right text-[11px] font-semibold text-muted-foreground"
                style={{ width: ROW_LABEL_COL_PX, height: cellPx }}
              >
                {grid.rowLabels?.[r]?.trim() || defaultRowLabel(r)}
              </th>
              {row.map((cell, c) => (
                <td
                  key={`cell-${r}-${c}`}
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
                      setDragAnchor({ r, c })
                      setDragCurrent({ r, c })
                    }}
                    onMouseEnter={() => {
                      if (dragAnchor) setDragCurrent({ r, c })
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
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
          originX={ROW_LABEL_COL_PX + CELL_BORDER_SPACING}
          originY={COL_HEADER_PX + CELL_BORDER_SPACING}
          selected={selectedStageId === s.id}
          onSelect={() => {
            onStageSelect(s.id)
            onSelectionChange(null)
          }}
          onCommitMove={(dx, dy) => onStageMove(s.id, dx, dy)}
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
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    startRef.current = { x: e.clientX, y: e.clientY }
    setDragOffset({ dx: 0, dy: 0 })
  }

  useEffect(() => {
    if (!dragOffset || !startRef.current) return
    const onMove = (e: MouseEvent) => {
      if (!startRef.current) return
      setDragOffset({
        dx: e.clientX - startRef.current.x,
        dy: e.clientY - startRef.current.y,
      })
    }
    const onUp = () => {
      if (dragOffset && (Math.abs(dragOffset.dx) > 2 || Math.abs(dragOffset.dy) > 2)) {
        // Convert pixel deltas back into cell-units. The parent rounds /
        // snaps; we just emit the raw cell delta.
        onCommitMove(dragOffset.dx / stride, dragOffset.dy / stride)
      }
      setDragOffset(null)
      startRef.current = null
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
