import { useCallback, useMemo, useRef, useState } from "react"
import { useParentSize } from "@visx/responsive"
import { scaleBand, scaleLinear } from "@visx/scale"
import { AxisBottom } from "@visx/axis"
import { Group } from "@visx/group"
import type { ScaleBand, ScaleLinear } from "d3-scale"

import { Bounds } from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"
import {
    GRAPHER_DARK_TEXT,
    GRAPHER_LIGHT_TEXT,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { darkenColorForText } from "@ourworldindata/grapher/src/color/ColorUtils.js"

import { useDismissOnTouchOutside } from "../../../../hooks/useDismissOnTouchOutside.js"
import { formatAxisTick, formatBarValue, PyramidView } from "../helpers.js"
import { ShowMode } from "../types.js"
import {
    COMPARE_BAR_OPACITY,
    MEN_COLOR,
    NATIVE_LINE_COLOR,
    WOMEN_COLOR,
} from "../constants.js"

export interface SexHeaderLabel {
    name: string
    /** Grayed-out share annotation, e.g. "(48% of immigrants)" */
    annotation?: string
}

export interface MigrantPyramidProps {
    /** Age bands youngest-first, as in the data file */
    ageBands: string[]
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
    const fonts = {
        tick: isNarrow ? 10 : 11,
        ageBandLabel: isNarrow ? 10 : 11,
        sexLabel: isNarrow ? 10 : 11,
        hoverLabel: isNarrow ? 10 : 11,
        axisLabel: isNarrow ? 11 : 12,
    }
    // Top fits the sex header labels; bottom fits the tick labels plus the
    // axis label, which sits closer on mobile where the fonts are smaller
    const margin = { top: 19, right: 0, bottom: isNarrow ? 48 : 52, left: 0 }
    const axisLabelOffset = isNarrow ? 40 : 46

    // Oldest age band at the top
    const bandsTopDown = useMemo(() => [...ageBands].reverse(), [ageBands])

    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const centerGap =
        maxTextWidth(ageBands, fonts.ageBandLabel) + 2 * CENTER_GAP_PADDING
    const halfWidth = Math.max((innerWidth - centerGap) / 2, 0)
    const centerX = margin.left + halfWidth + centerGap / 2

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

    const [hoveredBand, setHoveredBand] = useState<string | null>(null)
    const svgRef = useRef<SVGSVGElement>(null)
    const dismissHover = useCallback(() => setHoveredBand(null), [])
    useDismissOnTouchOutside(svgRef, hoveredBand !== null, dismissHover)

    const handlePointerEnter = useCallback(
        (e: React.PointerEvent, band: string) => {
            if (e.pointerType === "mouse") setHoveredBand(band)
        },
        []
    )
    const handlePointerLeave = useCallback((e: React.PointerEvent) => {
        if (e.pointerType === "mouse") setHoveredBand(null)
    }, [])
    const handlePointerDown = useCallback(
        (e: React.PointerEvent, band: string) => {
            if (e.pointerType === "touch") {
                e.stopPropagation()
                setHoveredBand((prev) => (prev === band ? null : band))
            }
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
            left: margin.left,
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
        <svg ref={svgRef} width={width} height={height} overflow="visible">
            <Group top={margin.top}>
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
                        fonts={fonts}
                        hoveredBand={hoveredBand}
                        hasComparison={!!view.natives}
                    />
                ))}

                {/* Age band labels in the center gap */}
                {bandsTopDown.map((band) => (
                    <text
                        key={band}
                        x={centerX}
                        y={(yScale(band) ?? 0) + yScale.bandwidth() / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={fonts.ageBandLabel}
                        fill={
                            band === hoveredBand
                                ? GRAPHER_DARK_TEXT
                                : GRAPHER_LIGHT_TEXT
                        }
                    >
                        {band}
                    </text>
                ))}

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
                        fontSize={fonts.sexLabel}
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
                    fontSize={fonts.axisLabel}
                    fill={GRAPHER_LIGHT_TEXT}
                >
                    {axisLabel}
                </text>

                {/* Full-width hit rects for hover — one per age band */}
                {bandsTopDown.map((band, i) => {
                    const bounds = bandHitBounds(
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
                            onPointerEnter={(e) => handlePointerEnter(e, band)}
                            onPointerLeave={handlePointerLeave}
                            onPointerDown={(e) => handlePointerDown(e, band)}
                        />
                    )
                })}
            </Group>
        </svg>
    )
}

