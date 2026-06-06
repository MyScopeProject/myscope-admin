// ---------------------------------------------------------------------------
// Seat-grid data model — Excel-style: every cell is one seat (or aisle, or
// stage, or label). Admins paint sections by selecting a rectangular range
// of cells and assigning them to a section.
//
// Save format: derives the SAME flat event_seats payload the API already
// accepts. No DB or API changes.
// ---------------------------------------------------------------------------

export interface SectionMeta {
  id: string                       // local UUID
  name: string                     // e.g. "Gold"
  defaultTicketTypeId: string      // tier applied to all seats in this section
}

// Cell kinds. Stages are NOT cell kinds — they're free-form overlays
// (StageBlock) sized in cell units. Labels are inline and live in cells.
export type GridCell =
  | { kind: "empty" }                                            // aisle / gap
  | { kind: "seat"; sectionId: string; tierOverride?: string }    // a sellable seat
  | { kind: "label"; text: string }                              // free-text label

// Free-form stage block — sized in CELL UNITS (not pixels) so the stage
// scales naturally with the zoom level. Lives ABOVE the cell grid as an
// overlay; it doesn't consume cells and doesn't have to align to them.
export interface StageBlock {
  id: string
  x: number                        // in cell units (top-left)
  y: number                        // in cell units (top-left)
  width: number                    // in cell units
  height: number                   // in cell units
  label: string
}

export interface SeatGrid {
  rows: number
  cols: number
  cells: GridCell[][]              // cells[row][col]
  sections: Record<string, SectionMeta>
  // Free-form stage overlays (custom width × height, not tied to cells).
  stages: StageBlock[]
  // Optional per-row label overrides. Index 0 = top row. Blank/undefined =
  // auto (A, B, C, ...).
  rowLabels?: (string | undefined)[]
  // Optional per-column seat-number overrides. Index 0 = leftmost col.
  // When set, replaces the default position-based seat number (1, 2, 3, …)
  // for any seat in that column. Blank/undefined = auto.
  colLabels?: (string | undefined)[]
  // Optional seat-number start for the whole grid. Default 1. Ignored on
  // columns that have an explicit colLabels override.
  seatNumberStart?: number
}

// Default empty grid — 10 rows × 14 cols of empty cells, plenty to start.
export function emptyGrid(): SeatGrid {
  const rows = 10
  const cols = 14
  const cells: GridCell[][] = []
  for (let r = 0; r < rows; r++) {
    cells.push(Array.from({ length: cols }, () => ({ kind: "empty" }) as GridCell))
  }
  return { rows, cols, cells, sections: {}, stages: [] }
}

// Add a stage at a default position (centered horizontally, near the top).
export function addStage(grid: SeatGrid, stage: StageBlock): SeatGrid {
  return { ...grid, stages: [...grid.stages, stage] }
}

// Patch one stage's fields.
export function updateStage(grid: SeatGrid, stageId: string, patch: Partial<StageBlock>): SeatGrid {
  return {
    ...grid,
    stages: grid.stages.map(s => (s.id === stageId ? { ...s, ...patch } : s)),
  }
}

// Remove a stage by id.
export function removeStage(grid: SeatGrid, stageId: string): SeatGrid {
  return { ...grid, stages: grid.stages.filter(s => s.id !== stageId) }
}

// Add a row at index. Side picks above/below the index.
export function addRow(grid: SeatGrid, atIndex: number, side: "above" | "below"): SeatGrid {
  const insertAt = side === "above" ? atIndex : atIndex + 1
  const newRow: GridCell[] = Array.from({ length: grid.cols }, () => ({ kind: "empty" }))
  const cells = grid.cells.slice()
  cells.splice(insertAt, 0, newRow)
  const rowLabels = grid.rowLabels?.slice()
  if (rowLabels) rowLabels.splice(insertAt, 0, undefined)
  return { ...grid, rows: grid.rows + 1, cells, rowLabels }
}

// Remove a row. Returns grid unchanged if it would leave 0 rows.
export function removeRow(grid: SeatGrid, rowIdx: number): SeatGrid {
  if (grid.rows <= 1) return grid
  const cells = grid.cells.slice()
  cells.splice(rowIdx, 1)
  const rowLabels = grid.rowLabels?.slice()
  if (rowLabels) rowLabels.splice(rowIdx, 1)
  return { ...grid, rows: grid.rows - 1, cells, rowLabels }
}

