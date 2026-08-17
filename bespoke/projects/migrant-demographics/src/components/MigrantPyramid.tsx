import { useCallback, useMemo, useRef, useState } from "react"
import { useParentSize } from "@visx/responsive"
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

import { usePinnedTooltip } from "../../../../hooks/usePinnedTooltip.js"
import { formatAxisTick, PyramidView } from "../helpers.js"
import { ShowMode } from "../types.js"
import { MEN_COLOR, NATIVE_LINE_COLOR, WOMEN_COLOR } from "../constants.js"
import { MigrantPyramidTooltip } from "./MigrantPyramidTooltip.js"

export interface SexHeaderLabel {
    name: string
    /** Grayed-out share of all immigrants, e.g. "(48%)" */
    annotation?: string
}

export interface MigrantPyramidProps {
    /** Age bands youngest-first, as in the data file */
    ageBands: string[]
    /** The values the bars encode */
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
    const { parentRef, width, height } = useParentSize()
    return (
        <div ref={parentRef} className="responsive-container">
            {width > 0 && height > 0 && (
                <MigrantPyramidContent
                    {...props}
                    width={width}
                    height={height}
                />
            )}
        </div>
    )
}

function MigrantPyramidContent({
    ageBands,
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

    // Oldest age band at the top
    const bandsTopDown = useMemo(() => [...ageBands].reverse(), [ageBands])

    const innerWidth = width
    const innerHeight = height - marginTop - marginBottom

    // Text measurement is comparatively costly, and neither input changes
    // when the pointer moves or the year does
    const centerGap = useMemo(
        () => maxTextWidth(ageBands, labelFontSize) + 2 * CENTER_GAP_PADDING,
        [ageBands, labelFontSize]
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
                domain: bandsTopDown,
                range: [0, innerHeight],
                padding: 0.15,
            }),
        [bandsTopDown, innerHeight]
    )

    const numTicks = isNarrow ? 3 : 4

    const [hover, setHover] = useState<HoverTarget | null>(null)
    const hoveredBand = hover?.band ?? null

    const svgRef = useRef<SVGSVGElement>(null)
    const dismissHover = useCallback(() => setHover(null), [])
    // On touch devices this pins the tooltip to the bottom of the viewport
    // and owns dismissal (tap outside, chart scrolled out of view)
    const { ref: chartRef, isPinned } = usePinnedTooltip<HTMLDivElement>(
        hover !== null,
        dismissHover
    )

    // Bound to both enter and move so the tooltip follows the cursor
    const handlePointerMove = useCallback(
        (e: React.PointerEvent, band: string) => {
            if (e.pointerType !== "mouse" || !svgRef.current) return
            const position = getRelativeMouse(svgRef.current, e.nativeEvent)
            setHover({ band, position })
        },
        []
    )
    const handlePointerLeave = useCallback((e: React.PointerEvent) => {
        if (e.pointerType === "mouse") setHover(null)
    }, [])
    const handlePointerDown = useCallback(
        (e: React.PointerEvent, band: string) => {
            if (e.pointerType !== "touch" || !svgRef.current) return
            const position = getRelativeMouse(svgRef.current, e.nativeEvent)
            setHover((prev) =>
                prev?.band === band ? null : { band, position }
            )
        },
        []
    )

    const halves: {
        side: "men" | "women"
        left: number
        scale: ScaleLinear<number, number>
        values: number[]
        comparisonValues?: number[]
        color: string
    }[] = [
        {
            side: "men",
            left: 0,
            scale: xScale.men,
            values: view.migrants.men,
            comparisonValues: view.natives?.men,
            color: MEN_COLOR,
        },
        {
            side: "women",
            left: centerX + centerGap / 2,
            scale: xScale.women,
            values: view.migrants.women,
            comparisonValues: view.natives?.women,
            color: WOMEN_COLOR,
        },
    ]

    return (
        <div ref={chartRef} className="migrant-pyramid__chart">
            <svg ref={svgRef} width={width} height={height} overflow="visible">
                <Group top={marginTop}>
                    {halves.map((half) => (
                        <PyramidHalf
                            key={half.side}
                            {...half}
                            ageBands={ageBands}
                            bandsTopDown={bandsTopDown}
                            yScale={yScale}
                            innerHeight={innerHeight}
                            numTicks={numTicks}
                            mode={mode}
                            tickFontSize={labelFontSize}
                            hoveredBand={hoveredBand}
                        />
                    ))}

                    {/* Age band labels in the center gap */}
                    {bandsTopDown.map((band) => {
                        // A step in gray alone is imperceptible at this size,
                        // and the surrounding bars dim at the same moment —
                        // so the hovered label goes bold as well
                        const isHovered = band === hoveredBand
                        return (
                            <text
                                key={band}
                                x={centerX}
                                y={(yScale(band) ?? 0) + yScale.bandwidth() / 2}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontSize={labelFontSize}
                                fontWeight={isHovered ? 700 : 400}
                                fill={isHovered ? GRAY_100 : GRAPHER_LIGHT_TEXT}
                            >
                                {band}
                            </text>
                        )
                    })}

                    {/* Sex column headers */}
                    {(
                        [
                            {
                                label: menLabel,
                                x: centerX - centerGap / 2 - 4,
                                textAnchor: "end" as const,
                                color: MEN_COLOR,
                            },
                            {
                                label: womenLabel,
                                x: centerX + centerGap / 2 + 4,
                                textAnchor: "start" as const,
                                color: WOMEN_COLOR,
                            },
                        ] as const
                    ).map(({ label, x, textAnchor, color }) => (
                        <text
                            key={label.name}
                            x={x}
                            y={-8}
                            textAnchor={textAnchor}
                            fontSize={labelFontSize}
                        >
                            <tspan
                                fontWeight={700}
                                fill={darkenColorForText(color)}
                            >
                                {label.name}
                            </tspan>
                            {label.annotation && (
                                <tspan fill={GRAPHER_LIGHT_TEXT}>
                                    {" "}
                                    {label.annotation}
                                </tspan>
                            )}
                        </text>
                    ))}

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
                    {bandsTopDown.map((band, i) => {
                        const bounds = bandRowBounds(
                            band,
                            i,
                            bandsTopDown.length,
                            yScale,
                            innerHeight
                        )
                        return (
                            <rect
                                key={`hit-${band}`}
                                x={0}
                                y={bounds.y}
                                width={innerWidth}
                                height={bounds.height}
                                fill="transparent"
                                onPointerEnter={(e) =>
                                    handlePointerMove(e, band)
                                }
                                onPointerMove={(e) =>
                                    handlePointerMove(e, band)
                                }
                                onPointerLeave={handlePointerLeave}
                                onPointerDown={(e) =>
                                    handlePointerDown(e, band)
                                }
                            />
                        )
                    })}
                </Group>
            </svg>

            {hover && (
                <MigrantPyramidTooltip
                    band={hover.band}
                    bandIndex={ageBands.indexOf(hover.band)}
                    view={view}
                    mode={mode}
                    position={hover.position}
                    containerBounds={new Bounds(0, 0, width, height)}
                    isPinned={isPinned}
                />
            )}
        </div>
    )
}

