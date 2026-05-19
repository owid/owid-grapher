import { memo, useMemo, useState, useCallback, useRef, useEffect } from "react"
import { useParentSize } from "@visx/responsive"
import { scaleLinear } from "@visx/scale"
import { Area, LinePath } from "@visx/shape"
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
    GRID_LABEL_COLOR,
    HOVER_LINE_COLOR,
    ZERO_LINE_COLOR,
    USER_MODIFIED_COLOR,
    FULL_TIME_RANGE,
    COLOR_CHILDREN,
    COLOR_WORKING,
    COLOR_RETIRED,
} from "../helpers/constants"

import { GRAPHER_LIGHT_TEXT } from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { darkenColorForText } from "@ourworldindata/grapher/src/color/ColorUtils.js"
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
import { toBreakpoint, useBreakpoint } from "../helpers/useBreakpoint.js"
import { usePinnedTooltip } from "../../../../hooks/usePinnedTooltip.js"
import {
    getPopulationChartFonts,
    type PopulationChartFonts,
} from "../helpers/fonts.js"
import { OwidVariableRoundingMode } from "@ourworldindata/types"

const margin = { top: 0, bottom: 16, left: 0, right: 0 }

function formatPopulationDifference(difference: number): string {
    return formatValue(difference, {
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 2,
        numberAbbreviation: "short",
        showPlus: true,
    })
}

interface DataPoint {
    year: number
    value: number
}

type AgeAreaKey = "young" | "working" | "old"

interface AgeAreaDataPoint {
    year: number
    young: number
    working: number
    old: number
}

interface AgeAreaStackPoint extends AgeAreaDataPoint {
    stack: Record<AgeAreaKey, { y0: number; y1: number }>
}

const AGE_AREA_OPACITY = 0.35

const AGE_AREA_LAYERS: {
    key: AgeAreaKey
    label: string
    shortLabel: string
    color: string
}[] = [
    {
        key: "young",
        label: "Children (<15)",
        shortLabel: "Children",
        color: COLOR_CHILDREN,
    },
    {
        key: "working",
        label: "Working age (15–64)",
        shortLabel: "Working age",
        color: COLOR_WORKING,
    },
    {
        key: "old",
        label: "Retired (65+)",
        shortLabel: "Retired",
        color: COLOR_RETIRED,
    },
]

interface TooltipState {
    target: { year: number } | null
    position: { x: number; y: number }
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
    showAgeGroupAreas?: boolean
}

