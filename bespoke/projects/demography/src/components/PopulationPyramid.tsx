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
import { computeMaxAgeGroupPopulation } from "../model/projectionRunner"
import {
    groupByAgeRange,
    calculateMedianAge,
    findAgeGroup,
    formatPopulationValueShort,
} from "../helpers/utils"

const BASE_WIDTH = 200
const BASE_MARGIN = { top: 12, right: 4, bottom: 18, left: 4 }
const BASE_CENTER_GAP = 40
const BASE_FONT = { tick: 9, ageLabel: 8, header: 10, ageHeader: 8 }
const BASE_TRIANGLE_SIZE = { w: 4, h: 3 }

/** Round to nearest 0.5px */
function round(v: number): number {
    return Math.round(v * 2) / 2
}

function scaledSizes(width: number) {
    const s = Math.min(Math.sqrt(width / BASE_WIDTH), 1.2)
    return {
        margin: {
            top: round(BASE_MARGIN.top * s),
            right: round(BASE_MARGIN.right * s),
            bottom: round(BASE_MARGIN.bottom * s),
            left: round(BASE_MARGIN.left * s),
        },
        centerGap: round(BASE_CENTER_GAP * s),
        font: {
            tick: round(BASE_FONT.tick * s),
            ageLabel: round(BASE_FONT.ageLabel * s),
            header: round(BASE_FONT.header * s),
            ageHeader: round(BASE_FONT.ageHeader * s),
        },
        triangle: {
            w: round(BASE_TRIANGLE_SIZE.w * s),
            h: round(BASE_TRIANGLE_SIZE.h * s),
        },
    }
}

// Labels reversed so 0-4 at bottom, oldest at top
const ageGroupLabels = [...PYRAMID_AGE_GROUPS].reverse()

interface PopulationPyramidProps {
    simulation: Simulation
    year: number
}

function PopulationPyramid({
    simulation,
    year,
    width,
    height,
}: PopulationPyramidProps & { width: number; height: number }) {
    const sizes = useMemo(() => scaledSizes(width), [width])
    const { margin, centerGap, font, triangle } = sizes

    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const halfWidth = (innerWidth - centerGap) / 2
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
            <svg width={width} height={height}>
                <Group top={margin.top}>
                    <PopulationPyramidHalf
                        left={margin.left}
                        xScale={xScale.male}
                        yScale={yScale}
                        ageBuckets={ageBucketsBySex.male}
                        height={innerHeight}
                        tickFontSize={font.tick}
                    />

                    <PopulationPyramidHalf
                        left={centerX + centerGap}
                        xScale={xScale.female}
                        yScale={yScale}
                        ageBuckets={ageBucketsBySex.female}
                        height={innerHeight}
                        tickFontSize={font.tick}
                    />

                    <PopulationPyramidAxisX
                        centerX={centerX + centerGap / 2}
                        gapWidth={centerGap}
                        yScale={yScale}
                        medianAgeBucket={medianAgeBucketBySex}
                        font={font}
                        triangle={triangle}
                    />
                </Group>
            </svg>
        </div>
    )
}

export function ResponsivePopulationPyramid({
    simulation,
    year,
}: PopulationPyramidProps) {
    const { parentRef, width, height } = useParentSize()
    return (
        <div ref={parentRef} style={{ width: "100%", height: "100%" }}>
            {width > 0 && height > 0 ? (
                <PopulationPyramid
                    simulation={simulation}
                    year={year}
                    width={width}
                    height={height}
                />
            ) : null}
        </div>
    )
}

function PopulationPyramidHalf({
    left,
    xScale,
    yScale,
    ageBuckets,
    height,
    tickFontSize,
}: {
    left: number
    xScale: ScaleLinear<number, number>
    yScale: ReturnType<typeof scaleBand<string>>
    ageBuckets: Record<string, number>
    height: number
    tickFontSize: number
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
                    fontSize: tickFontSize,
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

function PopulationPyramidAxisX({
    centerX,
    gapWidth,
    yScale,
    medianAgeBucket,
    font,
    triangle,
}: {
    centerX: number
    gapWidth: number
    yScale: ReturnType<typeof scaleBand<string>>
    medianAgeBucket: { male?: string; female?: string }
    font: { ageLabel: number; header: number; ageHeader: number }
    triangle: { w: number; h: number }
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
                                x={centerX - font.ageLabel - triangle.w}
                                y={bandY}
                                direction="right"
                                size={triangle}
                            />
                        )}
                        <text
                            x={centerX}
                            y={bandY}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={font.ageLabel}
                            fill={isMedian ? GRAPHER_LIGHT_TEXT : LABEL_COLOR}
                        >
                            {ageGroupLabel}
                        </text>
                        {isFemaleMedian && (
                            <Triangle
                                x={centerX + font.ageLabel + triangle.w}
                                y={bandY}
                                direction="left"
                                size={triangle}
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
                fontSize={font.header}
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
                fontSize={font.ageHeader}
                fill={LABEL_COLOR}
                letterSpacing="0.05em"
            >
                AGE
            </text>
            <text
                x={centerX + gapWidth / 2 + 4}
                y={-4}
                textAnchor="start"
                fontSize={font.header}
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
    size,
}: {
    x: number
    y: number
    direction: "left" | "right"
    size: { w: number; h: number }
}) {
    const sign = direction === "right" ? -1 : 1
    return (
        <polygon
            points={`${x + sign * size.w},${y - size.h} ${x + sign * size.w},${y + size.h} ${x},${y}`}
            fill={GRAPHER_LIGHT_TEXT}
        />
    )
}
