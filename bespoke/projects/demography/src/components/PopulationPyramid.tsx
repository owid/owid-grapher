import { useState, useCallback, useMemo } from "react"
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
import { darkenColorForText } from "@ourworldindata/grapher/src/color/ColorUtils.js"
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
import type { AgeZone, AgeZoneWithBounds } from "../helpers/types.js"
import { widthToBreakpoint } from "../helpers/useBreakpoint.js"
import {
    getPopulationPyramidFonts,
    type PopulationPyramidFonts,
} from "../helpers/fonts.js"

// Labels reversed so 0-4 at bottom, oldest at top
const AGE_GROUP_LABELS = [...PYRAMID_AGE_GROUPS].reverse()

const PYRAMID_MARGIN = { top: 16, right: 3, bottom: 14, left: 3 }
const CENTER_GAP_PADDING = 2
const TRIANGLE = { w: 3.5, h: 2.5 }

const AGE_ZONE_LABEL_PADDING = 24 // gap + arrow + spacing

export type ProjectionType = "custom" | "un"

export interface PopulationPyramidProps {
    simulation: Simulation
    year: number
    xAxisScaleMode?: "fixed" | "adaptive"
    ageZones?: AgeZone[]
    projection?: ProjectionType
}

function PopulationPyramid({
    simulation,
    year,
    xAxisScaleMode = "fixed",
    ageZones,
    projection = "custom",
    width,
    height,
}: PopulationPyramidProps & { width: number; height: number }) {
    const bp = widthToBreakpoint(width)
    const fonts = getPopulationPyramidFonts(bp)
    const margin = { ...PYRAMID_MARGIN }
    const centerGap =
        Bounds.forText("125-129", { fontSize: fonts.ageGroupLabel }).width +
        2 * CENTER_GAP_PADDING
    const triangle = TRIANGLE

    // Margin on the right to accommodate age zone boundary labels, if shown
    const ageZoneLabelMarginRight = useMemo(() => {
        if (!ageZones) return undefined
        const maxLabelWidth = Math.max(
            ...ageZones.map(
                (ageZone) =>
                    new TextWrap({
                        text: ageZone.label,
                        maxWidth: Infinity,
                        fontSize: fonts.ageZoneLabel,
                    }).width
            )
        )
        return maxLabelWidth + AGE_ZONE_LABEL_PADDING
    }, [fonts.ageZoneLabel, ageZones])

    if (ageZoneLabelMarginRight) {
        margin.right = ageZoneLabelMarginRight
    }

    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const halfWidth = (innerWidth - centerGap) / 2
    const centerX = margin.left + halfWidth

    const populationBySex = (
        projection === "un"
            ? simulation.getBenchmarkPopulationForYear
            : simulation.getPopulationForYear
    )(year)

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

    const xAxisMax = useMemo(() => {
        if (xAxisScaleMode === "adaptive") {
            // Max from current year only
            const max = Math.max(
                ...Object.values(ageBucketsBySex.male),
                ...Object.values(ageBucketsBySex.female),
                0
            )
            return Math.ceil(max * 1.1)
        } else {
            // Max across all years
            return Math.ceil(computeMaxAgeGroupPopulation(simulation) * 1.1)
        }
    }, [simulation, xAxisScaleMode, ageBucketsBySex])

    const xScale = useMemo(() => {
        const domain = [0, xAxisMax]
        return {
            // Male: 0 at center, xAxisMax at left edge
            male: scaleLinear({ domain, range: [halfWidth, 0] }),
            // Female: 0 at center, xAxisMax at right edge
            female: scaleLinear({ domain, range: [0, halfWidth] }),
        }
    }, [halfWidth, xAxisMax])

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

    const [hoveredAgeGroup, setHoveredAgeGroup] = useState<string | null>(null)
    const handlePointerLeave = useCallback(() => setHoveredAgeGroup(null), [])

    return (
        <div style={{ position: "relative" }}>
            <svg width={width} height={height} overflow="visible">
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
                        tickFontSize={fonts.xTick}
                        ageZones={ageZones}
                        side="male"
                        hoveredAgeGroup={hoveredAgeGroup}
                    />

                    <PopulationPyramidHalf
                        left={centerX + centerGap}
                        xScale={xScale.female}
                        yScale={yScale}
                        ageBuckets={ageBucketsBySex.female}
                        height={innerHeight}
                        tickFontSize={fonts.xTick}
                        ageZones={ageZones}
                        side="female"
                        hoveredAgeGroup={hoveredAgeGroup}
                    />

                    <PopulationPyramidAxisX
                        centerX={centerX + centerGap / 2}
                        gapWidth={centerGap}
                        yScale={yScale}
                        medianAgeBucket={medianAgeBucketBySex}
                        fonts={fonts}
                        triangle={triangle}
                        hoveredAgeGroup={hoveredAgeGroup}
                    />

                    {ageZonesWithBounds && (
                        <AgeZoneLabels
                            ageZones={ageZonesWithBounds}
                            fontSize={fonts.ageZoneLabel}
                        />
                    )}

                    {/* Full-width hit rects for hover — one per age group, spanning the entire SVG */}
                    {AGE_GROUP_LABELS.map((g, i) => {
                        const step = yScale.step()
                        const bandY = yScale(g) ?? 0
                        const bandwidth = yScale.bandwidth()
                        const halfGap = (step - bandwidth) / 2
                        const y = i === 0 ? 0 : bandY - halfGap
                        const bottom =
                            i === AGE_GROUP_LABELS.length - 1
                                ? innerHeight
                                : bandY + bandwidth + halfGap
                        return (
                            <rect
                                key={`hit-${g}`}
                                x={-margin.left}
                                y={y}
                                width={width}
                                height={bottom - y}
                                fill="transparent"
                                onPointerEnter={() => setHoveredAgeGroup(g)}
                                onPointerLeave={handlePointerLeave}
                            />
                        )
                    })}
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
    projection,
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
                    projection={projection}
                    width={width}
                    height={height}
                />
            ) : null}
        </div>
    )
}

