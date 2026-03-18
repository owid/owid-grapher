import { useMemo, useCallback } from "react"
import { ParentSize } from "@visx/responsive"
import { scaleLinear, scaleBand } from "@visx/scale"
import { Bar } from "@visx/shape"
import { AxisBottom, AxisLeft } from "@visx/axis"
import { Group } from "@visx/group"
import { useTooltip, TooltipWithBounds } from "@visx/tooltip"
import { localPoint } from "@visx/event"
import type { Simulation } from "../helpers/useSimulation"
import { PYRAMID_AGE_GROUPS } from "../helpers/constants"
import {
    START_YEAR,
    HISTORICAL_END_YEAR,
    END_YEAR,
} from "../helpers/constants"
import { computePyramidMaxExtent } from "../helpers/projectionRunner"
import {
    TOOLTIP_STYLE,
    formatPopulation,
    parseAgeGroupBounds,
    aggregateToPyramidAgeGroups,
    computeMedianAgeForSex,
    findAgeGroupForAge,
} from "../helpers/chartUtils"

const margin = { top: 12, right: 4, bottom: 18, left: 4 }
const CENTER_GAP = 40 // width reserved for age labels in the center

// Labels reversed so 0-4 at bottom, oldest at top
const labels = [...PYRAMID_AGE_GROUPS].reverse()

// Thin out labels for display on the y-axis
const displayLabels = new Set(labels.filter((_, i) => i % 2 === 0))

interface PyramidChartProps {
    simulation: Simulation
    year: number
    // retirementAge: number
}

interface TooltipData {
    ageGroup: string
    male: number
    female: number
}

