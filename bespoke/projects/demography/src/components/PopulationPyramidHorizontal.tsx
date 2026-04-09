import { useState, useCallback, useMemo, useRef } from "react"
import { useParentSize } from "@visx/responsive"
import { scaleLinear } from "@visx/scale"
import { Group } from "@visx/group"
import type { Simulation } from "../helpers/useSimulation"
import type { ProjectionType } from "./PopulationPyramid.js"
import {
    FEMALE_COLOR,
    GRID_LINE_COLOR,
    GRID_LABEL_COLOR,
    MALE_COLOR,
    PYRAMID_MAX_AGE,
    PYRAMID_AGE_GROUP_SIZE,
    PYRAMID_AGE_GROUPS,
    ZERO_LINE_COLOR,
} from "../helpers/constants"
import { GRAPHER_LIGHT_TEXT } from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { computeMaxAgeGroupPopulation } from "../model/projectionRunner"
import {
    groupByAgeRange,
    parseAgeGroup,
    formatPopulationValueShort,
    formatPopulationAxisLabelShort,
} from "../helpers/utils"
import { Bounds, formatValue } from "@ourworldindata/utils"
import { Halo, TextWrap, TextWrapSvg } from "@ourworldindata/components"
import { toBreakpoint } from "../helpers/useBreakpoint.js"
import { useDismissOnTouchOutside } from "../../../../hooks/useDismissOnTouchOutside.js"
import { getHorizontalPyramidFonts } from "../helpers/fonts.js"

export interface PopulationPyramidHorizontalProps {
    simulation: Simulation
    year: number
    yAxisScaleMode?: "fixed" | "adaptive"
    projection?: ProjectionType
    barColor?: { female: string; male: string } | string
    unit?: "percent" | "absolute"
}

