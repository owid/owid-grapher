import { useCallback, useMemo, useState } from "react"
import { line as d3Line, scaleLinear } from "d3"
import { getRelativeMouse } from "@ourworldindata/utils"

import { useChartDimensions } from "../../../../hooks/useDimensions.js"
import { usePinnedTooltip } from "../../../../hooks/usePinnedTooltip.js"

import {
    ALL_SCENARIOS,
    BASELINE_LABEL,
    BASELINE_SCENARIO,
    ENTITIES,
    formatEntityLabel,
    getEntityColor,
    PROJECTION_DASHARRAY,
    SCENARIO_COLORS,
    SCENARIOS,
    ScenarioSelection,
    SMALL_CHART_BREAKPOINT,
    WORLD,
} from "../helpers/PovertyProjectionsConstants.js"
import {
    getProjectedSeries,
    ProjectionPoint,
    ProjectionsData,
    splitAtProjection,
} from "../helpers/PovertyProjectionsData.js"
import {
    formatShare,
    formatShareAxisTick,
} from "../helpers/PovertyProjectionsHelpers.js"
import {
    getXAxisTickYears,
    getYAxisWidth,
    XAxis,
    YAxisGrid,
} from "./ProjectionsAxes.js"
import { ProjectionsMarker } from "./ProjectionsMarker.js"
import {
    LineLabels,
    ProjectionsLegend,
    wrapLineLabels,
} from "./ProjectionsLineLabels.js"
import { ProjectionsTooltip } from "./ProjectionsTooltip.js"

const LABEL_MAX_WIDTH = 140

/** One drawn line: a solid historical segment and/or a dotted projected
 * segment */
interface LineSeries {
    id: string
    label: string
    color: string
    historical?: ProjectionPoint[]
    projected: ProjectionPoint[]
    bold?: boolean
}

interface TooltipState {
    target: { year: number } | null
    position: { x: number; y: number }
}

export function ResponsiveProjectionsLineChart(props: {
    data: ProjectionsData
    scenario: ScenarioSelection
}) {
    const { ref, dimensions } = useChartDimensions<HTMLDivElement>({
        config: { ratio: 16 / 10, minHeight: 340, maxHeight: 480 },
    })

    return (
        <div ref={ref} className="poverty-projections-chart-container">
            {dimensions.width > 0 && (
                <ProjectionsLineChart
                    {...props}
                    width={dimensions.width}
                    height={dimensions.height}
                />
            )}
        </div>
    )
}

function buildLineSeries(
    data: ProjectionsData,
    scenario: ScenarioSelection
): LineSeries[] {
    const { firstProjectionYear } = data

    if (scenario === ALL_SCENARIOS) {
        // World only: the estimates continue into the baseline projection,
        // with the alternative scenarios fanning out around it
        const world = data.byEntity.get(WORLD)
        if (!world) return []
        const { historical, projected } = splitAtProjection(
            world.baseline,
            firstProjectionYear
        )
        return [
            {
                id: BASELINE_SCENARIO,
                label: BASELINE_LABEL,
                color: getEntityColor(WORLD),
                historical,
                projected,
                bold: true,
            },
            ...SCENARIOS.map((s) => ({
                id: s.id,
                label: s.label,
                color: SCENARIO_COLORS[s.id],
                projected: world.scenarios.get(s.id) ?? [],
            })),
        ]
    }

    // All entities, with the projected segments following the selected
    // scenario
    return ENTITIES.flatMap((entity): LineSeries[] => {
        const series = data.byEntity.get(entity)
        if (!series) return []
        const { historical } = splitAtProjection(
            series.baseline,
            firstProjectionYear
        )
        return [
            {
                id: entity,
                label: formatEntityLabel(entity),
                color: getEntityColor(entity),
                historical,
                projected: getProjectedSeries(
                    series,
                    scenario,
                    firstProjectionYear
                ),
            },
        ]
    })
}