// Add a column at index. Side picks left/right of the index.
export function addCol(grid: SeatGrid, atIndex: number, side: "left" | "right"): SeatGrid {
  const insertAt = side === "left" ? atIndex : atIndex + 1
  const cells = grid.cells.map(row => {
    const next = row.slice()
    next.splice(insertAt, 0, { kind: "empty" })
    return next
  })
  const colLabels = grid.colLabels?.slice()
  if (colLabels) colLabels.splice(insertAt, 0, undefined)
  return { ...grid, cols: grid.cols + 1, cells, colLabels }
}

// Remove a column. Returns grid unchanged if it would leave 0 cols.
export function removeCol(grid: SeatGrid, colIdx: number): SeatGrid {
  if (grid.cols <= 1) return grid
  const cells = grid.cells.map(row => {
    const next = row.slice()
    next.splice(colIdx, 1)
    return next
  })
  const colLabels = grid.colLabels?.slice()
  if (colLabels) colLabels.splice(colIdx, 1)
  return { ...grid, cols: grid.cols - 1, cells, colLabels }
}

// Inline-label setters used by the spreadsheet headers. Pass undefined to
// clear back to auto-derived (A/B/C... for rows, 1/2/3... for columns).
export function setRowLabel(grid: SeatGrid, rowIdx: number, label: string | undefined): SeatGrid {
  const labels = (grid.rowLabels ?? Array(grid.rows).fill(undefined)).slice()
  while (labels.length < grid.rows) labels.push(undefined)
  labels[rowIdx] = label
  return { ...grid, rowLabels: labels }
}
export function setColLabel(grid: SeatGrid, colIdx: number, label: string | undefined): SeatGrid {
  const labels = (grid.colLabels ?? Array(grid.cols).fill(undefined)).slice()
  while (labels.length < grid.cols) labels.push(undefined)
  labels[colIdx] = label
  return { ...grid, colLabels: labels }
}

// Normalised rectangular range (top-left + bottom-right).
export interface CellRange {
  r1: number; c1: number
  r2: number; c2: number
}

export function normRange(a: { r: number; c: number }, b: { r: number; c: number }): CellRange {
  return {
    r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c),
    r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c),
  }
}

export function rangeIncludes(range: CellRange, r: number, c: number): boolean {
  return r >= range.r1 && r <= range.r2 && c >= range.c1 && c <= range.c2
}

// Apply a transformation to every cell in a range.
export function paintRange(
  grid: SeatGrid,
  range: CellRange,
  paint: (cell: GridCell) => GridCell,
): SeatGrid {
  const cells = grid.cells.map((row, r) =>
    row.map((cell, c) => (rangeIncludes(range, r, c) ? paint(cell) : cell)),
  )
  return { ...grid, cells }
}

// Replace one cell.
export function setCell(grid: SeatGrid, r: number, c: number, cell: GridCell): SeatGrid {
  const cells = grid.cells.map((row, ri) =>
    ri !== r ? row : row.map((cur, ci) => (ci === c ? cell : cur)),
  )
  return { ...grid, cells }
}

// Add a section meta record (does NOT paint cells — pair with paintRange).
export function upsertSection(grid: SeatGrid, section: SectionMeta): SeatGrid {
  return {
    ...grid,
    sections: { ...grid.sections, [section.id]: section },
  }
}

// Remove a section meta record AND empty out any cells that belonged to it.
export function deleteSection(grid: SeatGrid, sectionId: string): SeatGrid {
  const nextSections = { ...grid.sections }
  delete nextSections[sectionId]
  const cells = grid.cells.map(row =>
    row.map(c => (c.kind === "seat" && c.sectionId === sectionId ? { kind: "empty" } as GridCell : c)),
  )
  return { ...grid, sections: nextSections, cells }
}

// ---------------------------------------------------------------------------
// Deriving flat seats + decor from the grid (for the save payload).
// ---------------------------------------------------------------------------

