import * as React from "react"
import * as _ from "lodash-es"
import cx from "classnames"
import { Point } from "@ourworldindata/utils"
import { GRAY_100 } from "../color/ColorConstants.js"

export type HeadAnchor = "start" | "end" | "both"

export interface BezierArrowProps {
    /** Start coordinates */
    start: Point
    /** End coordinates */
    end: Point

    /** Bezier handle offset from start coordinates */
    startHandleOffset?: Point
    /** Bezier handle offset from end coordinates */
    endHandleOffset?: Point

    /** Start bezier handle coordinates; if given, startHandleOffset is ignored */
    startHandle?: Point
    /** End bezier handle coordinates; if given, endHandleOffset is ignored */
    endHandle?: Point

    headAnchor?: HeadAnchor
    headLength?: number
    headAngle?: number
    headStyle?: "solid" | "line"

    className?: string
    width?: number
    color?: string
    opacity?: number
    lineCaps?: "round" | "sharp"
    style?: React.CSSProperties
}

export function BezierArrow({
    start,
    end,
    startHandleOffset = { x: 0, y: 0 },
    endHandleOffset = { x: 0, y: 0 },
    startHandle,
    endHandle,
    headAnchor = "end",
    headLength,
    headAngle = 45,
    headStyle = "line",
    lineCaps = "round",
    className,
    width = 1,
    color = GRAY_100,
    opacity = 1,
    style,
}: BezierArrowProps): React.ReactElement {
    const startControlPoint = startHandle ?? addOffset(start, startHandleOffset)
    const endControlPoint = endHandle ?? addOffset(end, endHandleOffset)

    const headOptions = {
        length: headLength ?? _.clamp(0.08 * dist(start, end), 4, 6),
        theta: headAngle,
        closed: headStyle === "solid",
    }

    const curvePath = bezierCurve(
        start,
        end,
        startControlPoint,
        endControlPoint
    )

    const startHeadPath =
        headAnchor === "start" || headAnchor === "both"
            ? arrowHead(
                  start,
                  resolveHandle(start, startControlPoint, end),
                  headOptions
              )
            : undefined

    const endHeadPath =
        headAnchor === "end" || headAnchor === "both"
            ? arrowHead(
                  end,
                  resolveHandle(end, endControlPoint, start),
                  headOptions
              )
            : undefined

    const curveStyle = {
        stroke: color,
        strokeWidth: width,
        strokeLinecap: lineCaps === "round" ? "round" : "butt",
        strokeLinejoin: lineCaps === "round" ? "round" : "miter",
        fill: "none",
    } as const
    const arrowHeadStyle = {
        ...curveStyle,
        fill: headOptions.closed ? color : "none",
    }

    return (
        <g className={cx("arrow", className)} opacity={opacity} style={style}>
            <path d={curvePath} style={curveStyle} />
            {startHeadPath && <path d={startHeadPath} style={arrowHeadStyle} />}
            {endHeadPath && <path d={endHeadPath} style={arrowHeadStyle} />}
        </g>
    )
}

function resolveHandle(
    point: Point,
    controlPoint: Point,
    fallback: Point
): Point {
    return equals(point, controlPoint) ? fallback : controlPoint
}

function arrowHead(
    point: Point,
    handle: Point,
    { length = 4, theta = 45, closed = false } = {}
): string {
    let xLen = handle.x - point.x
    let yLen = handle.y - point.y

    let distance = Math.sqrt(Math.pow(xLen, 2) + Math.pow(yLen, 2))
    if (distance === 0) {
        // No direction information — default to a horizontal head pointing right
        xLen = -1
        yLen = 0
        distance = 1
    }

    const ratio = length / distance

    const mid: Point = {
        x: point.x + xLen * ratio,
        y: point.y + yLen * ratio,
    }

    function rotate(p: Point, pivot: Point, deg: number): Point {
        const rad = (deg * Math.PI) / 180
        return {
            x:
                pivot.x +
                (p.x - pivot.x) * Math.cos(rad) -
                (p.y - pivot.y) * Math.sin(rad),
            y:
                pivot.y +
                (p.x - pivot.x) * Math.sin(rad) +
                (p.y - pivot.y) * Math.cos(rad),
        }
    }

    return [
        "M",
        format(rotate(mid, point, theta)),
        "L",
        format(point),
        "L",
        format(rotate(mid, point, -theta)),
        closed ? "Z" : "",
    ].join(" ")
}

const bezierCurve = (
    start: Point,
    end: Point,
    startHandle: Point,
    endHandle: Point
): string =>
    [
        "M",
        format(start),
        "C",
        format(startHandle),
        format(endHandle),
        format(end),
    ].join(" ")

const format = (p: Point): string => `${p.x},${p.y}`

const addOffset = (p: Point, o: Point): Point => ({
    x: p.x + o.x,
    y: p.y + o.y,
})

const equals = (p1: Point, p2: Point): boolean => p1.x === p2.x && p1.y === p2.y

const dist = (p1: Point, p2: Point): number =>
    Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
