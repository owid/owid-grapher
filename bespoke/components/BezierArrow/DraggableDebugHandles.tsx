import { useCallback, useRef } from "react"
import { useDrag } from "@visx/drag"
import type { Coords } from "./BezierArrow"

interface DraggableDebugHandlesProps {
    start: Coords
    end: Coords
    startHandleOffset: Coords
    endHandleOffset: Coords
    startHandle?: Coords
    endHandle?: Coords
    onOffsetsChange?: (offsets: { start: Coords; end: Coords }) => void
}

export function DraggableDebugHandles({
    start,
    end,
    startHandleOffset,
    endHandleOffset,
    startHandle,
    endHandle,
    onOffsetsChange,
}: DraggableDebugHandlesProps) {
    const startControlPoint: Coords = startHandle ?? [
        start[0] + startHandleOffset[0],
        start[1] + startHandleOffset[1],
    ]
    const endControlPoint: Coords = endHandle ?? [
        end[0] + endHandleOffset[0],
        end[1] + endHandleOffset[1],
    ]

    // Capture offsets at drag start so deltas are always relative to
    // a stable reference, avoiding double-counting when onOffsetsChange
    // updates the props mid-drag.
    const startOffsetAtDragStart = useRef(startHandleOffset)
    const endOffsetAtDragStart = useRef(endHandleOffset)

    const startDrag = useDrag({
        resetOnStart: true,
        snapToPointer: false,
        onDragStart: () => {
            startOffsetAtDragStart.current = startHandleOffset
        },
        onDragMove: ({ dx, dy }) => {
            const newOffset: Coords = [
                startOffsetAtDragStart.current[0] + dx,
                startOffsetAtDragStart.current[1] + dy,
            ]
            onOffsetsChange?.({ start: newOffset, end: endHandleOffset })
        },
        onDragEnd: ({ dx, dy }) => {
            const finalStart: Coords = [
                startOffsetAtDragStart.current[0] + dx,
                startOffsetAtDragStart.current[1] + dy,
            ]
            // eslint-disable-next-line no-console
            console.log(
                `Final offsets: startHandleOffset={[${Math.round(finalStart[0])}, ${Math.round(finalStart[1])}]} endHandleOffset={[${Math.round(endHandleOffset[0])}, ${Math.round(endHandleOffset[1])}]}`
            )
            onOffsetsChange?.({ start: finalStart, end: endHandleOffset })
        },
    })

    const endDrag = useDrag({
        resetOnStart: true,
        snapToPointer: false,
        onDragStart: () => {
            endOffsetAtDragStart.current = endHandleOffset
        },
        onDragMove: ({ dx, dy }) => {
            const newOffset: Coords = [
                endOffsetAtDragStart.current[0] + dx,
                endOffsetAtDragStart.current[1] + dy,
            ]
            onOffsetsChange?.({ start: startHandleOffset, end: newOffset })
        },
        onDragEnd: ({ dx, dy }) => {
            const finalEnd: Coords = [
                endOffsetAtDragStart.current[0] + dx,
                endOffsetAtDragStart.current[1] + dy,
            ]
            // eslint-disable-next-line no-console
            console.log(
                `Final offsets: startHandleOffset={[${Math.round(startHandleOffset[0])}, ${Math.round(startHandleOffset[1])}]} endHandleOffset={[${Math.round(finalEnd[0])}, ${Math.round(finalEnd[1])}]}`
            )
            onOffsetsChange?.({ start: startHandleOffset, end: finalEnd })
        },
    })

    const isDragging = startDrag.isDragging || endDrag.isDragging

    // Forward move/end events to whichever handle is active
    const handleMove = useCallback(
        (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
            if (startDrag.isDragging) startDrag.dragMove(e)
            if (endDrag.isDragging) endDrag.dragMove(e)
        },
        [startDrag, endDrag]
    )
    const handleUp = useCallback(
        (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
            if (startDrag.isDragging) startDrag.dragEnd(e)
            if (endDrag.isDragging) endDrag.dragEnd(e)
        },
        [startDrag, endDrag]
    )

    return (
        <g
            className="debug"
            style={{ userSelect: "none" }}
            onMouseMove={handleMove}
            onMouseUp={handleUp}
            onTouchMove={handleMove}
            onTouchEnd={handleUp}
        >
            {/* Invisible overlay to capture drag events outside the circles */}
            {isDragging && (
                <rect
                    width="100%"
                    height="100%"
                    fill="transparent"
                    style={{ cursor: "grabbing" }}
                />
            )}

            {/* Lines from anchor points to control points */}
            <line
                x1={start[0]}
                y1={start[1]}
                x2={startControlPoint[0]}
                y2={startControlPoint[1]}
                stroke="orange"
                strokeWidth={1}
                style={{ pointerEvents: "none" }}
            />
            <line
                x1={end[0]}
                y1={end[1]}
                x2={endControlPoint[0]}
                y2={endControlPoint[1]}
                stroke="orange"
                strokeWidth={1}
                style={{ pointerEvents: "none" }}
            />

            {/* Draggable control point circles */}
            <circle
                cx={startControlPoint[0]}
                cy={startControlPoint[1]}
                r={6}
                fill={
                    startDrag.isDragging ? "orange" : "rgba(255, 165, 0, 0.3)"
                }
                stroke="orange"
                strokeWidth={2}
                style={{
                    cursor: startDrag.isDragging ? "grabbing" : "grab",
                }}
                onMouseDown={startDrag.dragStart}
                onTouchStart={startDrag.dragStart}
            />
            <circle
                cx={endControlPoint[0]}
                cy={endControlPoint[1]}
                r={6}
                fill={endDrag.isDragging ? "orange" : "rgba(255, 165, 0, 0.3)"}
                stroke="orange"
                strokeWidth={2}
                style={{
                    cursor: endDrag.isDragging ? "grabbing" : "grab",
                }}
                onMouseDown={endDrag.dragStart}
                onTouchStart={endDrag.dragStart}
            />
        </g>
    )
}
