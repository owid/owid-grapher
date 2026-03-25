import { memo, useMemo, useState, useCallback } from "react"
import { useParentSize } from "@visx/responsive"
import { scaleLinear } from "@visx/scale"
import { LinePath } from "@visx/shape"
import { Group } from "@visx/group"
import type { Simulation } from "../helpers/useSimulation.js"
import { getPopulationForYear, getTotalPopulation } from "../helpers/utils"
import {
    START_YEAR,
    HISTORICAL_END_YEAR,
    END_YEAR,
    PROJECTION_BACKGROUND,
    HISTORICAL_TIME_RANGE,
    PROJECTION_TIME_RANGE,
    DENIM_BLUE,
    BENCHMARK_LINE_COLOR,
    PROJECTION_DASHARRAY,
    GRID_LINE_COLOR,
    LABEL_COLOR,
    HOVER_LINE_COLOR,
    ZERO_LINE_COLOR,
} from "../helpers/constants"
import { GRAPHER_LIGHT_TEXT } from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { TooltipCard } from "@ourworldindata/grapher/src/tooltip/TooltipCard.js"
import { TooltipValue } from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"
import { formatValue, GrapherTooltipAnchor } from "@ourworldindata/utils"
import { localPoint } from "@visx/event"
import * as R from "remeda"
import { BezierArrow } from "../../../../components/BezierArrow/BezierArrow.js"
import { Halo, TextWrap } from "@ourworldindata/components"
import {
    formatPopulationValueLong,
    formatPopulationAxisLabel,
} from "../helpers/utils.js"
import { TimeAxisX } from "./TimeAxisX.js"
import { last } from "lodash-es"
import { widthToBreakpoint } from "../helpers/useBreakpoint.js"
import { usePinnedTooltip } from "../../../../hooks/usePinnedTooltip.js"
import {
    getPopulationChartFonts,
    type PopulationChartFonts,
} from "../helpers/fonts.js"

const margin = { top: 0, bottom: 16, left: 0, right: 0 }

interface DataPoint {
    year: number
    value: number
}

function pixelDistance(
    yScale: (v: number) => number,
    a: number | undefined,
    b: number | undefined
): number {
    if (a === undefined || b === undefined) return 0
    return Math.abs(yScale(a) - yScale(b))
}

interface PopulationChartProps {
    simulation: Simulation
    showCustomProjection?: boolean
    hideChangeAnnotation?: boolean
    showHistoricalAnnotation?: boolean
}

