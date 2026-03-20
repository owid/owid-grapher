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

    const [hoveredAgeGroup, setHoveredAgeGroup] = useState<string | null>(null)
    const handlePointerLeave = useCallback(() => setHoveredAgeGroup(null), [])

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
                        side="male"
                        outerMargin={margin.left}
                        hoveredAgeGroup={hoveredAgeGroup}
                        onAgeGroupHover={setHoveredAgeGroup}
                        onPointerLeave={handlePointerLeave}
                    />

                    <PopulationPyramidHalf
                        left={centerX + centerGap}
                        xScale={xScale.female}
                        yScale={yScale}
                        ageBuckets={ageBucketsBySex.female}
                        height={innerHeight}
                        tickFontSize={font.tick}
                        ageZones={ageZones}
                        side="female"
                        outerMargin={margin.right}
                        hoveredAgeGroup={hoveredAgeGroup}
                        onAgeGroupHover={setHoveredAgeGroup}
                        onPointerLeave={handlePointerLeave}
                    />

                    <PopulationPyramidAxisX
                        centerX={centerX + centerGap / 2}
                        gapWidth={centerGap}
                        yScale={yScale}
                        medianAgeBucket={medianAgeBucketBySex}
                        font={font}
                        triangle={triangle}
                        hoveredAgeGroup={hoveredAgeGroup}
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
    outerMargin,
    hoveredAgeGroup,
    onAgeGroupHover,
    onPointerLeave,
}: {
    left: number
    xScale: ScaleLinear<number, number>
    yScale: ReturnType<typeof scaleBand<string>>
    ageBuckets: Record<string, number>
    height: number
    tickFontSize: number
    ageZones?: AgeZone[]
    side: "male" | "female"
    outerMargin: number
    hoveredAgeGroup: string | null
    onAgeGroupHover: (ageGroup: string) => void
    onPointerLeave: () => void
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

            {/* Invisible hit rects for hover — use step (band + gap) to eliminate gaps,
                and extend into the outer margin so the full chart area is hoverable */}
            {AGE_GROUP_LABELS.map((g, i) => {
                const step = yScale.step()
                const bandY = yScale(g) ?? 0
                const halfGap = (step - bandwidth) / 2
                const y = i === 0 ? 0 : bandY - halfGap
                const bottom =
                    i === AGE_GROUP_LABELS.length - 1
                        ? height
                        : bandY + bandwidth + halfGap
                // Male: extend left into margin; Female: extend right into margin
                const hitX = side === "male" ? -outerMargin : 0
                const hitWidth = halfWidth + outerMargin
                return (
                    <rect
                        key={`hit-${g}`}
                        x={hitX}
                        y={y}
                        width={hitWidth}
                        height={bottom - y}
                        fill="transparent"
                        onPointerEnter={() => onAgeGroupHover(g)}
                        onPointerLeave={onPointerLeave}
                    />
                )
            })}
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
    font,
    triangle,
    hoveredAgeGroup,
}: {
    centerX: number
    gapWidth: number
    yScale: ReturnType<typeof scaleBand<string>>
    medianAgeBucket: { male?: string; female?: string }
    font: { ageLabel: number; header: number; ageHeader: number }
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
