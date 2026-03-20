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
import {
    GRAPHER_DARK_TEXT,
    GRAPHER_LIGHT_TEXT,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { TextWrap } from "@ourworldindata/components"
import { BezierArrow } from "../../../../components/BezierArrow/BezierArrow.js"
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

const ZONE_LABEL_PADDING = 24 // gap + arrow + spacing
const ZONE_LABELS = ["Retired (65+)", "Children (<15)"]

export interface PopulationPyramidProps {
    simulation: Simulation
    year: number
    colorByAgeGroup?: (ageGroup: string) => string
    showAgeGroupBackground?: boolean
    showAgeZoneLabels?: boolean
    xAxisScaleMode?: "fixed" | "adaptive"
}

function PopulationPyramid({
    simulation,
    year,
    colorByAgeGroup,
    showAgeGroupBackground = false,
    showAgeZoneLabels = false,
    xAxisScaleMode = "fixed",
    width,
    height,
}: PopulationPyramidProps & { width: number; height: number }) {
    const sizes = useMemo(() => scaledSizes(width), [width])
    const { margin: baseMargin, centerGap, font, triangle } = sizes

    const zoneLabelFontSize = font.ageLabel + 1
    const zoneLabelRightMargin = useMemo(() => {
        if (!showAgeZoneLabels) return baseMargin.right
        const maxLabelWidth = Math.max(
            ...ZONE_LABELS.map(
                (label) =>
                    new TextWrap({
                        text: label,
                        maxWidth: Infinity,
                        fontSize: zoneLabelFontSize,
                    }).width
            )
        )
        return maxLabelWidth + ZONE_LABEL_PADDING
    }, [showAgeZoneLabels, zoneLabelFontSize, baseMargin.right])

    const margin = { ...baseMargin, right: zoneLabelRightMargin }

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
        let xAxisMax: number
        if (xAxisScaleMode === "adaptive") {
            // Max from current year only
            xAxisMax = Math.max(
                ...Object.values(ageBucketsBySex.male),
                ...Object.values(ageBucketsBySex.female),
                0
            )
            xAxisMax = Math.ceil(xAxisMax * 1.1)
        } else {
            // Max across all years
            xAxisMax = computeMaxAgeGroupPopulation(simulation)
        }
        const domain = [0, xAxisMax]
        return {
            // Male: 0 at center, xAxisMax at left edge
            male: scaleLinear({ domain, range: [halfWidth, 0] }),
            // Female: 0 at center, xAxisMax at right edge
            female: scaleLinear({ domain, range: [0, halfWidth] }),
        }
    }, [halfWidth, simulation, xAxisScaleMode, ageBucketsBySex])

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
                    {/* Age zone background bands */}
                    {showAgeGroupBackground &&
                        colorByAgeGroup &&
                        (() => {
                            // Group consecutive age groups by color into zones
                            const zones: {
                                color: string
                                startIdx: number
                                endIdx: number
                            }[] = []
                            let currentColor = colorByAgeGroup(
                                ageGroupLabels[0]
                            )
                            let startIdx = 0
                            for (let i = 1; i < ageGroupLabels.length; i++) {
                                const c = colorByAgeGroup(ageGroupLabels[i])
                                if (c !== currentColor) {
                                    zones.push({
                                        color: currentColor,
                                        startIdx,
                                        endIdx: i - 1,
                                    })
                                    currentColor = c
                                    startIdx = i
                                }
                            }
                            zones.push({
                                color: currentColor,
                                startIdx,
                                endIdx: ageGroupLabels.length - 1,
                            })

                            const bandwidth = yScale.bandwidth()
                            const step = yScale.step()
                            const halfGap = (step - bandwidth) / 2

                            return zones.map((zone, i) => {
                                const firstBarY =
                                    yScale(ageGroupLabels[zone.startIdx]) ?? 0
                                const lastBarY =
                                    yScale(ageGroupLabels[zone.endIdx]) ?? 0

                                // Extend to midpoint of gap, or to edge for first/last zone
                                const y = i === 0 ? 0 : firstBarY - halfGap
                                const yEnd =
                                    i === zones.length - 1
                                        ? innerHeight
                                        : lastBarY + bandwidth + halfGap

                                return (
                                    <rect
                                        key={`bg-${zone.startIdx}`}
                                        x={-margin.left}
                                        y={y}
                                        width={width}
                                        height={yEnd - y}
                                        fill={zone.color}
                                        opacity={0.06}
                                    />
                                )
                            })
                        })()}

                    <PopulationPyramidHalf
                        left={margin.left}
                        xScale={xScale.male}
                        yScale={yScale}
                        ageBuckets={ageBucketsBySex.male}
                        height={innerHeight}
                        tickFontSize={font.tick}
                        colorByAgeGroup={colorByAgeGroup}
                    />

                    <PopulationPyramidHalf
                        left={centerX + centerGap}
                        xScale={xScale.female}
                        yScale={yScale}
                        ageBuckets={ageBucketsBySex.female}
                        height={innerHeight}
                        tickFontSize={font.tick}
                        colorByAgeGroup={colorByAgeGroup}
                    />

                    <PopulationPyramidAxisX
                        centerX={centerX + centerGap / 2}
                        gapWidth={centerGap}
                        yScale={yScale}
                        medianAgeBucket={medianAgeBucketBySex}
                        font={font}
                        triangle={triangle}
                    />

                    {/* Age zone boundary labels on the right */}
                    {showAgeZoneLabels && (
                        <AgeZoneBoundaryLabels
                            yScale={yScale}
                            innerWidth={innerWidth}
                            marginLeft={margin.left}
                            marginRight={margin.right}
                            fontSize={font.ageLabel}
                            colorByAgeGroup={colorByAgeGroup}
                        />
                    )}
                </Group>
            </svg>
        </div>
    )
}

