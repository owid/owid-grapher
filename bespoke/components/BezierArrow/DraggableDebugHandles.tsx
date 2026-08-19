import { useCallback, useRef } from "react"
import { useDrag } from "@visx/drag"

import type { Point } from "@ourworldindata/utils"

interface DraggableDebugHandlesProps {
    start: Point
    end: Point
    startHandleOffset: Point
    endHandleOffset: Point
    startHandle?: Point
    endHandle?: Point
    onOffsetsChange?: (offsets: { start: Point; end: Point }) => void
}

const DEBUG_COLOR = "#af488f"

export function DraggableDebugHandles({
    start,
    end,
    startHandleOffset,
    endHandleOffset,
    startHandle,
    endHandle,
    onOffsetsChange,
}: DraggableDebugHandlesProps) {
    const startControlPoint: Point = startHandle ?? {
        x: start.x + startHandleOffset.x,
        y: start.y + startHandleOffset.y,
    }
    const endControlPoint: Point = endHandle ?? {
        x: end.x + endHandleOffset.x,
        y: end.y + endHandleOffset.y,
    }

    const startOffsetAtDragStart = useRef(startHandleOffset)
    const endOffsetAtDragStart = useRef(endHandleOffset)

    const startDrag = useDrag({
        resetOnStart: true,
        snapToPointer: false,
        onDragStart: () => {
            startOffsetAtDragStart.current = startHandleOffset
        },
        onDragMove: ({ dx, dy }) => {
            const newOffset: Point = {
                x: startOffsetAtDragStart.current.x + dx,
                y: startOffsetAtDragStart.current.y + dy,
            }
            onOffsetsChange?.({ start: newOffset, end: endHandleOffset })
        },
        onDragEnd: ({ dx, dy }) => {
            const finalStart: Point = {
                x: startOffsetAtDragStart.current.x + dx,
                y: startOffsetAtDragStart.current.y + dy,
            }
            // eslint-disable-next-line no-console
            console.log(
                `Final offsets: startHandleOffset={{ x: ${Math.round(finalStart.x)}, y: ${Math.round(finalStart.y)} }} endHandleOffset={{ x: ${Math.round(endHandleOffset.x)}, y: ${Math.round(endHandleOffset.y)} }}`
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
            const newOffset: Point = {
                x: endOffsetAtDragStart.current.x + dx,
                y: endOffsetAtDragStart.current.y + dy,
            }
            onOffsetsChange?.({ start: startHandleOffset, end: newOffset })
        },
        onDragEnd: ({ dx, dy }) => {
            const finalEnd: Point = {
                x: endOffsetAtDragStart.current.x + dx,
                y: endOffsetAtDragStart.current.y + dy,
            }
            // eslint-disable-next-line no-console
            console.log(
                `Final offsets: startHandleOffset={{ x: ${Math.round(startHandleOffset.x)}, y: ${Math.round(startHandleOffset.y)} }} endHandleOffset={{ x: ${Math.round(finalEnd.x)}, y: ${Math.round(finalEnd.y)} }}`
            )
            onOffsetsChange?.({ start: startHandleOffset, end: finalEnd })
        },
    })

    const isDragging = startDrag.isDragging || endDrag.isDragging

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
                x1={start.x}
                y1={start.y}
                x2={startControlPoint.x}
                y2={startControlPoint.y}
                stroke={DEBUG_COLOR}
                strokeWidth={1}
                style={{ pointerEvents: "none" }}
            />
            <line
                x1={end.x}
                y1={end.y}
                x2={endControlPoint.x}
                y2={endControlPoint.y}
                stroke={DEBUG_COLOR}
                strokeWidth={1}
                style={{ pointerEvents: "none" }}
            />

            {/* Draggable control point circles */}
            <circle
                cx={startControlPoint.x}
                cy={startControlPoint.y}
                r={6}
                fill={DEBUG_COLOR}
                style={{
                    cursor: startDrag.isDragging ? "grabbing" : "grab",
                }}
                onMouseDown={startDrag.dragStart}
                onTouchStart={startDrag.dragStart}
            />
            <circle
                cx={endControlPoint.x}
                cy={endControlPoint.y}
                r={6}
                fill={DEBUG_COLOR}
                style={{
                    cursor: endDrag.isDragging ? "grabbing" : "grab",
                }}
                onMouseDown={endDrag.dragStart}
                onTouchStart={endDrag.dragStart}
            />
        </g>
    )
}