function PopulationChart({
    simulation,
    showCustomProjection = true,
    hideChangeAnnotation = false,
    showHistoricalAnnotation = false,
    width,
    height,
}: PopulationChartProps & { width: number; height: number }) {
    const breakpoint = widthToBreakpoint(width)
    const fonts = getPopulationChartFonts(breakpoint)
    // Hover state for tooltip
    const [hoveredYear, setHoveredYear] = useState<number | null>(null)
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

    const dismissTooltip = useCallback(() => setHoveredYear(null), [])
    const { ref: chartRef, isPinned: pinTooltipToBottom } =
        usePinnedTooltip<HTMLDivElement>(
        hoveredYear !== null,
        dismissTooltip
    )

    const historicalDataPoints = useMemo(
        () =>
            R.pipe(
                HISTORICAL_TIME_RANGE,
                R.map((year) => {
                    const pop = getPopulationForYear(simulation.data, year)
                    if (!pop) return undefined
                    return { year, value: getTotalPopulation(pop) }
                }),
                R.filter(R.isDefined)
            ),
        [simulation]
    )

    const projectionDataPoints = useMemo(
        () =>
            R.pipe(
                PROJECTION_TIME_RANGE,
                R.map((year) => {
                    const result = simulation.forecastResults[year]
                    if (!result) return undefined
                    return { year, value: result.totalPop }
                }),
                R.filter(R.isDefined)
            ),
        [simulation]
    )

    const benchmarkDataPoints = useMemo(
        () =>
            R.pipe(
                PROJECTION_TIME_RANGE,
                R.map((year) => {
                    const result = simulation.unwppBenchmarkResults[year]
                    if (!result) return undefined
                    return { year, value: result.totalPop }
                }),
                R.filter(R.isDefined)
            ),
        [simulation]
    )

    const allDataPoints = useMemo(
        () => [
            ...historicalDataPoints,
            ...(showCustomProjection ? projectionDataPoints : []),
            ...benchmarkDataPoints,
        ],
        [
            historicalDataPoints,
            projectionDataPoints,
            benchmarkDataPoints,
            showCustomProjection,
        ]
    )
    const yMax = useMemo(
        () => Math.max(...allDataPoints.map((d) => d.value), 0),
        [allDataPoints]
    )

    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const xScale = scaleLinear({
        domain: [START_YEAR, END_YEAR],
        range: [0, innerWidth],
    })

    const yScale = scaleLinear({
        domain: [0, yMax * 1.05],
        range: [innerHeight, 0],
        nice: true,
    })

    const lastProjectionDataPoint = last(projectionDataPoints)?.value
    const lastBenchmarkDataPoint = last(benchmarkDataPoints)?.value

    const handleMouseMove = useCallback(
        (e: React.MouseEvent<SVGRectElement>) => {
            const point = localPoint(e)
            if (!point) return

            const svgX = point.x - margin.left
            // Invert x position to get the year, then snap to nearest integer
            const rawYear = xScale.invert(svgX)
            const snappedYear = Math.round(rawYear)
            const clampedYear = Math.max(
                START_YEAR,
                Math.min(END_YEAR, snappedYear)
            )

            setHoveredYear(clampedYear)
            setMousePosition({ x: point.x, y: point.y })
        },
        [xScale]
    )

    const handleMouseLeave = useCallback(() => {
        setHoveredYear(null)
    }, [])

    // Look up values at the hovered year
    const hoveredValues = useMemo(() => {
        if (hoveredYear === null) return null
        const historical = historicalDataPoints.find(
            (d) => d.year === hoveredYear
        )
        const projection = projectionDataPoints.find(
            (d) => d.year === hoveredYear
        )
        const benchmark = benchmarkDataPoints.find(
            (d) => d.year === hoveredYear
        )
        return { historical, projection, benchmark }
    }, [
        hoveredYear,
        historicalDataPoints,
        projectionDataPoints,
        benchmarkDataPoints,
    ])

    // Shouldn't happen
    if (
        lastProjectionDataPoint === undefined ||
        lastBenchmarkDataPoint === undefined
    ) {
        return null
    }

    const hasUserChanges =
        showCustomProjection && simulation.activePreset !== "unwpp"

    // Show change annotation at the end year when not hovering,
    // or at the hovered year when hovering a projection year
    const isHovering = hoveredYear !== null
    const changeAnnotationYear = isHovering ? hoveredYear : END_YEAR
    const dotDistance = pixelDistance(
        yScale,
        isHovering ? hoveredValues?.projection?.value : lastProjectionDataPoint,
        isHovering ? hoveredValues?.benchmark?.value : lastBenchmarkDataPoint
    )
    const shouldShowChangeAnnotation =
        !hideChangeAnnotation && hasUserChanges && dotDistance > 18

    return (
        <div ref={chartRef} style={{ position: "relative" }}>
            <svg width={width} height={height} overflow="visible">
                <Group left={margin.left} top={margin.top}>
                    {/* Projection background */}
                    <rect
                        x={xScale(HISTORICAL_END_YEAR)}
                        y={0}
                        width={innerWidth - xScale(HISTORICAL_END_YEAR)}
                        height={innerHeight}
                        fill={PROJECTION_BACKGROUND}
                    />

                    {/* Hover vertical line */}
                    {hoveredYear !== null && (
                        <line
                            x1={xScale(hoveredYear)}
                            y1={0}
                            x2={xScale(hoveredYear)}
                            y2={innerHeight}
                            stroke={HOVER_LINE_COLOR}
                            strokeWidth={1}
                            pointerEvents="none"
                        />
                    )}

                    <TimeAxisX
                        xScale={xScale}
                        innerWidth={innerWidth}
                        innerHeight={innerHeight}
                        fontSize={fonts.xTick}
                        strokeColor={ZERO_LINE_COLOR}
                    />
                    <AxisY
                        yScale={yScale}
                        innerWidth={innerWidth}
                        innerHeight={innerHeight}
                        fonts={fonts}
                    />

                    {/* Projection label */}
                    <text
                        x={
                            xScale(HISTORICAL_END_YEAR) +
                            Math.ceil(fonts.projectionAnnotation * 0.6)
                        }
                        y={
                            innerHeight -
                            Math.ceil(fonts.projectionAnnotation * 0.6)
                        }
                        fontSize={fonts.projectionAnnotation}
                        fill={GRAPHER_LIGHT_TEXT}
                    >
                        Projections →
                    </text>

                    {/* Historical line */}
                    <LinePath
                        data={historicalDataPoints}
                        x={(d) => xScale(d.year)}
                        y={(d) => yScale(d.value)}
                        stroke={DENIM_BLUE}
                        strokeWidth={3}
                    />

                    {/* UN benchmark line */}
                    <LinePath
                        data={benchmarkDataPoints}
                        x={(d) => xScale(d.year)}
                        y={(d) => yScale(d.value)}
                        stroke={
                            showCustomProjection
                                ? BENCHMARK_LINE_COLOR
                                : DENIM_BLUE
                        }
                        strokeWidth={3}
                        strokeDasharray={PROJECTION_DASHARRAY}
                        strokeLinecap="butt"
                    />

                    {/* Custom projection line */}
                    {showCustomProjection && (
                        <LinePath
                            data={projectionDataPoints}
                            x={(d) => xScale(d.year)}
                            y={(d) => yScale(d.value)}
                            stroke={DENIM_BLUE}
                            strokeWidth={3}
                            strokeDasharray={PROJECTION_DASHARRAY}
                            strokeLinecap="butt"
                        />
                    )}

                    {/* Endpoint labels with dots */}
                    <EndpointLabels
                        xScale={xScale}
                        yScale={yScale}
                        forecastDataPoints={
                            showCustomProjection
                                ? projectionDataPoints
                                : benchmarkDataPoints
                        }
                        benchmarkDataPoints={benchmarkDataPoints}
                        showBenchmark={hasUserChanges}
                        fonts={fonts}
                    />

                    {/* Historical endpoint annotation */}
                    {showHistoricalAnnotation &&
                        historicalDataPoints.length > 0 && (
                            <HistoricalAnnotation
                                xScale={xScale}
                                yScale={yScale}
                                dataPoint={last(historicalDataPoints)!}
                                fonts={fonts}
                            />
                        )}

                    {/* Change annotation between endpoints with arrow */}
                    {shouldShowChangeAnnotation && (
                        <ChangeAnnotation
                            xScale={xScale}
                            yScale={yScale}
                            year={changeAnnotationYear}
                            innerWidth={innerWidth}
                            projectionDataPoints={projectionDataPoints}
                            benchmarkDataPoints={benchmarkDataPoints}
                            hideLabel={isHovering}
                            fonts={fonts}
                        />
                    )}

                    {/* Hover dots — rendered above the change annotation */}
                    {hoveredYear !== null && hoveredValues && (
                        <HoverDots
                            x={xScale(hoveredYear)}
                            yScale={yScale}
                            hoveredValues={hoveredValues}
                            showCustomProjection={showCustomProjection}
                        />
                    )}

                    {/* Invisible interaction rect — must be last to capture events.
                        Extended horizontally by 20px on each side so the hover
                        doesn't disappear immediately at the chart edges. */}
                    <rect
                        x={-20}
                        y={0}
                        width={innerWidth + 40}
                        height={innerHeight}
                        fill="transparent"
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                    />
                </Group>
            </svg>

            {/* Tooltip */}
            {hoveredYear !== null && hoveredValues && (
                <TooltipCard
                    id="population-chart-tooltip"
                    x={mousePosition.x}
                    y={mousePosition.y}
                    offsetX={15}
                    offsetY={-10}
                    title={String(hoveredYear)}
                    anchor={
                        pinTooltipToBottom
                            ? GrapherTooltipAnchor.Bottom
                            : undefined
                    }
                    containerBounds={
                        pinTooltipToBottom ? undefined : { width, height }
                    }
                >
                    <PopulationTooltipContent
                        hoveredYear={hoveredYear}
                        hoveredValues={hoveredValues}
                        showCustomProjection={showCustomProjection}
                        hasUserChanges={hasUserChanges}
                    />
                </TooltipCard>
            )}
        </div>
    )
}