const BAR_LABEL_PADDING = 5

function PopulationPyramidHalf({
    left,
    xScale,
    yScale,
    ageBuckets,
    height,
    tickFontSize,
    ageZones,
    side,
    hoveredAgeGroup,
}: {
    left: number
    xScale: ScaleLinear<number, number>
    yScale: ReturnType<typeof scaleBand<string>>
    ageBuckets: Record<string, number>
    height: number
    tickFontSize: number
    ageZones?: AgeZone[]
    side: "male" | "female"
    hoveredAgeGroup: string | null
}) {
    const zeroX = xScale(0)
    const halfWidth = Math.abs(xScale(0) - xScale(xScale.domain()[1]))
    const bandwidth = yScale.bandwidth()

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
                const barWidth = Math.abs(scaledVal - zeroX)
                const barX = Math.min(scaledVal, zeroX)
                const barY = yScale(g) ?? 0
                const barColor =
                    ageZones?.find((z) => z.ageGroups.includes(g))?.color ??
                    DENIM_BLUE
                const dimmed = hoveredAgeGroup !== null && hoveredAgeGroup !== g

                return (
                    <Bar
                        key={g}
                        x={barX}
                        y={barY}
                        width={barWidth}
                        height={bandwidth}
                        fill={barColor}
                        opacity={dimmed ? 0.4 : 1}
                    />
                )
            })}

            {/* Value label for hovered bar */}
            {hoveredAgeGroup !== null && (
                <BarValueLabel
                    value={ageBuckets[hoveredAgeGroup] || 0}
                    barWidth={Math.abs(
                        xScale(ageBuckets[hoveredAgeGroup] || 0) - zeroX
                    )}
                    barX={Math.min(
                        xScale(ageBuckets[hoveredAgeGroup] || 0),
                        zeroX
                    )}
                    barY={yScale(hoveredAgeGroup) ?? 0}
                    barHeight={bandwidth}
                    halfWidth={halfWidth}
                    direction={side === "male" ? "left" : "right"}
                    fontSize={tickFontSize}
                    barColor={
                        ageZones?.find((z) =>
                            z.ageGroups.includes(hoveredAgeGroup)
                        )?.color ?? DENIM_BLUE
                    }
                />
            )}
        </Group>
    )
}

