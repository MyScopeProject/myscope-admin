"use client"

// Why this lives in its own file:
// react-konva uses a custom React reconciler. When its components are imported
// via individual next/dynamic({ssr:false}) calls in the parent, each one
// resolves asynchronously and the placeholder elements break Konva's node
// tree until every import settles — which manifests as a blank canvas in the
// builder. Importing Stage/Layer/Rect/Text/Circle/Group statically here and
// then dynamic()-ing this whole file once from the page keeps the entire
// canvas subtree as a single client-only chunk that mounts atomically.

import { useRef } from "react"
import { Stage, Layer, Rect, Text as KText, Circle, Group } from "react-konva"
import type Konva from "konva"

export interface EditorSeat {
  id: string
  section: string
  row_label: string
  seat_number: string
  x: number
  y: number
  ticket_type_id: string
}

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
  | { kind: "seat";     id: string }
  | { kind: "decor";    id: string }
  | { kind: "section";  name: string }
  | null

const SEAT_RADIUS = 8

interface Props {
  viewbox: { width: number; height: number }
  stageSize: { width: number; height: number }
  stagePos: { x: number; y: number }
  stageScale: number
  setStagePos: (pos: { x: number; y: number }) => void
  setStageScale: (scale: number) => void
  seats: EditorSeat[]
  decor: EditorDecor[]
  selection: Selection
  setSelection: (sel: Selection) => void
  // Tier color resolver — null/missing ticket_type_id returns the fallback.
  seatColor: (ticketTypeId: string) => string
  // Mutation callbacks — page is the source of truth and wraps each one
  // with a history snapshot so undo Just Works for every drag.
  onSeatMove:    (seatId:  string, x: number, y: number) => void
  onDecorMove:   (decorId: string, x: number, y: number) => void
  onSectionMove: (sectionName: string, dx: number, dy: number) => void
}

const SECTION_PADDING = 18 // px around section bbox for hit target + outline

export default function BuilderCanvas(props: Props) {
  const {
    viewbox, stageSize, stagePos, stageScale,
    setStagePos, setStageScale,
    seats, decor,
    selection, setSelection,
    seatColor,
    onSeatMove, onDecorMove, onSectionMove,
  } = props

  const stageRef = useRef<Konva.Stage | null>(null)

  // Group seats by section so we can render each section in its own draggable
  // <Group> with a bbox hit-target. Empty section names fall under "" — they
  // still render but won't have an outline label.
  const sectionedSeats = new Map<string, EditorSeat[]>()
  for (const s of seats) {
    const arr = sectionedSeats.get(s.section) ?? []
    arr.push(s)
    sectionedSeats.set(s.section, arr)
  }

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
        {/* Viewport rectangle so admin sees the canvas bounds */}
        <Rect
          x={0} y={0}
          width={viewbox.width} height={viewbox.height}
          fill="#FFFFFF" stroke="#E5E7EB" strokeWidth={1}
        />

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
          // Text decor — wrapped in a Group with a transparent hit-target
          // Rect so dragging is forgiving (the text glyphs alone are too
          // small / sparse to grab reliably, especially on touch).
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

        {/* Sections — each rendered in a draggable <Group>. Dragging the
            section's hit-rect (empty space inside the bbox) moves the whole
            group; dragging an individual seat still moves just the seat
            because Konva routes the drag to whichever child captured it. */}
        {Array.from(sectionedSeats.entries()).map(([sectionName, sectionSeats]) => {
          const bbox = computeBBox(sectionSeats)
          const isSectionSel =
            selection?.kind === "section" && selection.name === sectionName

          return (
            <Group
              key={`section-${sectionName}`}
              x={0}
              y={0}
              draggable
              onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
                const node = e.target
                // We only care when the group itself was the drag target; if
                // a seat inside was dragged Konva fires onDragEnd on the seat
                // (which has its own handler), so this branch is the
                // whole-section move.
                if (node !== e.currentTarget) return
                const dx = node.x()
                const dy = node.y()
                if (dx === 0 && dy === 0) return
                // Reset the Konva node back to (0, 0) synchronously so the
                // next React render (which passes x={0} y={0}) doesn't fight
                // the node's current state. The page handler bakes the delta
                // into seat coords + pushes one history entry.
                node.x(0)
                node.y(0)
                onSectionMove(sectionName, dx, dy)
              }}
            >
              {/* Section bbox hit-target. Always rendered but only visible
                  when the section is selected; it's the drag handle for the
                  whole group. listening=true so it captures the drag/click. */}
              <Rect
                x={bbox.x} y={bbox.y}
                width={bbox.width} height={bbox.height}
                fill={isSectionSel ? "rgba(59,130,246,0.06)" : "rgba(0,0,0,0.001)"}
                stroke={isSectionSel ? "#3B82F6" : "transparent"}
                strokeWidth={isSectionSel ? 1.5 : 0}
                dash={isSectionSel ? [6, 4] : undefined}
                cornerRadius={6}
                onClick={() => setSelection({ kind: "section", name: sectionName })}
                onTap={() => setSelection({ kind: "section", name: sectionName })}
              />
              {/* Section label tab, top-left of bbox. Click selects section
                  (so the bg outline appears and the inspector switches). */}
              {sectionName ? (
                <Group
                  x={bbox.x}
                  y={bbox.y - 22}
                  onClick={() => setSelection({ kind: "section", name: sectionName })}
                  onTap={() => setSelection({ kind: "section", name: sectionName })}
                >
                  <Rect
                    width={Math.max(80, sectionName.length * 8 + 16)}
                    height={18}
                    fill={isSectionSel ? "#3B82F6" : "#1F2937"}
                    cornerRadius={4}
                    opacity={0.85}
                  />
                  <KText
                    x={8}
                    y={2}
                    text={sectionName}
                    fill="#FFFFFF"
                    fontSize={12}
                    fontStyle="600"
                  />
                </Group>
              ) : null}

              {/* Seats — each retains its own drag for fine adjustment. */}
              {sectionSeats.map(s => {
                const isSel = selection?.kind === "seat" && selection.id === s.id
                const color = seatColor(s.ticket_type_id)
                return (
                  <Circle
                    key={s.id}
                    x={s.x} y={s.y} radius={SEAT_RADIUS}
                    fill={color}
                    stroke={isSel ? "#0F172A" : "#FFFFFF"}
                    strokeWidth={isSel ? 2 : 1}
                    draggable
                    onClick={() => setSelection({ kind: "seat", id: s.id })}
                    onTap={() => setSelection({ kind: "seat", id: s.id })}
                    onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
                      const t = e.target
                      onSeatMove(s.id, Math.round(t.x()), Math.round(t.y()))
                    }}
                  />
                )
              })}
            </Group>
          )
        })}
      </Layer>
    </Stage>
  )
}

// Bounding box of a section, padded so the hit-rect has a comfortable margin
// outside the outermost seats.
function computeBBox(seats: EditorSeat[]): { x: number; y: number; width: number; height: number } {
  if (seats.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const s of seats) {
    if (s.x < minX) minX = s.x
    if (s.y < minY) minY = s.y
    if (s.x > maxX) maxX = s.x
    if (s.y > maxY) maxY = s.y
  }
  return {
    x:      minX - SEAT_RADIUS - SECTION_PADDING,
    y:      minY - SEAT_RADIUS - SECTION_PADDING,
    width:  (maxX - minX) + 2 * (SEAT_RADIUS + SECTION_PADDING),
    height: (maxY - minY) + 2 * (SEAT_RADIUS + SECTION_PADDING),
  }
}
