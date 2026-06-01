"use client"

// Why this lives in its own file:
// react-konva uses a custom React reconciler. When its components are imported
// via individual next/dynamic({ssr:false}) calls in the parent, each one
// resolves asynchronously and the placeholder elements break Konva's node
// tree until every import settles — which manifests as a blank canvas in the
// builder. Importing Stage/Layer/Rect/Text/Circle/Group statically here and
// then dynamic()-ing this whole file once from the page keeps the entire
// canvas subtree as a single client-only chunk that mounts atomically.

import { useEffect, useMemo, useRef, useState } from "react"
import { Stage, Layer, Rect, Text as KText, Circle, Group, Image as KImage, Transformer } from "react-konva"
import type Konva from "konva"
import {
  type SectionSpec,
  type DerivedSeat,
  deriveSeats,
  deriveLabels,
} from "./seatMapModel"

export interface EditorDecor {
  id: string
  kind: "rect" | "text"
  x: number
  y: number
  width?: number
  height?: number
  label?: string
  fill?: string
  color?: string
}

export type Selection =
  | { kind: "section";  id: string }
  | { kind: "decor";    id: string }
  | { kind: "seat";     derivedId: string }  // a single cell within a section
  | null

const SEAT_RADIUS = 8
const SECTION_PADDING = 18

interface Props {
  viewbox: { width: number; height: number }
  stageSize: { width: number; height: number }
  stagePos: { x: number; y: number }
  stageScale: number
  setStagePos: (pos: { x: number; y: number }) => void
  setStageScale: (scale: number) => void
  sections: SectionSpec[]
  decor: EditorDecor[]
  // Background floor-plan image (dimmed beneath sections so the admin can
  // place + size sections to match the venue diagram). Null = no background.
  backgroundUrl: string | null
  selection: Selection
  setSelection: (sel: Selection) => void
  // Resolves a ticket-type id to its swatch colour (palette indexed by tier).
  seatColor: (ticketTypeId: string) => string
  // Section mutations — the page wraps each with a history snapshot.
  onSectionMove:   (sectionId: string, dx: number, dy: number) => void
  onSectionResize: (sectionId: string, tx: number, ty: number, scaleX: number, scaleY: number) => void
  // Decor mutation.
  onDecorMove:     (decorId:   string, x: number, y: number) => void
  // Toggle whether a particular cell is rendered (irregular bottom edges).
  onToggleSkipSeat: (sectionId: string, r: number, c: number) => void
}