interface HoverTarget {
    band: string
    /** Pointer position relative to the SVG */
    position: { x: number; y: number }
}

function PyramidHalf({
    side,
    left,
    scale,
    values,
    comparisonValues,
    color,
    ageBands,
    bandsTopDown,
    yScale,
    innerHeight,
    numTicks,
    mode,
    tickFontSize,
    hoveredBand,
}: {
    side: "men" | "women"
    left: number
    scale: ScaleLinear<number, number>
    values: number[]
    comparisonValues?: number[]
    color: string
    ageBands: string[]
    bandsTopDown: string[]
    yScale: ScaleBand<string>
    innerHeight: number
    numTicks: number
    mode: ShowMode
    tickFontSize: number
    hoveredBand: string | null
}): React.ReactElement {
    const zeroX = scale(0)
    const bandwidth = yScale.bandwidth()
    const valueOf = (band: string): number =>
        values[ageBands.indexOf(band)] ?? 0

    // The stretch of the comparison outline that crosses the hovered row,
    // redrawn on top so it stays legible while the rest of it dims
    const hoveredOutlineSegment =
        comparisonValues && hoveredBand !== null
            ? outlineSegment(
                  hoveredBand,
                  comparisonValues,
                  ageBands,
                  bandsTopDown,
                  scale,
                  yScale,
                  innerHeight
              )
            : undefined

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

            {/* X-axis */}
            <AxisBottom
                top={innerHeight}
                scale={scale}
                numTicks={numTicks}
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
            {bandsTopDown.map((band) => {
                const scaledValue = scale(valueOf(band))
                const barWidth = Math.abs(scaledValue - zeroX)
                const barX = Math.min(scaledValue, zeroX)
                const dimmed = hoveredBand !== null && hoveredBand !== band
                return (
                    <rect
                        key={band}
                        x={barX}
                        y={yScale(band) ?? 0}
                        width={barWidth}
                        height={bandwidth}
                        fill={color}
                        opacity={dimmed ? 0.4 : 1}
                    />
                )
            })}

            {/* Native-born comparison outline */}
            {comparisonValues && (
                <CasedLine
                    d={stepOutlinePath(
                        comparisonValues,
                        ageBands,
                        bandsTopDown,
                        scale,
                        yScale,
                        innerHeight
                    )}
                    opacity={hoveredBand !== null ? 0.4 : 1}
                />
            )}

            {hoveredOutlineSegment && (
                <CasedLine d={hoveredOutlineSegment} opacity={1} />
            )}
        </Group>
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
 * A continuous step outline through the bar ends of a population, spanning
 * the full column height (including the gaps between bars).
 */
function stepOutlinePath(
    values: number[],
    ageBands: string[],
    bandsTopDown: string[],
    scale: ScaleLinear<number, number>,
    yScale: ScaleBand<string>,
    innerHeight: number
): string {
    const segments: string[] = []
    for (let i = 0; i < bandsTopDown.length; i++) {
        const band = bandsTopDown[i]
        const x = scale(values[ageBands.indexOf(band)] ?? 0)
        const { y, height } = bandRowBounds(
            band,
            i,
            bandsTopDown.length,
            yScale,
            innerHeight
        )
        segments.push(
            i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`,
            `L ${x} ${y + height}`
        )
    }
    return segments.join(" ")
}

/**
 * The vertical stretch of the step outline that crosses one age band — the
 * same segment `stepOutlinePath` draws there, so highlighting it lines up
 * exactly with the dimmed outline underneath.
 */
function outlineSegment(
    band: string,
    values: number[],
    ageBands: string[],
    bandsTopDown: string[],
    scale: ScaleLinear<number, number>,
    yScale: ScaleBand<string>,
    innerHeight: number
): string | undefined {
    const index = bandsTopDown.indexOf(band)
    if (index === -1) return undefined
    const { y, height } = bandRowBounds(
        band,
        index,
        bandsTopDown.length,
        yScale,
        innerHeight
    )
    const x = scale(values[ageBands.indexOf(band)] ?? 0)
    return `M ${x} ${y} L ${x} ${y + height}`
}

/** The full row of an age band, extended to cover the gaps around its bars */
function bandRowBounds(
    band: string,
    index: number,
    numBands: number,
    yScale: ScaleBand<string>,
    innerHeight: number
): { y: number; height: number } {
    const step = yScale.step()
    const bandwidth = yScale.bandwidth()
    const halfGap = (step - bandwidth) / 2
    const bandY = yScale(band) ?? 0
    const y = index === 0 ? 0 : bandY - halfGap
    const bottom =
        index === numBands - 1 ? innerHeight : bandY + bandwidth + halfGap
    return { y, height: bottom - y }
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
    side: "men" | "women",
    mode: ShowMode,
    fontSize: number
): "start" | "middle" | "end" {
    const halfLabelWidth =
        Bounds.forText(formatAxisTick(tick, mode), { fontSize }).width / 2
    // Both halves map the axis maximum to the outer edge of the chart
    const outerEdge = scale.range()[1]
    if (Math.abs(scale(tick) - outerEdge) < halfLabelWidth)
        return side === "men" ? "start" : "end"
    return "middle"
}