interface PyramidFonts {
    tick: number
    ageBandLabel: number
    sexLabel: number
    hoverLabel: number
    axisLabel: number
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
    fonts,
    hoveredBand,
    hasComparison,
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
    fonts: PyramidFonts
    hoveredBand: string | null
    hasComparison: boolean
}): React.ReactElement {
    const zeroX = scale(0)
    const bandwidth = yScale.bandwidth()
    const valueOf = (band: string): number =>
        values[ageBands.indexOf(band)] ?? 0

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
                    fontSize: fonts.tick,
                    fill: GRAPHER_LIGHT_TEXT,
                    // Anchor labels inward when centering would overflow
                    // the chart's outer edge
                    textAnchor: edgeAwareTickAnchor(
                        tick as number,
                        scale,
                        side,
                        mode,
                        fonts.tick
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
                        fillOpacity={hasComparison ? COMPARE_BAR_OPACITY : 1}
                        opacity={dimmed ? 0.4 : 1}
                    />
                )
            })}

            {/* Native-born comparison outline */}
            {comparisonValues && (
                <path
                    d={stepOutlinePath(
                        comparisonValues,
                        ageBands,
                        bandsTopDown,
                        scale,
                        yScale,
                        innerHeight
                    )}
                    fill="none"
                    stroke={NATIVE_LINE_COLOR}
                    strokeWidth={1.5}
                    strokeLinejoin="round"
                    style={{ pointerEvents: "none" }}
                />
            )}

            {/* Value label for the hovered bar */}
            {hoveredBand !== null && (
                <BarValueLabel
                    value={valueOf(hoveredBand)}
                    barY={yScale(hoveredBand) ?? 0}
                    barHeight={bandwidth}
                    scale={scale}
                    zeroX={zeroX}
                    direction={side === "men" ? "left" : "right"}
                    fontSize={fonts.hoverLabel}
                    color={color}
                    mode={mode}
                />
            )}
        </Group>
    )
}

const BAR_LABEL_PADDING = 5

function BarValueLabel({
    value,
    barY,
    barHeight,
    scale,
    zeroX,
    direction,
    fontSize,
    color,
    mode,
}: {
    value: number
    barY: number
    barHeight: number
    scale: ScaleLinear<number, number>
    zeroX: number
    direction: "left" | "right"
    fontSize: number
    color: string
    mode: ShowMode
}): React.ReactElement {
    const scaledValue = scale(value)
    const barWidth = Math.abs(scaledValue - zeroX)
    const barX = Math.min(scaledValue, zeroX)
    const halfWidth = Math.abs(scale(0) - scale(scale.domain()[1]))

    const text = formatBarValue(value, mode)
    const textWrap = new TextWrap({ text, maxWidth: Infinity, fontSize })
    const labelWidth = textWrap.width + BAR_LABEL_PADDING * 2

    // Prefer the space outside the bar (away from the center)
    const spaceOutside =
        direction === "left" ? barX : halfWidth - (barX + barWidth)
    const fitsOutside = labelWidth < spaceOutside

    let x: number
    let textAnchor: "start" | "end"
    let fill: string
    if (direction === "left") {
        if (fitsOutside) {
            x = barX - BAR_LABEL_PADDING
            textAnchor = "end"
            fill = darkenColorForText(color)
        } else {
            x = barX + BAR_LABEL_PADDING
            textAnchor = "start"
            fill = "white"
        }
    } else {
        if (fitsOutside) {
            x = barX + barWidth + BAR_LABEL_PADDING
            textAnchor = "start"
            fill = darkenColorForText(color)
        } else {
            x = barX + barWidth - BAR_LABEL_PADDING
            textAnchor = "end"
            fill = "white"
        }
    }

    return (
        <text
            x={x}
            y={barY + barHeight / 2}
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
    const step = yScale.step()
    const bandwidth = yScale.bandwidth()
    const halfGap = (step - bandwidth) / 2

    const segments: string[] = []
    for (let i = 0; i < bandsTopDown.length; i++) {
        const band = bandsTopDown[i]
        const x = scale(values[ageBands.indexOf(band)] ?? 0)
        const yTop = i === 0 ? 0 : (yScale(band) ?? 0) - halfGap
        const yBottom =
            i === bandsTopDown.length - 1
                ? innerHeight
                : (yScale(band) ?? 0) + bandwidth + halfGap
        segments.push(
            i === 0 ? `M ${x} ${yTop}` : `L ${x} ${yTop}`,
            `L ${x} ${yBottom}`
        )
    }
    return segments.join(" ")
}

/** The full-width hover region of an age band, extended to cover the gaps */
function bandHitBounds(
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
    const x = scale(tick)
    const range = scale.range()
    const outerEdge = side === "men" ? Math.min(...range) : Math.max(...range)
    if (side === "men" && x - halfLabelWidth < outerEdge) return "start"
    if (side === "women" && x + halfLabelWidth > outerEdge) return "end"
    return "middle"
}
