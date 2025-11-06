import {
    CAUSE_OF_DEATH_CATEGORY_COLORS,
    TooltipState,
    DataRow,
} from "./CausesOfDeathConstants.js"
import {
    formatNumberLongText,
    formatPercentSigFig,
} from "./CausesOfDeathHelpers.js"
import { GrapherTooltipAnchor } from "@ourworldindata/types"
import {
    TooltipCard,
    TooltipValueCore,
} from "@ourworldindata/grapher/src/tooltip/Tooltip.js"
import { Bounds } from "@ourworldindata/utils"
import { useMemo } from "react"

export function CausesOfDeathTreemapTooltip({
    state,
    anchor,
    containerBounds,
    offsetX = 8,
    offsetY = 8,
    historicalData,
}: {
    state: TooltipState
    anchor?: GrapherTooltipAnchor
    containerBounds?: { width: number; height: number }
    offsetX?: number
    offsetY?: number
    historicalData: DataRow[]
}) {
    const { target, position } = state

    // Process sparkline data for current entity and variable (as percentage share)
    const sparklineData = useMemo(() => {
        if (!historicalData || !target) return []

        const currentEntity = target.node.data.data.entityName
        const currentVariable = target.node.data.data.variable

        // Calculate total deaths by year for this entity
        const totalsByYear = new Map<number, number>()
        historicalData
            .filter((row) => row.entityName === currentEntity)
            .forEach((row) => {
                const currentTotal = totalsByYear.get(row.year) || 0
                totalsByYear.set(row.year, currentTotal + row.value)
            })

        return historicalData
            .filter(
                (row) =>
                    row.entityName === currentEntity &&
                    row.variable === currentVariable
            )
            .map((row) => {
                const totalForYear = totalsByYear.get(row.year) || 1
                const sharePercent = (row.value / totalForYear) * 100
                return {
                    entityName: row.entityName,
                    time: row.year,
                    originalTime: row.year,
                    value: sharePercent,
                }
            })
            .sort((a, b) => a.originalTime - b.originalTime)
    }, [historicalData, target])

    const sparklineTimeRange = useMemo(() => {
        if (sparklineData.length === 0) return { minTime: 0, maxTime: 0 }
        return {
            minTime: Math.min(...sparklineData.map((d) => d.originalTime)),
            maxTime: Math.max(...sparklineData.map((d) => d.originalTime)),
        }
    }, [sparklineData])

    if (!target) return null

    const node = target.node
    const variable = node.data.data.variable
    const value = node.value || 0
    const year = node.data.data.year

    // Get total deaths from root node
    const totalDeaths = node.ancestors()[node.ancestors().length - 1].value || 0

    // Calculate current value as percentage for sparkline highlight
    const currentValuePercent =
        totalDeaths > 0 ? (value / totalDeaths) * 100 : 0

    const categoryColor =
        CAUSE_OF_DEATH_CATEGORY_COLORS[node.data.data.category ?? ""] ||
        "#5b5b5b"

    return (
        <TooltipCard
            id="causes-of-death-tooltip"
            x={position.x}
            y={position.y}
            offsetX={offsetX}
            offsetY={offsetY}
            title={variable}
            subtitle={year.toString()}
            style={{ maxWidth: 300 }}
            containerBounds={containerBounds}
            anchor={anchor}
        >
            {/* <div
                className={cx("variable", {
                    "variable--no-name": labelVariant === "unit-only",
                })}
            >
                <div className="values" style={{ color }}>
                    <span>
                        {formatPercentSigFig(value / totalDeaths)}{" "}
                        <span style={{ fontWeight: 400 }}>died from </span>
                        <span style={{ fontWeight: 400 }}>
                            {variable === variable.toUpperCase()
                                ? variable
                                : variable.toLowerCase()}
                        </span>{" "}
                        <span style={{ fontWeight: 400 }}>
                            in {year}, totaling
                        </span>{" "}
                        {displayValue} deaths
                    </span>
                </div>
            </div> */}
            <TooltipValueCore
                value={value / totalDeaths}
                displayInfo={{
                    // displayName: "Share of all deaths",
                    unit: "Share of deaths",
                }}
                valueFormatter={{
                    formatValueShort: (v) =>
                        formatPercentSigFig(typeof v === "number" ? v : 0),
                }}
                labelVariant="unit-only"
                color={categoryColor}
            />
            {/* <TooltipValueCore
                value={value}
                displayInfo={{
                    // displayName: "Share of all deaths",
                    unit: "Per year",
                }}
                valueFormatter={{
                    formatValueShort: (v) =>
                        formatNumberLongText(typeof v === "number" ? v : 0),
                }}
                labelVariant="unit-only"
            />
            <TooltipValueCore
                value={value / 365}
                displayInfo={{
                    // displayName: "Share of all deaths",
                    unit: "Per average day",
                }}
                valueFormatter={{
                    formatValueShort: (v) =>
                        formatNumberLongText(typeof v === "number" ? v : 0),
                }}
                labelVariant="unit-only"
            /> */}

            {/* Add sparkline section if there's historical data */}
            {sparklineData.length > 1 && (
                <CausesOfDeathTooltipSparkline
                    data={sparklineData}
                    timeRange={sparklineTimeRange}
                    currentYear={year}
                    currentValue={currentValuePercent}
                    color={categoryColor}
                />
            )}
        </TooltipCard>
    )
}

