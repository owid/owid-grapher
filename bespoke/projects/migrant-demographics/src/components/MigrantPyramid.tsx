import { memo, useCallback, useMemo, useRef, useState } from "react"
import { scaleBand, scaleLinear } from "@visx/scale"
import { AxisBottom } from "@visx/axis"
import { Group } from "@visx/group"
import type { ScaleBand, ScaleLinear } from "d3-scale"

import { Bounds, getRelativeMouse } from "@ourworldindata/utils"
import {
    GRAPHER_BACKGROUND,
    GRAPHER_LIGHT_TEXT,
    GRAY_100,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { darkenColorForText } from "@ourworldindata/grapher/src/color/ColorUtils.js"

import { ResponsiveContainer } from "../../../../components/ResponsiveContainer/ResponsiveContainer.js"
import { usePinnedTooltip } from "../../../../hooks/usePinnedTooltip.js"
import { formatAxisTick, PyramidRow, PyramidView } from "../core/helpers.js"
import { ShowMode } from "../core/types.js"
import { MEN_COLOR, NATIVE_LINE_COLOR, WOMEN_COLOR } from "../core/constants.js"
import { MigrantPyramidTooltip } from "./MigrantPyramidTooltip.js"

export interface SexHeaderLabel {
    name: string
    /** Grayed-out share of all immigrants, e.g. "(48%)" */
    annotation?: string
}

export interface MigrantPyramidProps {
    /** The values the bars encode, oldest age band first */
    view: PyramidView
    /** Upper bound of the mirrored x-axes (pre-niced by the scale) */
    xMax: number
    mode: ShowMode
    axisLabel: string
    menLabel: SexHeaderLabel
    womenLabel: SexHeaderLabel
    isNarrow?: boolean
}

const CENTER_GAP_PADDING = 10

/** Distance between a sex header and the age band labels it sits beside */
const SEX_HEADER_GAP = 4
const GRID_LINE_COLOR = "#ddd"

const NATIVE_LINE_WIDTH = 1.5
/**
 * The outline is drawn twice: a wider stroke in the chart background colour
 * underneath, then the line itself. Over a bar that reads as a channel cut
 * through it; over the background the casing is invisible. This is what lets
 * the bars stay at full strength — they carry the primary values.
 */
const NATIVE_LINE_CASING_WIDTH = 4

export function MigrantPyramid(props: MigrantPyramidProps): React.ReactElement {
    return (
        <ResponsiveContainer>
            {(dimensions) => (
                <MigrantPyramidContent {...props} {...dimensions} />
            )}
        </ResponsiveContainer>
    )
}

function MigrantPyramidContent({
    view,
    xMax,
    mode,
    axisLabel,
    menLabel,
    womenLabel,
    isNarrow,
    width,
    height,
}: MigrantPyramidProps & {
    width: number
    height: number
}): React.ReactElement {
    const labelFontSize = isNarrow ? 10 : 11
    const axisLabelFontSize = isNarrow ? 11 : 12
    // Top fits the sex header labels; bottom fits the tick labels plus the
    // axis label, which sits closer on mobile where the fonts are smaller
    const marginTop = 19
    const marginBottom = isNarrow ? 48 : 52
    const axisLabelOffset = isNarrow ? 40 : 46

    const innerWidth = width
    const innerHeight = height - marginTop - marginBottom

    const bands = useMemo(
        () => view.migrants.map((row) => row.band),
        [view.migrants]
    )

    // Text measurement is comparatively costly, and neither input changes
    // when the pointer moves or the year does
    const centerGap = useMemo(
        () => maxTextWidth(bands, labelFontSize) + 2 * CENTER_GAP_PADDING,
        [bands, labelFontSize]
    )
    const halfWidth = Math.max((innerWidth - centerGap) / 2, 0)
    const centerX = halfWidth + centerGap / 2

    const xScale = useMemo(
        () => ({
            // Men: 0 at the center, max at the left edge
            men: scaleLinear({
                domain: [0, xMax],
                range: [halfWidth, 0],
                nice: true,
            }),
            // Women: 0 at the center, max at the right edge
            women: scaleLinear({
                domain: [0, xMax],
                range: [0, halfWidth],
                nice: true,
            }),
        }),
        [halfWidth, xMax]
    )

    const yScale = useMemo(
        () =>
            scaleBand({
                domain: bands,
                range: [0, innerHeight],
                padding: 0.15,
            }),
        [bands, innerHeight]
    )

    // Each band's full row, so the outline and the hit areas cover the gaps
    // between bars rather than stopping at them
    const rowBounds = useMemo(
        () => computeRowBounds(bands, yScale, innerHeight),
        [bands, yScale, innerHeight]
    )

    // Geometry only — kept out of the render path the pointer drives
    const hitRects = useMemo(
        () =>
            rowBounds.map((bounds, i) => (
                <rect
                    key={bounds.band}
                    data-row={i}
                    x={0}
                    y={bounds.y}
                    width={innerWidth}
                    height={bounds.height}
                    fill="transparent"
                />
            )),
        [rowBounds, innerWidth]
    )

    const numTicks = isNarrow ? 3 : 4

    // Kept apart so a pointer move, which only ever changes the position,
    // doesn't re-render the halves — they redraw on the hovered row alone
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    const [pointerPosition, setPointerPosition] = useState<Position | null>(
        null
    )

    const svgRef = useRef<SVGSVGElement>(null)
    const dismissHover = useCallback(() => {
        setHoveredIndex(null)
        setPointerPosition(null)
    }, [])
    // On touch devices this pins the tooltip to the bottom of the viewport
    // and owns dismissal (tap outside, chart scrolled out of view)
    const { ref: chartRef, isPinned } = usePinnedTooltip<HTMLDivElement>(
        hoveredIndex !== null,
        dismissHover
    )

    // One handler set on the group rather than three closures per hit rect;
    // the row comes off the target's data attribute
    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (e.pointerType !== "mouse" || !svgRef.current) return
        const index = rowIndexOf(e.target)
        if (index === null) return
        setHoveredIndex(index)
        setPointerPosition(getRelativeMouse(svgRef.current, e.nativeEvent))
    }, [])
    const handlePointerLeave = useCallback(
        (e: React.PointerEvent) => {
            if (e.pointerType === "mouse") dismissHover()
        },
        [dismissHover]
    )
    // Touch taps to pin; other pointer types have no dismissal path
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (e.pointerType !== "touch" || !svgRef.current) return
        const index = rowIndexOf(e.target)
        if (index === null) return
        setPointerPosition(getRelativeMouse(svgRef.current, e.nativeEvent))
        setHoveredIndex((prev) => (prev === index ? null : index))
    }, [])

    const halves: {
        side: Sex
        left: number
        scale: ScaleLinear<number, number>
        color: string
    }[] = [
        {
            side: "men",
            left: 0,
            scale: xScale.men,
            color: MEN_COLOR,
        },
        {
            side: "women",
            left: centerX + centerGap / 2,
            scale: xScale.women,
            color: WOMEN_COLOR,
        },
    ]

    const hoveredRow =
        hoveredIndex !== null ? view.migrants[hoveredIndex] : undefined

    return (
        <div ref={chartRef} className="migrant-pyramid__chart">
            <svg ref={svgRef} width={width} height={height} overflow="visible">
                <Group top={marginTop}>
                    {halves.map((half) => (
                        <PyramidHalf
                            key={half.side}
                            {...half}
                            rows={view.migrants}
                            comparisonRows={view.natives}
                            rowBounds={rowBounds}
                            yScale={yScale}
                            innerHeight={innerHeight}
                            numTicks={numTicks}
                            mode={mode}
                            tickFontSize={labelFontSize}
                            hoveredIndex={hoveredIndex}
                        />
                    ))}

                    {/* Age band labels in the center gap */}
                    {view.migrants.map((row, i) => {
                        // A step in gray alone is imperceptible at this size,
                        // and the surrounding bars dim at the same moment —
                        // so the hovered label goes bold as well
                        const isHovered = i === hoveredIndex
                        return (
                            <text
                                key={row.band}
                                x={centerX}
                                y={
                                    (yScale(row.band) ?? 0) +
                                    yScale.bandwidth() / 2
                                }
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontSize={labelFontSize}
                                fontWeight={isHovered ? 700 : 400}
                                fill={isHovered ? GRAY_100 : GRAPHER_LIGHT_TEXT}
                            >
                                {row.band}
                            </text>
                        )
                    })}

                    {/* Sex column headers */}
                    <SexHeader
                        label={menLabel}
                        x={centerX - centerGap / 2 - SEX_HEADER_GAP}
                        textAnchor="end"
                        color={MEN_COLOR}
                        fontSize={labelFontSize}
                    />
                    <SexHeader
                        label={womenLabel}
                        x={centerX + centerGap / 2 + SEX_HEADER_GAP}
                        textAnchor="start"
                        color={WOMEN_COLOR}
                        fontSize={labelFontSize}
                    />

                    {/* X-axis label */}
                    <text
                        x={centerX}
                        y={innerHeight + axisLabelOffset}
                        textAnchor="middle"
                        fontSize={axisLabelFontSize}
                        fill={GRAPHER_LIGHT_TEXT}
                    >
                        {axisLabel}
                    </text>

                    {/* Full-width hit rects for hover — one per age band */}
                    <g
                        onPointerMove={handlePointerMove}
                        onPointerLeave={handlePointerLeave}
                        onPointerDown={handlePointerDown}
                    >
                        {hitRects}
                    </g>
                </Group>
            </svg>

            {hoveredIndex !== null && hoveredRow && pointerPosition && (
                <MigrantPyramidTooltip
                    migrants={hoveredRow}
                    natives={view.natives?.[hoveredIndex]}
                    mode={mode}
                    position={pointerPosition}
                    containerBounds={new Bounds(0, 0, width, height)}
                    isPinned={isPinned}
                />
            )}
        </div>
    )
}

