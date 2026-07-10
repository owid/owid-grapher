import { Bounds } from "@ourworldindata/utils"
import { GRAPHER_DARK_TEXT } from "@ourworldindata/grapher/src/color/ColorConstants.js"

// Grapher's axis styling (see grapher's AxisViews.tsx)
const TICK_FONT_SIZE = 12
const GRID_LINE_COLOR = "#ddd"
const GRID_LINE_DASH_PATTERN = "4,4"
const SOLID_TICK_COLOR = "#999"
const TICK_PADDING = 5

/** The width needed left of the plot for the y-axis tick labels */
export function getYAxisWidth(
    ticks: number[],
    formatTick: (tick: number) => string
): number {
    const maxLabelWidth = Math.max(
        ...ticks.map(
            (tick) =>
                Bounds.forText(formatTick(tick), { fontSize: TICK_FONT_SIZE })
                    .width
        ),
        0
    )
    return Math.ceil(maxLabelWidth) + TICK_PADDING
}

/** Horizontal gridlines with tick labels left of the plot, styled like
 * grapher's y-axis: dashed light gridlines, a solid darker zero line, and
 * right-aligned labels */
export function YAxisGrid({
    yScale,
    ticks,
    boundedWidth,
    formatTick,
}: {
    yScale: (value: number) => number
    ticks: number[]
    boundedWidth: number
    formatTick: (tick: number) => string
}) {
    return (
        <g className="poverty-projections-axis">
            {ticks.map((tick) => (
                <g key={tick}>
                    <line
                        x1={0}
                        y1={yScale(tick)}
                        x2={boundedWidth}
                        y2={yScale(tick)}
                        stroke={tick === 0 ? SOLID_TICK_COLOR : GRID_LINE_COLOR}
                        strokeWidth={1}
                        strokeDasharray={
                            tick === 0 ? undefined : GRID_LINE_DASH_PATTERN
                        }
                    />
                    <text
                        x={-TICK_PADDING}
                        y={yScale(tick)}
                        dominantBaseline="middle"
                        textAnchor="end"
                        fontSize={TICK_FONT_SIZE}
                        fill={GRAPHER_DARK_TEXT}
                    >
                        {formatTick(tick)}
                    </text>
                </g>
            ))}
        </g>
    )
}

/** Horizontal time axis with tick marks and year labels, styled like
 * grapher's x-axis */
export function XAxis({
    xScale,
    years,
    boundedWidth,
    boundedHeight,
}: {
    xScale: (year: number) => number
    years: number[]
    boundedWidth: number
    boundedHeight: number
}) {
    return (
        <g
            className="poverty-projections-axis"
            transform={`translate(0, ${boundedHeight})`}
        >
            <line
                x1={0}
                y1={0}
                x2={boundedWidth}
                y2={0}
                stroke={SOLID_TICK_COLOR}
                strokeLinecap="square"
            />
            {years.map((year) => (
                <line
                    key={year}
                    x1={xScale(year)}
                    y1={0}
                    x2={xScale(year)}
                    y2={4}
                    stroke={SOLID_TICK_COLOR}
                />
            ))}
            {years.map((year, index) => (
                <text
                    key={year}
                    x={xScale(year)}
                    y={17}
                    textAnchor={
                        index === 0
                            ? "start"
                            : index === years.length - 1
                              ? "end"
                              : "middle"
                    }
                    fontSize={TICK_FONT_SIZE}
                    fill={GRAPHER_DARK_TEXT}
                >
                    {year}
                </text>
            ))}
        </g>
    )
}

/** Pick x-axis tick years for the 1990-2050 range based on available width */
export function getXAxisTickYears(
    firstYear: number,
    lastYear: number,
    boundedWidth: number
): number[] {
    const step = boundedWidth < 500 ? 20 : 10
    const years: number[] = []
    for (let year = firstYear; year <= lastYear; year += step) {
        years.push(year)
    }
    if (!years.includes(lastYear)) years.push(lastYear)
    return years
}