function PopulationPyramidHorizontalContent({
    simulation,
    year,
    yAxisScaleMode = "fixed",
    projection = "custom",
    barColor,
    unit = "percent",
    width,
    height,
}: PopulationPyramidHorizontalProps & { width: number; height: number }) {
    const effectiveFemaleColor =
        typeof barColor === "object"
            ? barColor.female
            : (barColor ?? FEMALE_COLOR)
    const effectiveMaleColor =
        typeof barColor === "object" ? barColor.male : (barColor ?? MALE_COLOR)
    const fonts = getHorizontalPyramidFonts(toBreakpoint(width))
    const margin = { top: 0, right: 0, bottom: 0, left: 0 }

    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const populationBySex = (
        projection === "un"
            ? simulation.getBenchmarkPopulationForYear
            : simulation.getPopulationForYear
    )(year)

    const ageBucketsBySex = useMemo(() => {
        const male = populationBySex?.male ?? []
        const female = populationBySex?.female ?? []
        const totalPop =
            male.reduce((a, b) => a + b, 0) + female.reduce((a, b) => a + b, 0)
        const toBuckets = (buckets: Record<string, number>) => {
            if (unit === "absolute") return buckets
            const result: Record<string, number> = {}
            for (const [k, v] of Object.entries(buckets)) {
                result[k] = totalPop > 0 ? (v / totalPop) * 100 : 0
            }
            return result
        }
        return {
            male: toBuckets(groupByAgeRange(male)),
            female: toBuckets(groupByAgeRange(female)),
        }
    }, [populationBySex, unit])

    const xScale = useMemo(
        () =>
            scaleLinear({
                domain: [0, PYRAMID_MAX_AGE + PYRAMID_AGE_GROUP_SIZE],
                range: [0, innerWidth],
            }),
        [innerWidth]
    )

    const yMax = useMemo(() => {
        if (yAxisScaleMode === "adaptive") {
            const max = Math.max(
                ...Object.values(ageBucketsBySex.male),
                ...Object.values(ageBucketsBySex.female),
                0
            )
            return max
        }
        return computeMaxAgeGroupPopulation(simulation, unit) * 1.1
    }, [simulation, yAxisScaleMode, ageBucketsBySex, unit])

    const centerY = innerHeight / 2
    const centerGap = fonts.xTick + 6

    // Female bars grow upward from center gap, male bars grow downward
    const yScaleFemale = useMemo(
        () =>
            scaleLinear({
                domain: [0, yMax],
                range: [centerY - centerGap / 2, 0],
            }),
        [centerY, centerGap, yMax]
    )

    const yScaleMale = useMemo(
        () =>
            scaleLinear({
                domain: [0, yMax],
                range: [centerY + centerGap / 2, innerHeight],
            }),
        [centerY, centerGap, innerHeight, yMax]
    )

    const [hoveredAgeGroup, setHoveredAgeGroup] = useState<string | null>(null)
    const svgRef = useRef<SVGSVGElement>(null)
    const dismissHover = useCallback(() => setHoveredAgeGroup(null), [])
    useDismissOnTouchOutside(svgRef, hoveredAgeGroup !== null, dismissHover)

    const handlePointerEnter = useCallback(
        (e: React.PointerEvent, group: string) => {
            if (e.pointerType === "mouse") setHoveredAgeGroup(group)
        },
        []
    )
    const handlePointerLeave = useCallback((e: React.PointerEvent) => {
        if (e.pointerType === "mouse") setHoveredAgeGroup(null)
    }, [])
    const handlePointerDown = useCallback(
        (e: React.PointerEvent, group: string) => {
            if (e.pointerType === "touch") {
                e.stopPropagation()
                setHoveredAgeGroup((prev) => (prev === group ? null : group))
            }
        },
        []
    )

    return (
        <svg ref={svgRef} width={width} height={height} overflow="visible">
            <Group top={margin.top} left={margin.left}>
                <HorizontalGridLines
                    yScale={yScaleFemale}
                    innerWidth={innerWidth}
                />
                <HorizontalGridLines
                    yScale={yScaleMale}
                    innerWidth={innerWidth}
                />
                <GridLabels
                    yScale={yScaleFemale}
                    innerWidth={innerWidth}
                    innerHeight={innerHeight}
                    fontSize={fonts.yTick}
                    labelColor={GRID_LABEL_COLOR}
                    position="above"
                    unit={unit}
                />
                <GridLabels
                    yScale={yScaleMale}
                    innerWidth={innerWidth}
                    innerHeight={innerHeight}
                    fontSize={fonts.yTick}
                    labelColor={GRID_LABEL_COLOR}
                    position="below"
                    unit={unit}
                />

                <AgeGroupBars
                    xScale={xScale}
                    yScale={yScaleFemale}
                    ageBuckets={ageBucketsBySex.female}
                    color={effectiveFemaleColor}
                    hoveredAgeGroup={hoveredAgeGroup}
                />
                <AgeGroupBars
                    xScale={xScale}
                    yScale={yScaleMale}
                    ageBuckets={ageBucketsBySex.male}
                    color={effectiveMaleColor}
                    hoveredAgeGroup={hoveredAgeGroup}
                />
                <VerticalDividers
                    xScale={xScale}
                    tickValues={[25, 50, 75, 100, 125]}
                    femaleBaseline={centerY - centerGap / 2}
                    maleBaseline={centerY + centerGap / 2}
                    innerHeight={innerHeight}
                />

                <BarValueLabel
                    xScale={xScale}
                    yScale={yScaleFemale}
                    ageBuckets={ageBucketsBySex.female}
                    color={effectiveFemaleColor}
                    hoveredAgeGroup={hoveredAgeGroup}
                    fontSize={fonts.hoverLabel}
                    unit={unit}
                />
                <BarValueLabel
                    xScale={xScale}
                    yScale={yScaleMale}
                    ageBuckets={ageBucketsBySex.male}
                    color={effectiveMaleColor}
                    hoveredAgeGroup={hoveredAgeGroup}
                    fontSize={fonts.hoverLabel}
                    unit={unit}
                />
                <HoverHitRects
                    xScale={xScale}
                    innerHeight={innerHeight}
                    onPointerEnter={handlePointerEnter}
                    onPointerLeave={handlePointerLeave}
                    onPointerDown={handlePointerDown}
                />

                <AgeAxisCenter
                    xScale={xScale}
                    centerY={centerY}
                    centerGap={centerGap}
                    innerWidth={innerWidth}
                    tickValues={[25, 50, 75, 100, 125]}
                    fontSize={fonts.xTick}
                />

                {/* Sex labels in the center gap */}
                <text
                    x={0}
                    y={centerY}
                    dy={-1}
                    dominantBaseline="auto"
                    fontSize={fonts.sexLabel}
                    fill={effectiveFemaleColor}
                    fontWeight={700}
                    style={{ pointerEvents: "none" }}
                >
                    WOMEN
                </text>
                <text
                    x={0}
                    y={centerY}
                    dy={1}
                    dominantBaseline="hanging"
                    fontSize={fonts.sexLabel}
                    fill={effectiveMaleColor}
                    fontWeight={700}
                    style={{ pointerEvents: "none" }}
                >
                    MEN
                </text>
            </Group>
        </svg>
    )
}

export function PopulationPyramidHorizontal(
    props: PopulationPyramidHorizontalProps
) {
    const { parentRef, width, height } = useParentSize()
    return (
        <div ref={parentRef} className="responsive-container">
            {width > 0 && height > 0 && (
                <PopulationPyramidHorizontalContent
                    {...props}
                    width={width}
                    height={height}
                />
            )}
        </div>
    )
}