export const ResponsivePopulationChart = memo(
    function ResponsivePopulationChart({
        simulation,
        showCustomProjection,
        hideChangeAnnotation,
        showHistoricalAnnotation,
    }: PopulationChartProps) {
        const { parentRef, width, height } = useParentSize()
        return (
            <div ref={parentRef} style={{ width: "100%", height: "100%" }}>
                {width > 0 && height > 0 ? (
                    <PopulationChart
                        simulation={simulation}
                        showCustomProjection={showCustomProjection}
                        hideChangeAnnotation={hideChangeAnnotation}
                        showHistoricalAnnotation={showHistoricalAnnotation}
                        width={width}
                        height={height}
                    />
                ) : null}
            </div>
        )
    }
)

function HoverDots({
    x,
    yScale,
    hoveredValues,
    showCustomProjection,
}: {
    x: number
    yScale: (v: number) => number
    hoveredValues: {
        historical: DataPoint | undefined
        projection: DataPoint | undefined
        benchmark: DataPoint | undefined
    }
    showCustomProjection: boolean
}) {
    return (
        <g>
            {hoveredValues.historical && (
                <circle
                    cx={x}
                    cy={yScale(hoveredValues.historical.value)}
                    r={4}
                    fill={DENIM_BLUE}
                    stroke="#fff"
                    strokeWidth={1.5}
                    pointerEvents="none"
                />
            )}
            {hoveredValues.benchmark && (
                <circle
                    cx={x}
                    cy={yScale(hoveredValues.benchmark.value)}
                    r={4}
                    fill={
                        showCustomProjection ? BENCHMARK_LINE_COLOR : DENIM_BLUE
                    }
                    stroke="#fff"
                    strokeWidth={1.5}
                    pointerEvents="none"
                />
            )}
            {showCustomProjection && hoveredValues.projection && (
                <circle
                    cx={x}
                    cy={yScale(hoveredValues.projection.value)}
                    r={4}
                    fill={DENIM_BLUE}
                    stroke="#fff"
                    strokeWidth={1.5}
                    pointerEvents="none"
                />
            )}
        </g>
    )
}

