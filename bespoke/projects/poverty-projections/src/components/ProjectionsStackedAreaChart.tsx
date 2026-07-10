import { useCallback, useMemo, useState } from "react"
import {
    area as d3Area,
    line as d3Line,
    rgb,
    scaleLinear,
    stack as d3Stack,
    Series,
} from "d3"
import { getRelativeMouse } from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"
import { GRAY_90 } from "@ourworldindata/grapher/src/color/ColorConstants.js"
import {
    darkenColorForText,
    isDarkColor,
} from "@ourworldindata/grapher/src/color/ColorUtils.js"

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
import {
    getXAxisTickYears,
    getYAxisWidth,
    XAxis,
    YAxisGrid,
} from "./ProjectionsAxes.js"
import { ProjectionsMarker } from "./ProjectionsMarker.js"
import {
    LABEL_FONT_SIZE,
    LineLabels,
    ProjectionsLegend,
    wrapLineLabels,
} from "./ProjectionsLineLabels.js"
import { ProjectionsTooltip } from "./ProjectionsTooltip.js"

const BASELINE_TOTAL_ID = "baseline-total"

// Grapher's stacked-area style (see grapher's StackedConstants.ts)
const AREA_FILL_OPACITY = 0.8
const AREA_BORDER_OPACITY = 0.7
const AREA_BORDER_WIDTH = 0.5

const INSIDE_LABEL_MAX_WIDTH = 160
const INSIDE_LABEL_PADDING = 8
const EXTERNAL_LABEL_MAX_WIDTH = 140

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

