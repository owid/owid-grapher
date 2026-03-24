import { useState, useCallback, useMemo } from "react"
import { useParentSize } from "@visx/responsive"
import { scaleLinear } from "@visx/scale"
import { Group } from "@visx/group"
import type { Simulation } from "../helpers/useSimulation"
import type { ProjectionType } from "./PopulationPyramid.js"
import {
    FEMALE_COLOR,
    GRID_LINE_COLOR,
    LABEL_COLOR,
    MALE_COLOR,
    MAX_AGE,
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
} from "../helpers/utils"
import { Bounds, formatValue } from "@ourworldindata/utils"
import { TextWrap, TextWrapSvg } from "@ourworldindata/components"
import { OwidVariableRoundingMode } from "@ourworldindata/types"
import { useBreakpoint } from "../helpers/useBreakpoint.js"
import { getFontTier } from "../helpers/fontTiers.js"

export interface PopulationPyramidHorizontalProps {
    simulation: Simulation
    year: number
    yAxisScaleMode?: "fixed" | "adaptive"
    projection?: ProjectionType
}

function PopulationPyramidHorizontal({
    simulation,
    year,
    yAxisScaleMode = "fixed",
    projection = "custom",
    width,
    height,
}: PopulationPyramidHorizontalProps & { width: number; height: number }) {
    const breakpoint = useBreakpoint()
    const fontTier = getFontTier(breakpoint)
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
        return {
            male: groupByAgeRange(male),
            female: groupByAgeRange(female),
        }
    }, [populationBySex])

    const xScale = useMemo(
        () =>
            scaleLinear({
                domain: [0, MAX_AGE + PYRAMID_AGE_GROUP_SIZE],
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
        return Math.ceil(computeMaxAgeGroupPopulation(simulation))
    }, [simulation, yAxisScaleMode, ageBucketsBySex])

    const centerY = innerHeight / 2
    const centerGap = fontTier.tick + 6

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
    const handlePointerLeave = useCallback(() => setHoveredAgeGroup(null), [])

    return (
        <svg width={width} height={height} overflow="visible">
            <Group top={margin.top} left={margin.left}>
                <HorizontalGridLines
                    yScale={yScaleFemale}
                    innerWidth={innerWidth}
                />
                <HorizontalGridLines
                    yScale={yScaleMale}
                    innerWidth={innerWidth}
                />

                <AgeGroupBars
                    xScale={xScale}
                    yScale={yScaleFemale}
                    ageBuckets={ageBucketsBySex.female}
                    color={FEMALE_COLOR}
                    hoveredAgeGroup={hoveredAgeGroup}
                />
                <AgeGroupBars
                    xScale={xScale}
                    yScale={yScaleMale}
                    ageBuckets={ageBucketsBySex.male}
                    color={MALE_COLOR}
                    hoveredAgeGroup={hoveredAgeGroup}
                />
                <VerticalDividers
                    xScale={xScale}
                    tickValues={[25, 50, 75, 100, 125]}
                    femaleBaseline={centerY - centerGap / 2}
                    maleBaseline={centerY + centerGap / 2}
                    innerHeight={innerHeight}
                />
                <TopGridLabel
                    yScale={yScaleFemale}
                    innerWidth={innerWidth}
                    fontSize={fontTier.tick}
                    labelText="women"
                    labelColor={FEMALE_COLOR}
                    position="above"
                />
                <TopGridLabel
                    yScale={yScaleMale}
                    innerWidth={innerWidth}
                    fontSize={fontTier.tick}
                    labelText="men"
                    labelColor={MALE_COLOR}
                    position="below"
                />

                <BarValueLabel
                    xScale={xScale}
                    yScale={yScaleFemale}
                    ageBuckets={ageBucketsBySex.female}
                    color={FEMALE_COLOR}
                    hoveredAgeGroup={hoveredAgeGroup}
                    fontSize={fontTier.label}
                />
                <BarValueLabel
                    xScale={xScale}
                    yScale={yScaleMale}
                    ageBuckets={ageBucketsBySex.male}
                    color={MALE_COLOR}
                    hoveredAgeGroup={hoveredAgeGroup}
                    fontSize={fontTier.label}
                />
                <HoverHitRects
                    xScale={xScale}
                    innerHeight={innerHeight}
                    onHoverAgeGroup={setHoveredAgeGroup}
                    onPointerLeave={handlePointerLeave}
                />

                <AgeAxisCenter
                    xScale={xScale}
                    centerY={centerY}
                    centerGap={centerGap}
                    innerWidth={innerWidth}
                    tickValues={[25, 50, 75, 100, 125]}
                    fontSize={fontTier.tick}
                />

                {/* Sex labels in the center gap */}
                {/* <text
                    x={0}
                    y={centerY}
                    dominantBaseline="auto"
                    fontSize={fontTier.label}
                    fill={FEMALE_COLOR}
                    fontWeight={700}
                    style={{ pointerEvents: "none" }}
                >
                    WOMEN
                </text>
                <text
                    x={0}
                    y={centerY}
                    dominantBaseline="hanging"
                    fontSize={fontTier.label}
                    fill={MALE_COLOR}
                    fontWeight={700}
                    style={{ pointerEvents: "none" }}
                >
                    MEN
                </text> */}
            </Group>
        </svg>
    )
}

