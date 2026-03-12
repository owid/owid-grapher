import React, { useMemo } from "react"
import cx from "classnames"

import { DraggableDebugHandles } from "./DraggableDebugHandles"

export type Coords = [number, number]

export type HeadAnchor = "start" | "end" | "both"

export interface BezierArrowProps {
    /** Start coordinates */
    start?: Coords
    /** End coordinates */
    end?: Coords

    /** Bezier handle offset from start coordinates */
    startHandleOffset?: Coords
    /** Bezier handle offset from end coordinates */
    endHandleOffset?: Coords

    /** Start bezier handle coordinates; if given, startHandleOffset is ignored */
    startHandle?: Coords
    /** End bezier handle coordinates; if given, endHandleOffset is ignored */
    endHandle?: Coords

    /** Position of the arrow head */
    headAnchor?: HeadAnchor
    /** Length of the arrow head */
    headLength?: number
    /** Angle of the arrow head */
    headAngle?: number

    /** Renders bezier handle points for debugging */
    debug?: boolean

    // Class name and styling
    className?: string
    width?: number
    color?: string
    opacity?: number
}

export function BezierArrow({
    start = [0, 0],
    end = [50, 0],
    startHandleOffset = [0, 0],
    endHandleOffset = [0, 0],
    startHandle,
    endHandle,
    headAnchor = "end",
    headLength,
    headAngle = 55,
    className,
    width = 1,
    color = "black",
    opacity = 1,
    debug = false,
}: BezierArrowProps) {
    const [debugOffsets, setDebugOffsets] = React.useState<{
        start: Coords
        end: Coords
    } | null>(null)

    const effectiveStartOffset =
        debug && debugOffsets ? debugOffsets.start : startHandleOffset
    const effectiveEndOffset =
        debug && debugOffsets ? debugOffsets.end : endHandleOffset

    const startControlPoint =
        startHandle ?? addOffset(start, effectiveStartOffset)
    const endControlPoint = endHandle ?? addOffset(end, effectiveEndOffset)

    const path = useMemo(() => {
        const headOptions = {
            length: headLength ?? clamp(0.08 * dist(start, end), 4, 8),
            theta: headAngle,
        }

        return buildArrow(
            start,
            end,
            startControlPoint,
            endControlPoint,
            headAnchor,
            headOptions
        )
    }, [
        start,
        end,
        startControlPoint,
        endControlPoint,
        headAnchor,
        headLength,
        headAngle,
    ])

    return (
        <g className={cx("arrow", className)}>
            {debug && (
                <DraggableDebugHandles
                    start={start}
                    end={end}
                    startHandleOffset={startHandleOffset}
                    endHandleOffset={endHandleOffset}
                    startHandle={startHandle}
                    endHandle={endHandle}
                    onOffsetsChange={setDebugOffsets}
                />
            )}

            <path
                d={path}
                style={{ stroke: color, strokeWidth: width, opacity: opacity }}
            />
        </g>
    )
}

function buildArrow(
    start: Coords,
    end: Coords,
    startHandle: Coords,
    endHandle: Coords,
    headAnchor: HeadAnchor,
    headOptions: { length?: number; theta?: number }
) {
    let d = bezierCurve(start, end, startHandle, endHandle)

    if (headAnchor === "start" || headAnchor === "both") {
        const handle = equals(start, startHandle) ? end : startHandle
        d += arrowHead(start, handle, headOptions)
    }

    if (headAnchor === "end" || headAnchor === "both") {
        const handle = equals(end, endHandle) ? start : endHandle
        d += arrowHead(end, handle, headOptions)
    }

    return d
}

function arrowHead(
    point: Coords,
    handle: Coords,
    { length = 4, theta = 45 } = {}
) {
    const xLen = handle[0] - point[0]
    const yLen = handle[1] - point[1]

    const distance = Math.sqrt(Math.pow(xLen, 2) + Math.pow(yLen, 2))
    const ratio = length / distance

    const mid: Coords = [point[0] + xLen * ratio, point[1] + yLen * ratio]

    function rotate(p: Coords, pivot: Coords, deg: number): Coords {
        const rad = (deg * Math.PI) / 180
        return [
            pivot[0] +
                (p[0] - pivot[0]) * Math.cos(rad) -
                (p[1] - pivot[1]) * Math.sin(rad),
            pivot[1] +
                (p[0] - pivot[0]) * Math.sin(rad) +
                (p[1] - pivot[1]) * Math.cos(rad),
        ]
    }

    return [
        "M",
        rotate(mid, point, theta),
        "L",
        point,
        "L",
        rotate(mid, point, -theta),
    ].join(" ")
}

const bezierCurve = (
    start: Coords,
    end: Coords,
    startHandle: Coords,
    endHandle: Coords
) => ["M", start, "C", startHandle, endHandle, end].join(" ")

const addOffset = (p: Coords, o: Coords): Coords => [p[0] + o[0], p[1] + o[1]]

const equals = (p1: Coords, p2: Coords) => p1[0] === p2[0] && p1[1] === p2[1]

const clamp = (n: number, min = 0, max = 1) => Math.min(Math.max(n, min), max)

const dist = (p1: Coords, p2: Coords) =>
    Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2))
