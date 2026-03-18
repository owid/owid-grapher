import { useMemo } from "react"
import { useParentSize } from "@visx/responsive"
import { scaleLinear, scaleBand } from "@visx/scale"
import { Bar } from "@visx/shape"
import { AxisBottom } from "@visx/axis"
import { Group } from "@visx/group"
import type { ScaleLinear } from "d3-scale"
import type { Simulation } from "../helpers/useSimulation"
import {
    DENIM_BLUE,
    GRID_LINE_COLOR,
    LABEL_COLOR,
    PYRAMID_AGE_GROUPS,
} from "../helpers/constants"
import { GRAPHER_LIGHT_TEXT } from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { computeMaxAgeGroupPopulation } from "../helpers/projectionRunner"
import {
    groupByAgeRange,
    calculateMedianAge,
    findAgeGroup,
    formatPopulationValueShort,
} from "../helpers/chartUtils"

const margin = { top: 12, right: 4, bottom: 18, left: 4 }
const CENTER_GAP = 40 // width reserved for age labels in the center

// Labels reversed so 0-4 at bottom, oldest at top
const ageGroupLabels = [...PYRAMID_AGE_GROUPS].reverse()

interface PyramidChartProps {
    simulation: Simulation
    year: number
}

function DemographyPyramidChart({
    simulation,
    year,
    width,
    height,
}: PyramidChartProps & { width: number; height: number }) {
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const halfWidth = (innerWidth - CENTER_GAP) / 2
    const centerX = margin.left + halfWidth

    const populationBySex = simulation.getPopulationForYear(year)

    const { ageBucketsBySex, medianAgeBucketBySex } = useMemo(() => {
        const male = populationBySex?.male ?? []
        const female = populationBySex?.female ?? []
        return {
            ageBucketsBySex: {
                male: groupByAgeRange(male),
                female: groupByAgeRange(female),
            },
            medianAgeBucketBySex: {
                male: findAgeGroup(calculateMedianAge(male)),
                female: findAgeGroup(calculateMedianAge(female)),
            },
        }
    }, [populationBySex])

    const xScale = useMemo(() => {
        const xAxisMax = computeMaxAgeGroupPopulation(simulation)
        const domain = [0, xAxisMax]
        return {
            // Male: 0 at center, xAxisMax at left edge
            male: scaleLinear({ domain, range: [halfWidth, 0] }),
            // Female: 0 at center, xAxisMax at right edge
            female: scaleLinear({ domain, range: [0, halfWidth] }),
        }
    }, [halfWidth, simulation])

    const yScale = useMemo(
        () =>
            scaleBand({
                domain: ageGroupLabels,
                range: [0, innerHeight],
                padding: 0.15,
            }),
        [innerHeight]
    )

    return (
        <div style={{ position: "relative" }}>
            <svg width={width} height={height} overflow="visible">
                <Group top={margin.top}>
                    <PyramidHalf
                        left={margin.left}
                        xScale={xScale.male}
                        yScale={yScale}
                        ageBuckets={ageBucketsBySex.male}
                        height={innerHeight}
                    />

                    <PyramidHalf
                        left={centerX + CENTER_GAP}
                        xScale={xScale.female}
                        yScale={yScale}
                        ageBuckets={ageBucketsBySex.female}
                        height={innerHeight}
                    />

                    <PyramidAxisX
                        centerX={centerX + CENTER_GAP / 2}
                        gapWidth={CENTER_GAP}
                        yScale={yScale}
                        medianAgeBucket={medianAgeBucketBySex}
                    />
                </Group>
            </svg>
        </div>
    )
}

export function ResponsiveDemographyPyramidChart({
    simulation,
    year,
}: PyramidChartProps) {
    const { parentRef, width, height } = useParentSize()
    return (
        <div ref={parentRef} style={{ width: "100%", height: "100%" }}>
            {width > 0 && height > 0 ? (
                <DemographyPyramidChart
                    simulation={simulation}
                    year={year}
                    width={width}
                    height={height}
                />
            ) : null}
        </div>
    )
}