function AgeGroupBars({
    xScale,
    yScale,
    ageBuckets,
    color,
    hoveredAgeGroup,
}: {
    xScale: ReturnType<typeof scaleLinear<number>>
    yScale: ReturnType<typeof scaleLinear<number>>
    ageBuckets: Record<string, number>
    color: string
    hoveredAgeGroup: string | null
}) {
    const baseline = yScale(0)
    return (
        <>
            {PYRAMID_AGE_GROUPS.map((g) => {
                const { startAge } = parseAgeGroup(g)
                const barX = xScale(startAge)
                const barWidth =
                    xScale(startAge + PYRAMID_AGE_GROUP_SIZE) - barX
                const value = ageBuckets[g] || 0
                const barY = yScale(value)

                const dimmed = hoveredAgeGroup !== null && hoveredAgeGroup !== g
                const opacity = dimmed ? 0.4 : 1

                const y = Math.min(barY, baseline)
                const h = Math.abs(barY - baseline)

                return (
                    <rect
                        key={g}
                        x={barX}
                        y={y}
                        width={barWidth}
                        height={h}
                        fill={color}
                        opacity={opacity}
                        shapeRendering="crispEdges"
                    />
                )
            })}
        </>
    )
}

function BarValueLabel({
    xScale,
    yScale,
    ageBuckets,
    color,
    hoveredAgeGroup,
    fontSize,
    unit = "percent",
}: {
    xScale: ReturnType<typeof scaleLinear<number>>
    yScale: ReturnType<typeof scaleLinear<number>>
    ageBuckets: Record<string, number>
    color: string
    hoveredAgeGroup: string | null
    fontSize: number
    unit?: "percent" | "absolute"
}) {
    if (!hoveredAgeGroup) return null
    const value = ageBuckets[hoveredAgeGroup] || 0
    if (value <= 0) return null

    const { startAge } = parseAgeGroup(hoveredAgeGroup)
    const barX = xScale(startAge)
    const barWidth = xScale(startAge + PYRAMID_AGE_GROUP_SIZE) - barX
    const barY = yScale(value)
    const baseline = yScale(0)

    const y = Math.min(barY, baseline)
    const h = Math.abs(barY - baseline)
    const growsUp = barY < baseline
    const labelFontSize = fontSize
    const labelY = growsUp ? y - 5 : y + h + 5
    const dominantBaseline = growsUp ? "auto" : "hanging"

    return (
        <Halo id="horizontal-pyramid-hover" outlineWidth={3}>
            <text
                x={barX + barWidth / 2}
                y={labelY}
                textAnchor="middle"
                dominantBaseline={dominantBaseline}
                fontSize={labelFontSize}
                fontWeight={700}
                fill={color}
                style={{ pointerEvents: "none" }}
            >
                {unit === "absolute"
                    ? formatPopulationValueShort(value)
                    : `${value.toFixed(1)}%`}
            </text>
        </Halo>
    )
}

function HoverHitRects({
    xScale,
    innerHeight,
    onPointerEnter,
    onPointerLeave,
    onPointerDown,
}: {
    xScale: ReturnType<typeof scaleLinear<number>>
    innerHeight: number
    onPointerEnter: (e: React.PointerEvent, g: string) => void
    onPointerLeave: (e: React.PointerEvent) => void
    onPointerDown: (e: React.PointerEvent, g: string) => void
}) {
    return (
        <>
            {PYRAMID_AGE_GROUPS.map((g) => {
                const { startAge } = parseAgeGroup(g)
                const barX = xScale(startAge)
                const barWidth =
                    xScale(startAge + PYRAMID_AGE_GROUP_SIZE) - barX

                return (
                    <rect
                        key={g}
                        x={barX}
                        y={0}
                        width={barWidth}
                        height={innerHeight}
                        fill="transparent"
                        onPointerEnter={(e) => onPointerEnter(e, g)}
                        onPointerLeave={onPointerLeave}
                        onPointerDown={(e) => onPointerDown(e, g)}
                    />
                )
            })}
        </>
    )
}

function VerticalDividers({
    xScale,
    tickValues,
    femaleBaseline,
    maleBaseline,
    innerHeight,
}: {
    xScale: ReturnType<typeof scaleLinear<number>>
    tickValues: number[]
    femaleBaseline: number
    maleBaseline: number
    innerHeight: number
}) {
    return (
        <g style={{ pointerEvents: "none" }}>
            {tickValues.map((tick) => (
                <g key={tick}>
                    <line
                        x1={xScale(tick)}
                        y1={0}
                        x2={xScale(tick)}
                        y2={femaleBaseline}
                        stroke="white"
                        strokeWidth={0.5}
                    />
                    <line
                        x1={xScale(tick)}
                        y1={maleBaseline}
                        x2={xScale(tick)}
                        y2={innerHeight}
                        stroke="white"
                        strokeWidth={0.5}
                    />
                </g>
            ))}
        </g>
    )
}