export interface DerivedSeat {
  id: string                       // "<sectionId>#r#c"
  section: string
  row_label: string
  seat_number: string              // 1-based, counted within the row across all sections
  seat_label: string               // "<row>-<num>"
  x: number
  y: number
  ticket_type_id: string
}

export interface DerivedDecor {
  kind: "rect" | "text"
  x: number
  y: number
  width?: number
  height?: number
  label?: string
  fill?: string
  color?: string
}

const CELL_PX = 28                 // viewbox px per cell — picker rescales anyway
const CELL_GAP = 0                 // tight grid, gaps come from explicit empty cells

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

export function deriveLayout(grid: SeatGrid): {
  viewbox: { width: number; height: number }
  seats: DerivedSeat[]
  decor: DerivedDecor[]
} {
  const W = grid.cols * (CELL_PX + CELL_GAP) + CELL_PX
  const H = grid.rows * (CELL_PX + CELL_GAP) + CELL_PX
  const seats: DerivedSeat[] = []
  const decor: DerivedDecor[] = []

  // Seat-number start for the whole grid (1 by default).
  const seatStart = grid.seatNumberStart ?? 1

  // Walk each row: emit seats (numbered by COLUMN POSITION so aisles don't
  // shift the numbering — col 5 is always seat "6" no matter what sits in
  // col 4) + group consecutive label cells into single text runs. Stage
  // banners come from grid.stages, not cells.
  //
  // Label resolution distinguishes three states:
  //   undefined → auto-derive default
  //   ""        → explicit blank (preserved as-is)
  //   "X"       → custom override
  for (let r = 0; r < grid.rows; r++) {
    const rowLabelCustom = grid.rowLabels?.[r]
    // Display label can be blank ("") for aisle-only rows. Seat data needs
    // a non-empty row_label — the API rejects empty strings and the unique
    // (event_id, row_label, seat_number) constraint requires distinct values
    // — so fall back to the auto-derived default for the seat payload only.
    const displayRowLabel = rowLabelCustom !== undefined ? rowLabelCustom : defaultRowLabel(r)
    const rowLabel = displayRowLabel.trim() || defaultRowLabel(r)
    let labelRunStart = -1
    let labelText = ""

    const flushLabel = () => {
      if (labelRunStart < 0) return
      decor.push({
        kind: "text",
        x: Math.round((labelRunStart + 0.5) * CELL_PX),
        y: Math.round((r + 0.5) * CELL_PX),
        label: labelText,
        color: "#374151",
      })
      labelRunStart = -1
      labelText = ""
    }

    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.cells[r][c]
      if (cell.kind !== "label") flushLabel()

      if (cell.kind === "seat") {
        const sec = grid.sections[cell.sectionId]
        if (!sec) continue
        const tier = cell.tierOverride ?? sec.defaultTicketTypeId
        const x = Math.round((c + 0.5) * CELL_PX)
        const y = Math.round((r + 0.5) * CELL_PX)
        const colLabelCustom = grid.colLabels?.[c]
        // Same blank-fallback as the row label — seat_number must be non-empty
        // for the DB unique constraint and the API validator.
        const displayNum = colLabelCustom !== undefined ? colLabelCustom : String(seatStart + c)
        const num = displayNum.trim() || String(seatStart + c)
        seats.push({
          id: `${sec.id}#${r}#${c}`,
          section: sec.name,
          row_label: rowLabel,
          seat_number: num,
          seat_label: `${rowLabel}-${num}`,
          x, y,
          ticket_type_id: tier,
        })
      } else if (cell.kind === "label") {
        if (labelRunStart < 0) {
          labelRunStart = c
          labelText = cell.text
        }
      }
    }
    flushLabel()
  }

  // Free-form stage overlays — each becomes one decor rect at the admin's
  // chosen position and size (converted from cell units to viewbox pixels).
  for (const s of grid.stages) {
    decor.push({
      kind: "rect",
      x: Math.round(s.x * CELL_PX),
      y: Math.round(s.y * CELL_PX),
      width:  Math.max(20, Math.round(s.width  * CELL_PX)),
      height: Math.max(20, Math.round(s.height * CELL_PX)),
      label: s.label || "STAGE",
      fill: "#111827",
      color: "#FFFFFF",
    })
  }

  // Hidden meta entry — encodes grid structure (total rows × cols, custom
  // row/col labels, seat-number start) so the spreadsheet shape survives a
  // round-trip through the API. Positioned far off-canvas so the consumer
  // renderer doesn't show it. Picked up by hydrateGrid() on reload.
  decor.push({
    kind: "text",
    x: META_OFFSCREEN,
    y: META_OFFSCREEN,
    label: META_PREFIX + JSON.stringify({
      rows: grid.rows,
      cols: grid.cols,
      rowLabels: grid.rowLabels ?? null,
      colLabels: grid.colLabels ?? null,
      seatNumberStart: grid.seatNumberStart ?? null,
    }),
  })

  return { viewbox: { width: W, height: H }, seats, decor }
}