function CausesOfDeathTooltipSparkline({
    data,
    timeRange,
    currentYear,
    currentValue,
    color,
}: {
    data: {
        entityName: string
        time: number
        originalTime: number
        value: number
    }[]
    timeRange: { minTime: number; maxTime: number }
    currentYear: number
    currentValue: number
    color: string
}) {
    const width = 180
    const height = 60

    // Format labels first to measure their width (as percentages)
    const firstValue = data[0]
    const lastValue = data[data.length - 1]
    const firstValueLabel = formatPercentSigFig(firstValue.value / 100)
    const lastValueLabel = formatPercentSigFig(lastValue.value / 100)

    // Measure text width for proper padding
    const fontSize = 10
    const firstLabelBounds = Bounds.forText(firstValueLabel, { fontSize })
    const lastLabelBounds = Bounds.forText(lastValueLabel, { fontSize })

    // Calculate padding with enough space for labels
    const myPadding = 2
    const leftPadding = Math.max(15, firstLabelBounds.width + myPadding) // 8px margin from label to line
    const rightPadding = Math.max(15, lastLabelBounds.width + myPadding) // 8px margin from line to label

    const padding = {
        top: 12,
        right: rightPadding,
        bottom: 12,
        left: leftPadding,
    }

    const plotWidth = width - padding.left - padding.right
    const plotHeight = height - padding.top - padding.bottom

    // Calculate scales
    const xScale = (time: number) =>
        ((time - timeRange.minTime) / (timeRange.maxTime - timeRange.minTime)) *
            plotWidth +
        padding.left

    const values = data.map((d) => d.value)
    const dataMin = Math.min(...values)
    const dataMax = Math.max(...values)

    // Always include zero in the y-scale domain
    const yMin = Math.min(0, dataMin)
    const yMax = Math.max(0, dataMax)
    const yRange = yMax - yMin || 1 // avoid division by zero

    const yScale = (value: number) =>
        height - padding.bottom - ((value - yMin) / yRange) * plotHeight

    // Create path
    const pathData = data
        .map((d, i) => {
            const x = xScale(d.originalTime)
            const y = yScale(d.value)
            return `${i === 0 ? "M" : "L"} ${x} ${y}`
        })
        .join(" ")

    // Format time labels
    const startYearLabel = timeRange.minTime.toString()
    const endYearLabel = timeRange.maxTime.toString()

    // Calculate positions for first and last value labels
    const firstValueX = xScale(firstValue.originalTime)
    const firstValueY = yScale(firstValue.value)
    const lastValueX = xScale(lastValue.originalTime)
    const lastValueY = yScale(lastValue.value)

    return (
        <div
            style={{
                marginTop: 4,
                // paddingTop: "8px",
                // borderTop: "1px solid #eee",
            }}
        >
            {/* <div
                style={{
                    fontSize: "11px",
                    color: "#666",
                    marginBottom: "6px",
                    fontWeight: 400,
                }}
            >
                Trend over time
            </div> */}
            <div style={{ position: "relative" }}>
                <svg width={width} height={height}>
                    {/* Zero line (horizontal reference) */}
                    <line
                        x1={padding.left}
                        y1={yScale(0)}
                        x2={padding.left + plotWidth}
                        y2={yScale(0)}
                        stroke="#bbb"
                        strokeWidth={1}
                        // strokeDasharray="3,3"
                    />

                    {/* Sparkline path */}
                    <path
                        d={pathData}
                        stroke={color}
                        fill="none"
                        strokeWidth={2}
                    />

                    {/* Current year vertical line */}
                    <line
                        x1={xScale(currentYear)}
                        y1={padding.top}
                        x2={xScale(currentYear)}
                        y2={height - padding.bottom}
                        stroke="#ddd"
                        strokeWidth={1}
                        // strokeDasharray="2,2"
                    />

                    {/* Current year highlight dot */}
                    <circle
                        cx={xScale(currentYear)}
                        cy={yScale(currentValue)}
                        r={4}
                        fill={color}
                        stroke="#fff"
                        strokeWidth={1.5}
                    />

                    {/* First value label (to the left of the line) */}
                    <g className="first-value-label">
                        <text
                            className="outline"
                            x={firstValueX - myPadding}
                            y={firstValueY}
                            fontSize={fontSize}
                            fill="#fff"
                            stroke="#fff"
                            strokeWidth={3}
                            textAnchor="end"
                            dominantBaseline="middle"
                        >
                            {firstValueLabel}
                        </text>
                        <text
                            x={firstValueX - myPadding}
                            y={firstValueY}
                            fontSize={fontSize}
                            fill="#666"
                            textAnchor="end"
                            dominantBaseline="middle"
                        >
                            {firstValueLabel}
                        </text>
                    </g>

                    {/* Last value label (to the right of the line) */}
                    <g className="last-value-label">
                        <text
                            className="outline"
                            x={lastValueX + myPadding}
                            y={lastValueY}
                            fontSize={fontSize}
                            fill="#fff"
                            stroke="#fff"
                            strokeWidth={3}
                            textAnchor="start"
                            dominantBaseline="middle"
                        >
                            {lastValueLabel}
                        </text>
                        <text
                            x={lastValueX + myPadding}
                            y={lastValueY}
                            fontSize={fontSize}
                            fill="#666"
                            textAnchor="start"
                            dominantBaseline="middle"
                        >
                            {lastValueLabel}
                        </text>
                    </g>

                    {/* X-axis time labels */}
                    <g className="time-labels">
                        <text
                            x={padding.left}
                            y={height - 2}
                            fontSize="9"
                            fill="#999"
                            textAnchor="start"
                        >
                            {startYearLabel}
                        </text>
                        <text
                            x={padding.left + plotWidth}
                            y={height - 2}
                            fontSize="9"
                            fill="#999"
                            textAnchor="end"
                        >
                            {endYearLabel}
                        </text>
                    </g>
                </svg>
            </div>
        </div>
    )
}
