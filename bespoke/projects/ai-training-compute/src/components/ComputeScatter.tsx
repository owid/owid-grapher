import { useMemo, useRef, useState } from "react"
import * as R from "remeda"
import { scaleLinear, scaleLog } from "d3-scale"

import { Bounds, getRelativeMouse, isTouchDevice } from "@ourworldindata/utils"
import {
    GRAY_30,
    GRAY_50,
    GRAY_60,
    GRAY_70,
    GRAY_80,
    GRAY_90,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"

import { usePinnedTooltip } from "../../../../hooks/usePinnedTooltip.js"
import { AiModel, ColorScheme, YScaleType } from "../core/constants.js"
import {
    formatFlopInWords,
    formatPowerOfTen,
    formatPowerOfTenTick,
    formatScientific,
} from "../core/formatFlop.js"
import { darkenColorForHighContrastText } from "@ourworldindata/grapher/src/color/ColorUtils.js"
import { getGroupColor } from "../core/colorSchemes.js"
import {
    ComputerKind,
    ComputerSystem,
    getMonthOfComputation,
    getRecordHolders,
} from "../core/computers.js"
import { ReferencePoint } from "../core/referencePoints.js"
import { LANDMARKS } from "../core/landmarks.js"
import { spreadLabels } from "../core/labelLayout.js"
import { Box, placeLabels } from "../core/labelPlacement.js"
import {
    getLinearYMax,
    getLinearYTicks,
    getYearTicks,
    getYExponentDomain,
    getYTickExponents,
} from "../core/axes.js"
import { LeaderSegment } from "../core/eci.js"
import { getComputeRange } from "../core/uncertainty.js"
import { useTween } from "../core/useTween.js"
import { ComputeScatterTooltip } from "./ComputeScatterTooltip.js"
import {
    FRONTIER_ROW_SPACE,
    FrontierRow,
    findFrontierBar,
    layoutFrontierRow,
} from "./FrontierRow.js"

const FONT_SIZE = 12
const SMALL_FONT_SIZE = 11
const POINT_RADIUS = 2.75
// Semi-transparent so overlapping dots stay visible
const POINT_OPACITY = 0.8
const HOVER_RADIUS = 14
const COMPUTER_MARKER_SIZE = 8
const COMPUTER_COLOR = GRAY_90
const AXIS_TITLES: Record<YScaleType, string> = {
    log: "Training computation (FLOP) – logarithmic scale",
    linear: "Training computation (FLOP)",
}

export type HoverTarget =
    | { kind: "model"; model: AiModel }
    | { kind: "computer"; computer: ComputerSystem }
    | { kind: "reference"; reference: ReferencePoint }
    | { kind: "frontier"; segment: LeaderSegment; isPlotted: boolean }

type PointTarget = Extract<HoverTarget, { kind: "model" | "computer" }>

export function ComputeScatter({
    width,
    height,
    models,
    computers,
    referencePoints,
    labeledModels,
    timeRange,
    animateTransitions = false,
    colorScheme,
    focusedGroup,
    frontierSegments,
    showUncertainty = false,
    yScaleType = "log",
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
    /** Ease to a new time range (and the y axis it calls for) rather than jump */
    animateTransitions?: boolean
    colorScheme: ColorScheme
    focusedGroup?: string
    /**
     * Leaders of the Epoch Capabilities Index, drawn as a row above the plot
     * when given (and the time range reaches into them)
     */
    frontierSegments?: LeaderSegment[]
    /** Draw each model's 90% range from Epoch's confidence label */
    showUncertainty?: boolean
    yScaleType?: YScaleType
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
    const isLog = yScaleType === "log"

    // The axes the target time range calls for; on an animated change, the
    // x and y domains ease there together
    const isInTargetRange = (year: number): boolean =>
        year >= timeRange[0] && year <= timeRange[1]
    const targetValues = [
        ...models
            .filter((m) => isInTargetRange(m.year))
            .map((m) => m.trainingComputeFlop),
        ...computers
            .filter((c) => isInTargetRange(c.year))
            .map(getMonthOfComputation),
    ]
    const targetYDomain = getYExponentDomain(targetValues)
    const targetLinearMax = getLinearYMax(targetValues)
    // The linear maximum eases in log space, so a thousandfold zoom doesn't
    // spend most of the animation near the old value
    const [startYear, endYear, minExp, maxExp, linearMaxExp] = useTween(
        [
            timeRange[0],
            timeRange[1],
            targetYDomain[0],
            targetYDomain[1],
            Math.log10(targetLinearMax),
        ],
        { animate: animateTransitions }
    )
    const linearMax = 10 ** linearMaxExp
    const shownTimeRange: [number, number] = [startYear, endYear]
    const yExponentDomain: [number, number] = [minExp, maxExp]
    // Whole exponents in view, for gridlines and labels
    const firstExp = Math.ceil(minExp - 1e-9) + 0
    const lastExp = Math.floor(maxExp + 1e-9)

    const isInRange = (year: number): boolean =>
        year >= startYear && year <= endYear
    const visibleModels = models.filter((m) => isInRange(m.year))
    const visibleComputers = computers.filter((c) => isInRange(c.year))
    const isInFocus = (model: AiModel): boolean =>
        !focusedGroup || model.groups[colorScheme] === focusedGroup

    // Tick labels read "1 million (10⁶)"; on narrow charts the power of ten
    // goes on a second line
    const tickLines = (exp: number): string[] =>
        isNarrow
            ? [formatPowerOfTenTick(exp), `(${formatPowerOfTen(exp)})`]
            : [`${formatPowerOfTenTick(exp)} (${formatPowerOfTen(exp)})`]
    // Linear ticks read "200 septillion (2 × 10²⁶)"; on narrow charts just
    // the words, as a second line would run off the top of the plot
    const linearTickLines = (value: number): string[] => {
        if (value === 0) return ["0"]
        const words = formatFlopInWords(value, { significantDigits: 3 })
        return isNarrow ? [words] : [`${words} (${formatScientific(value)})`]
    }
    const lineWidth = (line: string): number =>
        Bounds.forText(line, { fontSize: FONT_SIZE }).width
    // Sized for the target axis, so the plot doesn't jitter mid-animation.
    // Linear ticks depend on the plot height; a generous guess at it is
    // enough here, as every tick label of a domain is about as wide.
    const tickLabelWidth = Math.max(
        ...(isLog
            ? R.range(targetYDomain[0], targetYDomain[1] + 1).flatMap(tickLines)
            : getLinearYTicks(targetLinearMax, height).flatMap(linearTickLines)
        ).map(lineWidth)
    )

    const bounds = new Bounds(0, 0, width, height)
    const plotLeft = FONT_SIZE + 8 + tickLabelWidth + 8
    const frontierInRange =
        frontierSegments?.filter(
            (s) => s.endYear > startYear && s.startYear < endYear
        ) ?? []
    const showFrontierRow = frontierInRange.length > 0
    const plotTop = 10 + (showFrontierRow ? FRONTIER_ROW_SPACE : 0)
    const plot = new Bounds(
        plotLeft,
        plotTop,
        width - plotLeft - 10,
        // Room for the year labels
        height - plotTop - 28
    )

    // Left edge of the y-axis label column; legal thresholds start here
    const tickColumnLeft = plot.left - 6 - tickLabelWidth

    const xScale = scaleLinear()
        .domain([startYear, endYear])
        .range([plot.left, plot.right])
    const yDomain: [number, number] = isLog
        ? [10 ** minExp, 10 ** maxExp]
        : [0, linearMax]
    const yScale = isLog
        ? scaleLog().domain(yDomain).range([plot.bottom, plot.top])
        : scaleLinear().domain(yDomain).range([plot.bottom, plot.top])

    // Log: labels at round powers of a thousand, and a gridline at every
    // thousandfold step, labeled or not. Linear: a gridline per label.
    const tickExponents = isLog
        ? getYTickExponents(yExponentDomain, plot.height)
        : []
    const yTicks: { value: number; lines: string[] }[] = isLog
        ? tickExponents.map((exp) => ({
              value: 10 ** exp,
              lines: tickLines(exp),
          }))
        : getLinearYTicks(linearMax, plot.height).map((value) => ({
              value,
              lines: linearTickLines(value),
          }))
    const gridValues = isLog
        ? R.range(firstExp, lastExp + 1)
              .filter((exp) => exp % 3 === 0)
              .map((exp) => 10 ** exp)
        : yTicks.map((tick) => tick.value)
    const yearTicks = getYearTicks(shownTimeRange, plot.width)

    const visibleReferencePoints = referencePoints.filter(
        (r) => r.flop >= yDomain[0] && r.flop <= yDomain[1]
    )
    const referenceLayout = layoutReferenceLabels(
        visibleReferencePoints,
        yScale,
        plot,
        tickColumnLeft,
        isNarrow
    )

    // Where each y-axis label starts, for things aligned to the label column
    const tickLabelLeft = (exp: number): number =>
        plot.left -
        6 -
        Math.max(
            ...tickLines(exp).map(
                (line) => Bounds.forText(line, { fontSize: FONT_SIZE }).width
            )
        )
    // Thousandfold steps only make sense on the log axis
    const arrowLayout = layoutThousandfoldArrows({
        tickExponents: isLog ? tickExponents : [],
        yScale,
        isNarrow,
        tickLabelLeft,
        // Half the height of a tick label, so arrows start and end clear of it
        tickLabelHalfHeight: (tickLines(0).length * FONT_SIZE) / 2 + 2,
    })

    const frontierBars = showFrontierRow
        ? layoutFrontierRow({
              segments: frontierInRange,
              models: visibleModels,
              xScale,
              timeRange: shownTimeRange,
          })
        : []

    const labels = useMemo(
        () =>
            layoutPointLabels({
                // On the linear axis most models sit on the baseline, where
                // labels would only crowd each other
                models: visibleModels.filter(
                    (m) =>
                        isInFocus(m) &&
                        (isLog || m.trainingComputeFlop >= 0.03 * linearMax)
                ),
                computers: visibleComputers,
                labeledModels,
                xScale,
                yScale,
                plot,
                isNarrow,
                obstacles: [
                    ...referenceLayout.map((r) => r.labelBox),
                    ...arrowLayout.labels.map((l) => l.box),
                ],
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
            linearMax,
            yScaleType,
            referencePoints,
            showFrontierRow,
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
        const bar = findFrontierBar(frontierBars, plot, position)
        if (bar) {
            setHover({
                target: {
                    kind: "frontier",
                    segment: bar.segment,
                    isPlotted: bar.model !== undefined,
                },
                position,
            })
            return
        }
        const nearest = findNearest(position.x, position.y)
        if (nearest) {
            setHover({ target: nearest, position })
            return
        }
        const reference = referenceLayout.find(
            ({ reference, labelBox }) =>
                boxContains(labelBox, position) ||
                (Math.abs(yScale(reference.flop) - position.y) < 3 &&
                    position.x >= tickColumnLeft &&
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
    const hoveredSegment =
        hover?.target.kind === "frontier" ? hover.target.segment : undefined
    // Hovering a plotted leader in the frontier row rings its dot
    const ringedModel =
        hoveredModel ??
        frontierBars.find((bar) => bar.segment === hoveredSegment)?.model
    const hoveredComputer =
        hover?.target.kind === "computer" ? hover.target.computer : undefined

    // Focused group on top, and within that, bigger runs on top
    const sortedModels = R.sortBy(
        visibleModels,
        (m) => (focusedGroup && isInFocus(m) ? 1 : 0),
        (m) => m.trainingComputeFlop
    )

    // Lines run through every computer of a kind, including ones outside the
    // zoomed range, so the trend stays visible; the plot clip trims them
    const recordHolders = getRecordHolders(computers)
    const computerLines = R.pipe(
        recordHolders,
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
                aria-label={`Scatter plot of the training computation of notable AI models over time, on a ${isLog ? "logarithmic" : "linear"} scale`}
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
                {gridValues.map((value) => (
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
                {yTicks.map(({ value, lines }) => {
                    const y = yScale(value)
                    return (
                        <text
                            key={`y-${value}`}
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

                <ThousandfoldArrows layout={arrowLayout} />

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
                                x1={tickColumnLeft}
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
                    {/* Uncertainty ranges, behind the dots */}
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
                                    y1={yScale(range[0])}
                                    y2={yScale(range[1])}
                                    stroke={getGroupColor(
                                        colorScheme,
                                        model.groups[colorScheme]
                                    )}
                                    strokeOpacity={
                                        isInFocus(model) ? 0.35 : 0.06
                                    }
                                    strokeWidth={1.25}
                                />
                            )
                        })}

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
                            fillOpacity={
                                isInFocus(model) ? POINT_OPACITY : 0.12
                            }
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

                {showFrontierRow && (
                    <FrontierRow
                        bars={frontierBars}
                        plot={plot}
                        colorScheme={colorScheme}
                        hoveredSegment={hoveredSegment}
                        getDotPosition={(model) => ({
                            x: xScale(model.year),
                            y: yScale(model.trainingComputeFlop),
                        })}
                    />
                )}

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
                            {label.computer.label ?? label.computer.name}
                        </text>
                    )
                )}

                {ringedModel && (
                    <circle
                        cx={xScale(ringedModel.year)}
                        cy={yScale(ringedModel.trainingComputeFlop)}
                        r={
                            POINT_RADIUS +
                            (ringedModel === hoveredModel ? 2 : 4)
                        }
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
    // A shape per kind: square, diamond, triangles pointing down and up, and
    // a ring for supercomputers
    if (kind === "pcCpu")
        return (
            <rect
                x={x - half}
                y={y - half}
                width={size}
                height={size}
                {...common}
            />
        )
    if (kind === "console")
        return (
            <polygon
                points={`${x},${y - half - 1} ${x + half + 1},${y} ${x},${y + half + 1} ${x - half - 1},${y}`}
                {...common}
            />
        )
    if (kind === "gpu")
        return (
            <polygon
                points={`${x - half - 1},${y - half} ${x + half + 1},${y - half} ${x},${y + half + 1}`}
                {...common}
            />
        )
    if (kind === "supercomputer")
        return <circle cx={x} cy={y} r={half + 0.5} {...common} />
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

interface ThousandfoldArrowLayout {
    x: number
    bulge: number
    labels: {
        low: number
        y1: number
        y2: number
        midY: number
        factor: string
        textX: number
        box: Box
    }[]
    isNarrow: boolean
}

/**
 * Curved arrows between the lowest labeled gridlines, spelling out that each
 * step up is a thousandfold increase. Drawn at 1,000 → 1 million → 1 billion
 * when those are visible, otherwise at the lowest two steps in view. They
 * run from label to label in the y-axis label column, curving right towards
 * their text.
 */
function layoutThousandfoldArrows({
    tickExponents,
    yScale,
    isNarrow,
    tickLabelLeft,
    tickLabelHalfHeight,
}: {
    tickExponents: number[]
    yScale: (value: number) => number
    isNarrow: boolean
    tickLabelLeft: (exp: number) => number
    tickLabelHalfHeight: number
}): ThousandfoldArrowLayout {
    const steps = tickExponents
        .slice(0, -1)
        .map((exp, i) => [exp, tickExponents[i + 1]] as const)
    const preferred = steps.filter(([low]) => low === 3 || low === 6)
    const pairs = (preferred.length === 2 ? preferred : steps).slice(0, 2)

    // Both arrows start under the leftmost of the labels they connect
    const x = Math.min(
        ...pairs.flatMap(([low, high]) => [
            tickLabelLeft(low),
            tickLabelLeft(high),
        ])
    )
    const bulge = isNarrow ? 10 : 14
    const labels = pairs.map(([low, high]) => {
        const y1 = yScale(10 ** low) - tickLabelHalfHeight
        const y2 = yScale(10 ** high) + tickLabelHalfHeight
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
    if (labels.length === 0) return null
    return (
        <g pointerEvents="none">
            <defs>
                <marker
                    id="compute-scatter-arrowhead"
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
                        markerEnd="url(#compute-scatter-arrowhead)"
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

interface ReferenceLabelPlacement {
    reference: ReferencePoint
    label: string
    labelX: number
    /** Baseline of the label text, just above its line where there's room */
    labelY: number
    labelBox: Box
}

/**
 * Labels start with their lines at the left edge of the y-axis label column:
 * compute grew over time, so the upper left of the chart is empty.
 */
function layoutReferenceLabels(
    referencePoints: ReferencePoint[],
    yScale: (value: number) => number,
    plot: Bounds,
    labelX: number,
    useShortLabels: boolean
): ReferenceLabelPlacement[] {
    const desired = referencePoints.map((r) => yScale(r.flop) - 3)
    const spread = spreadLabels(desired, SMALL_FONT_SIZE + 2, {
        min: plot.top + SMALL_FONT_SIZE,
        max: plot.bottom - 3,
    })
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
    // Only record-holders get a name; the rest are left to the tooltip
    const computerCandidates: Candidate[] = getRecordHolders(computers).map(
        (computer) => ({
            kind: "computer" as const,
            computer,
            x: xScale(computer.year),
            y: yScale(getMonthOfComputation(computer)),
            width: Bounds.forText(computer.label ?? computer.name, {
                fontSize: COMPUTER_LABEL_FONT_SIZE,
            }).width,
            fontSize: COMPUTER_LABEL_FONT_SIZE,
        })
    )

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