type Sex = "men" | "women"

/** Pointer position relative to the SVG */
interface Position {
    x: number
    y: number
}

/** An age band's full row, extended to cover the gaps around its bars */
interface RowBounds {
    band: string
    y: number
    height: number
}

interface PyramidHalfProps {
    /** Which side of the pyramid, and which value of each row it draws */
    side: Sex
    left: number
    scale: ScaleLinear<number, number>
    color: string
    rows: PyramidRow[]
    comparisonRows?: PyramidRow[]
    rowBounds: RowBounds[]
    yScale: ScaleBand<string>
    innerHeight: number
    numTicks: number
    mode: ShowMode
    tickFontSize: number
    hoveredIndex: number | null
}

/**
 * Memoised: every prop is either a primitive or memoised upstream, so a
 * pointer move that leaves the hovered row unchanged redraws nothing here.
 */
const PyramidHalf = memo(function PyramidHalf({
    side,
    left,
    scale,
    color,
    rows,
    comparisonRows,
    rowBounds,
    yScale,
    innerHeight,
    numTicks,
    mode,
    tickFontSize,
    hoveredIndex,
}: PyramidHalfProps): React.ReactElement {
    const zeroX = scale(0)
    const bandwidth = yScale.bandwidth()

    // The vertical stroke the outline draws across one row. The whole outline
    // and the highlighted stretch of it are built from the same segments, so
    // they line up exactly.
    const segment = (row: PyramidRow, bounds: RowBounds): string => {
        const x = scale(row[side])
        return `${x} ${bounds.y} L ${x} ${bounds.y + bounds.height}`
    }

    return (
        <Group left={left}>
            {/* Grid lines */}
            {scale
                .ticks(numTicks)
                .filter((tick) => tick > 0)
                .map((tick) => (
                    <line
                        key={`grid-${tick}`}
                        x1={scale(tick)}
                        y1={0}
                        x2={scale(tick)}
                        y2={innerHeight}
                        stroke={GRID_LINE_COLOR}
                        strokeWidth={1}
                        strokeDasharray="4,4"
                    />
                ))}

            {/* X-axis. Zero sits at the centre gap, where both halves would
                otherwise label it — and the grid lines skip it too. */}
            <AxisBottom
                top={innerHeight}
                scale={scale}
                numTicks={numTicks}
                hideZero
                tickFormat={(tick) => formatAxisTick(tick as number, mode)}
                stroke="transparent"
                tickStroke={GRAPHER_LIGHT_TEXT}
                tickLength={4}
                tickLabelProps={(tick) => ({
                    fontSize: tickFontSize,
                    fill: GRAPHER_LIGHT_TEXT,
                    // Anchor labels inward when centering would overflow
                    // the chart's outer edge
                    textAnchor: edgeAwareTickAnchor(
                        tick as number,
                        scale,
                        side,
                        mode,
                        tickFontSize
                    ),
                })}
            />

            {/* Bars */}
            {rows.map((row, i) => {
                const scaledValue = scale(row[side])
                const barWidth = Math.abs(scaledValue - zeroX)
                const barX = Math.min(scaledValue, zeroX)
                const dimmed = hoveredIndex !== null && hoveredIndex !== i
                return (
                    <rect
                        key={row.band}
                        x={barX}
                        y={yScale(row.band) ?? 0}
                        width={barWidth}
                        height={bandwidth}
                        fill={color}
                        opacity={dimmed ? 0.4 : 1}
                    />
                )
            })}

            {/* Native-born comparison outline */}
            {comparisonRows && (
                <>
                    <CasedLine
                        d={comparisonRows
                            .map(
                                (row, i) =>
                                    `${i === 0 ? "M" : "L"} ${segment(row, rowBounds[i])}`
                            )
                            .join(" ")}
                        opacity={hoveredIndex !== null ? 0.4 : 1}
                    />

                    {/* Redrawn on top so the hovered row stays legible
                        while the rest of the outline dims */}
                    {hoveredIndex !== null && (
                        <CasedLine
                            d={`M ${segment(comparisonRows[hoveredIndex], rowBounds[hoveredIndex])}`}
                            opacity={1}
                        />
                    )}
                </>
            )}
        </Group>
    )
})