function AgeAxisCenter({
    xScale,
    centerY,
    centerGap,
    innerWidth,
    tickValues,
    fontSize,
}: {
    xScale: ReturnType<typeof scaleLinear<number>>
    centerY: number
    centerGap: number
    innerWidth: number
    tickValues: number[]
    fontSize: number
}) {
    const femaleBaseline = centerY - centerGap / 2
    const maleBaseline = centerY + centerGap / 2

    return (
        <g style={{ pointerEvents: "none" }}>
            {/* Baseline lines at the edges of the gap */}
            <line
                x1={0}
                y1={femaleBaseline}
                x2={innerWidth}
                y2={femaleBaseline}
                stroke={ZERO_LINE_COLOR}
                strokeWidth={0.5}
            />
            <line
                x1={0}
                y1={maleBaseline}
                x2={innerWidth}
                y2={maleBaseline}
                stroke={ZERO_LINE_COLOR}
                strokeWidth={0.5}
            />
            {tickValues.map((tick, i) => (
                <g key={tick}>
                    {/* Tick label on the center line */}
                    <text
                        x={xScale(tick)}
                        y={centerY}
                        dy="0.35em"
                        textAnchor="middle"
                        fontSize={fontSize}
                        fill={GRAPHER_LIGHT_TEXT}
                    >
                        {tick}
                    </text>
                    {i === 0 && (
                        <text
                            x={xScale(tick)}
                            y={centerY}
                            dy="0.35em"
                            textAnchor="start"
                            fontSize={fontSize}
                            fill={GRAPHER_LIGHT_TEXT}
                            dx={
                                Bounds.forText(String(tick), {
                                    fontSize,
                                }).width /
                                    2 +
                                Bounds.forText(" ", {
                                    fontSize,
                                }).width
                            }
                        >
                            years
                        </text>
                    )}
                </g>
            ))}
        </g>
    )
}

function HorizontalGridLines({
    yScale,
    innerWidth,
}: {
    yScale: ReturnType<typeof scaleLinear<number>>
    innerWidth: number
}) {
    const ticks = yScale.ticks(2).filter((t) => t > 0)
    return (
        <>
            {ticks.map((tick) => (
                <line
                    key={`grid-${tick}`}
                    x1={0}
                    y1={yScale(tick)}
                    x2={innerWidth}
                    y2={yScale(tick)}
                    stroke={GRID_LINE_COLOR}
                    strokeWidth={0.5}
                    strokeDasharray="4,4"
                />
            ))}
        </>
    )
}

function GridLabels({
    yScale,
    innerWidth,
    innerHeight,
    fontSize,
    labelColor,
    position,
    unit = "percent",
}: {
    yScale: ReturnType<typeof scaleLinear<number>>
    innerWidth: number
    innerHeight: number
    fontSize: number
    labelColor: string
    position: "above" | "below"
    unit?: "percent" | "absolute"
}) {
    const ticks = yScale.ticks(2).filter((t) => t > 0)
    const formatTick = (tick: number) =>
        unit === "absolute"
            ? formatPopulationAxisLabelShort(tick)
            : formatValue(tick, {
                  numDecimalPlaces: 0,
                  numberAbbreviation: false,
                  unit: "%",
              })
    return (
        <>
            {ticks.map((tick) => {
                const y = yScale(tick)
                const textWrap = new TextWrap({
                    text: formatTick(tick),
                    maxWidth: Infinity,
                    fontSize,
                })
                const textY =
                    position === "above" ? y - textWrap.height - 1 : y + 2
                // Skip if the label overflows the SVG area
                if (textY < 0 || textY + textWrap.height > innerHeight)
                    return null
                return (
                    <GridLabel
                        key={tick}
                        valueText={formatTick(tick)}
                        x={innerWidth}
                        y={y}
                        fontSize={fontSize}
                        position={position}
                        labelColor={labelColor}
                    />
                )
            })}
        </>
    )
}

function GridLabel({
    valueText,
    x,
    y,
    fontSize,
    position,
    labelColor,
}: {
    valueText: string
    x: number
    y: number
    fontSize: number
    position: "above" | "below"
    labelColor: string
}) {
    const textWrap = new TextWrap({
        text: valueText,
        maxWidth: Infinity,
        fontSize,
    })

    const textX = x - textWrap.width
    const textY = position === "above" ? y - textWrap.height - 1 : y + 2

    return (
        <TextWrapSvg
            x={textX}
            y={textY}
            textWrap={textWrap}
            fill={labelColor}
        />
    )
}