function PyramidHalf({
    left,
    xScale,
    yScale,
    ageBuckets,
    height,
}: {
    left: number
    xScale: ScaleLinear<number, number>
    yScale: ReturnType<typeof scaleBand<string>>
    ageBuckets: Record<string, number>
    height: number
}) {
    const zeroX = xScale(0)
    return (
        <Group left={left}>
            {/* Grid lines */}
            {xScale
                .ticks(3)
                .filter((t) => t > 0)
                .map((tick) => (
                    <line
                        key={`grid-${tick}`}
                        x1={xScale(tick)}
                        y1={0}
                        x2={xScale(tick)}
                        y2={height}
                        stroke={GRID_LINE_COLOR}
                        strokeWidth={1}
                        strokeDasharray="4,4"
                    />
                ))}

            {/* X-axis */}
            <AxisBottom
                top={height}
                scale={xScale}
                numTicks={3}
                tickFormat={(v) => formatPopulationValueShort(v as number)}
                stroke="transparent"
                tickStroke={GRAPHER_LIGHT_TEXT}
                tickLength={4}
                tickLabelProps={{
                    fontSize: 9,
                    fill: GRAPHER_LIGHT_TEXT,
                    textAnchor: "middle",
                }}
            />

            {/* Bars */}
            {ageGroupLabels.map((g) => {
                const scaledVal = xScale(ageBuckets[g] || 0)
                return (
                    <Bar
                        key={g}
                        x={Math.min(scaledVal, zeroX)}
                        y={yScale(g) ?? 0}
                        width={Math.abs(scaledVal - zeroX)}
                        height={yScale.bandwidth()}
                        fill={DENIM_BLUE}
                    />
                )
            })}
        </Group>
    )
}

function PyramidAxisX({
    centerX,
    gapWidth,
    yScale,
    medianAgeBucket,
}: {
    centerX: number
    gapWidth: number
    yScale: ReturnType<typeof scaleBand<string>>
    medianAgeBucket: { male?: string; female?: string }
}) {
    return (
        <>
            {/* Age group labels with median arrows */}
            {ageGroupLabels.map((ageGroupLabel) => {
                const y = yScale(ageGroupLabel) ?? 0
                const bandY = y + yScale.bandwidth() / 2

                const isMaleMedian = ageGroupLabel === medianAgeBucket.male
                const isFemaleMedian = ageGroupLabel === medianAgeBucket.female
                const isMedian = isMaleMedian || isFemaleMedian

                return (
                    <g key={ageGroupLabel}>
                        {isMaleMedian && (
                            <Triangle
                                x={centerX - 13}
                                y={bandY}
                                direction="right"
                            />
                        )}
                        <text
                            x={centerX}
                            y={bandY}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={8}
                            fill={isMedian ? GRAPHER_LIGHT_TEXT : LABEL_COLOR}
                        >
                            {ageGroupLabel}
                        </text>
                        {isFemaleMedian && (
                            <Triangle
                                x={centerX + 13}
                                y={bandY}
                                direction="left"
                            />
                        )}
                    </g>
                )
            })}

            {/* MEN / AGE / WOMEN header */}
            <text
                x={centerX - gapWidth / 2 - 4}
                y={-4}
                textAnchor="end"
                fontSize={10}
                fontWeight={600}
                fill={GRAPHER_LIGHT_TEXT}
                letterSpacing="0.05em"
            >
                MEN
            </text>
            <text
                x={centerX}
                y={-4}
                textAnchor="middle"
                fontSize={8}
                fill={LABEL_COLOR}
                letterSpacing="0.05em"
            >
                AGE
            </text>
            <text
                x={centerX + gapWidth / 2 + 4}
                y={-4}
                textAnchor="start"
                fontSize={10}
                fontWeight={600}
                fill={GRAPHER_LIGHT_TEXT}
                letterSpacing="0.05em"
            >
                WOMEN
            </text>
        </>
    )
}

function Triangle({
    x,
    y,
    direction,
}: {
    x: number
    y: number
    direction: "left" | "right"
}) {
    const sign = direction === "right" ? -1 : 1
    return (
        <polygon
            points={`${x + sign * 4},${y - 3} ${x + sign * 4},${y + 3} ${x},${y}`}
            fill={GRAPHER_LIGHT_TEXT}
        />
    )
}
