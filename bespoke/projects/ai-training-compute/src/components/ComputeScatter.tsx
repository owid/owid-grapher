import { useMemo, useRef, useState } from "react"
import * as R from "remeda"
import { scaleLinear, scaleLog } from "d3-scale"

import { Bounds, getRelativeMouse, isTouchDevice } from "@ourworldindata/utils"
import {
    GRAY_10,
    GRAY_30,
    GRAY_50,
    GRAY_60,
    GRAY_70,
    GRAY_80,
    GRAY_90,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"

import { usePinnedTooltip } from "../../../../hooks/usePinnedTooltip.js"
import { AiModel, ColorScheme } from "../core/constants.js"
import {
    formatFlopInWords,
    formatPowerOfTen,
    formatPowerOfTenTick,
} from "../core/formatFlop.js"
import { darkenColorForHighContrastText } from "@ourworldindata/grapher/src/color/ColorUtils.js"
import { getGroupColor } from "../core/colorSchemes.js"
import {
    ComputerKind,
    ComputerSystem,
    getMonthOfComputation,
} from "../core/computers.js"
import { ReferencePoint } from "../core/referencePoints.js"
import { LANDMARKS } from "../core/landmarks.js"
import { ERAS, TIMELINE_EVENTS } from "../core/timeline.js"
import { spreadLabels } from "../core/labelLayout.js"
import { Box, placeLabels } from "../core/labelPlacement.js"
import {
    getYearTicks,
    getYExponentDomain,
    getYTickExponents,
} from "../core/axes.js"
import { ComputeScatterTooltip } from "./ComputeScatterTooltip.js"

const FONT_SIZE = 12
const SMALL_FONT_SIZE = 11
const POINT_RADIUS = 3.5
const HOVER_RADIUS = 14
const COMPUTER_MARKER_SIZE = 8
const COMPUTER_COLOR = GRAY_90
const AXIS_TITLE = "Training computation (FLOP)"

export type HoverTarget =
    | { kind: "model"; model: AiModel }
    | { kind: "computer"; computer: ComputerSystem }
    | { kind: "reference"; reference: ReferencePoint }

type PointTarget = Exclude<HoverTarget, { kind: "reference" }>

export function ComputeScatter({
    width,
    height,
    models,
    computers,
    referencePoints,
    labeledModels,
    timeRange,
    colorScheme,
    focusedGroup,
}: {
    width: number
    height: number
    models: AiModel[]
    /** Empty when the computers layer is switched off */
    computers: ComputerSystem[]
    referencePoints: ReferencePoint[]
    /** Model names to label, highest priority first */
    labeledModels: string[]
    timeRange: [number, number]
    colorScheme: ColorScheme
    focusedGroup?: string
}) {
    const svgRef = useRef<SVGSVGElement>(null)
    const [hover, setHover] = useState<
        { target: HoverTarget; position: { x: number; y: number } } | undefined
    >()
    const clearHover = (): void => setHover(undefined)
    const { ref: containerRef, isPinned } = usePinnedTooltip<HTMLDivElement>(
        hover !== undefined,
        clearHover
    )

    const isNarrow = width < 600
    const [startYear, endYear] = timeRange
    const isInRange = (year: number): boolean =>
        year >= startYear && year <= endYear

    const visibleModels = models.filter((m) => isInRange(m.year))
    const visibleComputers = computers.filter((c) => isInRange(c.year))
    const isInFocus = (model: AiModel): boolean =>
        !focusedGroup || model.groups[colorScheme] === focusedGroup

    const yExponentDomain = getYExponentDomain([
        ...visibleModels.map((m) => m.trainingComputeFlop),
        ...visibleComputers.map(getMonthOfComputation),
    ])
    const [minExp, maxExp] = yExponentDomain

    // Tick labels read "1 million (10⁶)"; on narrow charts the power of ten
    // goes on a second line
    const tickLines = (exp: number): string[] =>
        isNarrow
            ? [formatPowerOfTenTick(exp), `(${formatPowerOfTen(exp)})`]
            : [`${formatPowerOfTenTick(exp)} (${formatPowerOfTen(exp)})`]
    const tickLabelWidth = Math.max(
        ...R.range(minExp, maxExp + 1).flatMap((exp) =>
            tickLines(exp).map(
                (line) => Bounds.forText(line, { fontSize: FONT_SIZE }).width
            )
        )
    )

    const bounds = new Bounds(0, 0, width, height)
    const plotLeft = FONT_SIZE + 8 + tickLabelWidth + 8
    const plotTop = 10
    const plot = new Bounds(
        plotLeft,
        plotTop,
        width - plotLeft - 10,
        height - plotTop - (isNarrow ? 52 : 104)
    )

    const xScale = scaleLinear()
        .domain([startYear, endYear])
        .range([plot.left, plot.right])
    const yScale = scaleLog()
        .domain([10 ** minExp, 10 ** maxExp])
        .range([plot.bottom, plot.top])

    const tickExponents = getYTickExponents(yExponentDomain, plot.height)
    const gridExponents = R.range(minExp, maxExp + 1)
    const yearTicks = getYearTicks(timeRange, plot.width)

    const visibleReferencePoints = referencePoints.filter(
        (r) => r.flop >= 10 ** minExp && r.flop <= 10 ** maxExp
    )
    const referenceLayout = layoutReferenceLabels(
        visibleReferencePoints,
        yScale,
        plot,
        isNarrow
    )

    const labels = useMemo(
        () =>
            layoutPointLabels({
                models: visibleModels.filter(isInFocus),
                computers: visibleComputers,
                labeledModels,
                xScale,
                yScale,
                plot,
                isNarrow,
                obstacles: referenceLayout.map((r) => r.labelBox),
            }),
        // Everything here derives from these inputs
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            models,
            computers,
            labeledModels,
            startYear,
            endYear,
            width,
            height,
            focusedGroup,
            colorScheme,
            minExp,
            maxExp,
            referencePoints,
        ]
    )

    const findNearest = (x: number, y: number): PointTarget | undefined => {
        let best: PointTarget | undefined
        let bestDistance = HOVER_RADIUS
        for (const computer of visibleComputers) {
            const distance = Math.hypot(
                xScale(computer.year) - x,
                yScale(getMonthOfComputation(computer)) - y
            )
            if (distance < bestDistance) {
                best = { kind: "computer", computer }
                bestDistance = distance
            }
        }
        for (const model of visibleModels) {
            if (!isInFocus(model)) continue
            const distance = Math.hypot(
                xScale(model.year) - x,
                yScale(model.trainingComputeFlop) - y
            )
            if (distance < bestDistance) {
                best = { kind: "model", model }
                bestDistance = distance
            }
        }
        return best
    }

    const onMouseMove = (event: React.MouseEvent<SVGSVGElement>): void => {
        if (!svgRef.current) return
        const position = getRelativeMouse(svgRef.current, event.nativeEvent)
        const nearest = findNearest(position.x, position.y)
        if (nearest) {
            setHover({ target: nearest, position })
            return
        }
        const reference = referenceLayout.find(
            ({ reference, labelBox }) =>
                boxContains(labelBox, position) ||
                (Math.abs(yScale(reference.flop) - position.y) < 3 &&
                    position.x >= plot.left &&
                    position.x <= plot.right)
        )?.reference
        if (reference) {
            setHover({ target: { kind: "reference", reference }, position })
            return
        }
        if (!isTouchDevice()) setHover(undefined)
    }

    const onClick = (event: React.MouseEvent<SVGSVGElement>): void => {
        if (!svgRef.current) return
        const position = getRelativeMouse(svgRef.current, event.nativeEvent)
        const nearest = findNearest(position.x, position.y)
        if (nearest?.kind !== "model" || !nearest.model.link) return
        // On touch, the first tap shows the tooltip; tapping the same dot
        // again follows its link
        const isSecondTap =
            hover?.target.kind === "model" &&
            hover.target.model === nearest.model
        if (!isTouchDevice() || isSecondTap)
            window.open(nearest.model.link, "_blank", "noopener,noreferrer")
    }

    const hoveredModel =
        hover?.target.kind === "model" ? hover.target.model : undefined
    const hoveredComputer =
        hover?.target.kind === "computer" ? hover.target.computer : undefined

    // Focused group on top, and within that, bigger runs on top
    const sortedModels = R.sortBy(
        visibleModels,
        (m) => (focusedGroup && isInFocus(m) ? 1 : 0),
        (m) => m.trainingComputeFlop
    )

    const computerLines = R.pipe(
        visibleComputers,
        R.groupBy((c) => c.kind),
        R.values(),
        R.map((systems) => R.sortBy(systems, (c) => c.year))
    )

    return (
        <div ref={containerRef} className="compute-scatter">
            <svg
                ref={svgRef}
                width={width}
                height={height}
                viewBox={bounds.toViewBox()}
                onMouseMove={onMouseMove}
                onMouseLeave={() => {
                    if (!isTouchDevice()) setHover(undefined)
                }}
                onClick={onClick}
                style={{
                    cursor: hoveredModel?.link ? "pointer" : "default",
                }}
                role="img"
                aria-label="Scatter plot of the training computation of notable AI models over time, on a logarithmic scale"
            >
                <defs>
                    <clipPath id="compute-scatter-plot-clip">
                        <rect
                            x={plot.left - POINT_RADIUS - 2}
                            y={plot.top - POINT_RADIUS - 2}
                            width={plot.width + 2 * POINT_RADIUS + 4}
                            height={plot.height + 2 * POINT_RADIUS + 4}
                        />
                    </clipPath>
                </defs>

                {/* Gridlines */}
                {gridExponents.map((exp) => {
                    const isMajor = tickExponents.includes(exp)
                    return (
                        <line
                            key={`grid-${exp}`}
                            x1={plot.left}
                            x2={plot.right}
                            y1={yScale(10 ** exp)}
                            y2={yScale(10 ** exp)}
                            stroke={isMajor ? GRAY_30 : GRAY_10}
                            strokeWidth={isMajor ? 1 : 0.75}
                            strokeDasharray={isMajor ? undefined : "2,3"}
                        />
                    )
                })}

                {/* Y axis */}
                <text
                    transform={`translate(${FONT_SIZE}, ${plot.top + plot.height / 2}) rotate(-90)`}
                    textAnchor="middle"
                    fontSize={FONT_SIZE}
                    fontWeight={700}
                    fill={GRAY_80}
                >
                    {AXIS_TITLE}
                </text>
                {tickExponents.map((exp) => {
                    const lines = tickLines(exp)
                    const y = yScale(10 ** exp)
                    return (
                        <text
                            key={`y-${exp}`}
                            x={plot.left - 6}
                            y={y - ((lines.length - 1) * FONT_SIZE) / 2}
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
                    )
                })}

                {/* Timeline events */}
                {!isNarrow && (
                    <TimelineEvents
                        xScale={xScale}
                        plot={plot}
                        timeRange={timeRange}
                    />
                )}

                {/* X axis */}
                <line
                    x1={plot.left}
                    x2={plot.right}
                    y1={plot.bottom}
                    y2={plot.bottom}
                    stroke={GRAY_60}
                />
                {yearTicks.map((year) => (
                    <g key={`x-${year}`}>
                        <line
                            x1={xScale(year)}
                            x2={xScale(year)}
                            y1={plot.bottom}
                            y2={plot.bottom + 4}
                            stroke={GRAY_60}
                        />
                        <text
                            x={xScale(year)}
                            y={plot.bottom + 8}
                            textAnchor={
                                // Clear of the y axis labels at the left edge
                                xScale(year) - plot.left < 16
                                    ? "start"
                                    : xScale(year) > plot.right - 16
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
                ))}
                <Eras
                    xScale={xScale}
                    plot={plot}
                    timeRange={timeRange}
                    showDetail={!isNarrow}
                />

                {/* Reference lines */}
                {referenceLayout.map(({ reference, label, labelX, labelY }) => {
                    const y = yScale(reference.flop)
                    const isThreshold = reference.kind === "threshold"
                    const isHovered =
                        hover?.target.kind === "reference" &&
                        hover.target.reference === reference
                    return (
                        <g key={reference.id}>
                            <line
                                x1={plot.left}
                                x2={plot.right}
                                y1={y}
                                y2={y}
                                stroke={isThreshold ? GRAY_70 : GRAY_50}
                                strokeWidth={isHovered ? 1.5 : 1}
                                strokeDasharray={isThreshold ? "6,3" : "2,2"}
                            />
                            <text
                                x={labelX}
                                y={labelY}
                                fontSize={SMALL_FONT_SIZE}
                                fontStyle={isThreshold ? "normal" : "italic"}
                                fontWeight={isThreshold ? 700 : 400}
                                fill={isHovered ? GRAY_90 : GRAY_70}
                                stroke="white"
                                strokeWidth={3}
                                paintOrder="stroke"
                            >
                                {label}
                            </text>
                        </g>
                    )
                })}

                <g clipPath="url(#compute-scatter-plot-clip)">
                    {/* Dots */}
                    {sortedModels.map((model) => (
                        <circle
                            key={`${model.model}-${model.date.getTime()}`}
                            cx={xScale(model.year)}
                            cy={yScale(model.trainingComputeFlop)}
                            r={POINT_RADIUS}
                            fill={getGroupColor(
                                colorScheme,
                                model.groups[colorScheme]
                            )}
                            fillOpacity={isInFocus(model) ? 0.85 : 0.12}
                            stroke="white"
                            strokeWidth={0.6}
                        />
                    ))}

                    {/* Computers: one line per kind, so their growth reads
                        as a trend to compare against the dots */}
                    {computerLines.map((systems) => (
                        <polyline
                            key={systems[0].kind}
                            points={systems
                                .map(
                                    (c) =>
                                        `${xScale(c.year)},${yScale(getMonthOfComputation(c))}`
                                )
                                .join(" ")}
                            fill="none"
                            stroke={GRAY_60}
                            strokeWidth={1}
                            strokeDasharray="4,2"
                        />
                    ))}
                    {visibleComputers.map((computer) => (
                        <ComputerMarker
                            key={computer.id}
                            kind={computer.kind}
                            x={xScale(computer.year)}
                            y={yScale(getMonthOfComputation(computer))}
                            isHovered={computer === hoveredComputer}
                        />
                    ))}
                </g>

                {/* Point labels */}
                {labels.map((label) =>
                    label.kind === "model" ? (
                        <ModelLabel
                            key={`label-${label.model.model}`}
                            label={label}
                            color={getGroupColor(
                                colorScheme,
                                label.model.groups[colorScheme]
                            )}
                        />
                    ) : (
                        <text
                            key={`label-${label.computer.id}`}
                            x={label.textX}
                            y={label.box.y + label.box.height / 2}
                            textAnchor={label.anchor}
                            dominantBaseline="middle"
                            fontSize={COMPUTER_LABEL_FONT_SIZE}
                            fill={COMPUTER_COLOR}
                            stroke="white"
                            strokeWidth={3}
                            paintOrder="stroke"
                            pointerEvents="none"
                        >
                            {label.computer.name}
                        </text>
                    )
                )}

                {hoveredModel && (
                    <circle
                        cx={xScale(hoveredModel.year)}
                        cy={yScale(hoveredModel.trainingComputeFlop)}
                        r={POINT_RADIUS + 2}
                        fill="none"
                        stroke={GRAY_80}
                        strokeWidth={1.5}
                        pointerEvents="none"
                    />
                )}
            </svg>
            {hover && (
                <ComputeScatterTooltip
                    target={hover.target}
                    position={hover.position}
                    containerBounds={isPinned ? undefined : bounds}
                    isPinned={isPinned}
                    colorScheme={colorScheme}
                />
            )}
        </div>
    )
}

const COMPUTER_LABEL_FONT_SIZE = SMALL_FONT_SIZE - 0.5

export function ComputerMarker({
    kind,
    x,
    y,
    isHovered = false,
}: {
    kind: ComputerKind
    x: number
    y: number
    isHovered?: boolean
}) {
    const size = isHovered ? COMPUTER_MARKER_SIZE + 3 : COMPUTER_MARKER_SIZE
    const half = size / 2
    const common = {
        fill: "white",
        stroke: COMPUTER_COLOR,
        strokeWidth: isHovered ? 2 : 1.5,
    }
    if (kind === "supercomputer")
        return (
            <rect
                x={x - half}
                y={y - half}
                width={size}
                height={size}
                {...common}
            />
        )
    if (kind === "personal")
        return (
            <polygon
                points={`${x},${y - half - 1} ${x + half + 1},${y} ${x},${y + half + 1} ${x - half - 1},${y}`}
                {...common}
            />
        )
    return (
        <polygon
            points={`${x},${y - half - 1} ${x + half + 1},${y + half} ${x - half - 1},${y + half}`}
            {...common}
        />
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
                r={POINT_RADIUS + 1.5}
                fill={color}
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

function Eras({
    xScale,
    plot,
    timeRange,
    showDetail,
}: {
    xScale: (year: number) => number
    plot: Bounds
    timeRange: [number, number]
    showDetail: boolean
}) {
    const y = plot.bottom + 34
    return (
        <g pointerEvents="none">
            {ERAS.map((era) => {
                const start = Math.max(era.start, timeRange[0])
                const end = Math.min(era.end, timeRange[1])
                if (end <= start) return null
                const x1 = xScale(start) + 3
                const x2 = xScale(end) - 3
                const available = x2 - x1
                const labelWidth = Bounds.forText(era.label, {
                    fontSize: SMALL_FONT_SIZE,
                }).width
                if (available < labelWidth + 12) return null
                const detailFits =
                    showDetail &&
                    Bounds.forText(era.detail, {
                        fontSize: SMALL_FONT_SIZE - 1,
                    }).width < available
                const center = (x1 + x2) / 2
                return (
                    <g key={era.label}>
                        <line x1={x1} x2={x2} y1={y} y2={y} stroke={GRAY_50} />
                        <line
                            x1={x1}
                            x2={x1}
                            y1={y - 3}
                            y2={y + 3}
                            stroke={GRAY_50}
                        />
                        <line
                            x1={x2}
                            x2={x2}
                            y1={y - 3}
                            y2={y + 3}
                            stroke={GRAY_50}
                        />
                        <text
                            x={center}
                            y={y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={SMALL_FONT_SIZE}
                            fill={GRAY_80}
                            stroke="white"
                            strokeWidth={6}
                            paintOrder="stroke"
                        >
                            {era.label}
                        </text>
                        {detailFits && (
                            <text
                                x={center}
                                y={y + 9}
                                textAnchor="middle"
                                dominantBaseline="hanging"
                                fontSize={SMALL_FONT_SIZE - 1}
                                fill={GRAY_70}
                            >
                                {era.detail}
                            </text>
                        )}
                    </g>
                )
            })}
        </g>
    )
}

function TimelineEvents({
    xScale,
    plot,
    timeRange,
}: {
    xScale: (year: number) => number
    plot: Bounds
    timeRange: [number, number]
}) {
    const labelY = plot.bottom + 68
    const fontSize = SMALL_FONT_SIZE - 1
    const events = TIMELINE_EVENTS.filter(
        (event) => event.year >= timeRange[0] && event.year <= timeRange[1]
    )
    const placed = placeLabels(
        events.map((event) => {
            const x = xScale(event.year)
            const width = Bounds.forText(event.label, {
                fontSize,
                isItalic: true,
            }).width
            const y = labelY - fontSize / 2
            return {
                item: event,
                options: [
                    { x: x + 3, y, width, height: fontSize },
                    { x: x - 3 - width, y, width, height: fontSize },
                    // A second row when the first is taken
                    { x: x + 3, y: y + 17, width, height: fontSize },
                    { x: x - 3 - width, y: y + 17, width, height: fontSize },
                ],
            }
        }),
        { x: 0, y: 0, width: plot.right + 10, height: Infinity },
        { padding: 6 }
    )
    return (
        <g pointerEvents="none">
            {placed.map(({ item: event, box, optionIndex }) => {
                const x = xScale(event.year)
                const isRight = optionIndex % 2 === 0
                const y = box.y + fontSize / 2
                return (
                    <g key={event.label}>
                        <line
                            x1={x}
                            x2={x}
                            y1={plot.top}
                            y2={y + fontSize / 2}
                            stroke={GRAY_30}
                            strokeDasharray="1,3"
                        />
                        <text
                            x={isRight ? x + 3 : x - 3}
                            y={y}
                            textAnchor={isRight ? "start" : "end"}
                            dominantBaseline="middle"
                            fontSize={fontSize}
                            fontStyle="italic"
                            fill={GRAY_70}
                        >
                            {event.label}
                        </text>
                    </g>
                )
            })}
        </g>
    )
}

interface ReferenceLabelPlacement {
    reference: ReferencePoint
    label: string
    labelX: number
    /** Baseline of the label text, just above its line where there's room */
    labelY: number
    labelBox: Box
}

/**
 * Labels sit at the left edge: compute grew over time, so the upper left of
 * the chart is empty and the dots crowd the lower left only sparsely.
 */
function layoutReferenceLabels(
    referencePoints: ReferencePoint[],
    yScale: (value: number) => number,
    plot: Bounds,
    useShortLabels: boolean
): ReferenceLabelPlacement[] {
    const desired = referencePoints.map((r) => yScale(r.flop) - 3)
    const spread = spreadLabels(desired, SMALL_FONT_SIZE + 2, {
        min: plot.top + SMALL_FONT_SIZE,
        max: plot.bottom - 3,
    })
    const labelX = plot.left + 4
    return referencePoints.map((reference, i) => {
        const label = useShortLabels ? reference.shortLabel : reference.label
        const isThreshold = reference.kind === "threshold"
        return {
            reference,
            label,
            labelX,
            labelY: spread[i],
            labelBox: {
                x: labelX,
                y: spread[i] - SMALL_FONT_SIZE,
                width: Bounds.forText(label, {
                    fontSize: SMALL_FONT_SIZE,
                    fontWeight: isThreshold ? 700 : 400,
                    isItalic: !isThreshold,
                }).width,
                height: SMALL_FONT_SIZE + 2,
            },
        }
    })
}

interface LabelPosition {
    box: Box
    textX: number
    anchor: "start" | "end"
}

interface ModelLabelPlacement extends LabelPosition {
    kind: "model"
    model: AiModel
    name: string
    detail?: string
    dotX: number
    dotY: number
}

interface ComputerLabelPlacement extends LabelPosition {
    kind: "computer"
    computer: ComputerSystem
}

/**
 * Landmark models first, in priority order, then computers. Each tries a few
 * spots around its point (nearest first, then further out with a leader
 * line) and is dropped when none is free.
 */
function layoutPointLabels({
    models,
    computers,
    labeledModels,
    xScale,
    yScale,
    plot,
    isNarrow,
    obstacles,
}: {
    models: AiModel[]
    computers: ComputerSystem[]
    labeledModels: string[]
    xScale: (year: number) => number
    yScale: (value: number) => number
    plot: Bounds
    isNarrow: boolean
    obstacles: Box[]
}): (ModelLabelPlacement | ComputerLabelPlacement)[] {
    type Candidate =
        | {
              kind: "model"
              model: AiModel
              name: string
              detail?: string
              x: number
              y: number
              width: number
              fontSize: number
          }
        | {
              kind: "computer"
              computer: ComputerSystem
              x: number
              y: number
              width: number
              fontSize: number
          }

    const modelCandidates: Candidate[] = labeledModels.flatMap((name) => {
        const model = models.find((m) => m.model === name)
        if (!model) return []
        const displayName = LANDMARKS[name]?.displayName ?? name
        const label = `${displayName}, ${model.date.getUTCFullYear()}`
        const detail = isNarrow
            ? undefined
            : ` — ${formatFlopInWords(model.trainingComputeFlop)} FLOP`
        return [
            {
                kind: "model" as const,
                model,
                name: label,
                detail,
                x: xScale(model.year),
                y: yScale(model.trainingComputeFlop),
                width:
                    Bounds.forText(label, {
                        fontSize: FONT_SIZE,
                        fontWeight: 700,
                    }).width +
                    (detail
                        ? Bounds.forText(detail, { fontSize: FONT_SIZE }).width
                        : 0),
                fontSize: FONT_SIZE,
            },
        ]
    })
    const computerCandidates: Candidate[] = computers.map((computer) => ({
        kind: "computer" as const,
        computer,
        x: xScale(computer.year),
        y: yScale(getMonthOfComputation(computer)),
        width: Bounds.forText(computer.name, {
            fontSize: COMPUTER_LABEL_FONT_SIZE,
        }).width,
        fontSize: COMPUTER_LABEL_FONT_SIZE,
    }))

    const positionsFor = (candidate: Candidate): LabelPosition[] => {
        const { x, y, width, fontSize } = candidate
        const height = fontSize + 2
        const isModel = candidate.kind === "model"
        // Prefer the left on the crowded right side of the chart
        const preferLeft = x > plot.left + plot.width * 0.5
        const sides = preferLeft
            ? (["left", "right"] as const)
            : (["right", "left"] as const)
        const gaps = isModel ? [8, 36, 72] : [7]
        const dys = isModel ? [0, -16, 16, -32, 32] : [0, -10, 10]
        return gaps.flatMap((gap) =>
            sides.flatMap((side) =>
                dys.map((dy) => {
                    const textX = side === "left" ? x - gap : x + gap
                    return {
                        box: {
                            x: side === "left" ? textX - width : textX,
                            y: y + dy - height / 2,
                            width,
                            height,
                        },
                        textX,
                        anchor: side === "left" ? "end" : "start",
                    }
                })
            )
        )
    }

    const candidates = [...modelCandidates, ...computerCandidates]
    const positions = candidates.map(positionsFor)
    const placed = placeLabels(
        candidates.map((item, i) => ({
            item: i,
            options: positions[i].map((p) => p.box),
        })),
        { x: plot.left, y: plot.top, width: plot.width, height: plot.height },
        { obstacles }
    )

    return placed.map(({ item: index, optionIndex }) => {
        const candidate = candidates[index]
        const position = positions[index][optionIndex]
        if (candidate.kind === "model")
            return {
                kind: "model",
                model: candidate.model,
                name: candidate.name,
                detail: candidate.detail,
                dotX: candidate.x,
                dotY: candidate.y,
                ...position,
            }
        return { kind: "computer", computer: candidate.computer, ...position }
    })
}

function boxContains(box: Box, point: { x: number; y: number }): boolean {
    return (
        point.x >= box.x &&
        point.x <= box.x + box.width &&
        point.y >= box.y &&
        point.y <= box.y + box.height
    )
}