export function ResponsivePopulationPyramid({
    simulation,
    year,
    colorByAgeGroup,
    showAgeGroupBackground,
    showAgeZoneLabels,
    xAxisScaleMode,
}: PopulationPyramidProps) {
    const { parentRef, width, height } = useParentSize()
    return (
        <div ref={parentRef} style={{ width: "100%", height: "100%" }}>
            {width > 0 && height > 0 ? (
                <PopulationPyramid
                    simulation={simulation}
                    year={year}
                    colorByAgeGroup={colorByAgeGroup}
                    showAgeGroupBackground={showAgeGroupBackground}
                    showAgeZoneLabels={showAgeZoneLabels}
                    xAxisScaleMode={xAxisScaleMode}
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
    colorByAgeGroup,
}: {
    left: number
    xScale: ScaleLinear<number, number>
    yScale: ReturnType<typeof scaleBand<string>>
    ageBuckets: Record<string, number>
    height: number
    tickFontSize: number
    colorByAgeGroup?: (ageGroup: string) => string
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
                        fill={colorByAgeGroup ? colorByAgeGroup(g) : DENIM_BLUE}
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

function AgeZoneBoundaryLabels({
    yScale,
    innerWidth,
    marginLeft,
    marginRight,
    fontSize,
    colorByAgeGroup,
}: {
    yScale: ReturnType<typeof scaleBand<string>>
    innerWidth: number
    marginLeft: number
    marginRight: number
    fontSize: number
    colorByAgeGroup?: (ageGroup: string) => string
}) {
    const bandwidth = yScale.bandwidth()
    const step = yScale.step()
    const halfGap = (step - bandwidth) / 2

    // Boundary at age 65: between "65-69" (above) and "60-64" (below)
    const y65 = yScale("65-69") ?? 0
    const retirementY = y65 + bandwidth + halfGap

    // Boundary at age 15: between "15-19" (above) and "10-14" (below)
    const y15 = yScale("15-19") ?? 0
    const childrenY = y15 + bandwidth + halfGap

    const lineX1 = 0
    const lineX2 = marginLeft + innerWidth + marginRight - 4
    const labelX = marginLeft + innerWidth + 4
    const labelFontSize = fontSize + 1

    const arrowLength = 8
    const arrowX = lineX2 - 8
    const lineGap = 8 // gap between the horizontal line and the label+arrow
    const labelArrowGap = 9 // gap between the label text and the arrow

    const elderlyColor = colorByAgeGroup?.("65-69") ?? GRAPHER_LIGHT_TEXT
    const childrenColor = colorByAgeGroup?.("0-4") ?? GRAPHER_LIGHT_TEXT

    return (
        <>
            {/* Retired line at 65 */}
            <line
                x1={lineX1}
                y1={retirementY}
                x2={lineX2}
                y2={retirementY}
                stroke={elderlyColor}
                strokeWidth={0.5}
                opacity={0.4}
            />
            <text
                x={arrowX - labelArrowGap}
                y={retirementY - lineGap}
                textAnchor="end"
                dominantBaseline="auto"
                fontSize={labelFontSize}
                fill={GRAPHER_DARK_TEXT}
            >
                Retired (65+)
            </text>
            {/* Arrow pointing up */}
            <BezierArrow
                start={[arrowX, retirementY - lineGap]}
                end={[arrowX, retirementY - lineGap - arrowLength]}
                color={GRAPHER_DARK_TEXT}
                width={1}
                headAnchor="end"
                headLength={3}
            />

            {/* Children line at 15 */}
            <line
                x1={lineX1}
                y1={childrenY}
                x2={lineX2}
                y2={childrenY}
                stroke={childrenColor}
                strokeWidth={0.5}
                opacity={0.4}
            />
            <text
                x={arrowX - labelArrowGap}
                y={childrenY + lineGap}
                textAnchor="end"
                dominantBaseline="hanging"
                fontSize={labelFontSize}
                fill={GRAPHER_DARK_TEXT}
            >
                {"Children (<15)"}
            </text>
            {/* Arrow pointing down */}
            <BezierArrow
                start={[arrowX, childrenY + lineGap]}
                end={[arrowX, childrenY + lineGap + arrowLength]}
                color={GRAPHER_DARK_TEXT}
                width={1}
                headAnchor="end"
                headLength={3}
            />
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
