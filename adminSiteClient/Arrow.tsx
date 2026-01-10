import React, { useMemo } from "react"
import cx from "classnames"

import { DraggableDebugHandles } from "./DraggableDebugHandles"

export type Coords = [number, number]

export type HeadAnchor = "start" | "end" | "both"

export interface ArrowProps
    extends Omit<React.SVGProps<SVGGElement>, "start" | "end"> {
    /** start coordinates */
    start?: Coords
    /** end coordinates */
    end?: Coords

    /** bezier handle offset from start coordinates */
    startHandleOffset?: Coords
    /** bezier handle offset from end coordinates */
    endHandleOffset?: Coords

    /** start bezier handle coordinates; if given, startHandleOffset is ignored */
    startHandle?: Coords
    /** end bezier handle coordinates; if given, endHandleOffset is ignored */
    endHandle?: Coords

    /** position of the arrow head */
    headAnchor?: HeadAnchor
    /** length of the arrow head */
    headLength?: number
    /** angle of the arrow head */
    headAngle?: number

    /** convenience inline overrides for CSS vars */
    width?: number
    color?: string
    opacity?: number

    /** renders bezier handle points for debugging */
    debug?: boolean
}

const dist = (p1: Coords, p2: Coords) =>
    Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2))

const clamp = (n: number, min = 0, max = 1) => Math.min(Math.max(n, min), max)

const equals = (p1: Coords, p2: Coords) => p1[0] === p2[0] && p1[1] === p2[1]

const addOffset = (p: Coords, o: Coords): Coords => [p[0] + o[0], p[1] + o[1]]

const bezierCurve = (
    start: Coords,
    end: Coords,
    startHandle: Coords,
    endHandle: Coords
) => ["M", start, "C", startHandle, endHandle, end].join(" ")

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
    width = 1,
    color = "black",
    opacity = 1,
    debug = false,
    className,
    ...rest
}: ArrowProps) {
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
        <g className={cx("arrow", className)} {...rest}>
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