const META_PREFIX = "__macroLayoutMeta__"
const META_OFFSCREEN = -99999

interface MacroLayoutMeta {
  rows: number
  cols: number
  rowLabels: (string | null)[] | null
  colLabels: (string | null)[] | null
  seatNumberStart: number | null
}

// Pull the meta entry out of an apiDecor list (returns the parsed payload +
// the filtered decor list without the meta entry).
function extractMeta(apiDecor: ApiDecorLike[]): {
  meta: MacroLayoutMeta | null
  decor: ApiDecorLike[]
} {
  let meta: MacroLayoutMeta | null = null
  const filtered: ApiDecorLike[] = []
  for (const d of apiDecor) {
    if (
      d.kind === "text" &&
      typeof d.label === "string" &&
      d.label.startsWith(META_PREFIX)
    ) {
      try {
        meta = JSON.parse(d.label.slice(META_PREFIX.length)) as MacroLayoutMeta
      } catch {
        // ignore corrupted meta — fall back to inference
      }
      continue
    }
    filtered.push(d)
  }
  return { meta, decor: filtered }
}

// ---------------------------------------------------------------------------
// Hydrate from existing flat event_seats — best-effort reconstruction of the
// cell grid for re-edits.
// ---------------------------------------------------------------------------

interface ApiSeatLike {
  section: string | null
  row_label: string | null
  seat_number: string | number | null
  x: number | null
  y: number | null
  ticket_type_id: string | null
}

interface ApiDecorLike {
  kind: "rect" | "text" | "line"
  x?: number
  y?: number
  width?: number
  height?: number
  label?: string
}