function SexHeader({
    label,
    x,
    textAnchor,
    color,
    fontSize,
}: {
    label: SexHeaderLabel
    x: number
    textAnchor: "start" | "end"
    color: string
    fontSize: number
}): React.ReactElement {
    return (
        <text x={x} y={-8} textAnchor={textAnchor} fontSize={fontSize}>
            <tspan fontWeight={700} fill={darkenColorForText(color)}>
                {label.name}
            </tspan>
            {label.annotation && (
                <tspan
                    fill={GRAPHER_LIGHT_TEXT}
                >{` ${label.annotation}`}</tspan>
            )}
        </text>
    )
}

/** The native-born outline: the line itself over a background-coloured casing */
function CasedLine({
    d,
    opacity,
}: {
    d: string
    opacity: number
}): React.ReactElement {
    const shared = {
        d,
        fill: "none",
        strokeLinejoin: "round" as const,
        opacity,
        style: { pointerEvents: "none" as const },
    }
    return (
        <>
            <path
                {...shared}
                stroke={GRAPHER_BACKGROUND}
                strokeWidth={NATIVE_LINE_CASING_WIDTH}
            />
            <path
                {...shared}
                stroke={NATIVE_LINE_COLOR}
                strokeWidth={NATIVE_LINE_WIDTH}
            />
        </>
    )
}

