// ---------------------------------------------------------------------------
// Seat map data model — structured sections instead of free-form seats.
//
// The previous builder stored seats as a flat array of `(x, y)` circles, which
// forced the admin to drag every seat individually and made cross-section
// labelling (row A spans Left + Center + Right) fragile.
//
// This model treats each *section* as a declarative grid block:
//
//   - `(x, y)`, `rows`, `cols`, `rowSpacing`, `seatSpacing` describe the
//     geometry. Individual seat positions are derived, not stored.
//   - `defaultTicketTypeId` colours the whole block, with `tierOverrides`
//     letting the admin recolor specific cells (e.g. the Silver/Gold split
//     inside a single Orchestra Left block).
//   - `skipSeats` marks cells that don't exist, for the irregular bottom
//     edges in the reference layout (rows S/T with fewer seats).
//
// Row letters and seat numbers are NOT stored on the section — they are
// derived from the visual layout at save / render time:
//
//   1. Enumerate every (non-skip) cell from every section → DerivedSeat[]
//   2. Bucket by Y (with median-gap tolerance) so sections at the same row
//      land in one bucket.
//   3. Detect zone breaks via large Y-gaps. Each zone gets its own row-label
//      scheme: zone 0 = "A, B, … Z, AA, AB" (spreadsheet), zone 1 = "AA, BB,
//      CC, …" (double-letter balcony convention), zone 2 = "AAA, BBB, …".
//   4. Within each row bucket, sort by X across sections and assign seat
//      numbers 1, 2, 3, … — so the seat numbering continues from Left into
//      Center into Right naturally.
//
// Output to the API (`event_seats`) is the same shape as before: a flat list
// with `section`, `row_label`, `seat_number`, `x`, `y`, `ticket_type_id`. No
// migration is needed — only the editor abstraction changes.
// ---------------------------------------------------------------------------

export interface SectionSpec {
  id: string                    // local UUID
  name: string                  // e.g. "Orchestra Left"
  // Position of the section's top-left seat (in viewbox units).
  x: number
  y: number
  // Grid dimensions.
  rows: number
  cols: number
  rowSpacing: number            // px between row centres
  seatSpacing: number           // px between seat centres
  // Default ticket type for every cell. Per-cell overrides win.
  defaultTicketTypeId: string
  // Per-cell ticket type override. Key is `${r},${c}` (0-indexed).
  tierOverrides: Record<string, string>
  // Cells where no seat exists. Key is `${r},${c}`. Used for irregular
  // bottom edges (e.g. the curved frontline of an orchestra block).
  skipSeats: Record<string, true>
}

export interface DerivedSeat {
  // Stable per-render id so React keys and selection survive re-derivation.
  id: string                    // `${sectionId}#${r}#${c}`
  sectionId: string
  sectionName: string
  r: number                     // 0-indexed row within section
  c: number                     // 0-indexed column within section
  x: number                     // absolute viewbox X
  y: number                     // absolute viewbox Y
  ticketTypeId: string
}

export interface DerivedLabel {
  row_label: string
  seat_number: string
}

// Enumerate every (non-skip) seat from every section. The result is the
// canonical input to deriveLabels() and to the canvas renderer.
export function deriveSeats(sections: SectionSpec[]): DerivedSeat[] {
  const out: DerivedSeat[] = []
  for (const s of sections) {
    for (let r = 0; r < s.rows; r++) {
      for (let c = 0; c < s.cols; c++) {
        const key = `${r},${c}`
        if (s.skipSeats[key]) continue
        const tier = s.tierOverrides[key] ?? s.defaultTicketTypeId
        out.push({
          id: `${s.id}#${r}#${c}`,
          sectionId: s.id,
          sectionName: s.name,
          r, c,
          x: Math.round(s.x + c * s.seatSpacing),
          y: Math.round(s.y + r * s.rowSpacing),
          ticketTypeId: tier,
        })
      }
    }
  }
  return out
}

