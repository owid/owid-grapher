import { useMemo, useRef, useState } from "react"
import * as R from "remeda"
import { scaleLinear, scaleLog } from "d3-scale"

import { Bounds, getRelativeMouse, isTouchDevice } from "@ourworldindata/utils"
import {
    GRAY_30,
    GRAY_60,
    GRAY_70,
    GRAY_80,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { darkenColorForHighContrastText } from "@ourworldindata/grapher/src/color/ColorUtils.js"

import { usePinnedTooltip } from "../../../../hooks/usePinnedTooltip.js"
import {
    AiModel,
    ColorBy,
    NARROW_BREAKPOINT,
    YScaleType,
} from "../core/constants.js"
import { getColor, COLOR_SCHEMES } from "../core/colorSchemes.js"
import { formatFlopInWords } from "../core/formatFlop.js"
import { getYearTicks } from "../core/axes.js"
import { getYAxis } from "../core/yAxis.js"
import { Box, placeLabels } from "../core/labelPlacement.js"
import { LANDMARKS } from "../core/landmarks.js"
import { getComputeRange } from "../core/uncertainty.js"
import { ComputeTooltip } from "./ComputeTooltip.js"

const FONT_SIZE = 12
const SMALL_FONT_SIZE = 11
const POINT_RADIUS = 2.75
// Semi-transparent so overlapping dots stay visible
const POINT_OPACITY = 0.8
const HOVER_RADIUS = 14
const AXIS_TITLES: Record<YScaleType, string> = {
    log: "Training computation (FLOP) – logarithmic scale",
    linear: "Training computation (FLOP)",
}

export function ComputeChart({
    width,
    height,
    models,
    colorBy,
    yScaleType,
    xDomain,
    yBounds,
    showUncertainty,
    labeledModels,
    focusedGroup,
}: {
    width: number
    height: number
    models: AiModel[]
    colorBy: ColorBy
    yScaleType: YScaleType
    /** First and last year of the time axis */
    xDomain: [number, number]
    /** Fixed ends of the y axis in FLOP; either may be left to the data */
    yBounds: { min?: number; max?: number }
    showUncertainty: boolean
    /** Model names to label, most important first */
    labeledModels: string[]
    /** A legend group to bring forward; the others fade */
    focusedGroup?: string
}) {
    const svgRef = useRef<SVGSVGElement>(null)
    const [hover, setHover] = useState<
        { model: AiModel; position: { x: number; y: number } } | undefined
    >()
    const clearHover = (): void => setHover(undefined)
    const { ref: containerRef, isPinned } = usePinnedTooltip<HTMLDivElement>(
        hover !== undefined,
        clearHover
    )

    const isNarrow = width < NARROW_BREAKPOINT
    const isLog = yScaleType === "log"
    const [startYear, endYear] = xDomain

    const visibleModels = models.filter(
        (m) => m.year >= startYear && m.year <= endYear
    )
    const isInFocus = (model: AiModel): boolean =>
        !focusedGroup || COLOR_SCHEMES[colorBy].groupOf(model) === focusedGroup

    const yAxis = getYAxis({
        values: visibleModels.map((m) => m.trainingComputeFlop),
        yScaleType,
        yBounds,
        isNarrow,
    })

    const tickLabelWidth = Math.max(
        0,
        ...yAxis
            .ticksFor(height)
            .flatMap((tick) => tick.lines)
            .map((line) => Bounds.forText(line, { fontSize: FONT_SIZE }).width)
    )
    const plotLeft = FONT_SIZE + 8 + tickLabelWidth + 8
    const plotTop = 10
    const plot = new Bounds(
        plotLeft,
        plotTop,
        width - plotLeft - 10,
        height - plotTop - 28
    )

    const xScale = scaleLinear().domain(xDomain).range([plot.left, plot.right])
    const yScale = (
        isLog
            ? scaleLog().domain(yAxis.domain)
            : scaleLinear().domain(yAxis.domain)
    ).range([plot.bottom, plot.top])

    const [yMin, yMax] = yAxis.domain
    const yTicks = yAxis.ticksFor(plot.height)
    const yearTicks = getYearTicks(xDomain, plot.width)
    const arrows = isLog
        ? layoutThousandfoldArrows({
              tickExponents: yTicks.map((t) => Math.log10(t.value)),
              yScale,
              labelLeft: (value) =>
                  plot.left -
                  6 -
                  Math.max(
                      ...yAxis
                          .linesFor(value)
                          .map(
                              (line) =>
                                  Bounds.forText(line, { fontSize: FONT_SIZE })
                                      .width
                          )
                  ),
              labelHalfHeight: (yAxis.linesFor(1).length * FONT_SIZE) / 2 + 2,
              isNarrow,
          })
        : undefined

    const labels = useMemo(
        () =>
            layoutModelLabels({
                // On the linear axis most models sit on the baseline, where
                // labels would only crowd each other
                models: visibleModels.filter(
                    (m) =>
                        isInFocus(m) &&
                        (isLog || m.trainingComputeFlop >= 0.03 * yMax)
                ),
                labeledModels,
                xScale,
                yScale,
                plot,
                isNarrow,
                obstacles: arrows?.labels.map((label) => label.box) ?? [],
            }),
        // Everything here derives from these inputs
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            models,
            labeledModels,
            startYear,
            endYear,
            width,
            height,
            colorBy,
            yScaleType,
            focusedGroup,
            yMin,
            yMax,
        ]
    )

    const isInPlot = (model: AiModel): boolean => {
        const y = yScale(model.trainingComputeFlop)
        return y >= plot.top - 1 && y <= plot.bottom + 1
    }

    const findNearest = (x: number, y: number): AiModel | undefined => {
        let best: AiModel | undefined
        let bestDistance = HOVER_RADIUS
        for (const model of visibleModels) {
            if (!isInFocus(model) || !isInPlot(model)) continue
            const distance = Math.hypot(
                xScale(model.year) - x,
                yScale(model.trainingComputeFlop) - y
            )
            if (distance < bestDistance) {
                best = model
                bestDistance = distance
            }
        }
        return best
    }

    const onMouseMove = (event: React.MouseEvent<SVGSVGElement>): void => {
        if (!svgRef.current) return
        const position = getRelativeMouse(svgRef.current, event.nativeEvent)
        const model = findNearest(position.x, position.y)
        if (model) setHover({ model, position })
        else if (!isTouchDevice()) setHover(undefined)
    }

    // Focused group on top, and within that, bigger runs on top
    const sortedModels = R.sortBy(
        visibleModels,
        (m) => (focusedGroup && isInFocus(m) ? 1 : 0),
        (m) => m.trainingComputeFlop
    )

    return (
        <div ref={containerRef} className="compute-chart">
            <svg
                ref={svgRef}
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                onMouseMove={onMouseMove}
                onMouseLeave={() => {
                    if (!isTouchDevice()) setHover(undefined)
                }}
                role="img"
                aria-label={`Scatter plot of the computation used to train notable AI models over time, on a ${isLog ? "logarithmic" : "linear"} scale`}
            >
                <defs>
                    <clipPath id="compute-chart-plot-clip">
                        <rect
                            x={plot.left - POINT_RADIUS - 2}
                            y={plot.top - POINT_RADIUS - 2}
                            width={plot.width + 2 * POINT_RADIUS + 4}
                            height={plot.height + 2 * POINT_RADIUS + 4}
                        />
                    </clipPath>
                </defs>

                {/* Gridlines */}
                {yAxis.gridValues(plot.height).map((value) => (
                    <line
                        key={`grid-${value}`}
                        x1={plot.left}
                        x2={plot.right}
                        y1={yScale(value)}
                        y2={yScale(value)}
                        stroke={GRAY_30}
                    />
                ))}

                {/* Y axis */}
                <text
                    transform={`translate(${FONT_SIZE}, ${plot.top + plot.height / 2}) rotate(-90)`}
                    textAnchor="middle"
                    fontSize={FONT_SIZE}
                    fontWeight={700}
                    fill={GRAY_80}
                >
                    {AXIS_TITLES[yScaleType]}
                </text>
                {yTicks.map(({ value, lines }) => (
                    <text
                        key={`y-${value}`}
                        x={plot.left - 6}
                        y={yScale(value) - ((lines.length - 1) * FONT_SIZE) / 2}
                        textAnchor="end"
                        dominantBaseline="middle"
                        fontSize={FONT_SIZE}
                        fill={GRAY_70}
                    >
                        {lines.map((line, i) => (
                            <tspan
                                key={line}
                                x={plot.left - 6}
                                dy={i === 0 ? 0 : FONT_SIZE}
                            >
                                {line}
                            </tspan>
                        ))}
                    </text>
                ))}
                {arrows && <ThousandfoldArrows layout={arrows} />}

                {/* X axis */}
                <line
                    x1={plot.left}
                    x2={plot.right}
                    y1={plot.bottom}
                    y2={plot.bottom}
                    stroke={GRAY_60}
                />
                {yearTicks.map((year) => {
                    const x = xScale(year)
                    return (
                        <g key={`x-${year}`}>
                            <line
                                x1={x}
                                x2={x}
                                y1={plot.bottom}
                                y2={plot.bottom + 4}
                                stroke={GRAY_60}
                            />
                            <text
                                x={x}
                                y={plot.bottom + 8}
                                // Clear of the y axis labels at the edges
                                textAnchor={
                                    x - plot.left < 16
                                        ? "start"
                                        : x > plot.right - 16
                                          ? "end"
                                          : "middle"
                                }
                                dominantBaseline="hanging"
                                fontSize={FONT_SIZE}
                                fill={GRAY_70}
                            >
                                {year}
                            </text>
                        </g>
                    )
                })}

                <g clipPath="url(#compute-chart-plot-clip)">
                    {showUncertainty &&
                        sortedModels.map((model) => {
                            const range = getComputeRange(
                                model.trainingComputeFlop,
                                model.confidence
                            )
                            if (!range) return null
                            const x = xScale(model.year)
                            return (
                                <line
                                    key={`range-${model.model}-${model.date.getTime()}`}
                                    x1={x}
                                    x2={x}
                                    y1={yScale(
                                        Math.max(range[0], yAxis.domain[0])
                                    )}
                                    y2={yScale(range[1])}
                                    stroke={getColor(colorBy, model)}
                                    strokeOpacity={
                                        isInFocus(model) ? 0.35 : 0.06
                                    }
                                    strokeWidth={1.25}
                                />
                            )
                        })}
                    {sortedModels.map((model) => (
                        <circle
                            key={`${model.model}-${model.date.getTime()}`}
                            cx={xScale(model.year)}
                            cy={yScale(model.trainingComputeFlop)}
                            r={POINT_RADIUS}
                            fill={getColor(colorBy, model)}
                            fillOpacity={
                                isInFocus(model) ? POINT_OPACITY : 0.12
                            }
                            stroke="white"
                            strokeWidth={0.6}
                        />
                    ))}
                </g>

                {labels.map((label) => (
                    <ModelLabel
                        key={`label-${label.model.model}`}
                        label={label}
                        color={getColor(colorBy, label.model)}
                    />
                ))}

                {hover && (
                    <circle
                        cx={xScale(hover.model.year)}
                        cy={yScale(hover.model.trainingComputeFlop)}
                        r={POINT_RADIUS + 2}
                        fill="none"
                        stroke={GRAY_80}
                        strokeWidth={1.5}
                        pointerEvents="none"
                    />
                )}
            </svg>
            {hover && (
                <ComputeTooltip
                    model={hover.model}
                    position={hover.position}
                    containerBounds={isPinned ? undefined : { width, height }}
                    isPinned={isPinned}
                    colorBy={colorBy}
                />
            )}
        </div>
    )
}

