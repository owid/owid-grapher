import React, { CSSProperties, useMemo } from "react"

/**
 * Arrow, either as straight line or Bézier curve.
 *
 * CSS variables supported (can be set on the wrapping <g> or ancestors):
 * - `--arrow-color`: color of the arrow (default: black)
 * - `--arrow-width`: stroke width of the arrow (default: 1)
 * - `--arrow-opacity`: opacity of the arrow (default: 1)
 *
 * The rendered markup is composed of:
 * - `.arrow`: group
 * - `.arrow__shape`: path
 */

export type Coords = [number, number]

export type HeadAnchor = "start" | "end" | "both"

export interface ArrowProps<D = unknown>
    extends Omit<React.SVGProps<SVGGElement>, "start" | "end"> {
    /** start coordinates */
    start?: Coords
    /** end coordinates */
    end?: Coords

    /** Optional tuple of data items used with xGet/yGet to derive start & end */
    data?: [D, D]
    /** Indexes to pass into xGet/yGet when deriving from data */
    xIndex?: number
    yIndex?: number

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

    /** Optional accessors to map data -> coordinates (used when `data` is provided) */
    xGet?: (d: D, xIndex?: number) => number
    yGet?: (d: D, yIndex?: number) => number
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

export function Arrow<D = unknown>({
    start = [0, 0],
    end = [50, 0],
    data,
    xIndex = 0,
    yIndex = 0,
    startHandleOffset = [0, 0],
    endHandleOffset = [0, 0],
    startHandle,
    endHandle,
    headAnchor = "end",
    headLength,
    headAngle = 55,
    width: widthOverride,
    color: colorOverride,
    opacity: opacityOverride,
    debug = false,
    xGet,
    yGet,
    className,
    style,
    ...rest
}: ArrowProps<D>) {
    // Resolve start/end from `data` if accessors are provided
    const [_start, _end] = useMemo<readonly [Coords, Coords]>(() => {
        if (data && xGet && yGet) {
            const s: Coords = [xGet(data[0], xIndex), yGet(data[0], yIndex)]
            const e: Coords = [xGet(data[1], xIndex), yGet(data[1], yIndex)]
            return [s, e] as const
        }
        return [start, end] as const
    }, [data, start, end, xGet, yGet, xIndex, yIndex])

    const _startHandle = useMemo<Coords>(
        () =>
            startHandle ? startHandle : addOffset(_start, startHandleOffset),
        [_start, startHandle, startHandleOffset]
    )

    const _endHandle = useMemo<Coords>(
        () => (endHandle ? endHandle : addOffset(_end, endHandleOffset)),
        [_end, endHandle, endHandleOffset]
    )

    const headOptions = useMemo(
        () => ({
            length: headLength ?? clamp(0.08 * dist(_start, _end), 4, 8),
            theta: headAngle,
        }),
        [_start, _end, headLength, headAngle]
    )

    const d = useMemo(
        () =>
            buildArrow(
                _start,
                _end,
                _startHandle,
                _endHandle,
                headAnchor,
                headOptions
            ),
        [_start, _end, _startHandle, _endHandle, headAnchor, headOptions]
    )

    // Support CSS custom properties like the Svelte version
    const groupStyle: CSSProperties = {
        ...(style || {}),
        // Allow overriding via props; empty string leaves inheritance in place
        ["--_color" as any]: colorOverride ?? "",
        ["--_width" as any]: widthOverride ?? "",
        ["--_opacity" as any]: opacityOverride ?? "",
    }

    return (
        <g
            className={["arrow", className].filter(Boolean).join(" ")}
            style={groupStyle}
            {...rest}
        >
            {debug && (
                <g className="debug">
                    {[_startHandle, _endHandle].map((coords, i) => (
                        <circle
                            key={`c-${i}`}
                            cx={coords[0]}
                            cy={coords[1]}
                            r={5}
                        />
                    ))}
                    {[
                        [_start, _startHandle] as const,
                        [_end, _endHandle] as const,
                    ].map(([s, e], i) => (
                        <line
                            key={`l-${i}`}
                            x1={s[0]}
                            y1={s[1]}
                            x2={e[0]}
                            y2={e[1]}
                        />
                    ))}
                </g>
            )}

            <path
                className="arrow__shape"
                d={d}
                // Mirror the original SCSS variable behavior
                style={
                    {
                        stroke: "var(--_color, var(--arrow-color, var(--c-ui-black, black)))",
                        strokeWidth: "var(--_width, var(--arrow-width, 1))",
                        strokeLinejoin: "round",
                        strokeLinecap: "round",
                        fill: "none",
                        opacity: "var(--_opacity, var(--arrow-opacity, 1))",
                    } as CSSProperties
                }
            />

            {/* Optional basic styles analogous to the Svelte .debug block */}
            {debug && (
                <style>{`
          .debug circle { fill: none; stroke: orange; }
          .debug line { stroke: orange; }
        `}</style>
            )}
        </g>
    )
}
