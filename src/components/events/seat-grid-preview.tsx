import React from "react"
import { cn } from "@/lib/utils"

// Seat-map geometry returned by the admin event detail endpoint (seats_preview).
export type LayoutData = {
  sections: Array<{
    id: string
    name: string
    color?: string
    rows: Array<{
      label: string
      seats: Array<{ number: string; type?: string }>
    }>
  }>
}

// SeatGridPreview — lightweight SVG render of a seat map for the admin review
// page. Sections stack vertically with a stage bar; huge sections are
// downsampled so the DOM stays small while the shape stays faithful. Mirrors
// the component in myscope-web (separate app, no shared package).
export function SeatGridPreview({
  layout,
  stagePosition = "front",
  compact = false,
  className,
}: {
  layout: LayoutData
  stagePosition?: string
  compact?: boolean
  className?: string
}) {
  const sections = layout?.sections ?? []
  if (sections.length === 0) {
    return (
      <div className={cn("rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground", className)}>
        Nothing to preview yet
      </div>
    )
  }

  const DOT = compact ? 3 : 6
  const GAP = compact ? 1.5 : 3
  const PAD = compact ? 6 : 12
  const SECTION_GAP = compact ? 8 : 18
  const LABEL_H = compact ? 0 : 16
  const STAGE_H = compact ? 7 : 16
  const STAGE_GAP = compact ? 4 : 10
  const MAX_COLS = compact ? 30 : 50
  const MAX_ROWS = compact ? 18 : 38
  const step = DOT + GAP

  const sample = (total: number, n: number) =>
    total <= n
      ? Array.from({ length: total }, (_, i) => i)
      : Array.from({ length: n }, (_, i) => Math.round((i * (total - 1)) / Math.max(1, n - 1)))

  const blocks = sections.map((sec) => {
    const rows = sec.rows ?? []
    const maxCols = rows.reduce((m, r) => Math.max(m, (r.seats ?? []).length), 0)
    const seatCount = rows.reduce(
      (t, r) => t + (r.seats?.filter((s) => s?.type !== "aisle").length ?? 0),
      0,
    )
    return {
      name: sec.name,
      color: sec.color || "#7F77DD",
      colIdx: sample(maxCols, MAX_COLS),
      rowIdx: sample(rows.length, MAX_ROWS),
      seatCount,
    }
  })

  const contentW = Math.max(1, ...blocks.map((b) => b.colIdx.length)) * step
  const showStage = !!stagePosition && stagePosition !== "none"
  const stageAtBottom = stagePosition === "back"

  let bodyH = 0
  blocks.forEach((b, i) => {
    if (i > 0) bodyH += SECTION_GAP
    bodyH += LABEL_H + b.rowIdx.length * step
  })
  const stageBlockH = showStage ? STAGE_H + STAGE_GAP : 0
  const width = contentW + PAD * 2
  const height = PAD * 2 + bodyH + stageBlockH

  const els: React.ReactNode[] = []
  let cy = PAD

  const stage = (key: string) => (
    <g key={key}>
      <rect x={PAD} y={cy} width={contentW} height={STAGE_H} rx={3} style={{ fill: "var(--muted)" }} />
      {!compact && (
        <text
          x={PAD + contentW / 2}
          y={cy + STAGE_H / 2 + 3}
          textAnchor="middle"
          style={{ fill: "var(--muted-foreground)", fontSize: 9, letterSpacing: 1.5 }}
        >
          STAGE
        </text>
      )}
    </g>
  )

  if (showStage && !stageAtBottom) {
    els.push(stage("stage-top"))
    cy += STAGE_H + STAGE_GAP
  }

  blocks.forEach((b, bi) => {
    if (bi > 0) cy += SECTION_GAP
    if (!compact) {
      els.push(
        <text key={`label-${bi}`} x={PAD} y={cy + 11} style={{ fill: "var(--foreground)", fontSize: 10, fontWeight: 600 }}>
          {b.name} · {b.seatCount}
        </text>,
      )
      cy += LABEL_H
    }
    const blockW = b.colIdx.length * step
    const xStart = PAD + (contentW - blockW) / 2
    for (let r = 0; r < b.rowIdx.length; r++) {
      for (let c = 0; c < b.colIdx.length; c++) {
        els.push(
          <rect
            key={`${bi}-${r}-${c}`}
            x={xStart + c * step}
            y={cy + r * step}
            width={DOT}
            height={DOT}
            rx={DOT / 3}
            fill={b.color}
            opacity={0.85}
          />,
        )
      }
    }
    cy += b.rowIdx.length * step
  })

  if (showStage && stageAtBottom) {
    cy += STAGE_GAP
    els.push(stage("stage-bottom"))
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Seat map preview"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ width: "100%", height: "auto", maxHeight: compact ? 132 : 340, display: "block" }}
    >
      {els}
    </svg>
  )
}