function ModelLabel({
    label,
    color,
}: {
    label: ModelLabelPlacement
    color: string
}) {
    const { box, textX, anchor, dotX, dotY, name, detail } = label
    const textY = box.y + box.height / 2
    const needsLeader =
        Math.abs(textX - dotX) > 10 || Math.abs(textY - dotY) > 2
    const leaderX = anchor === "end" ? box.x + box.width + 2 : box.x - 2
    return (
        <g pointerEvents="none">
            {needsLeader && (
                <line
                    x1={leaderX}
                    y1={textY}
                    x2={dotX}
                    y2={dotY}
                    stroke={color}
                    strokeWidth={0.8}
                />
            )}
            <circle
                cx={dotX}
                cy={dotY}
                r={POINT_RADIUS + 1}
                fill={color}
                fillOpacity={POINT_OPACITY}
                stroke="white"
                strokeWidth={1}
            />
            <text
                x={textX}
                y={textY}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize={FONT_SIZE}
                fill={darkenColorForHighContrastText(color)}
                stroke="white"
                strokeWidth={3}
                paintOrder="stroke"
            >
                <tspan fontWeight={700}>{name}</tspan>
                {detail && <tspan>{detail}</tspan>}
            </text>
        </g>
    )
}

interface ModelLabelPlacement {
    model: AiModel
    name: string
    detail?: string
    box: Box
    textX: number
    anchor: "start" | "end"
    dotX: number
    dotY: number
}