/** The color of the area fill as it appears on a white background */
const blendWithWhite = (color: string, opacity: number): string => {
    const { r, g, b } = rgb(color)
    return rgb(
        Math.round(r * opacity + 255 * (1 - opacity)),
        Math.round(g * opacity + 255 * (1 - opacity)),
        Math.round(b * opacity + 255 * (1 - opacity))
    ).formatHex()
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

    const firstYear = data.years[0]
    const lastYear = data.years[data.years.length - 1]
    // The year the projected data (and the shaded projection area) starts
    const boundaryYear = data.firstProjectionYear - 1

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

    const marginTop = 20
    const marginBottom = 26
    const boundedHeight = Math.max(height - marginTop - marginBottom, 0)

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

    const yTicks = useMemo(() => yScale.ticks(5), [yScale])

    // Regions get their label inside the area where the band is thickest —
    // like the static chart this replicates. Bands too thin for their label
    // fall back to a connector-line label at the right edge.
    const { insideLabels, externalSpecs } = useMemo(() => {
        const inside: {
            region: string
            wrap: TextWrap
            yearIndex: number
            centerY: number
            color: string
        }[] = []
        const external: {
            id: string
            text: string
            color: string
            idealY: number
            bold?: boolean
        }[] = []

        for (const series of stackedSeries) {
            let bestIndex = 0
            let bestThickness = -Infinity
            series.forEach((point, index) => {
                const thickness = yScale(point[0]) - yScale(point[1])
                if (thickness > bestThickness) {
                    bestThickness = thickness
                    bestIndex = index
                }
            })

            const color = getEntityColor(series.key)
            const wrap = new TextWrap({
                text: formatEntityLabel(series.key),
                maxWidth: INSIDE_LABEL_MAX_WIDTH,
                fontSize: LABEL_FONT_SIZE,
                fontWeight: 700,
            })

            if (wrap.height + INSIDE_LABEL_PADDING <= bestThickness) {
                const point = series[bestIndex]
                inside.push({
                    region: series.key,
                    wrap,
                    yearIndex: bestIndex,
                    centerY: (yScale(point[0]) + yScale(point[1])) / 2,
                    color,
                })
            } else {
                const lastPoint = series[series.length - 1]
                external.push({
                    id: series.key,
                    text: formatEntityLabel(series.key),
                    color,
                    idealY: yScale((lastPoint[0] + lastPoint[1]) / 2),
                })
            }
        }

        const lastBaselineTotal = baselineTotals[baselineTotals.length - 1]
        if (lastBaselineTotal) {
            external.push({
                id: BASELINE_TOTAL_ID,
                text: BASELINE_LABEL,
                color: GRAY_90,
                idealY: yScale(lastBaselineTotal.total),
                bold: true,
            })
        }

        return { insideLabels: inside, externalSpecs: external }
    }, [stackedSeries, baselineTotals, yScale])

    const { labels: wrappedExternalLabels, width: labelsWidth } = useMemo(
        () => wrapLineLabels(externalSpecs, EXTERNAL_LABEL_MAX_WIDTH),
        [externalSpecs]
    )

    const marginLeft = getYAxisWidth(yTicks, formatCountAxisTick)
    const marginRight = isNarrow || externalSpecs.length === 0 ? 4 : labelsWidth
    const boundedWidth = Math.max(width - marginLeft - marginRight, 0)

    const xScale = useMemo(
        () =>
            scaleLinear()
                .domain([firstYear, lastYear])
                .range([0, boundedWidth]),
        [firstYear, lastYear, boundedWidth]
    )

    const areaPath = useMemo(
        () =>
            d3Area<Series<StackedYearRow, string>[number]>()
                .x((point) => xScale(point.data.year))
                .y0((point) => yScale(point[0]))
                .y1((point) => yScale(point[1])),
        [xScale, yScale]
    )

    const borderPath = useMemo(
        () =>
            d3Line<Series<StackedYearRow, string>[number]>()
                .x((point) => xScale(point.data.year))
                .y((point) => yScale(point[1])),
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
                <g transform={`translate(${marginLeft}, ${marginTop})`}>
                    {stackedSeries.map((series) => (
                        <g key={series.key}>
                            <path
                                d={areaPath(series) ?? undefined}
                                fill={getEntityColor(series.key)}
                                fillOpacity={AREA_FILL_OPACITY}
                            />
                            <path
                                d={borderPath(series) ?? undefined}
                                fill="none"
                                stroke={rgb(getEntityColor(series.key))
                                    .darker(0.5)
                                    .toString()}
                                strokeOpacity={AREA_BORDER_OPACITY}
                                strokeWidth={AREA_BORDER_WIDTH}
                            />
                        </g>
                    ))}

                    <YAxisGrid
                        yScale={yScale}
                        ticks={yTicks}
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
                        boundaryYear={boundaryYear}
                        lastYear={lastYear}
                        boundedHeight={boundedHeight}
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

                    {/* Region labels inside the areas, where the band is
                        thickest */}
                    {insideLabels.map(
                        ({ region, wrap, yearIndex, centerY, color }) => {
                            const year = rows[yearIndex]?.year ?? firstYear
                            const x = Math.max(
                                wrap.width / 2 + 2,
                                Math.min(
                                    boundedWidth - wrap.width / 2 - 2,
                                    xScale(year)
                                )
                            )
                            const textColor = isDarkColor(
                                blendWithWhite(color, AREA_FILL_OPACITY)
                            )
                                ? "#fff"
                                : darkenColorForText(color)
                            const topY = centerY - wrap.height / 2
                            return (
                                <text
                                    key={region}
                                    fontSize={LABEL_FONT_SIZE}
                                    fontWeight={700}
                                    fill={textColor}
                                    textAnchor="middle"
                                    pointerEvents="none"
                                >
                                    {wrap.lines.map((line, index) => (
                                        <tspan
                                            key={index}
                                            x={x}
                                            y={
                                                topY +
                                                index * wrap.singleLineHeight +
                                                LABEL_FONT_SIZE * 0.85
                                            }
                                        >
                                            {line.text}
                                        </tspan>
                                    ))}
                                </text>
                            )
                        }
                    )}

                    {!isNarrow && externalSpecs.length > 0 && (
                        <LineLabels
                            labels={wrappedExternalLabels}
                            seriesEndX={boundedWidth}
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
