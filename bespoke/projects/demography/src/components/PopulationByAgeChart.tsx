import { useState, useCallback, useMemo } from "react"
import { useParentSize } from "@visx/responsive"
import { scaleLinear } from "@visx/scale"
import { Group } from "@visx/group"
import type { Simulation } from "../helpers/useSimulation"
import {
    DENIM_BLUE,
    GRID_LINE_COLOR,
    LABEL_COLOR,
    MAX_AGE,
    PYRAMID_AGE_GROUP_SIZE,
    PYRAMID_AGE_GROUPS,
    ZERO_LINE_COLOR,
} from "../helpers/constants"
import { GRAPHER_LIGHT_TEXT } from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { computeMaxTotalAgeGroupPopulation } from "../model/projectionRunner"
import { groupByAgeRange, parseAgeGroup } from "../helpers/utils"
import { Bounds, formatValue } from "@ourworldindata/utils"
import { OwidVariableRoundingMode } from "@ourworldindata/types"
import { AgeZone } from "../helpers/types.js"
import { useBreakpoint } from "../helpers/useBreakpoint.js"
import { getFontTier, getSizeTier } from "../helpers/fontTiers.js"

export interface PopulationByAgeChartProps {
    simulation: Simulation
    year: number
    yAxisScaleMode?: "fixed" | "adaptive"
    ageZones?: AgeZone[]
}

function PopulationByAgeChart({
    simulation,
    year,
    yAxisScaleMode = "fixed",
    ageZones,
    width,
    height,
}: PopulationByAgeChartProps & { width: number; height: number }) {
    const breakpoint = useBreakpoint()
    const fontTier = getFontTier(breakpoint)
    const margin = { top: 0, right: 0, bottom: 14, left: 0 }

    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const populationBySex = simulation.getPopulationForYear(year)

    const ageBuckets = useMemo(() => {
        const male = populationBySex?.male ?? []
        const female = populationBySex?.female ?? []
        const maleGrouped = groupByAgeRange(male)
        const femaleGrouped = groupByAgeRange(female)
        const total: Record<string, number> = {}
        for (const g of PYRAMID_AGE_GROUPS) {
            total[g] = (maleGrouped[g] || 0) + (femaleGrouped[g] || 0)
        }
        return total
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
            const max = Math.max(...Object.values(ageBuckets), 0)
            return Math.ceil(max * 1.1)
        }
        return computeMaxTotalAgeGroupPopulation(simulation)
    }, [simulation, yAxisScaleMode, ageBuckets])

    const yScale = useMemo(
        () =>
            scaleLinear({
                domain: [0, yMax * 1.05],
                range: [innerHeight, 0],
                nice: true,
            }),
        [innerHeight, yMax]
    )

    const [hoveredAgeGroup, setHoveredAgeGroup] = useState<string | null>(null)
    const handlePointerLeave = useCallback(() => setHoveredAgeGroup(null), [])

    return (
        <svg width={width} height={height} overflow="visible">
            <Group top={margin.top} left={margin.left}>
                <HorizontalGridLines
                    yScale={yScale}
                    innerWidth={innerWidth}
                    tickFontSize={fontTier.tick}
                />

                <AgeGroupBars
                    xScale={xScale}
                    yScale={yScale}
                    ageBuckets={ageBuckets}
                    innerHeight={innerHeight}
                    ageZones={ageZones}
                    hoveredAgeGroup={hoveredAgeGroup}
                    onHoverAgeGroup={setHoveredAgeGroup}
                    onPointerLeave={handlePointerLeave}
                />

                <AgeAxisBottom
                    xScale={xScale}
                    innerHeight={innerHeight}
                    tickValues={[25, 50, 75, 100, 125]}
                    fontSize={fontTier.tick}
                />
            </Group>
        </svg>
    )
}

