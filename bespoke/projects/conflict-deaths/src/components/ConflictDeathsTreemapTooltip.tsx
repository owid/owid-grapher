import { useMemo } from "react"
import * as R from "remeda"
import * as d3 from "d3"

import { Bounds } from "@ourworldindata/utils"
import { GrapherTooltipAnchor } from "@ourworldindata/types"
import { TooltipCard } from "@ourworldindata/grapher/src/tooltip/TooltipCard.js"
import { TooltipValue } from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"

import {
    TooltipState,
    DataRow,
    getRegionColor,
} from "../core/ConflictDeathsConstants.js"
import {
    formatExactCount,
    formatShare,
    maxBy,
    minBy,
} from "../core/ConflictDeathsHelpers.js"

export function ConflictDeathsTreemapTooltip({
    state,
    shouldPinTooltipToBottom,
    containerBounds,
    timeSeriesData,
    years,
    year,
}: {
    state: TooltipState
    anchor?: GrapherTooltipAnchor
    shouldPinTooltipToBottom?: boolean
    containerBounds?: Bounds
    timeSeriesData: DataRow[]
    /** All years in the data range, for the sparklines */
    years: number[]
    year: number
}) {
    const tooltipCard = (
        <ConflictDeathsTreemapTooltipCard
            state={state}
            year={year}
            timeSeriesData={timeSeriesData}
            years={years}
            anchor={
                shouldPinTooltipToBottom
                    ? GrapherTooltipAnchor.Bottom
                    : undefined
            }
            containerBounds={
                shouldPinTooltipToBottom ? undefined : containerBounds
            }
        />
    )

    return tooltipCard
}

function ConflictDeathsTreemapTooltipCard({
    state,
    year,
    timeSeriesData,
    years,
    containerBounds,
    anchor,
}: {
    state: TooltipState
    year: number
    timeSeriesData: DataRow[]
    years: number[]
    containerBounds?: { width: number; height: number }
    anchor?: GrapherTooltipAnchor
}) {
    const { target, position } = state

    const entityName = target?.node.data.data.entityName

    // Deaths and share of global deaths in every year, for the sparklines
    const sparklineData = useMemo(() => {
        if (!entityName) return []

        const totalsByYear = R.pipe(
            timeSeriesData,
            R.groupBy((row) => row.year),
            R.mapValues((rows) => R.sumBy(rows, (row) => row.value))
        )

        const valueByYear = new Map(
            timeSeriesData
                .filter((row) => row.entityName === entityName)
                .map((row) => [row.year, row.value])
        )

        // The data only holds non-zero values, so fill in the missing years
        return years.map((y) => {
            const value = valueByYear.get(y) ?? 0
            const total = totalsByYear[y] ?? 0
            return {
                year: y,
                value2: value,
                share2: total > 0 ? value / total : 0,
            }
        })
    }, [timeSeriesData, years, entityName])

    const timeRange: [number, number] = useMemo(
        () => [
            minBy(sparklineData, (d) => d.year),
            maxBy(sparklineData, (d) => d.year),
        ],
        [sparklineData]
    )

    if (!target || !entityName) return null

    const { value, share, region } = target.node.data.data

    // Shouldn't happen
    if (value === undefined || share === undefined) return null

    const regionColor = getRegionColor(region)

    return (
        <TooltipCard
            id="conflict-deaths-tooltip"
            x={position.x}
            y={position.y}
            offsetX={8}
            offsetY={8}
            title={entityName}
            subtitle={region}
            style={{ maxWidth: 300 }}
            containerBounds={containerBounds}
            anchor={anchor}
        >
            <TooltipValue
                value={
                    <div className="conflict-deaths-tooltip__value">
                        <ConflictDeathsTooltipSparkline
                            data={sparklineData}
                            getValue={(d) => d.value2}
                            timeRange={timeRange}
                            year={year}
                            color={regionColor}
                        />
                        <span>{formatExactCount(value)}</span>
                    </div>
                }
                label={`Deaths in ${year}`}
                color={regionColor}
            />
            <TooltipValue
                value={
                    <div className="conflict-deaths-tooltip__value">
                        <ConflictDeathsTooltipSparkline
                            data={sparklineData}
                            getValue={(d) => d.share2}
                            timeRange={timeRange}
                            year={year}
                            color={regionColor}
                        />
                        <span>{formatShare(share)}</span>
                    </div>
                }
                label={`Share of global deaths in ${year}`}
                color={regionColor}
            />
        </TooltipCard>
    )
}

interface SparklineDatapoint {
    year: number
    value2: number
    share2: number
}

function ConflictDeathsTooltipSparkline({
    data,
    getValue,
    timeRange,
    year,
    color,
    width = 40,
    height = 18,
    dotRadius = 4,
}: {
    data: SparklineDatapoint[]
    getValue: (d: SparklineDatapoint) => number
    timeRange: [number, number]
    year: number
    color: string
    width?: number
    height?: number
    dotRadius?: number
}) {
    // Calculate scales using d3
    const xScale = d3.scaleLinear().domain(timeRange).range([0, width])

    const yMin = 0
    const yMax = maxBy(data, getValue) ?? 0
    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([height, 0])

    // Create path using d3 line generator
    const line = d3
        .line<SparklineDatapoint>()
        .x((d) => xScale(d.year))
        .y((d) => yScale(getValue(d)))

    const path = line(data)
    if (!path) return null

    const datapoint = data.find((row) => row.year === year)

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{ marginRight: 12, overflow: "visible" }}
        >
            {/* Zero line (horizontal reference) */}
            <line
                x1={0}
                y1={yScale(0)}
                x2={width}
                y2={yScale(0)}
                stroke="#ddd"
                strokeWidth={1}
            />

            {/* Sparkline path */}
            <path d={path} stroke={color} fill="none" strokeWidth={2} />

            {/* Current year highlight dot */}
            <circle
                cx={xScale(year)}
                cy={yScale(datapoint ? getValue(datapoint) : 0)}
                r={dotRadius}
                fill={color}
                stroke="#fff"
                strokeWidth={1.5}
            />
        </svg>
    )
}