// Compute row letters + seat numbers for every derived seat. Returns a map
// keyed by DerivedSeat.id. Multiple sections at the same Y share a row
// bucket (so row "A" can span Left, Center, Right). Large Y-gaps create
// zone breaks (so the back balcony gets its own AA/BB/CC scheme).
export function deriveLabels(seats: DerivedSeat[]): Record<string, DerivedLabel> {
  if (seats.length === 0) return {}

  // Sort by Y so adjacency walking works.
  const sorted = [...seats].sort((a, b) => a.y - b.y)

  // Estimate the typical row gap from the median of positive Y-diffs.
  const diffs: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i].y - sorted[i - 1].y
    if (d > 0.5) diffs.push(d)
  }
  diffs.sort((a, b) => a - b)
  const medianRowGap = diffs[Math.floor(diffs.length / 2)] || 22
  // Anything within 0.6× the median counts as the same row.
  const rowTol = Math.max(6, medianRowGap * 0.6)
  // Anything >2.5× the median is treated as a zone break.
  const zoneBreakTol = medianRowGap * 2.5

  // Build row buckets and track zone boundaries.
  interface RowBucket { yCentre: number; seats: DerivedSeat[]; zoneIdx: number }
  const buckets: RowBucket[] = []
  let zoneIdx = 0
  let lastBucketY = -Infinity
  for (const s of sorted) {
    const gap = s.y - lastBucketY
    if (gap > zoneBreakTol && buckets.length > 0) {
      zoneIdx += 1
      buckets.push({ yCentre: s.y, seats: [s], zoneIdx })
    } else if (gap > rowTol || buckets.length === 0) {
      buckets.push({ yCentre: s.y, seats: [s], zoneIdx })
    } else {
      const b = buckets[buckets.length - 1]
      b.seats.push(s)
      // Average y as we accumulate to stabilise the centroid.
      b.yCentre = (b.yCentre * (b.seats.length - 1) + s.y) / b.seats.length
    }
    lastBucketY = s.y
  }

  // Per-zone row counter — resets when zoneIdx ticks over.
  const rowIndexInZone = new Map<number, number>()
  const out: Record<string, DerivedLabel> = {}
  for (const b of buckets) {
    const idx = rowIndexInZone.get(b.zoneIdx) ?? 0
    rowIndexInZone.set(b.zoneIdx, idx + 1)
    const rowLabel = rowLabelForZone(b.zoneIdx, idx)
    // Sort the row left → right ACROSS sections, then number 1..N.
    b.seats.sort((a, b2) => a.x - b2.x)
    b.seats.forEach((seat, i) => {
      out[seat.id] = { row_label: rowLabel, seat_number: String(i + 1) }
    })
  }
  return out
}

// Spreadsheet-style row label A, B, …, Z, AA, AB, … for zone 0; double / triple
// letters for higher zones. Matches the reference layout's A-U (zone 0, top)
// and AA-MM (zone 1, balcony) convention.
function rowLabelForZone(zoneIdx: number, rowIdx: number): string {
  if (zoneIdx === 0) {
    let s = ""
    let i = rowIdx + 1
    while (i > 0) {
      const r = (i - 1) % 26
      s = String.fromCharCode(65 + r) + s
      i = Math.floor((i - 1) / 26)
    }
    return s
  }
  const c = String.fromCharCode(65 + (rowIdx % 26))
  return c.repeat(zoneIdx + 1)
}

// Reverse engineer SectionSpec[] from an existing event_seats response.
// Used on builder hydration so re-edits don't start blank. We group seats
// by their `section` name (the authoritative grouping in the API), then for
// each group estimate the geometry from the position cluster.
//
// `apiSeats` shape:  { section, row_label, seat_number, x, y, ticket_type_id }
export interface ApiSeatLike {
  section: string | null
  row_label: string | null
  seat_number: string | number | null
  x: number | null
  y: number | null
  ticket_type_id: string | null
}

