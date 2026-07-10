import {
    GRAPHER_LIGHT_TEXT,
    GRAY_30,
    GRAY_60,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"

const TICK_FONT_SIZE = 11

/** Horizontal gridlines with their tick labels drawn above-left, in the
 * style of grapher's y-axis */
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
                        stroke={tick === 0 ? GRAY_60 : GRAY_30}
                        strokeWidth={1}
                    />
                    {tick !== 0 && (
                        <text
                            x={0}
                            y={yScale(tick) - 4}
                            fontSize={TICK_FONT_SIZE}
                            fill={GRAPHER_LIGHT_TEXT}
                            // White halo so the labels stay readable on top
                            // of area fills
                            paintOrder="stroke"
                            stroke="#fff"
                            strokeWidth={3}
                            strokeLinejoin="round"
                        >
                            {formatTick(tick)}
                        </text>
                    )}
                </g>
            ))}
        </g>
    )
}

/** Horizontal time axis with tick marks and year labels */
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
                stroke={GRAY_60}
                strokeLinecap="square"
            />
            {years.map((year) => (
                <line
                    key={year}
                    x1={xScale(year)}
                    y1={0}
                    x2={xScale(year)}
                    y2={4}
                    stroke={GRAY_60}
                />
            ))}
            {years.map((year, index) => (
                <text
                    key={year}
                    x={xScale(year)}
                    y={16}
                    textAnchor={
                        index === 0
                            ? "start"
                            : index === years.length - 1
                              ? "end"
                              : "middle"
                    }
                    fontSize={TICK_FONT_SIZE}
                    fill={GRAPHER_LIGHT_TEXT}
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