function EndpointLabels({
    xScale,
    yScale,
    forecastDataPoints,
    benchmarkDataPoints,
    showBenchmark,
    fonts,
}: {
    xScale: (v: number) => number
    yScale: (v: number) => number
    forecastDataPoints: DataPoint[]
    benchmarkDataPoints: DataPoint[]
    showBenchmark: boolean
    fonts: PopulationChartFonts
}) {
    const forecastValue = forecastDataPoints.at(-1)!.value
    const benchmarkValue = benchmarkDataPoints.at(-1)!.value
    const x = xScale(END_YEAR)
    const yForecast = yScale(forecastValue)
    const yBenchmark = yScale(benchmarkValue)

    // When both labels shown, place relative to each other.
    // When only the forecast label is shown, place based on recent trend:
    // if population increased over the last 20 years, label goes above.
    const forecastLabelAbove = showBenchmark
        ? yForecast < yBenchmark
        : (forecastDataPoints.find((d) => d.year === END_YEAR - 20)?.value ??
              forecastValue) < forecastValue

    return (
        <>
            {showBenchmark && (
                <>
                    <circle cx={x} cy={yBenchmark} r={4} fill="#bbb" />
                    <Halo
                        id="benchmark-label"
                        outlineWidth={3}
                        outlineColor="white"
                    >
                        <text
                            x={x}
                            y={yBenchmark + (yBenchmark < yForecast ? -10 : 16)}
                            textAnchor="end"
                            fontSize={fonts.pointLabel}
                            fill={GRAPHER_LIGHT_TEXT}
                            fontWeight={500}
                        >
                            {formatPopulationValueLong(benchmarkValue)}
                        </text>
                    </Halo>
                </>
            )}
            <circle cx={x} cy={yForecast} r={4} fill={DENIM_BLUE} />
            <Halo id="projection-label" outlineWidth={3} outlineColor="white">
                <text
                    x={x}
                    y={yForecast + (forecastLabelAbove ? -10 : 16)}
                    textAnchor="end"
                    fontSize={fonts.pointLabel}
                    fill={DENIM_BLUE}
                    fontWeight={700}
                >
                    {formatPopulationValueLong(forecastValue)}
                </text>
            </Halo>
        </>
    )
}

