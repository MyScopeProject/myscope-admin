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
  | { kind: "seat";  id: string }
  | { kind: "decor"; id: string }
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
  setSeats: (updater: (arr: EditorSeat[]) => EditorSeat[]) => void
  setDecor: (updater: (arr: EditorDecor[]) => EditorDecor[]) => void
  selection: Selection
  setSelection: (sel: Selection) => void
  // Tier color resolver — null/missing ticket_type_id returns the fallback.
  seatColor: (ticketTypeId: string) => string
}

export default function BuilderCanvas(props: Props) {
  const {
    viewbox, stageSize, stagePos, stageScale,
    setStagePos, setStageScale,
    seats, decor, setSeats, setDecor,
    selection, setSelection,
    seatColor,
  } = props

  const stageRef = useRef<Konva.Stage | null>(null)

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
                  setDecor(arr => arr.map(x =>
                    x.id === d.id ? { ...x, x: Math.round(t.x()), y: Math.round(t.y()) } : x))
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
          return (
            <KText
              key={d.id}
              x={d.x} y={d.y}
              text={d.label ?? "LABEL"}
              fill={d.color ?? "#374151"}
              fontSize={16} fontStyle="bold"
              draggable
              onClick={() => setSelection({ kind: "decor", id: d.id })}
              onTap={() => setSelection({ kind: "decor", id: d.id })}
              stroke={isSel ? "#3B82F6" : undefined}
              strokeWidth={isSel ? 1 : 0}
              onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
                const t = e.target
                setDecor(arr => arr.map(x =>
                  x.id === d.id ? { ...x, x: Math.round(t.x()), y: Math.round(t.y()) } : x))
              }}
            />
          )
        })}

        {/* Seats */}
        {seats.map(s => {
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
                setSeats(arr => arr.map(x =>
                  x.id === s.id ? { ...x, x: Math.round(t.x()), y: Math.round(t.y()) } : x))
              }}
            />
          )
        })}
      </Layer>
    </Stage>
  )
}
