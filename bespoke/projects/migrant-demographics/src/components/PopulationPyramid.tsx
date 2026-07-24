import { useMemo, useState } from "react"
import { scaleLinear } from "d3"

import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"

import {
    AXIS_LABEL_COLOR,
    AgeBandRow,
    FEMALE_COLOR,
    GRID_LINE_COLOR,
    MALE_COLOR,
    MetricMode,
    NATIVE_BORN_COLOR,
    PyramidData,
} from "../helpers/constants.js"
import {
    formatCountShort,
    formatPercent,
    formatShareShort,
} from "../helpers/format.js"

export interface PopulationPyramidProps {
    data: PyramidData
    metric: MetricMode
    compare: boolean
}

/** The value that determines a bar's length, given the current metric. */
interface RowValues {
    ageBand: string
    men: number
    women: number
    nativeMen: number
    nativeWomen: number
}

const MIN_ROW_HEIGHT = 16
const MAX_ROW_HEIGHT = 28

export function PopulationPyramid(
    props: PopulationPyramidProps
): React.ReactElement {
    const { ref, width } = useContainerWidth()
    return (
        <div ref={ref} className="population-pyramid">
            {width > 0 && <PopulationPyramidSvg {...props} width={width} />}
        </div>
    )
}

function PopulationPyramidSvg({
    data,
    metric,
    compare,
    width,
}: PopulationPyramidProps & { width: number }): React.ReactElement {
    // Comparing migrants with the native-born only makes sense as shares,
    // since the two populations differ by an order of magnitude.
    const effectiveMetric: MetricMode = compare ? "share" : metric

    const isNarrow = width < 480
    const centerWidth = Math.round(clamp(width * 0.14, 52, 84))
    const rowHeight = clamp(
        Math.round((width * 0.55) / data.rows.length),
        MIN_ROW_HEIGHT,
        MAX_ROW_HEIGHT
    )
    const barHeight = Math.round(rowHeight * 0.72)

    const fontSize = {
        panelHeader: isNarrow ? 12 : 14,
        ageBand: isNarrow ? 11 : 13,
        tick: isNarrow ? 10 : 12,
        axisTitle: isNarrow ? 11 : 13,
        value: isNarrow ? 10 : 12,
    }

    const margin = {
        top: fontSize.panelHeader + 18,
        bottom: fontSize.tick + fontSize.axisTitle + 26,
    }

    const panelWidth = (width - centerWidth) / 2
    const rightStart = panelWidth + centerWidth
    const chartHeight = data.rows.length * rowHeight
    const height = margin.top + chartHeight + margin.bottom
    const chartBottom = margin.top + chartHeight

    // Convert raw counts to the plotted value (absolute or share of the
    // respective population).
    const rowValues: RowValues[] = useMemo(() => {
        const toShare = (value: number, total: number): number =>
            total > 0 ? (value / total) * 100 : 0
        return data.rows.map((row: AgeBandRow) => {
            if (effectiveMetric === "share") {
                return {
                    ageBand: row.ageBand,
                    men: toShare(row.men, data.totalMigrants),
                    women: toShare(row.women, data.totalMigrants),
                    nativeMen: toShare(row.nativeMen, data.totalNativeBorn),
                    nativeWomen: toShare(row.nativeWomen, data.totalNativeBorn),
                }
            }
            return {
                ageBand: row.ageBand,
                men: row.men,
                women: row.women,
                nativeMen: row.nativeMen,
                nativeWomen: row.nativeWomen,
            }
        })
    }, [data, effectiveMetric])

    const maxValue = useMemo(() => {
        let max = 0
        for (const row of rowValues) {
            max = Math.max(max, row.men, row.women)
            if (compare) max = Math.max(max, row.nativeMen, row.nativeWomen)
        }
        return max || 1
    }, [rowValues, compare])

    // Length of a bar (0 at the centre, growing outward).
    const lengthScale = useMemo(
        () => scaleLinear().domain([0, maxValue]).range([0, panelWidth]),
        [maxValue, panelWidth]
    )

    const ticks = useMemo(
        () => lengthScale.ticks(isNarrow ? 4 : 5),
        [lengthScale, isNarrow]
    )

    const formatTick = (value: number): string =>
        effectiveMetric === "share"
            ? formatShareShort(value)
            : formatCountShort(value)

    const [hoveredBand, setHoveredBand] = useState<string | null>(null)

    // Row i (0-4) sits at the bottom; 75+ at the top.
    const rowY = (index: number): number =>
        margin.top + (data.rows.length - 1 - index) * rowHeight

    const menPercent = formatPercent(
        data.totalMigrants > 0 ? data.totalMen / data.totalMigrants : 0
    )
    const womenPercent = formatPercent(
        data.totalMigrants > 0 ? data.totalWomen / data.totalMigrants : 0
    )

    const centerX = panelWidth + centerWidth / 2

    return (
        <svg
            className="population-pyramid__svg"
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            role="img"
            aria-label="Population pyramid"
        >
            {/* Panel headers */}
            <text
                x={panelWidth / 2}
                y={margin.top - 8}
                textAnchor="middle"
                className="population-pyramid__panel-header"
                fontSize={fontSize.panelHeader}
            >
                Men ({menPercent})
            </text>
            <text
                x={rightStart + panelWidth / 2}
                y={margin.top - 8}
                textAnchor="middle"
                className="population-pyramid__panel-header"
                fontSize={fontSize.panelHeader}
            >
                Women ({womenPercent})
            </text>

            {/* Gridlines + tick labels */}
            {ticks.map((tick) => {
                const len = lengthScale(tick)
                return (
                    <g key={tick} className="population-pyramid__grid">
                        <line
                            x1={panelWidth - len}
                            y1={margin.top}
                            x2={panelWidth - len}
                            y2={chartBottom}
                            stroke={GRID_LINE_COLOR}
                        />
                        <line
                            x1={rightStart + len}
                            y1={margin.top}
                            x2={rightStart + len}
                            y2={chartBottom}
                            stroke={GRID_LINE_COLOR}
                        />
                        <text
                            x={panelWidth - len}
                            y={chartBottom + fontSize.tick + 6}
                            textAnchor="middle"
                            fill={AXIS_LABEL_COLOR}
                            fontSize={fontSize.tick}
                        >
                            {formatTick(tick)}
                        </text>
                        <text
                            x={rightStart + len}
                            y={chartBottom + fontSize.tick + 6}
                            textAnchor="middle"
                            fill={AXIS_LABEL_COLOR}
                            fontSize={fontSize.tick}
                        >
                            {formatTick(tick)}
                        </text>
                    </g>
                )
            })}

            {/* Bars */}
            {rowValues.map((row, index) => {
                const y = rowY(index) + (rowHeight - barHeight) / 2
                const menLen = lengthScale(row.men)
                const womenLen = lengthScale(row.women)
                const dimmed =
                    hoveredBand !== null && hoveredBand !== row.ageBand
                const opacity = dimmed ? 0.35 : 1
                return (
                    <g key={row.ageBand}>
                        <rect
                            x={panelWidth - menLen}
                            y={y}
                            width={menLen}
                            height={barHeight}
                            fill={MALE_COLOR}
                            opacity={opacity}
                            shapeRendering="crispEdges"
                        />
                        <rect
                            x={rightStart}
                            y={y}
                            width={womenLen}
                            height={barHeight}
                            fill={FEMALE_COLOR}
                            opacity={opacity}
                            shapeRendering="crispEdges"
                        />
                    </g>
                )
            })}

            {/* Native-born comparison outline */}
            {compare && (
                <>
                    <StepOutline
                        rows={rowValues}
                        pick={(row) => row.nativeMen}
                        lengthScale={lengthScale}
                        rowY={rowY}
                        rowHeight={rowHeight}
                        baseX={panelWidth}
                        direction={-1}
                    />
                    <StepOutline
                        rows={rowValues}
                        pick={(row) => row.nativeWomen}
                        lengthScale={lengthScale}
                        rowY={rowY}
                        rowHeight={rowHeight}
                        baseX={rightStart}
                        direction={1}
                    />
                </>
            )}

            {/* Age-band labels in the centre column */}
            {data.rows.map((row, index) => (
                <text
                    key={row.ageBand}
                    x={centerX}
                    y={rowY(index) + rowHeight / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="population-pyramid__age-label"
                    fontSize={fontSize.ageBand}
                >
                    {row.ageBand}
                </text>
            ))}

            {/* Hovered-row value labels */}
            {hoveredBand !== null &&
                (() => {
                    const index = rowValues.findIndex(
                        (row) => row.ageBand === hoveredBand
                    )
                    if (index === -1) return null
                    const row = rowValues[index]
                    const y = rowY(index) + rowHeight / 2
                    const menLen = lengthScale(row.men)
                    const womenLen = lengthScale(row.women)
                    const format = (value: number): string =>
                        effectiveMetric === "share"
                            ? `${value.toFixed(1)}%`
                            : formatCountShort(value)
                    return (
                        <>
                            <text
                                x={panelWidth - menLen - 5}
                                y={y}
                                textAnchor="end"
                                dominantBaseline="central"
                                className="population-pyramid__value-label"
                                fontSize={fontSize.value}
                                fill={MALE_COLOR}
                            >
                                {format(row.men)}
                            </text>
                            <text
                                x={rightStart + womenLen + 5}
                                y={y}
                                textAnchor="start"
                                dominantBaseline="central"
                                className="population-pyramid__value-label"
                                fontSize={fontSize.value}
                                fill={FEMALE_COLOR}
                            >
                                {format(row.women)}
                            </text>
                        </>
                    )
                })()}

            {/* Axis title */}
            <text
                x={centerX}
                y={height - 6}
                textAnchor="middle"
                className="population-pyramid__axis-title"
                fontSize={fontSize.axisTitle}
            >
                {effectiveMetric === "share"
                    ? "Share of each population"
                    : "Number of immigrants"}
            </text>

            {/* Hover hit areas spanning the full width of each row */}
            {data.rows.map((row, index) => (
                <rect
                    key={row.ageBand}
                    x={0}
                    y={rowY(index)}
                    width={width}
                    height={rowHeight}
                    fill="transparent"
                    onMouseEnter={() => setHoveredBand(row.ageBand)}
                    onMouseLeave={() => setHoveredBand(null)}
                />
            ))}
        </svg>
    )
}

/**
 * A stepped outline hugging the outer edge of the bars for one panel, used to
 * overlay the native-born profile. `direction` is -1 for the left (men) panel
 * and +1 for the right (women) panel.
 */
function StepOutline({
    rows,
    pick,
    lengthScale,
    rowY,
    rowHeight,
    baseX,
    direction,
}: {
    rows: RowValues[]
    pick: (row: RowValues) => number
    lengthScale: (value: number) => number
    rowY: (index: number) => number
    rowHeight: number
    baseX: number
    direction: 1 | -1
}): React.ReactElement {
    const points: Array<[number, number]> = []
    // Walk from the top row (last index) down to the bottom row (index 0).
    const orderedIndices = rows.map((_, i) => i).reverse()

    // Start on the centre axis at the very top.
    const firstIndex = orderedIndices[0]
    points.push([baseX, rowY(firstIndex)])

    for (const index of orderedIndices) {
        const len = lengthScale(pick(rows[index]))
        const x = baseX + direction * len
        const top = rowY(index)
        const bottom = top + rowHeight
        points.push([x, top])
        points.push([x, bottom])
    }

    // Return to the centre axis at the very bottom.
    const lastIndex = orderedIndices[orderedIndices.length - 1]
    points.push([baseX, rowY(lastIndex) + rowHeight])

    const d = points
        .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`)
        .join(" ")

    return (
        <path
            d={d}
            fill="none"
            stroke={NATIVE_BORN_COLOR}
            strokeWidth={1.5}
            strokeLinejoin="round"
            className="population-pyramid__native-outline"
        />
    )
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
}
