import React, { useState, useRef, useCallback } from "react"
import { Coords } from "./Arrow"

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
    const [dragging, setDragging] = useState<"start" | "end" | null>(null)
    const [offsets, setOffsets] = useState({
        start: startHandleOffset,
        end: endHandleOffset,
    })
    const svgRef = useRef<SVGGElement>(null)

    // Calculate actual control point positions
    const startControlPoint = startHandle ?? [
        start[0] + offsets.start[0],
        start[1] + offsets.start[1],
    ]
    const endControlPoint = endHandle ?? [
        end[0] + offsets.end[0],
        end[1] + offsets.end[1],
    ]

    const getSVGCoordinates = useCallback(
        (clientX: number, clientY: number): Coords => {
            const svg = svgRef.current?.ownerSVGElement
            if (!svg) return [clientX, clientY]

            const point = svg.createSVGPoint()
            point.x = clientX
            point.y = clientY

            const ctm = svg.getScreenCTM()
            if (ctm) {
                const transformed = point.matrixTransform(ctm.inverse())
                return [transformed.x, transformed.y]
            }

            return [clientX, clientY]
        },
        []
    )

    const handleMouseDown = useCallback(
        (handle: "start" | "end") => (e: React.MouseEvent) => {
            e.preventDefault()
            e.stopPropagation()
            setDragging(handle)
        },
        []
    )

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!dragging) return

            const [x, y] = getSVGCoordinates(e.clientX, e.clientY)
            const anchor = dragging === "start" ? start : end
            const newOffset: Coords = [x - anchor[0], y - anchor[1]]

            setOffsets((prev) => {
                const newOffsets = {
                    ...prev,
                    [dragging]: newOffset,
                }

                // Log to console while dragging
                console.log(
                    `Arrow offsets - start: [${Math.round(newOffsets.start[0])}, ${Math.round(newOffsets.start[1])}], end: [${Math.round(newOffsets.end[0])}, ${Math.round(newOffsets.end[1])}]`
                )

                // Notify parent to update arrow in real-time
                onOffsetsChange?.(newOffsets)

                return newOffsets
            })
        },
        [dragging, getSVGCoordinates, start, end, onOffsetsChange]
    )

    const handleMouseUp = useCallback(() => {
        if (dragging) {
            // Log final values in a format that's easy to copy
            console.log(
                `Final offsets: startHandleOffset={[${Math.round(offsets.start[0])}, ${Math.round(offsets.start[1])}]} endHandleOffset={[${Math.round(offsets.end[0])}, ${Math.round(offsets.end[1])}]}`
            )
            setDragging(null)
        }
    }, [dragging, offsets])

    // Add global event listeners for mouse move and up
    React.useEffect(() => {
        if (dragging) {
            window.addEventListener("mousemove", handleMouseMove)
            window.addEventListener("mouseup", handleMouseUp)

            return () => {
                window.removeEventListener("mousemove", handleMouseMove)
                window.removeEventListener("mouseup", handleMouseUp)
            }
        }
        return undefined
    }, [dragging, handleMouseMove, handleMouseUp])

    return (
        <g className="debug" ref={svgRef}>
            {/* Control point circles */}
            <circle
                cx={startControlPoint[0]}
                cy={startControlPoint[1]}
                r={6}
                fill={
                    dragging === "start" ? "orange" : "rgba(255, 165, 0, 0.3)"
                }
                stroke="orange"
                strokeWidth={2}
                style={{
                    cursor: dragging === "start" ? "grabbing" : "grab",
                    pointerEvents: "all",
                }}
                onMouseDown={handleMouseDown("start")}
            />
            <circle
                cx={endControlPoint[0]}
                cy={endControlPoint[1]}
                r={6}
                fill={dragging === "end" ? "orange" : "rgba(255, 165, 0, 0.3)"}
                stroke="orange"
                strokeWidth={2}
                style={{
                    cursor: dragging === "end" ? "grabbing" : "grab",
                    pointerEvents: "all",
                }}
                onMouseDown={handleMouseDown("end")}
            />

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
        </g>
    )
}