/**
 * Labels for the landmark models in view, in priority order. Each tries a
 * few spots around its dot, nearest first, then further out with a leader
 * line, and is dropped when none is free.
 */
function layoutModelLabels({
    models,
    labeledModels,
    xScale,
    yScale,
    plot,
    isNarrow,
    obstacles,
}: {
    models: AiModel[]
    labeledModels: string[]
    xScale: (year: number) => number
    yScale: (value: number) => number
    plot: Bounds
    isNarrow: boolean
    obstacles: Box[]
}): ModelLabelPlacement[] {
    const candidates = labeledModels.flatMap((name) => {
        const model = models.find((m) => m.model === name)
        if (!model) return []
        const displayName = LANDMARKS[name]?.displayName ?? name
        const label = `${displayName}, ${model.date.getUTCFullYear()}`
        const detail = isNarrow
            ? undefined
            : ` — ${formatFlopInWords(model.trainingComputeFlop)} FLOP`
        const width =
            Bounds.forText(label, { fontSize: FONT_SIZE, fontWeight: 700 })
                .width +
            (detail ? Bounds.forText(detail, { fontSize: FONT_SIZE }).width : 0)
        const x = xScale(model.year)
        const y = yScale(model.trainingComputeFlop)
        const height = FONT_SIZE + 2
        // Prefer the left on the crowded right side of the chart
        const sides =
            x > plot.left + plot.width * 0.5
                ? (["left", "right"] as const)
                : (["right", "left"] as const)
        const positions = [8, 36, 72].flatMap((gap) =>
            sides.flatMap((side) =>
                [0, -16, 16, -32, 32].map((dy) => {
                    const textX = side === "left" ? x - gap : x + gap
                    const anchor: "start" | "end" =
                        side === "left" ? "end" : "start"
                    return {
                        box: {
                            x: side === "left" ? textX - width : textX,
                            y: y + dy - height / 2,
                            width,
                            height,
                        },
                        textX,
                        anchor,
                    }
                })
            )
        )
        return [{ model, label, detail, x, y, positions }]
    })

    const placed = placeLabels(
        candidates.map((candidate, i) => ({
            item: i,
            options: candidate.positions.map((p) => p.box),
        })),
        { x: plot.left, y: plot.top, width: plot.width, height: plot.height },
        { obstacles }
    )

    return placed.map(({ item, optionIndex }) => {
        const candidate = candidates[item]
        const position = candidate.positions[optionIndex]
        return {
            model: candidate.model,
            name: candidate.label,
            detail: candidate.detail,
            dotX: candidate.x,
            dotY: candidate.y,
            ...position,
        }
    })
}