function ChangeAnnotation({
    xScale,
    yScale,
    year,
    innerWidth,
    projectionDataPoints,
    benchmarkDataPoints,
    hideLabel = false,
    fonts,
}: {
    xScale: (v: number) => number
    yScale: (v: number) => number
    year: number
    innerWidth: number
    projectionDataPoints: { year: number; value: number }[]
    benchmarkDataPoints: { year: number; value: number }[]
    hideLabel?: boolean
    fonts: PopulationChartFonts
}) {
    const forecastPoint = projectionDataPoints.find((d) => d.year === year)
    const benchmarkPoint = benchmarkDataPoints.find((d) => d.year === year)
    if (!forecastPoint || !benchmarkPoint) return null

    const forecastValue = forecastPoint.value
    const benchmarkValue = benchmarkPoint.value
    const x = xScale(year)
    const yForecast = yScale(forecastValue)
    const yBenchmark = yScale(benchmarkValue)

    const dotRadius = 4
    const gap = dotRadius + 2
    const forecastEnd =
        yForecast < yBenchmark ? yForecast + gap : yForecast - gap
    const benchmarkEnd =
        yForecast < yBenchmark ? yBenchmark - gap : yBenchmark + gap
    const midY = (yForecast + yBenchmark) / 2
    const pct = ((forecastValue - benchmarkValue) / benchmarkValue) * 100
    const pctLabel = formatValue(pct, {
        numDecimalPlaces: 0,
        unit: "%",
        showPlus: true,
    })

    const labelFontSize = fonts.changeAnnotation
    const labelGap = 6
    const labelWidth = new TextWrap({
        text: pctLabel,
        fontSize: labelFontSize,
        fontWeight: 500,
        maxWidth: Infinity,
    }).width
    const placeOnRight = x + labelGap + labelWidth <= innerWidth

    return (
        <>
            {/* Arrow between dots */}
            <BezierArrow
                start={[x, benchmarkEnd]}
                end={[x, forecastEnd]}
                color={DENIM_BLUE}
                width={1.5}
            />

            {/* Percentage label */}
            {!hideLabel && (
                <Halo id="change-label" outlineWidth={2}>
                    <text
                        x={placeOnRight ? x + labelGap : x - labelGap}
                        y={midY}
                        textAnchor={placeOnRight ? "start" : "end"}
                        dominantBaseline="middle"
                        fontSize={labelFontSize}
                        fontWeight={500}
                        fill={DENIM_BLUE}
                    >
                        {pctLabel}
                    </text>
                </Halo>
            )}
        </>
    )
}

