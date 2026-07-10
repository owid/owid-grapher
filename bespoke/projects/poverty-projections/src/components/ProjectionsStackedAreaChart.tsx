import { useCallback, useMemo, useState } from "react"
import {
    area as d3Area,
    line as d3Line,
    scaleLinear,
    stack as d3Stack,
    Series,
} from "d3"
import { getRelativeMouse } from "@ourworldindata/utils"
import { GRAY_90 } from "@ourworldindata/grapher/src/color/ColorConstants.js"

import { useChartDimensions } from "../../../../hooks/useDimensions.js"
import { usePinnedTooltip } from "../../../../hooks/usePinnedTooltip.js"

import {
    BASELINE_LABEL,
    BASELINE_SCENARIO,
    formatEntityLabel,
    getEntityColor,
    getScenarioLabel,
    REGION_STACK_ORDER,
    ScenarioId,
    SMALL_CHART_BREAKPOINT,
    WORLD,
} from "../helpers/PovertyProjectionsConstants.js"
import {
    buildBaselineTotals,
    buildStackedRows,
    getStackedTotal,
    ProjectionsData,
    StackedYearRow,
} from "../helpers/PovertyProjectionsData.js"
import {
    formatCount,
    formatCountAxisTick,
} from "../helpers/PovertyProjectionsHelpers.js"
import { getXAxisTickYears, XAxis, YAxisGrid } from "./ProjectionsAxes.js"
import { ProjectionsMarker } from "./ProjectionsMarker.js"
import { LineLabels, ProjectionsLegend } from "./ProjectionsLineLabels.js"
import { ProjectionsTooltip } from "./ProjectionsTooltip.js"

const BASELINE_TOTAL_ID = "baseline-total"

interface TooltipState {
    target: { year: number } | null
    position: { x: number; y: number }
}

export function ResponsiveProjectionsStackedAreaChart(props: {
    data: ProjectionsData
    scenario: ScenarioId | typeof BASELINE_SCENARIO
}) {
    const { ref, dimensions } = useChartDimensions<HTMLDivElement>({
        config: { ratio: 16 / 10, minHeight: 340, maxHeight: 480 },
    })

    return (
        <div ref={ref} className="poverty-projections-chart-container">
            {dimensions.width > 0 && (
                <ProjectionsStackedAreaChart
                    {...props}
                    width={dimensions.width}
                    height={dimensions.height}
                />
            )}
        </div>
    )
}