interface ThousandfoldArrowLayout {
    x: number
    bulge: number
    isNarrow: boolean
    labels: {
        low: number
        y1: number
        y2: number
        midY: number
        factor: string
        textX: number
        box: Box
    }[]
}

/**
 * Curved arrows spelling out that each labeled gridline is a thousand times
 * the one below: between 1,000, 1 million and 1 billion when those are in
 * view, otherwise between the lowest labels in view. They run from label to
 * label in the y-axis label column, curving right towards their text.
 */
function layoutThousandfoldArrows({
    tickExponents,
    yScale,
    labelLeft,
    labelHalfHeight,
    isNarrow,
}: {
    tickExponents: number[]
    yScale: (value: number) => number
    labelLeft: (value: number) => number
    labelHalfHeight: number
    isNarrow: boolean
}): ThousandfoldArrowLayout | undefined {
    const steps = tickExponents
        .slice(0, -1)
        .map((exp, i) => [exp, tickExponents[i + 1]] as const)
    const preferred = steps.filter(([low]) => low === 3 || low === 6)
    const pairs = (preferred.length === 2 ? preferred : steps).slice(0, 2)
    if (pairs.length === 0) return undefined

    // Both arrows start under the leftmost of the labels they connect
    const x = Math.min(
        ...pairs.flatMap(([low, high]) => [
            labelLeft(10 ** low),
            labelLeft(10 ** high),
        ])
    )
    const bulge = isNarrow ? 10 : 14
    const labels = pairs.map(([low, high]) => {
        const y1 = yScale(10 ** low) - labelHalfHeight
        const y2 = yScale(10 ** high) + labelHalfHeight
        const midY = (y1 + y2) / 2
        const factor = formatFlopInWords(10 ** (high - low), {
            significantDigits: 1,
        })
        const textX = x + bulge + 5
        const text = isNarrow ? `${factor}×` : `${factor}× more compute`
        const width = Bounds.forText(text, {
            fontSize: SMALL_FONT_SIZE,
            fontWeight: 700,
        }).width
        return {
            low,
            y1,
            y2,
            midY,
            factor,
            textX,
            box: {
                x: x - 2,
                y: midY - SMALL_FONT_SIZE / 2 - 1,
                width: textX - x + width + 2,
                height: SMALL_FONT_SIZE + 2,
            },
        }
    })
    return { x, bulge, labels, isNarrow }
}