export function reverseEngineerSections(
  apiSeats: ApiSeatLike[],
  uid: (prefix?: string) => string,
): SectionSpec[] {
  // Group by section name.
  const groups = new Map<string, ApiSeatLike[]>()
  for (const s of apiSeats) {
    if (s.x == null || s.y == null) continue
    const name = (s.section || "General").toString()
    const arr = groups.get(name) ?? []
    arr.push(s)
    groups.set(name, arr)
  }

  const out: SectionSpec[] = []
  for (const [name, seats] of groups.entries()) {
    if (seats.length === 0) continue

    // Determine unique row labels (in seat order) and unique col positions.
    const rowsByLabel = new Map<string, ApiSeatLike[]>()
    for (const s of seats) {
      const lbl = (s.row_label || "?").toString()
      const arr = rowsByLabel.get(lbl) ?? []
      arr.push(s)
      rowsByLabel.set(lbl, arr)
    }
    const rowLabelsSorted = Array.from(rowsByLabel.keys()).sort((a, b) => {
      // Sort by average y of the row.
      const ay = avg(rowsByLabel.get(a)!.map(s => Number(s.y)))
      const by = avg(rowsByLabel.get(b)!.map(s => Number(s.y)))
      return ay - by
    })

    // cols = max row width.
    const cols = Math.max(...Array.from(rowsByLabel.values()).map(r => r.length))
    const rows = rowLabelsSorted.length

    // Spacing — median of consecutive X gaps within rows, and Y gaps between
    // rows. Falls back to 22 (matches the builder's grid default).
    const xGaps: number[] = []
    for (const arr of rowsByLabel.values()) {
      const xs = arr.map(s => Number(s.x)).sort((a, b) => a - b)
      for (let i = 1; i < xs.length; i++) {
        const d = xs[i] - xs[i - 1]
        if (d > 0.5) xGaps.push(d)
      }
    }
    const yGaps: number[] = []
    for (let i = 1; i < rowLabelsSorted.length; i++) {
      const ya = avg(rowsByLabel.get(rowLabelsSorted[i - 1])!.map(s => Number(s.y)))
      const yb = avg(rowsByLabel.get(rowLabelsSorted[i])!.map(s => Number(s.y)))
      if (yb - ya > 0.5) yGaps.push(yb - ya)
    }
    xGaps.sort((a, b) => a - b)
    yGaps.sort((a, b) => a - b)
    const seatSpacing = xGaps[Math.floor(xGaps.length / 2)] || 22
    const rowSpacing = yGaps[Math.floor(yGaps.length / 2)] || 22

    // Top-left = (min x across all seats, min y across all seats).
    const minX = Math.min(...seats.map(s => Number(s.x)))
    const minY = Math.min(...seats.map(s => Number(s.y)))

    // Default ticket = most common ticket_type across the section.
    const tierCounts = new Map<string, number>()
    for (const s of seats) {
      const t = s.ticket_type_id || ""
      if (!t) continue
      tierCounts.set(t, (tierCounts.get(t) || 0) + 1)
    }
    let defaultTier = ""
    let best = 0
    for (const [t, count] of tierCounts) {
      if (count > best) { best = count; defaultTier = t }
    }

    // Build the section's rectangular grid; any (r, c) that doesn't have a
    // matching API seat is marked skipped (handles the irregular fronts).
    // Also build tierOverrides for cells whose ticket_type differs from
    // the default.
    const id = uid("section")
    const spec: SectionSpec = {
      id,
      name,
      x: Math.round(minX),
      y: Math.round(minY),
      rows,
      cols,
      rowSpacing,
      seatSpacing,
      defaultTicketTypeId: defaultTier,
      tierOverrides: {},
      skipSeats: {},
    }

    // Build a lookup by (r, c) via approximate position match.
    for (let r = 0; r < rows; r++) {
      const rowLabel = rowLabelsSorted[r]
      const arr = rowsByLabel.get(rowLabel) ?? []
      // Sort by x for column ordering.
      arr.sort((a, b) => Number(a.x) - Number(b.x))
      for (let c = 0; c < cols; c++) {
        // Compute expected x for column c.
        const expectedX = spec.x + c * spec.seatSpacing
        // Find seat whose x is closest to expectedX (within half-spacing).
        const tol = spec.seatSpacing / 2
        const match = arr.find(s => Math.abs(Number(s.x) - expectedX) <= tol)
        if (!match) {
          spec.skipSeats[`${r},${c}`] = true
        } else if (match.ticket_type_id && match.ticket_type_id !== defaultTier) {
          spec.tierOverrides[`${r},${c}`] = match.ticket_type_id
        }
      }
    }
    out.push(spec)
  }
  return out
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0
  let s = 0
  for (const x of xs) s += x
  return s / xs.length
}