/**
 * Every band's row, spanning the full column height: the first and last reach
 * the ends, and the rest split the gap to their neighbour.
 */
function computeRowBounds(
    bands: string[],
    yScale: ScaleBand<string>,
    innerHeight: number
): RowBounds[] {
    const bandwidth = yScale.bandwidth()
    const halfGap = (yScale.step() - bandwidth) / 2
    return bands.map((band, i) => {
        const top = yScale(band) ?? 0
        const y = i === 0 ? 0 : top - halfGap
        const bottom =
            i === bands.length - 1 ? innerHeight : top + bandwidth + halfGap
        return { band, y, height: bottom - y }
    })
}

/** The row a delegated pointer event landed on, from the hit rect's data attribute */
function rowIndexOf(target: EventTarget): number | null {
    if (!(target instanceof Element)) return null
    const raw = target.getAttribute("data-row")
    if (raw === null) return null
    const index = Number(raw)
    return Number.isInteger(index) ? index : null
}

function maxTextWidth(texts: string[], fontSize: number): number {
    return Math.max(
        ...texts.map((text) => Bounds.forText(text, { fontSize }).width)
    )
}

/**
 * A centered label on the outermost tick of a half sticks out beyond the
 * chart's edge; anchor it inward instead.
 */
function edgeAwareTickAnchor(
    tick: number,
    scale: ScaleLinear<number, number>,
    side: Sex,
    mode: ShowMode,
    fontSize: number
): "start" | "middle" | "end" {
    const halfLabelWidth =
        Bounds.forText(formatAxisTick(tick, mode), { fontSize }).width / 2
    // Men run right-to-left, women left-to-right, so their outer edges are
    // the two extremes of the range — whichever way it's written
    const outerEdge =
        side === "men" ? Math.min(...scale.range()) : Math.max(...scale.range())
    if (Math.abs(scale(tick) - outerEdge) < halfLabelWidth)
        return side === "men" ? "start" : "end"
    return "middle"
}