function BarValueLabel({
    value,
    barWidth,
    barX,
    barY,
    barHeight,
    halfWidth,
    direction,
    fontSize,
    barColor,
}: {
    value: number
    barWidth: number
    barX: number
    barY: number
    barHeight: number
    halfWidth: number
    direction: "left" | "right"
    fontSize: number
    barColor: string
}) {
    const text = formatPopulationValueShort(value)
    const tw = new TextWrap({ text, maxWidth: Infinity, fontSize })
    const labelWidth = tw.width + BAR_LABEL_PADDING * 2

    // Available space outside the bar (away from center)
    const spaceOutside =
        direction === "left" ? barX : halfWidth - (barX + barWidth)
    const fitsOutside = labelWidth < spaceOutside

    let x: number
    let textAnchor: "start" | "end"
    let fill: string

    if (direction === "left") {
        // Bar end is at the left edge (barX)
        if (fitsOutside) {
            x = barX - BAR_LABEL_PADDING
            textAnchor = "end"
            fill = darkenColorForText(barColor)
        } else {
            x = barX + BAR_LABEL_PADDING
            textAnchor = "start"
            fill = "white"
        }
    } else {
        // Bar end is at the right edge (barX + barWidth)
        if (fitsOutside) {
            x = barX + barWidth + BAR_LABEL_PADDING
            textAnchor = "start"
            fill = darkenColorForText(barColor)
        } else {
            x = barX + barWidth - BAR_LABEL_PADDING
            textAnchor = "end"
            fill = "white"
        }
    }

    const y = barY + barHeight / 2

    return (
        <text
            x={x}
            y={y}
            textAnchor={textAnchor}
            dominantBaseline="central"
            fontSize={fontSize}
            fontWeight={700}
            fill={fill}
            style={{ pointerEvents: "none" }}
        >
            {text}
        </text>
    )
}

function PopulationPyramidAxisX({
    centerX,
    gapWidth,
    yScale,
    medianAgeBucket,
    fonts,
    triangle,
    hoveredAgeGroup,
}: {
    centerX: number
    gapWidth: number
    yScale: ReturnType<typeof scaleBand<string>>
    medianAgeBucket: { male?: string; female?: string }
    fonts: PopulationPyramidFonts
    triangle: { w: number; h: number }
    hoveredAgeGroup: string | null
}) {
    const isHovering = hoveredAgeGroup !== null
    return (
        <>
            {/* Age group labels with median arrows */}
            {AGE_GROUP_LABELS.map((ageGroupLabel) => {
                const y = yScale(ageGroupLabel) ?? 0
                const bandY = y + yScale.bandwidth() / 2

                const isMaleMedian = ageGroupLabel === medianAgeBucket.male
                const isFemaleMedian = ageGroupLabel === medianAgeBucket.female
                const isMedian = isMaleMedian || isFemaleMedian
                const isHovered = ageGroupLabel === hoveredAgeGroup

                return (
                    <g key={ageGroupLabel}>
                        {isMaleMedian && !isHovering && (
                            <Triangle
                                x={centerX - fonts.ageGroupLabel - triangle.w}
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
                            fontSize={fonts.ageGroupLabel}
                            fill={
                                isHovered
                                    ? GRAPHER_DARK_TEXT
                                    : isMedian
                                      ? GRAPHER_LIGHT_TEXT
                                      : LABEL_COLOR
                            }
                        >
                            {ageGroupLabel}
                        </text>
                        {isFemaleMedian && !isHovering && (
                            <Triangle
                                x={centerX + fonts.ageGroupLabel + triangle.w}
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
                fontSize={fonts.sexLabel}
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
                fontSize={fonts.ageZoneLabel}
                fill={LABEL_COLOR}
                letterSpacing="0.05em"
            >
                AGE
            </text>
            <text
                x={centerX + gapWidth / 2 + 4}
                y={-4}
                textAnchor="start"
                fontSize={fonts.sexLabel}
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
    const arrowMargin = Math.ceil(fontSize * 0.6) // Gap between the label text and the arrow
    const verticalOffset = Math.ceil(fontSize * 0.6) // Gap between the horizontal line and the label+arrow

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
                    <g
                        key={`boundary-${zone.zone}`}
                        style={{ pointerEvents: "none" }}
                    >
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