function PyramidChartInner({
    simulation,
    year,
    // retirementAge,
    width,
    height,
}: PyramidChartProps & { width: number; height: number }) {
    const {
        showTooltip,
        hideTooltip,
        tooltipData,
        tooltipLeft,
        tooltipTop,
        tooltipOpen,
    } = useTooltip<TooltipData>()

    const maxExtent = useMemo(() => {
        return computePyramidMaxExtent({
            data: simulation.data,
            forecastResults: simulation.forecastResults,
            startYear: START_YEAR,
            historicalEndYear: HISTORICAL_END_YEAR,
            endYear: END_YEAR,
            pyramidAgeGroups: PYRAMID_AGE_GROUPS,
            aggregateToPyramidAgeGroups,
        })
    }, [simulation.data, simulation.forecastResults])

    const population = simulation.getPopulationForYear(year)

    const { maleData, femaleData } = useMemo(() => {
        if (!population) {
            const empty: Record<string, number> = {}
            for (const g of labels) empty[g] = 0
            return { maleData: empty, femaleData: empty }
        }
        return {
            maleData: aggregateToPyramidAgeGroups(population.male),
            femaleData: aggregateToPyramidAgeGroups(population.female),
        }
    }, [population])

    // Median age per sex and the bucket each falls into
    const { maleMedianBucket, femaleMedianBucket } = useMemo(() => {
        if (!population)
            return {
                maleMedianBucket: undefined,
                femaleMedianBucket: undefined,
            }
        const maleMedian = computeMedianAgeForSex(population.male)
        const femaleMedian = computeMedianAgeForSex(population.female)
        return {
            maleMedianBucket: findAgeGroupForAge(maleMedian),
            femaleMedianBucket: findAgeGroupForAge(femaleMedian),
        }
    }, [population])

    // UN WPP reference population for overlay
    const unwppPopulation =
        year > HISTORICAL_END_YEAR
            ? (simulation.unwppBenchmarkResults[year]?.population ?? null)
            : null

    const { unwppMaleData, unwppFemaleData } = useMemo(() => {
        if (!unwppPopulation) {
            return { unwppMaleData: null, unwppFemaleData: null }
        }
        return {
            unwppMaleData: aggregateToPyramidAgeGroups(unwppPopulation.male),
            unwppFemaleData: aggregateToPyramidAgeGroups(
                unwppPopulation.female
            ),
        }
    }, [unwppPopulation])

    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom
    const halfWidth = (innerWidth - CENTER_GAP) / 2
    const centerX = margin.left + halfWidth

    // Male scale: value 0 at center, maxExtent at left edge
    const maleXScale = useMemo(
        () => scaleLinear({ domain: [0, maxExtent], range: [halfWidth, 0] }),
        [halfWidth, maxExtent]
    )
    // Female scale: value 0 at center, maxExtent at right edge
    const femaleXScale = useMemo(
        () => scaleLinear({ domain: [0, maxExtent], range: [0, halfWidth] }),
        [halfWidth, maxExtent]
    )

    const yScale = useMemo(
        () =>
            scaleBand({
                domain: labels,
                range: [0, innerHeight],
                padding: 0.15,
            }),
        [innerHeight]
    )

    // // Shading regions
    // const shadingRects = useMemo(() => {
    //     const rects: { y: number; height: number; fill: string }[] = []

    //     // Find boundary indices
    //     let youngEndLabel: string | null = null
    //     let oldStartLabel: string | null = null

    //     for (const label of labels) {
    //         const { startAge, endAge } = parseAgeGroupBounds(label)
    //         if (endAge === 14) youngEndLabel = label
    //         if (startAge >= retirementAge) oldStartLabel = label
    //         if (startAge < retirementAge && endAge >= retirementAge)
    //             oldStartLabel = label
    //     }

    //     if (!youngEndLabel || !oldStartLabel) return rects

    //     const youngEndY =
    //         (yScale(youngEndLabel) ?? 0) + (yScale.bandwidth?.() ?? 0)
    //     const oldStartY = yScale(oldStartLabel) ?? 0

    //     // Old dependents (top)
    //     rects.push({
    //         y: 0,
    //         height: oldStartY + yScale.bandwidth(),
    //         fill: "rgba(255, 152, 0, 0.15)",
    //     })

    //     // Working age (middle)
    //     rects.push({
    //         y: oldStartY + yScale.bandwidth(),
    //         height: youngEndY - (oldStartY + yScale.bandwidth()),
    //         fill: "rgba(66, 165, 245, 0.15)",
    //     })

    //     // Young dependents (bottom)
    //     rects.push({
    //         y: youngEndY,
    //         height: innerHeight - youngEndY,
    //         fill: "rgba(156, 39, 176, 0.15)",
    //     })

    //     return rects
    // }, [yScale, retirementAge, innerHeight])

    const handleMouseMove = useCallback(
        (event: React.MouseEvent<SVGRectElement>) => {
            const point = localPoint(event)
            if (!point) return
            const y = point.y - margin.top

            // Find which age group the mouse is over
            const bandWidth = yScale.bandwidth()
            const step = yScale.step()
            const idx = Math.floor(y / step)
            if (idx < 0 || idx >= labels.length) return
            const ageGroup = labels[idx]

            showTooltip({
                tooltipData: {
                    ageGroup,
                    male: maleData[ageGroup] || 0,
                    female: femaleData[ageGroup] || 0,
                },
                tooltipLeft: point.x,
                tooltipTop:
                    (yScale(ageGroup) ?? 0) + bandWidth / 2 + margin.top,
            })
        },
        [yScale, maleData, femaleData, showTooltip]
    )

    return (
        <div style={{ position: "relative" }}>
            <svg width={width} height={height} overflow="visible">
                <Group top={margin.top}>
                    {/* Background shading */}
                    {/* {shadingRects.map((r, i) => (
            <rect
              key={i}
              x={margin.left}†
              y={r.y}
              width={innerWidth}
              height={r.height}
              fill={r.fill}
            />
          ))} */}

                    {/* Grid lines for male side */}
                    <Group left={margin.left}>
                        {maleXScale
                            .ticks(3)
                            .filter((t) => t > 0)
                            .map((tick) => (
                                <line
                                    key={`grid-m-${tick}`}
                                    x1={maleXScale(tick)}
                                    y1={0}
                                    x2={maleXScale(tick)}
                                    y2={innerHeight}
                                    stroke="#ddd"
                                    strokeWidth={1}
                                    strokeDasharray="4,4"
                                />
                            ))}
                    </Group>
                    {/* Grid lines for female side */}
                    <Group left={centerX + CENTER_GAP}>
                        {femaleXScale
                            .ticks(3)
                            .filter((t) => t > 0)
                            .map((tick) => (
                                <line
                                    key={`grid-f-${tick}`}
                                    x1={femaleXScale(tick)}
                                    y1={0}
                                    x2={femaleXScale(tick)}
                                    y2={innerHeight}
                                    stroke="#ddd"
                                    strokeWidth={1}
                                    strokeDasharray="4,4"
                                />
                            ))}
                    </Group>

                    {/* Male bars (left of center) */}
                    <Group left={margin.left}>
                        {labels.map((g) => {
                            const val = maleData[g] || 0
                            const x = maleXScale(val)
                            return (
                                <Bar
                                    key={`m-${g}`}
                                    x={x}
                                    y={yScale(g) ?? 0}
                                    width={halfWidth - x}
                                    height={yScale.bandwidth()}
                                    fill="#4c6a9c"
                                />
                            )
                        })}
                    </Group>

                    {/* Female bars (right of center) */}
                    <Group left={centerX + CENTER_GAP}>
                        {labels.map((g) => {
                            const val = femaleData[g] || 0
                            return (
                                <Bar
                                    key={`f-${g}`}
                                    x={0}
                                    y={yScale(g) ?? 0}
                                    width={femaleXScale(val)}
                                    height={yScale.bandwidth()}
                                    fill="#4c6a9c"
                                />
                            )
                        })}
                    </Group>

                    {/* Center age labels + median arrows */}
                    {labels.map((g) => {
                        if (!g) return null
                        const bandY = (yScale(g) ?? 0) + yScale.bandwidth() / 2
                        const isMaleMedian = g === maleMedianBucket
                        const isFemaleMedian = g === femaleMedianBucket
                        return (
                            <g key={`label-${g}`}>
                                {isMaleMedian && (
                                    <polygon
                                        points={`${centerX + CENTER_GAP / 2 - 17},${bandY - 3} ${centerX + CENTER_GAP / 2 - 17},${bandY + 3} ${centerX + CENTER_GAP / 2 - 13},${bandY}`}
                                        fill="#777"
                                    />
                                )}
                                <text
                                    x={centerX + CENTER_GAP / 2}
                                    y={bandY}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    fontSize={8}
                                    fill={
                                        isMaleMedian || isFemaleMedian
                                            ? "#777"
                                            : "#999"
                                    }
                                >
                                    {g}
                                </text>
                                {isFemaleMedian && (
                                    <polygon
                                        points={`${centerX + CENTER_GAP / 2 + 17},${bandY - 3} ${centerX + CENTER_GAP / 2 + 17},${bandY + 3} ${centerX + CENTER_GAP / 2 + 13},${bandY}`}
                                        fill="#777"
                                    />
                                )}
                            </g>
                        )
                    })}

                    {/* Male/Female/Age labels */}
                    <text
                        x={centerX - 4}
                        y={-4}
                        textAnchor="end"
                        fontSize={10}
                        fontWeight={600}
                        fill="#767676"
                        letterSpacing="0.05em"
                    >
                        MEN
                    </text>
                    <text
                        x={centerX + CENTER_GAP / 2}
                        y={-4}
                        textAnchor="middle"
                        fontSize={8}
                        fill="#999"
                        letterSpacing="0.05em"
                    >
                        AGE
                    </text>
                    <text
                        x={centerX + CENTER_GAP + 4}
                        y={-4}
                        textAnchor="start"
                        fontSize={10}
                        fontWeight={600}
                        fill="#767676"
                        letterSpacing="0.05em"
                    >
                        WOMEN
                    </text>

                    {/* X-axis for male side (mirrored) */}
                    <Group left={margin.left}>
                        <AxisBottom
                            top={innerHeight}
                            scale={maleXScale}
                            numTicks={3}
                            tickFormat={(v) => {
                                const n = v as number
                                if (n >= 1e6) return `${Math.round(n / 1e6)}M`
                                if (n >= 1e3) return `${Math.round(n / 1e3)}K`
                                return String(Math.round(n))
                            }}
                            stroke="transparent"
                            tickStroke="#767676"
                            tickLength={4}
                            tickLabelProps={{
                                fontSize: 9,
                                fill: "#767676",
                                textAnchor: "middle",
                            }}
                        />
                    </Group>
                    {/* X-axis for female side */}
                    <Group left={centerX + CENTER_GAP}>
                        <AxisBottom
                            top={innerHeight}
                            scale={femaleXScale}
                            numTicks={3}
                            tickFormat={(v) => {
                                const n = v as number
                                if (n >= 1e6) return `${Math.round(n / 1e6)}M`
                                if (n >= 1e3) return `${Math.round(n / 1e3)}K`
                                return String(Math.round(n))
                            }}
                            stroke="transparent"
                            tickStroke="#767676"
                            tickLength={4}
                            tickLabelProps={{
                                fontSize: 9,
                                fill: "#767676",
                                textAnchor: "middle",
                            }}
                        />
                    </Group>

                    {/* Invisible overlay for mouse events */}
                    <rect
                        x={margin.left}
                        width={innerWidth}
                        height={innerHeight}
                        fill="transparent"
                        onMouseMove={handleMouseMove}
                        onMouseLeave={hideTooltip}
                    />
                </Group>
            </svg>

            {tooltipOpen && tooltipData && (
                <TooltipWithBounds
                    left={tooltipLeft}
                    top={tooltipTop}
                    unstyled
                    style={TOOLTIP_STYLE}
                >
                    <div style={{ fontWeight: 600 }}>
                        {tooltipData.ageGroup}
                    </div>
                    <div>
                        <span style={{ color: "#90CAF9" }}>Male:</span>{" "}
                        {formatPopulation(tooltipData.male)}
                    </div>
                    <div>
                        <span style={{ color: "#F48FB1" }}>Female:</span>{" "}
                        {formatPopulation(tooltipData.female)}
                    </div>
                </TooltipWithBounds>
            )}
        </div>
    )
}

export function DemographyPyramidChart({
    simulation,
    year,
}: PyramidChartProps) {
    return (
        <ParentSize>
            {({ width, height }) =>
                width > 0 && height > 0 ? (
                    <PyramidChartInner
                        simulation={simulation}
                        year={year}
                        // retirementAge={retirementAge}
                        width={width}
                        height={height}
                    />
                ) : null
            }
        </ParentSize>
    )
}
