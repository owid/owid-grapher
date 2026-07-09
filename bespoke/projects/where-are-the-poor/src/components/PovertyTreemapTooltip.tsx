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
    PovertyLine,
    getGroupColor,
    formatGroupLabel,
    WORLD_SELECTION,
} from "../helpers/PovertyConstants.js"
import {
    formatCount,
    formatShare,
    maxBy,
    minBy,
} from "../helpers/PovertyHelpers.js"

export function PovertyTreemapTooltip({
    state,
    shouldPinTooltipToBottom,
    containerBounds,
    timeSeriesData,
    povertyLine,
    region,
    year,
}: {
    state: TooltipState
    anchor?: GrapherTooltipAnchor
    shouldPinTooltipToBottom?: boolean
    containerBounds?: Bounds
    timeSeriesData: DataRow[]
    povertyLine: PovertyLine
    region: string
    year: number
}) {
    const tooltipCard = (
        <PovertyTreemapTooltipCard
            state={state}
            year={year}
            povertyLine={povertyLine}
            region={region}
            timeSeriesData={timeSeriesData}
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

function PovertyTreemapTooltipCard({
    state,
    year,
    povertyLine,
    region,
    timeSeriesData,
    containerBounds,
    anchor,
}: {
    state: TooltipState
    year: number
    povertyLine: PovertyLine
    region: string
    timeSeriesData: DataRow[]
    containerBounds?: { width: number; height: number }
    anchor?: GrapherTooltipAnchor
}) {
    const { target, position } = state

    // Process sparkline data for the hovered country
    const sparklineData = useMemo(() => {
        if (!target) return []

        const { countryName } = target.node.data.data

        // Calculate the total number of poor people by year
        const totalsByYear = R.pipe(
            timeSeriesData,
            R.groupBy((row) => row.year),
            R.mapValues((rows) => R.sumBy(rows, (row) => row.headcount))
        )

        return timeSeriesData
            .filter((row) => row.countryName === countryName)
            .map((row) => {
                const totalForYear = totalsByYear[row.year] || 1
                const share = row.headcount / totalForYear
                return {
                    countryName: row.countryName,
                    year: row.year,
                    headcount2: row.headcount,
                    share2: share,
                }
            })
            .sort((a, b) => a.year - b.year)
    }, [timeSeriesData, target])

    const timeRange: [number, number] = useMemo(
        () => [
            minBy(sparklineData, (d) => d.year),
            maxBy(sparklineData, (d) => d.year),
        ],
        [sparklineData]
    )

    if (!target) return null

    const node = target.node

    const { countryName, value, share, group } = node.data.data

    // Shouldn't happen
    if (value === undefined || share === undefined || !countryName) return null

    const groupColor = getGroupColor(group)

    const shareLabel =
        region === WORLD_SELECTION
            ? `Share of the world's poor in ${year}`
            : `Share of the poor in ${formatGroupLabel(region)} in ${year}`

    return (
        <TooltipCard
            id="where-are-the-poor-tooltip"
            x={position.x}
            y={position.y}
            offsetX={8}
            offsetY={8}
            title={countryName}
            subtitle={group ? formatGroupLabel(group) : undefined}
            style={{ maxWidth: 300 }}
            containerBounds={containerBounds}
            anchor={anchor}
        >
            <TooltipValue
                value={
                    <div className="where-are-the-poor-tooltip__value">
                        <PovertyTooltipSparkline
                            data={sparklineData}
                            getValue={(d) => d.headcount2}
                            timeRange={timeRange}
                            year={year}
                            color={groupColor}
                        />
                        <span>{formatCount(value)}</span>
                    </div>
                }
                label={`People living below ${povertyLine.label} in ${year}`}
                color={groupColor}
            />
            <TooltipValue
                value={
                    <div className="where-are-the-poor-tooltip__value">
                        <PovertyTooltipSparkline
                            data={sparklineData}
                            getValue={(d) => d.share2}
                            timeRange={timeRange}
                            year={year}
                            color={groupColor}
                        />
                        <span>{formatShare(share)}</span>
                    </div>
                }
                label={shareLabel}
                color={groupColor}
            />
        </TooltipCard>
    )
}

interface SparklineDatapoint {
    countryName: string
    year: number
    headcount2: number
    share2: number
}

function PovertyTooltipSparkline({
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
