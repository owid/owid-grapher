import {
    MARKER_LABEL_COLOR,
    MARKER_LINE_COLOR,
    MARKER_SHADING_COLOR,
} from "../helpers/PovertyProjectionsConstants.js"

const LABEL_FONT_SIZE = 11

/** Marks the projection period: a vertical dashed line at the first
 * projected year — labeled like the comparison line of the published
 * grapher chart — and, optionally, a light shading over the projected
 * years. */
export function ProjectionsMarker({
    xScale,
    firstProjectionYear,
    lastYear,
    boundedHeight,
    showShading = false,
    compact = false,
}: {
    xScale: (year: number) => number
    firstProjectionYear: number
    lastYear: number
    boundedHeight: number
    /** Shade the projected years (used by the stacked-area variant) */
    showShading?: boolean
    /** Shorten the label on narrow charts */
    compact?: boolean
}) {
    const x = xScale(firstProjectionYear)
    const label = compact ? "Projections →" : "→ Projections by the World Bank"

    return (
        <g className="poverty-projections-marker">
            {showShading && (
                <rect
                    x={x}
                    y={0}
                    width={Math.max(xScale(lastYear) - x, 0)}
                    height={boundedHeight}
                    fill={MARKER_SHADING_COLOR}
                />
            )}
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