function ProjectionsStackedAreaChart({
    data,
    scenario,
    width,
    height,
}: {
    data: ProjectionsData
    scenario: ScenarioId | typeof BASELINE_SCENARIO
    width: number
    height: number
}) {
    const isNarrow = width < SMALL_CHART_BREAKPOINT
    const margin = {
        top: 20,
        right: isNarrow ? 12 : 170,
        bottom: 26,
        left: 4,
    }
    const boundedWidth = Math.max(width - margin.left - margin.right, 0)
    const boundedHeight = Math.max(height - margin.top - margin.bottom, 0)

    const firstYear = data.years[0]
    const lastYear = data.years[data.years.length - 1]

    const rows = useMemo(
        () => buildStackedRows(data, scenario),
        [data, scenario]
    )

    // The baseline ("current forecasts") total, shown as a dashed reference
    // line when an alternative scenario is selected
    const baselineTotals = useMemo(
        () => (scenario === BASELINE_SCENARIO ? [] : buildBaselineTotals(data)),
        [data, scenario]
    )

    const stackedSeries = useMemo(
        () =>
            d3Stack<StackedYearRow, string>()
                .keys(REGION_STACK_ORDER)
                .value((row, key) => row.values[key] ?? 0)(rows),
        [rows]
    )

    const xScale = useMemo(
        () =>
            scaleLinear()
                .domain([firstYear, lastYear])
                .range([0, boundedWidth]),
        [firstYear, lastYear, boundedWidth]
    )

    const yScale = useMemo(() => {
        const maxTotal = Math.max(
            ...rows.map(getStackedTotal),
            ...baselineTotals.map((point) => point.total),
            1
        )
        return scaleLinear()
            .domain([0, maxTotal])
            .range([boundedHeight, 0])
            .nice()
    }, [rows, baselineTotals, boundedHeight])

    const areaPath = useMemo(
        () =>
            d3Area<Series<StackedYearRow, string>[number]>()
                .x((point) => xScale(point.data.year))
                .y0((point) => yScale(point[0]))
                .y1((point) => yScale(point[1])),
        [xScale, yScale]
    )

    const baselineLinePath = useMemo(
        () =>
            d3Line<{ year: number; total: number }>()
                .x((point) => xScale(point.year))
                .y((point) => yScale(point.total)),
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
                    Math.round(xScale.invert(point.x - margin.left))
                )
            )
            setTooltipState({ target: { year }, position: point })
        },
        [chartRef, xScale, firstYear, lastYear, margin.left]
    )

    const hoveredYear = tooltipState.target?.year ?? null
    const isProjected =
        hoveredYear !== null && hoveredYear >= data.firstProjectionYear

    // Regions top of the stack first, then the World total (the sum of the
    // regions, so it matches the chart)
    const tooltipRows = useMemo(() => {
        if (hoveredYear === null) return []
        const row = rows.find((r) => r.year === hoveredYear)
        if (!row) return []
        return [
            ...REGION_STACK_ORDER.toReversed().map((region) => ({
                key: region,
                label: formatEntityLabel(region),
                value: formatCount(row.values[region] ?? 0),
                color: getEntityColor(region),
            })),
            {
                key: WORLD,
                label: WORLD,
                value: formatCount(getStackedTotal(row)),
                color: undefined,
            },
        ]
    }, [rows, hoveredYear])

    // Region labels at the right edge, placed at the vertical middle of each
    // band's last-year extent; the baseline reference label joins the same
    // collision resolution
    const labelSpecs = useMemo(() => {
        const lastIndex = rows.length - 1
        const regionLabels = stackedSeries.map((series) => {
            const lastPoint = series[lastIndex]
            return {
                id: series.key,
                text: formatEntityLabel(series.key),
                color: getEntityColor(series.key),
                idealY: yScale((lastPoint[0] + lastPoint[1]) / 2),
            }
        })
        const lastBaselineTotal = baselineTotals[baselineTotals.length - 1]
        return [
            ...regionLabels,
            ...(lastBaselineTotal
                ? [
                      {
                          id: BASELINE_TOTAL_ID,
                          text: BASELINE_LABEL,
                          color: GRAY_90,
                          idealY: yScale(lastBaselineTotal.total),
                          bold: true,
                      },
                  ]
                : []),
        ]
    }, [stackedSeries, rows.length, baselineTotals, yScale])

    return (
        <div
            ref={chartRef}
            className="poverty-projections-chart poverty-projections-chart--stacked"
        >
            {isNarrow && (
                <ProjectionsLegend
                    items={[
                        ...REGION_STACK_ORDER.toReversed().map((region) => ({
                            id: region,
                            label: formatEntityLabel(region),
                            color: getEntityColor(region),
                        })),
                        ...(baselineTotals.length > 0
                            ? [
                                  {
                                      id: BASELINE_TOTAL_ID,
                                      label: `${BASELINE_LABEL} (dashed)`,
                                      color: GRAY_90,
                                  },
                              ]
                            : []),
                    ]}
                />
            )}
            <svg width={width} height={height} overflow="visible">
                <g transform={`translate(${margin.left}, ${margin.top})`}>
                    {stackedSeries.map((series) => (
                        <path
                            key={series.key}
                            d={areaPath(series) ?? undefined}
                            fill={getEntityColor(series.key)}
                            fillOpacity={0.85}
                            stroke="#fff"
                            strokeWidth={0.5}
                        />
                    ))}

                    <YAxisGrid
                        yScale={yScale}
                        ticks={yScale.ticks(5)}
                        boundedWidth={boundedWidth}
                        formatTick={formatCountAxisTick}
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
                        firstProjectionYear={data.firstProjectionYear}
                        lastYear={lastYear}
                        boundedHeight={boundedHeight}
                        showShading
                        compact={isNarrow}
                    />

                    {baselineTotals.length > 0 && (
                        <path
                            d={baselineLinePath(baselineTotals) ?? undefined}
                            fill="none"
                            stroke={GRAY_90}
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                        />
                    )}

                    {!isNarrow && (
                        <LineLabels
                            specs={labelSpecs}
                            x={boundedWidth + 8}
                            maxWidth={margin.right - 20}
                            top={0}
                            bottom={boundedHeight}
                        />
                    )}

                    {/* Hover line */}
                    {hoveredYear !== null && (
                        <line
                            x1={xScale(hoveredYear)}
                            y1={0}
                            x2={xScale(hoveredYear)}
                            y2={boundedHeight}
                            stroke="#a1a1a1"
                            strokeWidth={1}
                            pointerEvents="none"
                        />
                    )}

                    {/* Invisible interaction rect — must be last to capture
                        pointer events */}
                    <rect
                        x={-margin.left}
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
                        scenario !== BASELINE_SCENARIO && isProjected
                            ? `${getScenarioLabel(scenario)} scenario`
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