export function ResponsivePopulationByAgeChart(
    props: PopulationByAgeChartProps
) {
    const { parentRef, width, height } = useParentSize()
    return (
        <div ref={parentRef} style={{ width: "100%", height: "100%" }}>
            {width > 0 && height > 0 ? (
                <PopulationByAgeChart
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
    innerHeight,
    ageZones,
    hoveredAgeGroup,
    onHoverAgeGroup,
    onPointerLeave,
}: {
    xScale: ReturnType<typeof scaleLinear<number>>
    yScale: ReturnType<typeof scaleLinear<number>>
    ageBuckets: Record<string, number>
    innerHeight: number
    ageZones?: AgeZone[]
    hoveredAgeGroup: string | null
    onHoverAgeGroup: (g: string) => void
    onPointerLeave: () => void
}) {
    return (
        <>
            {PYRAMID_AGE_GROUPS.map((g) => {
                const { startAge } = parseAgeGroup(g)
                const barX = xScale(startAge)
                const barWidth =
                    xScale(startAge + PYRAMID_AGE_GROUP_SIZE) - barX + 0.5
                const value = ageBuckets[g] || 0
                const barY = yScale(value)
                const barHeight = innerHeight - barY

                const barColor =
                    ageZones?.find((z) => z.ageGroups.includes(g))?.color ??
                    DENIM_BLUE

                const dimmed = hoveredAgeGroup !== null && hoveredAgeGroup !== g

                return (
                    <rect
                        key={g}
                        x={barX}
                        y={barY}
                        width={barWidth}
                        height={barHeight}
                        fill={barColor}
                        opacity={dimmed ? 0.4 : 1}
                        onPointerEnter={() => onHoverAgeGroup(g)}
                        onPointerLeave={onPointerLeave}
                    />
                )
            })}
        </>
    )
}

function AgeAxisBottom({
    xScale,
    innerHeight,
    tickValues,
    fontSize,
}: {
    xScale: ReturnType<typeof scaleLinear<number>>
    innerHeight: number
    tickValues: number[]
    fontSize: number
}) {
    const labelY = innerHeight + fontSize + 4
    return (
        <g>
            {tickValues.map((tick, i) => (
                <g key={tick}>
                    <line
                        x1={xScale(tick)}
                        y1={0}
                        x2={xScale(tick)}
                        y2={innerHeight}
                        stroke="white"
                        strokeWidth={0.5}
                        style={{ pointerEvents: "none" }}
                    />
                    <text
                        x={xScale(tick)}
                        y={labelY}
                        textAnchor="middle"
                        fontSize={fontSize}
                        fill={GRAPHER_LIGHT_TEXT}
                    >
                        {tick}
                    </text>
                    {i === 0 && (
                        <text
                            x={xScale(tick)}
                            y={labelY}
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
    tickFontSize,
}: {
    yScale: ReturnType<typeof scaleLinear<number>>
    innerWidth: number
    tickFontSize: number
}) {
    return (
        <>
            {yScale.ticks(2).map((tick, i, arr) => {
                const isTop = i === arr.length - 1
                return (
                    <g key={`grid-${tick}`}>
                        <line
                            x1={0}
                            y1={yScale(tick)}
                            x2={innerWidth}
                            y2={yScale(tick)}
                            stroke={
                                tick === 0 ? ZERO_LINE_COLOR : GRID_LINE_COLOR
                            }
                            strokeWidth={1}
                            strokeDasharray={tick === 0 ? undefined : "4,4"}
                        />
                        {tick > 0 && (
                            <text
                                x={innerWidth}
                                y={yScale(tick) - 4}
                                textAnchor="end"
                                fontSize={tickFontSize}
                                fill={LABEL_COLOR}
                            >
                                {formatGridLabel(tick) +
                                    (isTop ? " people" : "")}
                            </text>
                        )}
                    </g>
                )
            })}
        </>
    )
}

function formatGridLabel(value: number): string {
    return formatValue(value, {
        roundingMode: OwidVariableRoundingMode.decimalPlaces,
        numDecimalPlaces: 0,
        numberAbbreviation: "long",
    })
}