export default function BuilderCanvas(props: Props) {
  const {
    viewbox, stageSize, stagePos, stageScale,
    setStagePos, setStageScale,
    sections, decor,
    backgroundUrl,
    selection, setSelection,
    seatColor,
    onSectionMove, onSectionResize, onDecorMove, onToggleSkipSeat,
  } = props

  const stageRef = useRef<Konva.Stage | null>(null)
  const sectionRefs = useRef<Record<string, Konva.Group | null>>({})
  const transformerRef = useRef<Konva.Transformer | null>(null)

  // Background image as an HTMLImageElement so Konva.Image can measure it.
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!backgroundUrl) { setBgImage(null); return }
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.src = backgroundUrl
    img.onload = () => setBgImage(img)
    img.onerror = () => setBgImage(null)
    return () => { img.onload = null; img.onerror = null }
  }, [backgroundUrl])

  // Attach Transformer to the currently-selected section's Group.
  useEffect(() => {
    const t = transformerRef.current
    if (!t) return
    if (selection?.kind === "section") {
      const node = sectionRefs.current[selection.id]
      t.nodes(node ? [node] : [])
    } else {
      t.nodes([])
    }
    t.getLayer()?.batchDraw()
  }, [selection, sections])

  // Derive every seat from every section, then compute zone-aware row letters
  // + cross-section seat numbers. Memoised so panning / selection changes
  // don't redo the work.
  const derived = useMemo(() => deriveSeats(sections), [sections])
  const labels  = useMemo(() => deriveLabels(derived),  [derived])

  // Group derived seats by their Y-bucket so we can place row-letter labels
  // at the outermost edges of each row, like the reference layout's
  // A-U / AA-MM gutters.
  const rowGutters = useMemo(() => {
    const byRow = new Map<string, { y: number; minX: number; maxX: number; label: string }>()
    for (const s of derived) {
      const lab = labels[s.id]
      if (!lab) continue
      const cur = byRow.get(lab.row_label)
      if (cur) {
        if (s.x < cur.minX) cur.minX = s.x
        if (s.x > cur.maxX) cur.maxX = s.x
        cur.y = (cur.y + s.y) / 2
      } else {
        byRow.set(lab.row_label, { y: s.y, minX: s.x, maxX: s.x, label: lab.row_label })
      }
    }
    return Array.from(byRow.values())
  }, [derived, labels])

  // Bounding box of all seats — used to anchor gutter labels at the overall
  // left / right margins, not per-section, so the reference layout's "A on
  // both sides of the entire layout" effect works.
  const overallBounds = useMemo(() => {
    if (derived.length === 0) return null
    let minX = Infinity, maxX = -Infinity
    for (const s of derived) {
      if (s.x < minX) minX = s.x
      if (s.x > maxX) maxX = s.x
    }
    return { minX, maxX }
  }, [derived])

  // Wheel zoom around the cursor.
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const scaleBy = 1.08
    const stage = e.target.getStage()
    if (!stage) return
    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }
    const direction = e.evt.deltaY > 0 ? -1 : 1
    const newScale = Math.max(0.2, Math.min(4,
      direction > 0 ? oldScale * scaleBy : oldScale / scaleBy,
    ))
    setStageScale(newScale)
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    })
  }

  return (
    <Stage
      ref={stageRef}
      width={stageSize.width}
      height={stageSize.height}
      scaleX={stageScale}
      scaleY={stageScale}
      x={stagePos.x}
      y={stagePos.y}
      draggable
      onWheel={handleWheel}
      onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
        const stage = e.target.getStage()
        if (stage && e.target === stage) {
          setStagePos({ x: stage.x(), y: stage.y() })
        }
      }}
      onClick={(e: Konva.KonvaEventObject<MouseEvent>) => {
        if (e.target === e.target.getStage()) setSelection(null)
      }}
    >
      <Layer>
        {/* Viewport */}
        <Rect
          x={0} y={0}
          width={viewbox.width} height={viewbox.height}
          fill="#FFFFFF" stroke="#E5E7EB" strokeWidth={1}
        />

        {/* Background floor-plan */}
        {bgImage && (
          <KImage
            image={bgImage}
            x={0} y={0}
            width={viewbox.width} height={viewbox.height}
            opacity={0.4}
            listening={false}
          />
        )}

        {/* Decor */}
        {decor.map(d => {
          const isSel = selection?.kind === "decor" && selection.id === d.id
          if (d.kind === "rect") {
            return (
              <Group
                key={d.id}
                x={d.x} y={d.y}
                draggable
                onClick={() => setSelection({ kind: "decor", id: d.id })}
                onTap={() => setSelection({ kind: "decor", id: d.id })}
                onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
                  const t = e.target
                  if (t !== e.currentTarget) return
                  onDecorMove(d.id, Math.round(t.x()), Math.round(t.y()))
                }}
              >
                <Rect
                  width={d.width ?? 200} height={d.height ?? 60}
                  fill={d.fill ?? "#111827"}
                  stroke={isSel ? "#3B82F6" : "transparent"}
                  strokeWidth={isSel ? 2 : 0}
                />
                {d.label ? (
                  <KText
                    width={d.width ?? 200} height={d.height ?? 60}
                    text={d.label}
                    fill={d.color ?? "#FFFFFF"}
                    align="center" verticalAlign="middle"
                    fontSize={18} fontStyle="bold"
                  />
                ) : null}
              </Group>
            )
          }
          const label = d.label ?? "LABEL"
          const approxW = Math.max(80, label.length * 9 + 16)
          const approxH = 24
          return (
            <Group
              key={d.id}
              x={d.x} y={d.y}
              draggable
              onClick={() => setSelection({ kind: "decor", id: d.id })}
              onTap={() => setSelection({ kind: "decor", id: d.id })}
              onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
                const t = e.target
                if (t !== e.currentTarget) return
                onDecorMove(d.id, Math.round(t.x()), Math.round(t.y()))
              }}
            >
              <Rect
                x={-4} y={-4}
                width={approxW} height={approxH}
                fill={isSel ? "rgba(59,130,246,0.08)" : "rgba(0,0,0,0.001)"}
                stroke={isSel ? "#3B82F6" : "transparent"}
                strokeWidth={isSel ? 1 : 0}
                cornerRadius={3}
              />
              <KText
                text={label}
                fill={d.color ?? "#374151"}
                fontSize={16} fontStyle="bold"
              />
            </Group>
          )
        })}

        {/* Sections — each a draggable + resizable group of derived seats. */}
        {sections.map(section => {
          const isSel = selection?.kind === "section" && selection.id === section.id
          const w = (section.cols - 1) * section.seatSpacing
          const h = (section.rows - 1) * section.rowSpacing
          const bboxX = -SECTION_PADDING - SEAT_RADIUS
          const bboxY = -SECTION_PADDING - SEAT_RADIUS
          const bboxW = w + 2 * (SECTION_PADDING + SEAT_RADIUS)
          const bboxH = h + 2 * (SECTION_PADDING + SEAT_RADIUS)

          const sectionSeats = derived.filter(s => s.sectionId === section.id)

          return (
            <Group
              key={section.id}
              ref={(node: Konva.Group | null) => { sectionRefs.current[section.id] = node }}
              x={section.x}
              y={section.y}
              draggable
              onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
                const node = e.target
                if (node !== e.currentTarget) return
                const dx = node.x() - section.x
                const dy = node.y() - section.y
                if (dx === 0 && dy === 0) return
                onSectionMove(section.id, dx, dy)
              }}
              onTransformEnd={(e: Konva.KonvaEventObject<Event>) => {
                const node = e.target
                if (node !== e.currentTarget) return
                const sx = node.scaleX()
                const sy = node.scaleY()
                const nx = node.x()
                const ny = node.y()
                node.scaleX(1)
                node.scaleY(1)
                if (sx === 1 && sy === 1 && nx === section.x && ny === section.y) return
                onSectionResize(section.id, nx, ny, sx, sy)
              }}
            >
              {/* Bbox hit target — drag from empty space, click to select. */}
              <Rect
                x={bboxX} y={bboxY}
                width={bboxW} height={bboxH}
                fill={isSel ? "rgba(59,130,246,0.06)" : "rgba(0,0,0,0.001)"}
                stroke={isSel ? "#3B82F6" : "transparent"}
                strokeWidth={isSel ? 1.5 : 0}
                dash={isSel ? [6, 4] : undefined}
                cornerRadius={6}
                onClick={() => setSelection({ kind: "section", id: section.id })}
                onTap={() => setSelection({ kind: "section", id: section.id })}
              />
              {/* Section name tab. */}
              {section.name ? (
                <Group
                  x={bboxX}
                  y={bboxY - 22}
                  onClick={() => setSelection({ kind: "section", id: section.id })}
                  onTap={() => setSelection({ kind: "section", id: section.id })}
                >
                  <Rect
                    width={Math.max(80, section.name.length * 8 + 16)}
                    height={18}
                    fill={isSel ? "#3B82F6" : "#1F2937"}
                    cornerRadius={4}
                    opacity={0.85}
                  />
                  <KText
                    x={8} y={2}
                    text={section.name}
                    fill="#FFFFFF"
                    fontSize={12}
                    fontStyle="600"
                  />
                </Group>
              ) : null}
              {/* Derived seats. Skipped cells render as dim crosses so the
                  admin can re-toggle them; non-skip cells are full circles. */}
              {sectionSeats.map(s => {
                const cellKey = `${s.r},${s.c}`
                const isSeatSel = selection?.kind === "seat" && selection.derivedId === s.id
                const localX = s.x - section.x
                const localY = s.y - section.y
                return (
                  <Circle
                    key={s.id}
                    x={localX} y={localY}
                    radius={SEAT_RADIUS}
                    fill={seatColor(s.ticketTypeId)}
                    stroke={isSeatSel ? "#0F172A" : "#FFFFFF"}
                    strokeWidth={isSeatSel ? 2 : 1}
                    onClick={(e: Konva.KonvaEventObject<MouseEvent>) => {
                      e.cancelBubble = true
                      setSelection({ kind: "seat", derivedId: s.id })
                    }}
                    onDblClick={(e: Konva.KonvaEventObject<MouseEvent>) => {
                      // Double-click toggles "skip" — useful for carving the
                      // curved fronts in the reference layout.
                      e.cancelBubble = true
                      onToggleSkipSeat(section.id, s.r, s.c)
                    }}
                    onTap={(e: Konva.KonvaEventObject<MouseEvent>) => {
                      e.cancelBubble = true
                      setSelection({ kind: "seat", derivedId: s.id })
                    }}
                    _skipKey={cellKey}
                  />
                )
              })}
              {/* Skip-cell markers — render an X where a seat would otherwise
                  appear so the admin can re-include the cell with another
                  double-click. */}
              {Object.keys(section.skipSeats).map(key => {
                const [rStr, cStr] = key.split(",")
                const r = Number(rStr); const c = Number(cStr)
                if (r >= section.rows || c >= section.cols) return null
                const lx = c * section.seatSpacing
                const ly = r * section.rowSpacing
                return (
                  <Group
                    key={`skip-${key}`}
                    x={lx} y={ly}
                    onDblClick={() => onToggleSkipSeat(section.id, r, c)}
                  >
                    <Circle radius={SEAT_RADIUS} fill="rgba(0,0,0,0.001)" stroke="#9CA3AF" strokeWidth={1} dash={[2, 2]} />
                    <KText x={-4} y={-5} text="×" fontSize={10} fill="#9CA3AF" />
                  </Group>
                )
              })}
            </Group>
          )
        })}

        {/* Row-letter labels at the overall left + right gutters. Anchored
            once per Y-bucket so multi-section rows share one label on each
            side, like the reference seating diagram. */}
        {overallBounds && rowGutters.map((g, i) => (
          <Group key={`gutter-${i}`} listening={false}>
            <KText
              x={overallBounds.minX - SEAT_RADIUS - 36}
              y={g.y - 7}
              width={24} height={14}
              text={g.label}
              fill="#6B7280"
              fontSize={11}
              fontStyle="600"
              align="right"
            />
            <KText
              x={overallBounds.maxX + SEAT_RADIUS + 14}
              y={g.y - 7}
              width={24} height={14}
              text={g.label}
              fill="#6B7280"
              fontSize={11}
              fontStyle="600"
              align="left"
            />
          </Group>
        ))}

        {/* Transformer for section resize. Constrained to scaling only. */}
        <Transformer
          ref={transformerRef}
          rotateEnabled={false}
          flipEnabled={false}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 30 || newBox.height < 30) return oldBox
            return newBox
          }}
          anchorSize={9}
          borderStroke="#3B82F6"
          anchorStroke="#3B82F6"
          anchorFill="#FFFFFF"
        />
      </Layer>
    </Stage>
  )
}

// Re-export for the page so it can resolve derived seats by id for the
// per-seat inspector + tier overrides.
export type { DerivedSeat }
