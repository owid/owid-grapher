import {
    MARKER_LABEL_COLOR,
    MARKER_LINE_COLOR,
    MARKER_SHADING_COLOR,
} from "../helpers/PovertyProjectionsConstants.js"

const LABEL_FONT_SIZE = 11

/** Marks the projection period: a light shading over the projected years
 * and a vertical dashed line at the year the projected (dotted) segments
 * branch off, labeled like the comparison line of the published grapher
 * chart. */
export function ProjectionsMarker({
    xScale,
    boundaryYear,
    lastYear,
    boundedHeight,
    compact = false,
}: {
    xScale: (year: number) => number
    /** The year the projected segments branch off (the last pre-projection
     * year, so the shading and the dotted lines coincide) */
    boundaryYear: number
    lastYear: number
    boundedHeight: number
    /** Shorten the label on narrow charts */
    compact?: boolean
}) {
    const x = xScale(boundaryYear)
    const label = compact ? "Projections →" : "→ Projections by the World Bank"

    return (
        <g className="poverty-projections-marker">
            <rect
                x={x}
                y={0}
                width={Math.max(xScale(lastYear) - x, 0)}
                height={boundedHeight}
                fill={MARKER_SHADING_COLOR}
            />
            <line
                x1={x}
                y1={-4}
                x2={x}
                y2={boundedHeight}
                stroke={MARKER_LINE_COLOR}
                strokeDasharray="2 2"
                opacity={0.9}
            />
            <text
                x={x + 5}
                y={-6}
                fontSize={LABEL_FONT_SIZE}
                fill={MARKER_LABEL_COLOR}
            >
                {label}
            </text>
        </g>
    )
}
