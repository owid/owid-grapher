import { memo, useCallback, useId, useMemo, useRef, useState } from "react"
import { scaleLinear, scaleLog } from "@visx/scale"
import { area, curveMonotoneX } from "d3-shape"
import type { ScaleLinear, ScaleLogarithmic } from "d3-scale"

import { Bounds, getRelativeMouse } from "@ourworldindata/utils"
import {
    GRAPHER_BACKGROUND,
    GRAPHER_DARK_TEXT,
    GRAPHER_LIGHT_TEXT,
    GRAY_100,
    GRAY_20,
    GRAY_60,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"

import { ResponsiveContainer } from "../../../../components/ResponsiveContainer/ResponsiveContainer.js"
import { usePinnedTooltip } from "../../../../hooks/usePinnedTooltip.js"
import type {
    ChartSeries,
    IncomeDistributionChartModel,
} from "../core/chartModel.js"
import {
    combinedFactor,
    formatIncome,
    timeIntervalNoun,
} from "../core/currency.js"
import { placeRegionLabels, RegionBandPixels } from "../core/regionLabels.js"
import type {
    Currency,
    IncomeDistributionYear,
    TimeInterval,
} from "../core/types.js"
import {
    INT_POVERTY_LINE,
    WORLD_COLOR,
    WORLD_ENTITY_NAME,
} from "../core/constants.js"
import { IncomeDistributionTooltip } from "./IncomeDistributionTooltip.js"

export interface IncomeDistributionChartProps {
    model: IncomeDistributionChartModel
    /** For the share below the line in the tooltip */
    yearData: IncomeDistributionYear
    year: number
    currency: Currency
    timeInterval: TimeInterval
    /** Custom poverty line in int-$/day, null when unset */
    povertyLine: number | null
    /** Called on click with the income under the cursor; the caller sets or clears the line */
    onTogglePovertyLine: (income: number) => void
    /** Shared with the legend */
    hoveredEntity: string | null
    onHoverEntity: (key: string | null) => void
    isNarrow: boolean
}

const MARGIN = { top: 10, right: 16, bottom: 32, left: 16 }

/** Multiples of each power of ten that get a tick */
const TICK_MULTIPLIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const LABELLED_MULTIPLIERS = [1, 2, 3, 5]
const LABELLED_MULTIPLIERS_NARROW = [1, 3]

const REGION_LABEL_FONT_SIZES = [13, 12, 11, 10, 9] as const
const REGION_LABEL_FONT_SIZES_NARROW = [11, 10, 9] as const

const FADED_OPACITY = 0.35
const DIMMED_OPACITY = 0.3

/** A pointer that moves further than this between down and click was dragging */
const DRAG_THRESHOLD = 5

export function IncomeDistributionChart(
    props: IncomeDistributionChartProps
): React.ReactElement {
    return (
        <ResponsiveContainer>
            {(dimensions) => (
                <IncomeDistributionChartContent {...props} {...dimensions} />
            )}
        </ResponsiveContainer>
    )
}

interface Position {
    x: number
    y: number
}

interface PointerState {
    /** Int-$/day under the pointer */
    income: number
    /** Relative to the chart container */
    position: Position
}

interface AxisTick {
    /** Int-$/day, for positioning */
    value: number
    label?: string
}

function IncomeDistributionChartContent({
    model,
    yearData,
    year,
    currency,
    timeInterval,
    povertyLine,
    onTogglePovertyLine,
    hoveredEntity,
    onHoverEntity,
    isNarrow,
    width,
    height,
}: IncomeDistributionChartProps & {
    width: number
    height: number
}): React.ReactElement {
    const plotLeft = MARGIN.left
    const plotRight = Math.max(width - MARGIN.right, plotLeft + 1)
    const plotTop = MARGIN.top
    const plotBottom = Math.max(height - MARGIN.bottom, plotTop + 1)
    const tickFontSize = isNarrow ? 11 : 12

    const incomes = model.grid.incomes
    const isStacked = model.regionBands.length > 0

    const xScale = useMemo(
        () =>
            scaleLog<number>({
                domain: [incomes[0], incomes[incomes.length - 1]],
                range: [plotLeft, plotRight],
                clamp: true,
            }),
        [incomes, plotLeft, plotRight]
    )
    const yScale = useMemo(
        () =>
            scaleLinear<number>({
                domain: [0, model.yMax > 0 ? model.yMax : 1],
                range: [plotBottom, plotTop],
            }),
        [model.yMax, plotBottom, plotTop]
    )

    const paths = useMemo(
        () => computeAreaPaths(model.series, incomes, xScale, yScale),
        [model.series, incomes, xScale, yScale]
    )

    const ticks = useMemo(
        () =>
            computeAxisTicks(
                xScale,
                currency,
                timeInterval,
                isNarrow ? LABELLED_MULTIPLIERS_NARROW : LABELLED_MULTIPLIERS
            ),
        [xScale, currency, timeInterval, isNarrow]
    )

    const regionLabels = useMemo(() => {
        if (model.regionBands.length === 0) return []
        const bands: RegionBandPixels[] = model.regionBands.map((band) => ({
            region: band.region,
            points: incomes.map((income, i) => ({
                x: xScale(income),
                top: yScale(band.y1[i]),
                bottom: yScale(band.y0[i]),
            })),
        }))
        return placeRegionLabels(bands, {
            fontSizes: isNarrow
                ? REGION_LABEL_FONT_SIZES_NARROW
                : REGION_LABEL_FONT_SIZES,
        })
    }, [model.regionBands, incomes, xScale, yScale, isNarrow])

    // Series the hovered entity covers: itself, or the countries of a hovered region
    const highlightedKeys = useMemo(() => {
        if (hoveredEntity === null) return undefined
        const keys = new Set(
            model.series
                .filter(
                    (series) =>
                        series.key === hoveredEntity ||
                        series.region === hoveredEntity
                )
                .map((series) => series.key)
        )
        return keys.size > 0 ? keys : undefined
    }, [model.series, hoveredEntity])

    const [pointer, setPointer] = useState<PointerState | null>(null)
    const svgRef = useRef<SVGSVGElement>(null)
    const pointerDownRef = useRef<Position | null>(null)

    // Touch only: a tap outside the chart or scrolling it away also ends
    // the entity highlight a tap on an area started
    const dismissPointer = useCallback(() => {
        setPointer(null)
        onHoverEntity(null)
    }, [onHoverEntity])
    const { ref: chartRef, isPinned } = usePinnedTooltip<HTMLDivElement>(
        pointer !== null,
        dismissPointer
    )

    const pointerStateFromEvent = useCallback(
        (event: { clientX: number; clientY: number }): PointerState | null => {
            if (!svgRef.current) return null
            const position = getRelativeMouse(svgRef.current, event)
            return {
                income: xScale.invert(position.x),
                position: { x: position.x, y: position.y },
            }
        },
        [xScale]
    )

    const handlePointerMove = useCallback(
        (event: React.PointerEvent<SVGSVGElement>) => {
            if (event.pointerType !== "mouse") return
            setPointer(pointerStateFromEvent(event))
        },
        [pointerStateFromEvent]
    )
    const handlePointerLeave = useCallback(
        (event: React.PointerEvent<SVGSVGElement>) => {
            // On touch devices, dismissal is handled by usePinnedTooltip
            if (event.pointerType === "mouse") setPointer(null)
        },
        []
    )
    const handlePointerDown = useCallback(
        (event: React.PointerEvent<SVGSVGElement>) => {
            pointerDownRef.current = { x: event.clientX, y: event.clientY }
            if (event.pointerType !== "mouse")
                setPointer(pointerStateFromEvent(event))
        },
        [pointerStateFromEvent]
    )
    const handleClick = useCallback(
        (event: React.MouseEvent<SVGSVGElement>) => {
            const start = pointerDownRef.current
            pointerDownRef.current = null
            if (
                start &&
                Math.hypot(event.clientX - start.x, event.clientY - start.y) >
                    DRAG_THRESHOLD
            )
                return
            const state = pointerStateFromEvent(event)
            if (state) onTogglePovertyLine(state.income)
        },
        [pointerStateFromEvent, onTogglePovertyLine]
    )

    // Entity hover, delegated from the area paths via their data-key
    const handleAreaPointerOver = useCallback(
        (event: React.PointerEvent<SVGGElement>) => {
            if (event.pointerType !== "mouse") return
            const key = seriesKeyOf(event.target)
            if (key !== null) onHoverEntity(key)
        },
        [onHoverEntity]
    )
    const handleAreaPointerLeave = useCallback(
        (event: React.PointerEvent<SVGGElement>) => {
            if (event.pointerType === "mouse") onHoverEntity(null)
        },
        [onHoverEntity]
    )
    const handleAreaPointerDown = useCallback(
        (event: React.PointerEvent<SVGGElement>) => {
            if (event.pointerType === "mouse") return
            const key = seriesKeyOf(event.target)
            if (key !== null) onHoverEntity(key === hoveredEntity ? null : key)
        },
        [onHoverEntity, hoveredEntity]
    )

    const clipPathId = `income-distribution-highlight-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`

    const hoveredIncome = pointer?.income ?? null
    const threshold = povertyLine ?? hoveredIncome
    const thresholdX = threshold !== null ? xScale(threshold) : null

    const containerBounds = useMemo(
        () => new Bounds(0, 0, width, height),
        [width, height]
    )

    const tooltipEntity = hoveredEntity ?? WORLD_ENTITY_NAME
    const tooltipColor =
        tooltipEntity === WORLD_ENTITY_NAME
            ? WORLD_COLOR
            : (model.legend.find((entry) => entry.key === tooltipEntity)
                  ?.color ??
              model.series.find((series) => series.key === tooltipEntity)
                  ?.color)

    const noun = timeIntervalNoun(timeInterval)
    const stackedBy = model.series[0]?.isCountry ? "country" : "world region"
    const ariaLabel = isStacked
        ? `Distribution of the world population by income per ${noun} in ${year}, stacked by ${stackedBy} and coloured by world region, on a logarithmic income axis.`
        : `Distribution of income per ${noun} in ${year} in ${model.legend.map((entry) => entry.key).join(", ")}, on a logarithmic income axis.`

    return (
        <div ref={chartRef} className="income-distribution-chart">
            <svg
                ref={svgRef}
                className="income-distribution-chart__svg"
                width={width}
                height={height}
                role="img"
                aria-label={ariaLabel}
                onPointerMove={handlePointerMove}
                onPointerLeave={handlePointerLeave}
                onPointerDown={handlePointerDown}
                onClick={handleClick}
            >
                <defs>
                    <clipPath id={clipPathId}>
                        <rect
                            x={0}
                            y={0}
                            width={Math.max(thresholdX ?? width, 0)}
                            height={height}
                        />
                    </clipPath>
                </defs>

                <XAxis
                    ticks={ticks}
                    xScale={xScale}
                    plotTop={plotTop}
                    plotBottom={plotBottom}
                    fontSize={tickFontSize}
                />

                <g
                    className="income-distribution-chart__areas"
                    opacity={thresholdX !== null ? FADED_OPACITY : 1}
                    onPointerOver={handleAreaPointerOver}
                    onPointerLeave={handleAreaPointerLeave}
                    onPointerDown={handleAreaPointerDown}
                >
                    <AreaLayer
                        series={model.series}
                        paths={paths}
                        isStacked={isStacked}
                        highlightedKeys={highlightedKeys}
                    />
                </g>
                {thresholdX !== null && (
                    <g
                        className="income-distribution-chart__areas income-distribution-chart__areas--highlight"
                        clipPath={`url(#${clipPathId})`}
                    >
                        <AreaLayer
                            series={model.series}
                            paths={paths}
                            isStacked={isStacked}
                            highlightedKeys={highlightedKeys}
                        />
                    </g>
                )}

                {regionLabels.map((label) => (
                    <text
                        key={label.region}
                        className="income-distribution-chart__region-label"
                        x={label.x}
                        y={label.y}
                        fontSize={label.fontSize}
                        textAnchor="middle"
                        dominantBaseline="central"
                    >
                        {label.region}
                    </text>
                ))}

                <InternationalPovertyLine
                    x={xScale(INT_POVERTY_LINE)}
                    plotTop={plotTop}
                    plotBottom={plotBottom}
                    label={`International poverty line: ${formatIncome(INT_POVERTY_LINE, currency, timeInterval, { short: true })}`}
                    showLabel={!isNarrow}
                />

                {povertyLine !== null && (
                    <CustomPovertyLine
                        x={xScale(povertyLine)}
                        plotTop={plotTop}
                        plotBottom={plotBottom}
                        width={width}
                        label={`Poverty line: ${formatIncome(povertyLine, currency, timeInterval)}`}
                    />
                )}

                {hoveredIncome !== null && (
                    <PointerLine
                        x={xScale(hoveredIncome)}
                        plotTop={plotTop}
                        plotBottom={plotBottom}
                        width={width}
                        fontSize={tickFontSize}
                        label={formatIncome(
                            hoveredIncome,
                            currency,
                            timeInterval
                        )}
                    />
                )}
            </svg>

            {pointer && (
                <IncomeDistributionTooltip
                    position={pointer.position}
                    containerBounds={containerBounds}
                    isPinned={isPinned}
                    line={povertyLine ?? pointer.income}
                    hoveredEntity={hoveredEntity}
                    yearData={yearData}
                    year={year}
                    currency={currency}
                    timeInterval={timeInterval}
                    hasPovertyLine={povertyLine !== null}
                    color={tooltipColor}
                />
            )}
        </div>
    )
}

/**
 * Memoised: its props only change with the model, the size or the hovered
 * entity, so pointer moves don't redraw the paths.
 */
const AreaLayer = memo(function AreaLayer({
    series,
    paths,
    isStacked,
    highlightedKeys,
}: {
    series: ChartSeries[]
    paths: string[]
    isStacked: boolean
    highlightedKeys: Set<string> | undefined
}): React.ReactElement {
    return (
        <>
            {series.map((s, i) => {
                const isHighlighted = highlightedKeys?.has(s.key) ?? false
                const isDimmed = highlightedKeys !== undefined && !isHighlighted
                return (
                    <path
                        key={s.key}
                        data-key={s.key}
                        d={paths[i]}
                        fill={s.color}
                        fillOpacity={isStacked ? 1 : 0.5}
                        stroke={isStacked ? GRAPHER_BACKGROUND : s.color}
                        strokeWidth={
                            isStacked
                                ? isHighlighted
                                    ? 1
                                    : 0.5
                                : isHighlighted
                                  ? 2.5
                                  : 1.5
                        }
                        strokeLinejoin="round"
                        opacity={isDimmed ? DIMMED_OPACITY : 1}
                    />
                )
            })}
        </>
    )
})

function XAxis({
    ticks,
    xScale,
    plotTop,
    plotBottom,
    fontSize,
}: {
    ticks: AxisTick[]
    xScale: ScaleLogarithmic<number, number>
    plotTop: number
    plotBottom: number
    fontSize: number
}): React.ReactElement {
    return (
        <g className="income-distribution-chart__axis" pointerEvents="none">
            {ticks.map((tick) => {
                const x = xScale(tick.value)
                const isLabelled = tick.label !== undefined
                return (
                    <g key={tick.value}>
                        {isLabelled && (
                            <line
                                x1={x}
                                x2={x}
                                y1={plotTop}
                                y2={plotBottom}
                                stroke={GRAY_20}
                            />
                        )}
                        <line
                            x1={x}
                            x2={x}
                            y1={plotBottom}
                            y2={plotBottom + (isLabelled ? 5 : 3)}
                            stroke={GRAPHER_LIGHT_TEXT}
                        />
                        {isLabelled && (
                            <text
                                x={x}
                                y={plotBottom + 9}
                                dy="0.71em"
                                textAnchor="middle"
                                fontSize={fontSize}
                                fill={GRAPHER_LIGHT_TEXT}
                            >
                                {tick.label}
                            </text>
                        )}
                    </g>
                )
            })}
        </g>
    )
}

function InternationalPovertyLine({
    x,
    plotTop,
    plotBottom,
    label,
    showLabel,
}: {
    x: number
    plotTop: number
    plotBottom: number
    label: string
    showLabel: boolean
}): React.ReactElement {
    return (
        <g pointerEvents="none">
            <line
                x1={x}
                x2={x}
                y1={plotTop}
                y2={plotBottom}
                stroke={GRAY_60}
                strokeWidth={1}
                strokeDasharray="3,3"
            />
            {showLabel && (
                <text
                    transform={`translate(${x + 4}, ${plotTop + 2}) rotate(90)`}
                    textAnchor="start"
                    fontSize={10}
                    fill={GRAPHER_LIGHT_TEXT}
                >
                    {label}
                </text>
            )}
        </g>
    )
}

function CustomPovertyLine({
    x,
    plotTop,
    plotBottom,
    width,
    label,
}: {
    x: number
    plotTop: number
    plotBottom: number
    width: number
    label: string
}): React.ReactElement {
    const fontSize = 12
    const labelWidth = Bounds.forText(label, {
        fontSize,
        fontWeight: 700,
    }).width
    // Flip the label to the left of the line when it would overflow
    const fitsRight = x + 5 + labelWidth <= width
    return (
        <g pointerEvents="none">
            <line
                x1={x}
                x2={x}
                y1={plotTop}
                y2={plotBottom}
                stroke={GRAY_100}
                strokeWidth={2}
                strokeDasharray="5,4"
            />
            <text
                x={fitsRight ? x + 5 : x - 5}
                y={plotTop + 10}
                textAnchor={fitsRight ? "start" : "end"}
                fontSize={fontSize}
                fontWeight={700}
                fill={GRAY_100}
                stroke={GRAPHER_BACKGROUND}
                strokeWidth={3}
                paintOrder="stroke"
            >
                {label}
            </text>
        </g>
    )
}

function PointerLine({
    x,
    plotTop,
    plotBottom,
    width,
    fontSize,
    label,
}: {
    x: number
    plotTop: number
    plotBottom: number
    width: number
    fontSize: number
    label: string
}): React.ReactElement {
    // Keep the label inside the chart near its edges
    const halfLabelWidth =
        Bounds.forText(label, { fontSize, fontWeight: 700 }).width / 2
    const labelX = Math.min(
        Math.max(x, halfLabelWidth),
        Math.max(width - halfLabelWidth, halfLabelWidth)
    )
    return (
        <g pointerEvents="none">
            <line
                x1={x}
                x2={x}
                y1={plotTop}
                y2={plotBottom}
                stroke={GRAY_60}
                strokeWidth={1}
            />
            <text
                x={labelX}
                y={plotBottom + 9}
                dy="0.71em"
                textAnchor="middle"
                fontSize={fontSize}
                fontWeight={700}
                fill={GRAPHER_DARK_TEXT}
                stroke={GRAPHER_BACKGROUND}
                strokeWidth={4}
                paintOrder="stroke"
            >
                {label}
            </text>
        </g>
    )
}

function computeAreaPaths(
    series: ChartSeries[],
    incomes: number[],
    xScale: ScaleLogarithmic<number, number>,
    yScale: ScaleLinear<number, number>
): string[] {
    return series.map((s) => {
        const generator = area<number>()
            .x((_, i) => xScale(incomes[i]))
            .y0((_, i) => yScale(s.y0[i]))
            .y1((_, i) => yScale(s.y1[i]))
            .curve(curveMonotoneX)
        return generator(s.y1) ?? ""
    })
}

/**
 * Ticks at round amounts in the displayed currency and interval (1, 2, 3, 5
 * × 10^k by default), positioned in int-$/day. The other multiples get
 * unlabelled minor ticks.
 */
function computeAxisTicks(
    xScale: ScaleLogarithmic<number, number>,
    currency: Currency,
    timeInterval: TimeInterval,
    labelledMultipliers: number[]
): AxisTick[] {
    const factor = combinedFactor(currency, timeInterval)
    if (!(factor > 0)) return []
    const [min, max] = xScale.domain()
    const ticks: AxisTick[] = []
    for (
        let power = Math.floor(Math.log10(min * factor));
        Math.pow(10, power) <= max * factor;
        power++
    ) {
        for (const multiplier of TICK_MULTIPLIERS) {
            // Round away float noise like 3 × 0.1 = 0.30000000000000004
            const displayed = Number(
                (multiplier * Math.pow(10, power)).toPrecision(12)
            )
            const value = displayed / factor
            if (value < min || value > max) continue
            ticks.push({
                value,
                label: labelledMultipliers.includes(multiplier)
                    ? formatIncome(value, currency, timeInterval, {
                          short: true,
                      })
                    : undefined,
            })
        }
    }
    return ticks
}

/** The series a delegated pointer event landed on, from the path's data attribute */
function seriesKeyOf(target: EventTarget): string | null {
    if (!(target instanceof Element)) return null
    return target.getAttribute("data-key")
}