function ProjectionsLineChart({
    data,
    scenario,
    width,
    height,
}: {
    data: ProjectionsData
    scenario: ScenarioSelection
    width: number
    height: number
}) {
    const isNarrow = width < SMALL_CHART_BREAKPOINT

    const firstYear = data.years[0]
    const lastYear = data.years[data.years.length - 1]
    // The year the dotted segments (and the shaded projection area) start
    const boundaryYear = data.firstProjectionYear - 1

    const seriesList = useMemo(
        () => buildLineSeries(data, scenario),
        [data, scenario]
    )

    const marginTop = 20
    const marginBottom = 26
    const boundedHeight = Math.max(height - marginTop - marginBottom, 0)

    const yScale = useMemo(() => {
        const maxRatio = Math.max(
            ...seriesList.flatMap((series) => [
                ...(series.historical ?? []).map((point) => point.ratio),
                ...series.projected.map((point) => point.ratio),
            ]),
            1
        )
        return scaleLinear()
            .domain([0, maxRatio])
            .range([boundedHeight, 0])
            .nice()
    }, [seriesList, boundedHeight])

    const yTicks = useMemo(() => yScale.ticks(5), [yScale])

    // The labels at the right edge of the chart, at the height of each
    // line's endpoint
    const { labels: wrappedLabels, width: labelsWidth } = useMemo(
        () =>
            wrapLineLabels(
                seriesList.map((series) => {
                    const lastPoint =
                        series.projected[series.projected.length - 1]
                    return {
                        id: series.id,
                        text: series.label,
                        color: series.color,
                        idealY: yScale(lastPoint?.ratio ?? 0),
                        bold: series.bold,
                    }
                }),
                LABEL_MAX_WIDTH
            ),
        [seriesList, yScale]
    )

    const marginLeft = getYAxisWidth(yTicks, formatShareAxisTick)
    const marginRight = isNarrow ? 4 : labelsWidth
    const boundedWidth = Math.max(width - marginLeft - marginRight, 0)

    const xScale = useMemo(
        () =>
            scaleLinear()
                .domain([firstYear, lastYear])
                .range([0, boundedWidth]),
        [firstYear, lastYear, boundedWidth]
    )

    const linePath = useMemo(
        () =>
            d3Line<ProjectionPoint>()
                .x((point) => xScale(point.year))
                .y((point) => yScale(point.ratio)),
        [xScale, yScale]
    )

    // Tooltip state and pointer handling
    const [tooltipState, setTooltipState] = useState<TooltipState>({
        target: null,
        position: { x: 0, y: 0 },
    })
    const dismissTooltip = useCallback(
        () => setTooltipState((prev) => ({ ...prev, target: null })),
        []
    )
    const { ref: chartRef, isPinned: pinTooltipToBottom } =
        usePinnedTooltip<HTMLDivElement>(
            tooltipState.target !== null,
            dismissTooltip
        )

    const handlePointerMove = useCallback(
        (event: React.PointerEvent<SVGRectElement>) => {
            if (!chartRef.current) return
            const point = getRelativeMouse(chartRef.current, event)
            const year = Math.max(
                firstYear,
                Math.min(
                    lastYear,
                    Math.round(xScale.invert(point.x - marginLeft))
                )
            )
            setTooltipState({ target: { year }, position: point })
        },
        [chartRef, xScale, firstYear, lastYear, marginLeft]
    )

    const hoveredYear = tooltipState.target?.year ?? null
    const isProjected =
        hoveredYear !== null && hoveredYear >= data.firstProjectionYear

    // The values shown in the tooltip: every series that has a value at the
    // hovered year, ordered top of chart first
    const tooltipRows = useMemo(() => {
        if (hoveredYear === null) return []
        return seriesList
            .flatMap((series) => {
                const point = [
                    ...(series.historical ?? []),
                    ...series.projected,
                ].find((p) => p.year === hoveredYear)
                if (!point) return []
                return [
                    {
                        key: series.id,
                        label: series.label,
                        value: formatShare(point.ratio),
                        color: series.color,
                        ratio: point.ratio,
                    },
                ]
            })
            .sort((a, b) => b.ratio - a.ratio)
    }, [seriesList, hoveredYear])

    return (
        <div
            ref={chartRef}
            className="poverty-projections-chart poverty-projections-chart--line"
        >
            {isNarrow && (
                <ProjectionsLegend
                    items={seriesList.map((series) => ({
                        id: series.id,
                        label: series.label,
                        color: series.color,
                    }))}
                />
            )}
            <svg width={width} height={height} overflow="visible">
                <g transform={`translate(${marginLeft}, ${marginTop})`}>
                    <YAxisGrid
                        yScale={yScale}
                        ticks={yTicks}
                        boundedWidth={boundedWidth}
                        formatTick={formatShareAxisTick}
                    />
                    <XAxis
                        xScale={xScale}
                        years={getXAxisTickYears(
                            firstYear,
                            lastYear,
                            boundedWidth
                        )}
                        boundedWidth={boundedWidth}
                        boundedHeight={boundedHeight}
                    />
                    <ProjectionsMarker
                        xScale={xScale}
                        boundaryYear={boundaryYear}
                        lastYear={lastYear}
                        boundedHeight={boundedHeight}
                        compact={isNarrow}
                    />

                    {seriesList.map((series) => (
                        <g key={series.id}>
                            {series.historical && (
                                <path
                                    d={linePath(series.historical) ?? undefined}
                                    fill="none"
                                    stroke={series.color}
                                    strokeWidth={series.bold ? 2 : 1.5}
                                />
                            )}
                            <path
                                d={linePath(series.projected) ?? undefined}
                                fill="none"
                                stroke={series.color}
                                strokeWidth={series.bold ? 2 : 1.5}
                                strokeDasharray={PROJECTION_DASHARRAY}
                            />
                        </g>
                    ))}

                    {!isNarrow && (
                        <LineLabels
                            labels={wrappedLabels}
                            seriesEndX={boundedWidth}
                            top={0}
                            bottom={boundedHeight}
                        />
                    )}

                    {/* Hover line and dots */}
                    {hoveredYear !== null && (
                        <g pointerEvents="none">
                            <line
                                x1={xScale(hoveredYear)}
                                y1={0}
                                x2={xScale(hoveredYear)}
                                y2={boundedHeight}
                                stroke="#a1a1a1"
                                strokeWidth={1}
                            />
                            {tooltipRows.map((row) => (
                                <circle
                                    key={row.key}
                                    cx={xScale(hoveredYear)}
                                    cy={yScale(row.ratio)}
                                    r={3.5}
                                    fill={row.color}
                                    stroke="#fff"
                                    strokeWidth={1.5}
                                />
                            ))}
                        </g>
                    )}

                    {/* Invisible interaction rect — must be last to capture
                        pointer events */}
                    <rect
                        x={-marginLeft}
                        y={0}
                        width={width}
                        height={boundedHeight}
                        fill="transparent"
                        onPointerMove={handlePointerMove}
                        onPointerLeave={dismissTooltip}
                    />
                </g>
            </svg>

            {hoveredYear !== null && tooltipRows.length > 0 && (
                <ProjectionsTooltip
                    title={String(hoveredYear)}
                    subtitle={
                        scenario !== BASELINE_SCENARIO &&
                        scenario !== ALL_SCENARIOS &&
                        isProjected
                            ? `${
                                  SCENARIOS.find((s) => s.id === scenario)
                                      ?.label
                              } scenario`
                            : undefined
                    }
                    rows={tooltipRows}
                    isProjected={isProjected}
                    position={tooltipState.position}
                    pinToBottom={pinTooltipToBottom}
                    containerWidth={width}
                    containerHeight={height}
                />
            )}
        </div>
    )
}