export function hydrateGrid(
  apiSeats: ApiSeatLike[],
  apiDecorRaw: ApiDecorLike[],
  uid: (prefix?: string) => string,
): SeatGrid {
  if (apiSeats.length === 0 && apiDecorRaw.length === 0) return emptyGrid()

  // Pull the meta entry out first — it's the authoritative source for grid
  // dimensions + label overrides. Falls back to position-based inference
  // when missing (legacy events saved before the meta entry existed).
  const { meta, decor: apiDecor } = extractMeta(apiDecorRaw)

  // Bucket seats by row_label to determine row count + the row order via
  // mean Y. Within each row, sort by X to determine column slots.
  interface RowBucket { label: string; seats: ApiSeatLike[]; meanY: number }
  const rowMap = new Map<string, ApiSeatLike[]>()
  for (const s of apiSeats) {
    if (s.x == null || s.y == null) continue
    const lbl = (s.row_label || "?").toString()
    const arr = rowMap.get(lbl) ?? []
    arr.push(s)
    rowMap.set(lbl, arr)
  }
  const rowBuckets: RowBucket[] = []
  for (const [label, seats] of rowMap.entries()) {
    const meanY = seats.reduce((acc, s) => acc + Number(s.y), 0) / seats.length
    rowBuckets.push({ label, seats, meanY })
  }
  rowBuckets.sort((a, b) => a.meanY - b.meanY)

  // Column slots — globally derived from the unique X positions across all
  // seats (rounded to the nearest 14 px to absorb minor noise).
  const xSet = new Set<number>()
  for (const s of apiSeats) {
    if (s.x == null) continue
    xSet.add(Math.round(Number(s.x) / 14) * 14)
  }
  const xs = Array.from(xSet).sort((a, b) => a - b)
  const colIndexForX = (x: number) => {
    const rounded = Math.round(x / 14) * 14
    return xs.indexOf(rounded)
  }

  const rows = rowBuckets.length + Math.min(4, Math.max(2, apiDecor.length))   // a few extra rows for stage/labels
  const cols = Math.max(1, xs.length) + 2                                       // a little padding on the right
  const cells: GridCell[][] = []
  for (let r = 0; r < rows; r++) {
    cells.push(Array.from({ length: cols }, () => ({ kind: "empty" }) as GridCell))
  }

  // Build section registry — one per unique section name.
  const sections: Record<string, SectionMeta> = {}
  const sectionByName = new Map<string, SectionMeta>()
  const getSection = (name: string, defaultTier: string): SectionMeta => {
    const existing = sectionByName.get(name)
    if (existing) return existing
    const m: SectionMeta = { id: uid("section"), name, defaultTicketTypeId: defaultTier }
    sectionByName.set(name, m)
    sections[m.id] = m
    return m
  }

  // Place each row's seats into their grid row.
  const rowLabels: (string | undefined)[] = Array(rows).fill(undefined)
  rowBuckets.forEach((b, rIdx) => {
    rowLabels[rIdx] = b.label
    for (const s of b.seats) {
      if (s.x == null) continue
      const col = colIndexForX(Number(s.x))
      if (col < 0 || col >= cols) continue
      const name = (s.section || "Section").toString()
      const tier = (s.ticket_type_id || "").toString()
      const sec = getSection(name, tier)
      cells[rIdx][col] = { kind: "seat", sectionId: sec.id }
    }
  })

  // Free-form stage rects → grid.stages (in cell units). Text labels still
  // go into a spare row as cell-labels since they're inherently inline.
  const stages: StageBlock[] = []
  let extraRow = rowBuckets.length
  for (const d of apiDecor) {
    if (d.kind === "line") continue
    if (d.kind === "rect") {
      const xPx = Number(d.x ?? 0)
      const yPx = Number(d.y ?? 0)
      const wPx = Number(d.width  ?? 200)
      const hPx = Number(d.height ?? 30)
      stages.push({
        id: uid("stage"),
        x: xPx / 28,      // CELL_PX = 28 in deriveLayout — keep in sync
        y: yPx / 28,
        width:  Math.max(1, wPx / 28),
        height: Math.max(1, hPx / 28),
        label: d.label || "STAGE",
      })
    } else if (extraRow < rows) {
      cells[extraRow][0] = { kind: "label", text: d.label || "Label" }
      extraRow += 1
    }
  }

  // Apply meta overrides — these are authoritative when the seat map was
  // saved with the spreadsheet builder. We resize the cells grid to the
  // saved rows × cols (preserving entirely-empty rows/columns the inference
  // can't see), and replace the inferred row/col label arrays.
  if (meta && Number.isFinite(meta.rows) && Number.isFinite(meta.cols)) {
    const metaRows = Math.max(1, Math.round(meta.rows))
    const metaCols = Math.max(1, Math.round(meta.cols))
    if (metaRows !== rows || metaCols !== cols) {
      const next: GridCell[][] = []
      for (let r = 0; r < metaRows; r++) {
        const row: GridCell[] = []
        for (let c = 0; c < metaCols; c++) {
          row.push(cells[r]?.[c] ?? { kind: "empty" })
        }
        next.push(row)
      }
      return {
        rows: metaRows, cols: metaCols, cells: next, sections, stages,
        rowLabels: meta.rowLabels ? meta.rowLabels.map(v => v ?? undefined) : rowLabels,
        colLabels: meta.colLabels ? meta.colLabels.map(v => v ?? undefined) : undefined,
        seatNumberStart: meta.seatNumberStart ?? undefined,
      }
    }
    // Same dimensions — just apply the label overrides.
    return {
      rows, cols, cells, sections, stages,
      rowLabels: meta.rowLabels ? meta.rowLabels.map(v => v ?? undefined) : rowLabels,
      colLabels: meta.colLabels ? meta.colLabels.map(v => v ?? undefined) : undefined,
      seatNumberStart: meta.seatNumberStart ?? undefined,
    }
  }

  return {
    rows, cols, cells, sections, stages,
    rowLabels,
  }
}
