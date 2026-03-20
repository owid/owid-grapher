import { useMemo } from "react"
import { useParentSize } from "@visx/responsive"
import { scaleLinear, scaleBand } from "@visx/scale"
import { Bar } from "@visx/shape"
import { AxisBottom } from "@visx/axis"
import { Group } from "@visx/group"
import type { ScaleLinear } from "d3-scale"
import type { Simulation } from "../helpers/useSimulation"
import {
    AGE_ZONE_BACKGROUND_OPACITY,
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
import { Bounds } from "@ourworldindata/utils"
import { AgeZone, AgeZoneWithBounds } from "../helpers/types.js"

const BASE_WIDTH = 200
const BASE_MARGIN = { top: 12, right: 4, bottom: 18, left: 4 }
const BASE_CENTER_GAP = 40
const BASE_FONT = { tick: 9, ageLabel: 8, header: 10, ageHeader: 8, ageZone: 9 }
const BASE_TRIANGLE_SIZE = { w: 4, h: 3 }

// Labels reversed so 0-4 at bottom, oldest at top
const AGE_GROUP_LABELS = [...PYRAMID_AGE_GROUPS].reverse()

const AGE_ZONE_LABEL_PADDING = 24 // gap + arrow + spacing

export interface PopulationPyramidProps {
    simulation: Simulation
    year: number
    xAxisScaleMode?: "fixed" | "adaptive"
    ageZones?: AgeZone[]
}

function PopulationPyramid({
    simulation,
    year,
    xAxisScaleMode = "fixed",
    ageZones,
    width,
    height,
}: PopulationPyramidProps & { width: number; height: number }) {
    const sizes = useMemo(() => scaledSizes(width), [width])
    const { margin, centerGap, font, triangle } = sizes

    // Margin on the right to accommodate age zone boundary labels, if shown
    const ageZoneLabelMarginRight = useMemo(() => {
        if (!ageZones) return undefined
        const maxLabelWidth = Math.max(
            ...ageZones.map(
                (ageZone) =>
                    new TextWrap({
                        text: ageZone.label,
                        maxWidth: Infinity,
                        fontSize: font.ageZone,
                    }).width
            )
        )
        return maxLabelWidth + AGE_ZONE_LABEL_PADDING
    }, [font.ageZone, ageZones])

    if (ageZoneLabelMarginRight) {
        margin.right = ageZoneLabelMarginRight
    }

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
                domain: AGE_GROUP_LABELS,
                range: [0, innerHeight],
                padding: 0.15,
            }),
        [innerHeight]
    )

    const ageZonesWithBounds = useMemo(
        () =>
            ageZones
                ? computeZoneBounds(ageZones, yScale, innerHeight, {
                      marginLeft: margin.left,
                      fullWidth: width,
                  })
                : undefined,
        [ageZones, yScale, innerHeight, margin.left, width]
    )

    return (
        <div style={{ position: "relative" }}>
            <svg width={width} height={height}>
                <Group top={margin.top}>
                    {ageZonesWithBounds && (
                        <AgeZoneBackgroundBands ageZones={ageZonesWithBounds} />
                    )}

                    <PopulationPyramidHalf
                        left={margin.left}
                        xScale={xScale.male}
                        yScale={yScale}
                        ageBuckets={ageBucketsBySex.male}
                        height={innerHeight}
                        tickFontSize={font.tick}
                        ageZones={ageZones}
                    />

                    <PopulationPyramidHalf
                        left={centerX + centerGap}
                        xScale={xScale.female}
                        yScale={yScale}
                        ageBuckets={ageBucketsBySex.female}
                        height={innerHeight}
                        tickFontSize={font.tick}
                        ageZones={ageZones}
                    />

                    <PopulationPyramidAxisX
                        centerX={centerX + centerGap / 2}
                        gapWidth={centerGap}
                        yScale={yScale}
                        medianAgeBucket={medianAgeBucketBySex}
                        font={font}
                        triangle={triangle}
                    />

                    {ageZonesWithBounds && (
                        <AgeZoneLabels
                            ageZones={ageZonesWithBounds}
                            fontSize={font.ageZone}
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
    xAxisScaleMode,
    ageZones,
}: PopulationPyramidProps) {
    const { parentRef, width, height } = useParentSize()
    return (
        <div ref={parentRef} style={{ width: "100%", height: "100%" }}>
            {width > 0 && height > 0 ? (
                <PopulationPyramid
                    simulation={simulation}
                    year={year}
                    ageZones={ageZones}
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
    ageZones,
}: {
    left: number
    xScale: ScaleLinear<number, number>
    yScale: ReturnType<typeof scaleBand<string>>
    ageBuckets: Record<string, number>
    height: number
    tickFontSize: number
    ageZones?: AgeZone[]
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
            {AGE_GROUP_LABELS.map((g) => {
                const scaledVal = xScale(ageBuckets[g] || 0)
                return (
                    <Bar
                        key={g}
                        x={Math.min(scaledVal, zeroX)}
                        y={yScale(g) ?? 0}
                        width={Math.abs(scaledVal - zeroX)}
                        height={yScale.bandwidth()}
                        fill={
                            ageZones?.find((z) => z.ageGroups.includes(g))
                                ?.color ?? DENIM_BLUE
                        }
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
            {AGE_GROUP_LABELS.map((ageGroupLabel) => {
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

function AgeZoneBackgroundBands({
    ageZones,
}: {
    ageZones: AgeZoneWithBounds[]
}) {
    return (
        <>
            {ageZones.map((zone) => (
                <rect
                    key={zone.zone}
                    {...zone.bounds.toProps()}
                    fill={zone.color}
                    opacity={AGE_ZONE_BACKGROUND_OPACITY}
                />
            ))}
        </>
    )
}

function AgeZoneLabels({
    ageZones,
    fontSize,
}: {
    ageZones: AgeZoneWithBounds[]
    fontSize: number
}) {
    const arrowLength = 0.9 * fontSize
    const arrowMargin = 8 // Gap between the label text and the arrow
    const verticalOffset = 8 // Gap between the horizontal line and the label+arrow

    return (
        <>
            {ageZones.map((zone) => {
                if (zone.zone === "working") return null // Only label the dependent zones

                const arrowX = zone.bounds.right - arrowMargin

                const lineY =
                    zone.zone === "children"
                        ? zone.bounds.top
                        : zone.bounds.bottom

                const direction = zone.zone === "children" ? 1 : -1

                return (
                    <g key={`boundary-${zone.zone}`}>
                        <line
                            x1={zone.bounds.left}
                            y1={lineY}
                            x2={zone.bounds.right}
                            y2={lineY}
                            stroke={zone.color}
                            strokeWidth={0.5}
                            opacity={0.4}
                        />
                        <text
                            x={arrowX - arrowMargin}
                            y={lineY + direction * verticalOffset}
                            dominantBaseline={
                                zone.zone === "children" ? "hanging" : "auto"
                            }
                            textAnchor="end"
                            fontSize={fontSize}
                            fill={GRAPHER_DARK_TEXT}
                        >
                            {zone.label}
                        </text>
                        <BezierArrow
                            start={[arrowX, lineY + direction * verticalOffset]}
                            end={[
                                arrowX,
                                lineY +
                                    direction * (verticalOffset + arrowLength),
                            ]}
                            color={GRAPHER_DARK_TEXT}
                            headLength={3}
                        />
                    </g>
                )
            })}
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
            ageZone: round(BASE_FONT.ageZone * s),
        },
        triangle: {
            w: round(BASE_TRIANGLE_SIZE.w * s),
            h: round(BASE_TRIANGLE_SIZE.h * s),
        },
    }
}

/**
 * Compute the y position and height for each zone's background rect.
 * Extends each zone to the midpoint of the gap between bands,
 * or to the chart edge for the first/last zone.
 */
function computeZoneBounds(
    zones: AgeZone[],
    yScale: ReturnType<typeof scaleBand<string>>,
    innerHeight: number,
    rect: { marginLeft: number; fullWidth: number }
): AgeZoneWithBounds[] {
    const bandwidth = yScale.bandwidth()
    const step = yScale.step()
    const halfGap = (step - bandwidth) / 2

    return zones.map((zone, i) => {
        const firstBarY = yScale(zone.ageGroups[0]) ?? 0
        const lastBarY = yScale(zone.ageGroups[zone.ageGroups.length - 1]) ?? 0

        const y = i === 0 ? 0 : firstBarY - halfGap
        const yEnd =
            i === zones.length - 1
                ? innerHeight
                : lastBarY + bandwidth + halfGap

        return {
            ...zone,
            bounds: new Bounds(-rect.marginLeft, y, rect.fullWidth, yEnd - y),
        }
    })
}

/** Round to nearest 0.5px */
function round(v: number): number {
    return Math.round(v * 2) / 2
}