function PopulationChartContent({
    simulation,
    width,
    height,
    showCustomProjection = true,
    showAgeGroupAreas = false,
}: PopulationChartProps & { width: number; height: number }) {
    const windowBreakpoint = useBreakpoint()
    const breakpoint = toBreakpoint(width)
    const fonts = getPopulationChartFonts(breakpoint, windowBreakpoint)

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

    const hoveredYear = tooltipState.target?.year ?? null

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

    const ageAreaDataPoints = useMemo(
        () =>
            R.pipe(
                FULL_TIME_RANGE,
                R.map((year) => {
                    const zones = showCustomProjection
                        ? simulation.getAgeZonePopulation(year)
                        : simulation.getBenchmarkAgeZonePopulation(year)
                    const total = zones.young + zones.working + zones.old
                    if (total <= 0) return undefined
                    return {
                        year,
                        young: zones.young,
                        working: zones.working,
                        old: zones.old,
                    }
                }),
                R.filter(R.isDefined)
            ),
        [simulation, showCustomProjection]
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

    const ageAreaStackPoints = useMemo(
        () => ageAreaDataPoints.map(toAgeAreaStackPoint),
        [ageAreaDataPoints]
    )

    const handlePointerMove = useCallback(
        (
            e:
                | React.MouseEvent<SVGRectElement>
                | React.TouchEvent<SVGRectElement>
        ) => {
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

            setTooltipState({
                target: { year: clampedYear },
                position: { x: point.x, y: point.y },
            })
        },
        [xScale]
    )

    // Attach touchmove with { passive: false } so preventDefault() works.
    // React registers touch listeners as passive by default, which makes
    // preventDefault() a no-op and logs a console warning.
    const interactionRectRef = useRef<SVGRectElement>(null)
    useEffect(() => {
        const el = interactionRectRef.current
        if (!el) return

        const onTouchMove = (e: TouchEvent) => {
            e.preventDefault()
            handlePointerMove(e as unknown as React.TouchEvent<SVGRectElement>)
        }
        el.addEventListener("touchmove", onTouchMove, { passive: false })
        return () => el.removeEventListener("touchmove", onTouchMove)
    }, [handlePointerMove])

    const handlePointerLeave = useCallback(() => {
        setTooltipState((prev) => ({ ...prev, target: null }))
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

    const lastProjectionDataPoint = last(projectionDataPoints)?.value
    const lastBenchmarkDataPoint = last(benchmarkDataPoints)?.value

    // Shouldn't happen
    if (
        lastProjectionDataPoint === undefined ||
        lastBenchmarkDataPoint === undefined
    ) {
        return null
    }

    const hasUserChanges = showCustomProjection && simulation.isModified
    const projectionColor = hasUserChanges ? USER_MODIFIED_COLOR : DENIM_BLUE

    // Show change annotation at the end year when not hovering,
    // or at the hovered year when hovering a projection year
    const isHovering = hoveredYear !== null
    const changeAnnotationYear = isHovering ? hoveredYear : END_YEAR
    const dotDistance = pixelDistance(
        yScale,
        isHovering ? hoveredValues?.projection?.value : lastProjectionDataPoint,
        isHovering ? hoveredValues?.benchmark?.value : lastBenchmarkDataPoint
    )
    const shouldShowChangeAnnotation = hasUserChanges && dotDistance > 18

    return (
        <div ref={chartRef} style={{ position: "relative" }}>
            <svg width={width} height={height} overflow="visible">
                <Group left={margin.left} top={margin.top}>
                    {/* Projection area background */}
                    <rect
                        x={xScale(HISTORICAL_END_YEAR)}
                        y={0}
                        width={innerWidth - xScale(HISTORICAL_END_YEAR)}
                        height={innerHeight}
                        fill={PROJECTION_BACKGROUND}
                    />

                    {showAgeGroupAreas && (
                        <PopulationAgeAreaPaths
                            data={ageAreaStackPoints}
                            xScale={xScale}
                            yScale={yScale}
                        />
                    )}

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

                    {showAgeGroupAreas && (
                        <PopulationAgeAreaLabels
                            data={ageAreaStackPoints}
                            xScale={xScale}
                            yScale={yScale}
                            innerWidth={innerWidth}
                            fontSize={fonts.pointLabel}
                        />
                    )}

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
                            stroke={projectionColor}
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
                        forecastColor={projectionColor}
                        fonts={fonts}
                    />

                    {/* Change annotation between endpoints with arrow */}
                    {shouldShowChangeAnnotation && (
                        <ChangeAnnotation
                            xScale={xScale}
                            yScale={yScale}
                            year={changeAnnotationYear}
                            innerWidth={innerWidth}
                            projectionDataPoints={projectionDataPoints}
                            benchmarkDataPoints={benchmarkDataPoints}
                            color={projectionColor}
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
                            projectionColor={projectionColor}
                        />
                    )}

                    {/* Invisible interaction rect — must be last to capture events.
                        Extended horizontally by 20px on each side so the hover
                        doesn't disappear immediately at the chart edges. */}
                    <rect
                        ref={interactionRectRef}
                        x={-20}
                        y={0}
                        width={innerWidth + 40}
                        height={innerHeight}
                        fill="transparent"
                        onMouseMove={handlePointerMove}
                        onMouseLeave={handlePointerLeave}
                        onTouchStart={handlePointerMove}
                    />
                </Group>
            </svg>

            {/* Tooltip */}
            {hoveredYear !== null && hoveredValues && (
                <TooltipCard
                    id="population-chart-tooltip"
                    x={tooltipState.position.x}
                    y={tooltipState.position.y}
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
                        projectionColor={projectionColor}
                    />
                </TooltipCard>
            )}
        </div>
    )
}

export const PopulationChart = memo(function PopulationChart(
    props: PopulationChartProps
) {
    const { parentRef, width, height } = useParentSize()
    return (
        <div ref={parentRef} className="responsive-container">
            {width > 0 && height > 0 && (
                <PopulationChartContent
                    {...props}
                    width={width}
                    height={height}
                />
            )}
        </div>
    )
})

function toAgeAreaStackPoint(point: AgeAreaDataPoint): AgeAreaStackPoint {
    const youngTop = point.young
    const workingTop = youngTop + point.working
    const oldTop = workingTop + point.old

    return {
        ...point,
        stack: {
            young: { y0: 0, y1: youngTop },
            working: { y0: youngTop, y1: workingTop },
            old: { y0: workingTop, y1: oldTop },
        },
    }
}

function PopulationAgeAreaPaths({
    data,
    xScale,
    yScale,
}: {
    data: AgeAreaStackPoint[]
    xScale: (v: number) => number
    yScale: (v: number) => number
}) {
    return (
        <g pointerEvents="none">
            {AGE_AREA_LAYERS.map((layer) => (
                <Area<AgeAreaStackPoint>
                    key={layer.key}
                    data={data}
                    x={(d) => xScale(d.year)}
                    y0={(d) => yScale(d.stack[layer.key].y0)}
                    y1={(d) => yScale(d.stack[layer.key].y1)}
                    fill={layer.color}
                    opacity={AGE_AREA_OPACITY}
                />
            ))}
        </g>
    )
}

function PopulationAgeAreaLabels({
    data,
    xScale,
    yScale,
    innerWidth,
    fontSize,
}: {
    data: AgeAreaStackPoint[]
    xScale: (v: number) => number
    yScale: (v: number) => number
    innerWidth: number
    fontSize: number
}) {
    const labelPadding = 8
    const minimumLayerHeight = fontSize * 0.75

    return (
        <g pointerEvents="none">
            {AGE_AREA_LAYERS.map((layer) => {
                const label = getAgeAreaLabel({
                    data,
                    layerKey: layer.key,
                    label: layer.label,
                    shortLabel: layer.shortLabel,
                    xScale,
                    yScale,
                    innerWidth,
                    fontSize,
                    minimumLayerHeight,
                    labelPadding,
                })

                if (!label) return null

                return (
                    <Halo
                        key={layer.key}
                        id={`age-area-label-${layer.key}`}
                        outlineWidth={2}
                        outlineColor="white"
                    >
                        <text
                            x={label.x}
                            y={label.y}
                            textAnchor="end"
                            dominantBaseline="central"
                            fontSize={fontSize}
                            fontWeight={700}
                            fill={darkenColorForText(layer.color)}
                        >
                            {label.text}
                        </text>
                    </Halo>
                )
            })}
        </g>
    )
}

function getAgeAreaLabel({
    data,
    layerKey,
    label,
    shortLabel,
    xScale,
    yScale,
    innerWidth,
    fontSize,
    minimumLayerHeight,
    labelPadding,
}: {
    data: AgeAreaStackPoint[]
    layerKey: AgeAreaKey
    label: string
    shortLabel: string
    xScale: (v: number) => number
    yScale: (v: number) => number
    innerWidth: number
    fontSize: number
    minimumLayerHeight: number
    labelPadding: number
}): { x: number; y: number; text: string } | null {
    const labelWidth = new TextWrap({
        text: label,
        fontSize,
        fontWeight: 700,
        maxWidth: Infinity,
    }).width
    const shortLabelWidth = new TextWrap({
        text: shortLabel,
        fontSize,
        fontWeight: 700,
        maxWidth: Infinity,
    }).width

    const makeCandidate = (point: AgeAreaStackPoint, text: string) => {
        const stack = point.stack[layerKey]
        const yTop = yScale(stack.y1)
        const yBottom = yScale(stack.y0)
        return {
            x: xScale(point.year),
            y: (yTop + yBottom) / 2,
            height: Math.abs(yBottom - yTop),
            text,
        }
    }

    const fits = (point: AgeAreaStackPoint, textWidth: number) => {
        const candidate = makeCandidate(point, label)
        return (
            candidate.height >= minimumLayerHeight &&
            candidate.x - textWidth >= labelPadding &&
            candidate.x <= innerWidth - labelPadding
        )
    }

    const pointWithLongLabel = data.find((point) => fits(point, labelWidth))
    if (pointWithLongLabel) return makeCandidate(pointWithLongLabel, label)

    const pointWithShortLabel = data.find((point) =>
        fits(point, shortLabelWidth)
    )
    if (pointWithShortLabel) {
        return makeCandidate(pointWithShortLabel, shortLabel)
    }

    return null
}

function HoverDots({
    x,
    yScale,
    hoveredValues,
    showCustomProjection,
    projectionColor = DENIM_BLUE,
}: {
    x: number
    yScale: (v: number) => number
    hoveredValues: {
        historical: DataPoint | undefined
        projection: DataPoint | undefined
        benchmark: DataPoint | undefined
    }
    showCustomProjection: boolean
    projectionColor?: string
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
                    fill={projectionColor}
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
    forecastColor = DENIM_BLUE,
    fonts,
}: {
    xScale: (v: number) => number
    yScale: (v: number) => number
    forecastDataPoints: DataPoint[]
    benchmarkDataPoints: DataPoint[]
    showBenchmark: boolean
    forecastColor?: string
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
                    <circle
                        cx={x}
                        cy={yBenchmark}
                        r={4}
                        fill={BENCHMARK_LINE_COLOR}
                    />
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
            <circle cx={x} cy={yForecast} r={4} fill={forecastColor} />
            <Halo id="projection-label" outlineWidth={3} outlineColor="white">
                <text
                    x={x}
                    y={yForecast + (forecastLabelAbove ? -10 : 16)}
                    textAnchor="end"
                    fontSize={fonts.pointLabel}
                    fill={forecastColor}
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
    color = DENIM_BLUE,
    fonts,
}: {
    xScale: (v: number) => number
    yScale: (v: number) => number
    year: number
    innerWidth: number
    projectionDataPoints: { year: number; value: number }[]
    benchmarkDataPoints: { year: number; value: number }[]
    color?: string
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
    const difference = forecastValue - benchmarkValue
    const differenceLabel = formatPopulationDifference(difference)

    const labelFontSize = fonts.changeAnnotation
    const labelGap = 6
    const labelWidth = new TextWrap({
        text: differenceLabel,
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
                color={color}
                width={1.5}
            />

            {/* Difference label */}
            <Halo id="change-label" outlineWidth={2}>
                <text
                    x={placeOnRight ? x + labelGap : x - labelGap}
                    y={midY}
                    textAnchor={placeOnRight ? "start" : "end"}
                    dominantBaseline="middle"
                    fontSize={labelFontSize}
                    fontWeight={500}
                    fill={color}
                >
                    {differenceLabel}
                </text>
            </Halo>
        </>
    )
}

function PopulationTooltipContent({
    hoveredYear,
    hoveredValues,
    showCustomProjection,
    hasUserChanges,
    projectionColor = DENIM_BLUE,
}: {
    hoveredYear: number
    hoveredValues: {
        historical: DataPoint | undefined
        projection: DataPoint | undefined
        benchmark: DataPoint | undefined
    }
    showCustomProjection: boolean
    hasUserChanges: boolean
    projectionColor?: string
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
    const formattedDifference = formatPopulationDifference(difference)

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
                color={projectionColor}
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
    const ticks = yScale
        .ticks(tickCount)
        .filter(
            (t) => yScale(t) > fonts.yTick + 4 && yScale(t) < innerHeight - 4
        )

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
                                x={0}
                                y={yScale(tick) - 4}
                                fontSize={fonts.yTick}
                                fill={GRID_LABEL_COLOR}
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