export function ResponsivePopulationPyramidHorizontal(
    props: PopulationPyramidHorizontalProps
) {
    const { parentRef, width, height } = useParentSize()
    return (
        <div ref={parentRef} style={{ width: "100%", height: "100%" }}>
            {width > 0 && height > 0 ? (
                <PopulationPyramidHorizontal
                    {...props}
                    width={width}
                    height={height}
                />
            ) : null}
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
}: {
    xScale: ReturnType<typeof scaleLinear<number>>
    yScale: ReturnType<typeof scaleLinear<number>>
    ageBuckets: Record<string, number>
    color: string
    hoveredAgeGroup: string | null
    fontSize: number
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
    const labelFontSize = fontSize - 2
    const fitsInside = h > labelFontSize + 4

    let labelY: number
    let dominantBaseline: "hanging" | "auto"
    let fill: string

    if (fitsInside) {
        labelY = growsUp ? y + 2 : y + h - 2
        dominantBaseline = growsUp ? "hanging" : "auto"
        fill = "white"
    } else {
        labelY = growsUp ? y - 2 : y + h + 2
        dominantBaseline = growsUp ? "auto" : "hanging"
        fill = color
    }

    return (
        <text
            x={barX + barWidth / 2}
            y={labelY}
            textAnchor="middle"
            dominantBaseline={dominantBaseline}
            fontSize={labelFontSize}
            fontWeight={700}
            fill={fill}
            style={{ pointerEvents: "none" }}
        >
            {formatPopulationValueShort(value)}
        </text>
    )
}

function HoverHitRects({
    xScale,
    innerHeight,
    onHoverAgeGroup,
    onPointerLeave,
}: {
    xScale: ReturnType<typeof scaleLinear<number>>
    innerHeight: number
    onHoverAgeGroup: (g: string) => void
    onPointerLeave: () => void
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
                        onPointerEnter={() => onHoverAgeGroup(g)}
                        onPointerLeave={onPointerLeave}
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

function TopGridLabel({
    yScale,
    innerWidth,
    fontSize,
    labelText,
    labelColor,
    position,
}: {
    yScale: ReturnType<typeof scaleLinear<number>>
    innerWidth: number
    fontSize: number
    labelText: string
    labelColor: string
    position: "above" | "below"
}) {
    const ticks = yScale.ticks(2).filter((t) => t > 0)
    const topTick = ticks.at(-1)
    if (topTick === undefined) return null
    return (
        <GridLabel
            valueText={formatGridLabel(topTick)}
            labelText={labelText}
            x={innerWidth}
            y={yScale(topTick)}
            fontSize={fontSize}
            position={position}
            labelColor={labelColor}
        />
    )
}

const GRID_LABEL_PADDING_X = 1.5
const GRID_LABEL_PADDING_Y = 0.5

function GridLabel({
    valueText,
    labelText,
    x,
    y,
    fontSize,
    position,
    labelColor,
}: {
    valueText: string
    labelText: string
    x: number
    y: number
    fontSize: number
    position: "above" | "below"
    labelColor: string
}) {
    const valueWrap = new TextWrap({
        text: valueText,
        maxWidth: Infinity,
        fontSize,
    })
    const labelWrap = new TextWrap({
        text: labelText,
        maxWidth: Infinity,
        fontSize,
    })
    const spaceWidth = Bounds.forText(" ", { fontSize }).width

    const labelRectWidth = labelWrap.width + GRID_LABEL_PADDING_X * 2
    const labelRectHeight = labelWrap.height + GRID_LABEL_PADDING_Y * 2

    // Right-align everything to x
    const labelRectX = x - labelRectWidth
    const valueTextX = labelRectX - spaceWidth - valueWrap.width
    const labelTextX = labelRectX + GRID_LABEL_PADDING_X

    // Position vertically: TextWrapSvg renders from top-left
    const textY = position === "above" ? y - labelRectHeight : y + 1
    const labelRectY = textY + GRID_LABEL_PADDING_Y

    return (
        <g>
            {/* Value text (no background) */}
            <TextWrapSvg
                x={valueTextX}
                y={textY + GRID_LABEL_PADDING_Y}
                textWrap={valueWrap}
                fill={LABEL_COLOR}
            />
            {/* Label background rect */}
            <rect
                x={labelRectX}
                y={labelRectY - GRID_LABEL_PADDING_Y}
                width={labelRectWidth}
                height={labelRectHeight}
                fill={labelColor}
                rx={1}
            />
            {/* Label text */}
            <TextWrapSvg
                x={labelTextX}
                y={labelRectY}
                textWrap={labelWrap}
                fill="white"
            />
        </g>
    )
}

function formatGridLabel(value: number): string {
    return formatValue(value, {
        roundingMode: OwidVariableRoundingMode.decimalPlaces,
        numDecimalPlaces: 0,
        numberAbbreviation: "long",
    })
}