function ThousandfoldArrows({ layout }: { layout: ThousandfoldArrowLayout }) {
    const { x, bulge, labels, isNarrow } = layout
    return (
        <g pointerEvents="none">
            <defs>
                <marker
                    id="compute-chart-arrowhead"
                    viewBox="0 0 10 10"
                    refX={8}
                    refY={5}
                    markerWidth={6}
                    markerHeight={6}
                    orient="auto-start-reverse"
                >
                    <path d="M0,1 L9,5 L0,9 z" fill={GRAY_70} />
                </marker>
            </defs>
            {labels.map(({ low, y1, y2, midY, factor, textX }) => (
                <g key={low}>
                    <path
                        d={`M${x},${y1} Q${x + bulge * 2},${midY} ${x},${y2}`}
                        fill="none"
                        stroke={GRAY_70}
                        strokeWidth={1.2}
                        markerEnd="url(#compute-chart-arrowhead)"
                    />
                    <text
                        x={textX}
                        y={midY}
                        dominantBaseline="middle"
                        fontSize={SMALL_FONT_SIZE}
                        fill={GRAY_80}
                        stroke="white"
                        strokeWidth={3}
                        paintOrder="stroke"
                    >
                        <tspan fontWeight={700}>{factor}×</tspan>
                        {!isNarrow && <tspan> more compute</tspan>}
                    </text>
                </g>
            ))}
        </g>
    )
}
