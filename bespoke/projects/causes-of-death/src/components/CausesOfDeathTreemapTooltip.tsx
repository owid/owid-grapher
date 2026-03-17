import { useMemo } from "react"
import { createPortal } from "react-dom"
import * as R from "remeda"
import * as d3 from "d3"

import { Bounds } from "@ourworldindata/utils"
import { GrapherTooltipAnchor } from "@ourworldindata/types"
import { TooltipCard } from "@ourworldindata/grapher/src/tooltip/TooltipCard.js"
import { TooltipValue } from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"

import {
    TooltipState,
    DataRow,
    getCategoryColor,
} from "./CausesOfDeathConstants.js"
import {
    formatCount,
    formatShare,
    maxBy,
    minBy,
} from "./CausesOfDeathHelpers.js"
import { usePortalContainer } from "./CausesOfDeathPortalContext.js"

export function CausesOfDeathTreemapTooltip({
    state,
    shouldPinTooltipToBottom,
    containerBounds,
    timeSeriesData,
    year,
}: {
    state: TooltipState
    anchor?: GrapherTooltipAnchor
    shouldPinTooltipToBottom?: boolean
    containerBounds?: Bounds
    timeSeriesData: DataRow[]
    year: number
}) {
    const portalContainer = usePortalContainer()

    const tooltipCard = (
        <CausesOfDeathTreemapTooltipCard
            state={state}
            year={year}
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

    // On mobile, portal the tooltip to the Shadow DOM container so it
    // can be position:fixed to the viewport bottom while still having
    // access to scoped styles (BodyPortal would render outside the
    // Shadow DOM where styles aren't available).
    return shouldPinTooltipToBottom && portalContainer
        ? createPortal(tooltipCard, portalContainer)
        : tooltipCard
}

function CausesOfDeathTreemapTooltipCard({
    state,
    year,
    timeSeriesData,
    containerBounds,
    anchor,
}: {
    state: TooltipState
    year: number
    timeSeriesData: DataRow[]
    containerBounds?: { width: number; height: number }
    anchor?: GrapherTooltipAnchor
}) {
    const { target, position } = state

    // Process sparkline data for current entity and variable (as percentage share)
    const sparklineData = useMemo(() => {
        if (!target) return []

        const { variable } = target.node.data.data

        // Calculate total deaths by year
        const totalsByYear = R.pipe(
            timeSeriesData,
            R.groupBy((row) => row.year),
            R.mapValues((rows) => R.sumBy(rows, (row) => row.value))
        )

        return timeSeriesData
            .filter((row) => row.variable === variable)
            .map((row) => {
                const totalForYear = totalsByYear[row.year] || 1
                const share = row.value / totalForYear
                return {
                    entityName: row.entityName,
                    year: row.year,
                    value2: row.value,
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

    const { variable, value, share, description, category } = node.data.data

    // Shouldn't happen
    if (value === undefined || share === undefined) return null

    const categoryColor = getCategoryColor(node.data.data.category)

    const subtitle = description ? `${description} (${category})` : category

    return (
        <TooltipCard
            id="causes-of-death-tooltip"
            x={position.x}
            y={position.y}
            offsetX={8}
            offsetY={8}
            title={variable}
            subtitle={subtitle}
            style={{ maxWidth: 300 }}
            containerBounds={containerBounds}
            anchor={anchor}
        >
            <TooltipValue
                value={
                    <div className="causes-of-death-tooltip__value">
                        <CausesOfDeathTooltipSparkline
                            data={sparklineData}
                            getValue={(d) => d.share2}
                            timeRange={timeRange}
                            year={year}
                            color={categoryColor}
                        />
                        <span>{formatShare(share)}</span>
                    </div>
                }
                label={`Share of deaths in ${year}`}
                color={categoryColor}
            />
            <TooltipValue
                value={
                    <div className="causes-of-death-tooltip__value">
                        <CausesOfDeathTooltipSparkline
                            data={sparklineData}
                            getValue={(d) => d.value2}
                            timeRange={timeRange}
                            year={year}
                            color={categoryColor}
                        />
                        <span>
                            {formatCount(value)}{" "}
                            <span className="muted">
                                (
                                {formatCount(value / 365, {
                                    abbreviate: false,
                                })}{" "}
                                per day)
                            </span>
                        </span>
                    </div>
                }
                label={`Number of deaths in ${year}`}
                color={categoryColor}
            />
        </TooltipCard>
    )
}

interface SparklineDatapoint {
    entityName: string
    year: number
    value2: number
    share2: number
}

function CausesOfDeathTooltipSparkline({
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
