import { memo, useMemo } from "react"
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
} from "../helpers/constants"
import { GRAPHER_LIGHT_TEXT } from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { formatValue } from "@ourworldindata/utils"
import * as R from "remeda"
import { BezierArrow } from "../../../../components/BezierArrow/BezierArrow.js"
import { Halo } from "@ourworldindata/components"
import { formatPopulationValueLong } from "../helpers/utils.js"
import { TimeAxisX } from "./TimeAxisX.js"
import { last } from "lodash-es"

const margin = { top: 18, bottom: 18, left: 0, right: 0 }

interface DataPoint {
    year: number
    value: number
}

interface PopulationChartProps {
    simulation: Simulation
    showCustomProjection?: boolean
}

function PopulationChart({
    simulation,
    showCustomProjection = true,
    width,
    height,
}: PopulationChartProps & { width: number; height: number }) {
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

    // Shouldn't happen
    if (
        lastProjectionDataPoint === undefined ||
        lastBenchmarkDataPoint === undefined
    ) {
        return null
    }

    const hasUserChanges =
        showCustomProjection && simulation.activePreset !== "unwpp"
    const dotDistance = Math.abs(
        yScale(lastProjectionDataPoint) - yScale(lastBenchmarkDataPoint)
    )
    const shouldShowChangeAnnotation = hasUserChanges && dotDistance > 20

    return (
        <div style={{ position: "relative" }}>
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

                    <TimeAxisX
                        xScale={xScale}
                        innerWidth={innerWidth}
                        innerHeight={innerHeight}
                    />
                    <AxisY yScale={yScale} innerWidth={innerWidth} />

                    {/* Projection label */}
                    <Halo
                        id="projection-label"
                        outlineWidth={2}
                        outlineColor={PROJECTION_BACKGROUND}
                    >
                        <text
                            x={xScale(HISTORICAL_END_YEAR) + 6}
                            y={12}
                            fontSize={10}
                            fill={GRAPHER_LIGHT_TEXT}
                        >
                            Projections →
                        </text>
                    </Halo>

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
                    />

                    {/* Change annotation between endpoints with arrow */}
                    {shouldShowChangeAnnotation && (
                        <ChangeAnnotation
                            xScale={xScale}
                            yScale={yScale}
                            projectionDataPoints={projectionDataPoints}
                            benchmarkDataPoints={benchmarkDataPoints}
                        />
                    )}
                </Group>
            </svg>
        </div>
    )
}

export const ResponsivePopulationChart = memo(
    function ResponsivePopulationChart({
        simulation,
        showCustomProjection,
    }: PopulationChartProps) {
        const { parentRef, width, height } = useParentSize()
        return (
            <div ref={parentRef} style={{ width: "100%", height: "100%" }}>
                {width > 0 && height > 0 ? (
                    <PopulationChart
                        simulation={simulation}
                        showCustomProjection={showCustomProjection}
                        width={width}
                        height={height}
                    />
                ) : null}
            </div>
        )
    }
)

function EndpointLabels({
    xScale,
    yScale,
    forecastDataPoints,
    benchmarkDataPoints,
    showBenchmark,
}: {
    xScale: (v: number) => number
    yScale: (v: number) => number
    forecastDataPoints: DataPoint[]
    benchmarkDataPoints: DataPoint[]
    showBenchmark: boolean
}) {
    const forecastValue = forecastDataPoints.at(-1)!.value
    const benchmarkValue = benchmarkDataPoints.at(-1)!.value
    const x = xScale(END_YEAR)
    const yForecast = yScale(forecastValue)
    const yBenchmark = yScale(benchmarkValue)

    return (
        <>
            {showBenchmark && (
                <>
                    <circle cx={x} cy={yBenchmark} r={4} fill="#bbb" />
                    <Halo id="benchmark-label" outlineWidth={2}>
                        <text
                            x={x}
                            y={yBenchmark + (yBenchmark < yForecast ? -10 : 14)}
                            textAnchor="end"
                            fontSize={11}
                            fill={GRAPHER_LIGHT_TEXT}
                            fontWeight={500}
                        >
                            {formatPopulationValueLong(benchmarkValue)}
                        </text>
                    </Halo>
                </>
            )}
            <circle cx={x} cy={yForecast} r={4} fill={DENIM_BLUE} />
            <Halo id="projection-label" outlineWidth={2}>
                <text
                    x={x}
                    y={yForecast + (yForecast < yBenchmark ? -10 : 14)}
                    textAnchor="end"
                    fontSize={11}
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
    projectionDataPoints,
    benchmarkDataPoints,
}: {
    xScale: (v: number) => number
    yScale: (v: number) => number
    projectionDataPoints: { year: number; value: number }[]
    benchmarkDataPoints: { year: number; value: number }[]
}) {
    const forecastValue = projectionDataPoints.at(-1)!.value
    const benchmarkValue = benchmarkDataPoints.at(-1)!.value
    const x = xScale(END_YEAR)
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
            <Halo id="change-label" outlineWidth={2}>
                <text
                    x={x - 6}
                    y={midY}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={10}
                    fontWeight={500}
                    fill={DENIM_BLUE}
                >
                    {pctLabel}
                </text>
            </Halo>
        </>
    )
}

function AxisY({
    yScale,
    innerWidth,
}: {
    yScale: { ticks: (count: number) => number[]; (v: number): number }
    innerWidth: number
}) {
    const ticks = yScale.ticks(4)

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
                            stroke={GRID_LINE_COLOR}
                            strokeWidth={1}
                        />
                        {tick > 0 && (
                            <text
                                x={4}
                                y={yScale(tick) - 4}
                                fontSize={11}
                                fill={LABEL_COLOR}
                            >
                                {formatPopulationValueLong(tick) +
                                    (isTop ? " people" : "")}
                            </text>
                        )}
                    </g>
                )
            })}
        </>
    )
}