function PopulationTooltipContent({
    hoveredYear,
    hoveredValues,
    showCustomProjection,
    hasUserChanges,
}: {
    hoveredYear: number
    hoveredValues: {
        historical: DataPoint | undefined
        projection: DataPoint | undefined
        benchmark: DataPoint | undefined
    }
    showCustomProjection: boolean
    hasUserChanges: boolean
}) {
    const isHistorical = hoveredYear <= HISTORICAL_END_YEAR

    if (isHistorical && hoveredValues.historical) {
        return (
            <TooltipValue
                label="Population"
                value={formatPopulationValueLong(
                    hoveredValues.historical.value
                )}
                color={DENIM_BLUE}
            />
        )
    }

    const projectionValue = showCustomProjection
        ? hoveredValues.projection
        : hoveredValues.benchmark
    const benchmarkValue = hoveredValues.benchmark

    if (!projectionValue || !benchmarkValue) return null

    // When only the UN projection line is shown, display a single value
    if (!showCustomProjection) {
        return (
            <TooltipValue
                label="UN projection"
                value={formatPopulationValueLong(benchmarkValue.value)}
                color={DENIM_BLUE}
            />
        )
    }

    const difference = projectionValue.value - benchmarkValue.value
    const formattedDifference = formatValue(difference, {
        numSignificantFigures: 2,
        numberAbbreviation: "short",
        showPlus: true,
    })

    return (
        <>
            <TooltipValue
                label="UN projection"
                value={formatPopulationValueLong(benchmarkValue.value)}
                color={showCustomProjection ? GRAPHER_LIGHT_TEXT : DENIM_BLUE}
            />
            <TooltipValue
                label="Your projection"
                value={
                    <span>
                        {formatPopulationValueLong(projectionValue.value)}
                        {hasUserChanges && difference !== 0 && (
                            <span className="population-chart-tooltip__difference">
                                ({formattedDifference})
                            </span>
                        )}
                    </span>
                }
                color={DENIM_BLUE}
            />
        </>
    )
}

function AxisY({
    yScale,
    innerWidth,
    innerHeight,
    fonts,
}: {
    yScale: { ticks: (count: number) => number[]; (v: number): number }
    innerWidth: number
    innerHeight: number
    fonts: PopulationChartFonts
}) {
    const tickCount = innerHeight < 150 ? 2 : innerHeight < 250 ? 3 : 4
    const ticks = yScale.ticks(tickCount)

    return (
        <>
            {ticks.map((tick, i, arr) => {
                const isTop = i === arr.length - 1
                return (
                    <g key={tick}>
                        <line
                            x1={0}
                            y1={yScale(tick)}
                            x2={innerWidth}
                            y2={yScale(tick)}
                            stroke={
                                tick === 0 ? ZERO_LINE_COLOR : GRID_LINE_COLOR
                            }
                            strokeWidth={1}
                        />
                        {tick > 0 && (
                            <text
                                x={4}
                                y={yScale(tick) - 4}
                                fontSize={fonts.yTick}
                                fill={LABEL_COLOR}
                            >
                                {formatPopulationAxisLabel(tick) +
                                    (isTop ? " people" : "")}
                            </text>
                        )}
                    </g>
                )
            })}
        </>
    )
}

function HistoricalAnnotation({
    xScale,
    yScale,
    dataPoint,
    fonts,
}: {
    xScale: (v: number) => number
    yScale: (v: number) => number
    dataPoint: DataPoint
    fonts: PopulationChartFonts
}) {
    const x = xScale(dataPoint.year)
    const y = yScale(dataPoint.value)

    return (
        <>
            <circle cx={x} cy={y} r={4} fill={DENIM_BLUE} />
            <Halo
                id="historical-annotation"
                outlineWidth={3}
                outlineColor="white"
            >
                <text
                    x={x}
                    y={y - 10}
                    textAnchor="middle"
                    fontSize={fonts.pointLabel}
                    fill={DENIM_BLUE}
                    fontWeight={700}
                >
                    {formatPopulationValueLong(dataPoint.value)}
                </text>
            </Halo>
        </>
    )
}
