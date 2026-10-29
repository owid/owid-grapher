import React, { useState } from "react"
import Tippy from "@tippyjs/react"
import { hideAll, Placement } from "tippy.js"
import { getMinHitAreaSize } from "../core/GrapherConstants"
import {
    GRAPHER_DARK_TEXT,
    GRAPHER_LIGHT_TEXT,
} from "../color/ColorConstants.js"
import {
    SeriesLabelState,
    PositionedTextFragment,
    TextRole,
    SpanLine,
    SeriesLabelTooltipTarget,
} from "./SeriesLabelState.js"
import { isTouchDevice, roundForSvg } from "@ourworldindata/utils"
import { FIGMA_TEXT_NODE_BREAK_DY, Halo } from "@ourworldindata/components"
import { RegionTooltip } from "./RegionTooltip.js"
import { SeriesLabelAnnotations } from "./SeriesLabelAnnotations.js"
import { AnnotationInfoIcon } from "../annotations/AnnotationInfoIcon.js"
import { getDescriptionForKey, getRegionsForKey } from "./RegionTooltipData.js"

const defaultColors: Record<TextRole, string> = {
    name: GRAPHER_DARK_TEXT,
    value: GRAPHER_DARK_TEXT,
    regionPublisherSuffix: GRAPHER_LIGHT_TEXT,
}

const UNDERLINE_OFFSET = 2

const TOOLTIP_PLACEMENTS = {
    start: { preferred: "top-start", fallback: "bottom-start" },
    end: { preferred: "top-end", fallback: "bottom-end" },
} as const satisfies Record<
    "start" | "end",
    { preferred: Placement; fallback: Placement }
>

export interface SeriesLabelProps {
    state: SeriesLabelState
    x: number
    y: number
    id?: string
    color?: Partial<Record<TextRole, string>>
    opacity?: number
    outline?: boolean
    showInfoIcon?: boolean
    onMouseEnter?: React.MouseEventHandler<SVGElement>
    onMouseLeave?: React.MouseEventHandler<SVGElement>
    onTooltipShow?: () => void
    onTooltipHide?: () => void
}

/**
 * Renders a series label that consists of up to three fragments:
 * - The main label text (e.g. "United States")
 * - An optional suffix naming the region's publisher (e.g. "(WHO)")
 * - An optional value label (e.g. "70 years")
 */
export function SeriesLabel({
    state,
    x,
    y,
    id,
    color,
    opacity,
    outline,
    showInfoIcon = false,
    onMouseEnter,
    onMouseLeave,
    onTooltipShow,
    onTooltipHide,
}: SeriesLabelProps): React.ReactElement {
    const [renderX, renderY] = state.getPositionForSvgRendering(x, y)

    const fontSize = state.fontSettings.fontSize
    const colors = { ...defaultColors, ...color }
    const props = { id, opacity, onMouseEnter, onMouseLeave }

    const withHalo = (
        element: React.ReactElement<{
            id?: string
            style?: React.CSSProperties
        }>
    ): React.ReactElement => {
        const haloId = id ? `${id}__halo` : "label__halo"
        return outline ? (
            <Halo id={haloId} fontSize={state.fontSettings.fontSize}>
                {element}
            </Halo>
        ) : (
            element
        )
    }

    const label =
        state.tooltipTargets.length === 0 ? (
            withHalo(
                <NativeAlignedLabelText
                    x={renderX}
                    y={renderY}
                    spanLines={state.spanLines}
                    textAnchor={state.textAnchor}
                    fontSize={fontSize}
                    lineHeight={state.singleLineHeight}
                    colors={colors}
                    {...props}
                />
            )
        ) : (
            <g {...props}>
                {withHalo(
                    <LabelText
                        x={renderX}
                        y={renderY}
                        fragments={state.positionedFragments}
                        fontSize={fontSize}
                        colors={colors}
                    />
                )}
                {state.tooltipTargets.map((target) => (
                    <TooltipTrigger
                        key={target.role}
                        x={renderX}
                        y={renderY}
                        target={target}
                        textAnchor={state.textAnchor}
                        fontSize={fontSize}
                        stroke={colors[target.role]}
                        onTooltipShow={onTooltipShow}
                        onTooltipHide={onTooltipHide}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                    />
                ))}
            </g>
        )

    if (!showInfoIcon) return label

    const { x: iconX, y: iconY } = state.infoIconCenterOffset
    return (
        <>
            {label}
            <g
                transform={`translate(${roundForSvg(x + iconX)}, ${roundForSvg(y + iconY)})`}
                opacity={opacity}
                style={{ pointerEvents: "none" }}
            >
                <AnnotationInfoIcon
                    radius={state.infoIconRadius}
                    color={colors.name}
                />
            </g>
        </>
    )
}

function NativeAlignedLabelText({
    x,
    y,
    spanLines,
    textAnchor,
    fontSize,
    lineHeight,
    colors,
    id,
    opacity,
    style,
    onMouseEnter,
    onMouseLeave,
}: {
    x: number
    y: number
    spanLines: SpanLine[]
    textAnchor: "start" | "end"
    fontSize: number
    lineHeight: number
    colors: Record<TextRole, string>
    id?: string
    opacity?: number
    style?: React.CSSProperties // Necessary for Halo
    onMouseEnter?: React.MouseEventHandler<SVGElement>
    onMouseLeave?: React.MouseEventHandler<SVGElement>
}): React.ReactElement {
    return (
        <text
            id={id}
            style={style}
            x={roundForSvg(x)}
            y={roundForSvg(y)}
            textAnchor={textAnchor}
            fontSize={fontSize}
            opacity={opacity}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {spanLines.map((spans, lineIndex) =>
                spans.map((span, spanIndex) => {
                    const renderX = getSpanX({ spanIndex, x })
                    const renderDy = getSpanDy({
                        spanLines,
                        lineIndex,
                        spanIndex,
                        lineHeight,
                        textAnchor,
                    })

                    return (
                        <tspan
                            key={span.text}
                            x={renderX}
                            dy={renderDy}
                            fontWeight={span.fontWeight}
                            fill={colors[span.role]}
                            // librsvg (Wikimedia's renderer) drops a leading space otherwise
                            xmlSpace={
                                span.text.startsWith(" ")
                                    ? "preserve"
                                    : undefined
                            }
                        >
                            {span.text}
                        </tspan>
                    )
                })
            )}
        </text>
    )
}

function LabelText({
    x,
    y,
    fragments,
    fontSize,
    colors,
    id,
    opacity,
    style,
    onMouseEnter,
    onMouseLeave,
}: {
    x: number
    y: number
    fragments: PositionedTextFragment[]
    fontSize: number
    colors: Record<TextRole, string>
    id?: string
    opacity?: number
    style?: React.CSSProperties // Necessary for Halo
    onMouseEnter?: React.MouseEventHandler<SVGElement>
    onMouseLeave?: React.MouseEventHandler<SVGElement>
}): React.ReactElement {
    if (fragments.length === 1) {
        return (
            <TextFragment
                id={id}
                x={x}
                y={y}
                fragment={fragments[0]}
                fontSize={fontSize}
                fill={colors[fragments[0].role]}
                opacity={opacity}
                style={style}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
            />
        )
    }

    return (
        <text
            id={id}
            style={style}
            fontSize={fontSize}
            opacity={opacity}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {fragments.map((fragment) => (
                <TextSpanFragment
                    key={fragment.text}
                    x={x}
                    y={y}
                    fragment={fragment}
                    fill={colors[fragment.role]}
                />
            ))}
        </text>
    )
}

function TextFragment({
    x,
    y,
    fragment,
    fontSize,
    fill,
    id,
    opacity,
    style,
    onMouseEnter,
    onMouseLeave,
}: {
    x: number
    y: number
    fragment: PositionedTextFragment
    fontSize: number
    fill: string
    id?: string
    opacity?: number
    style?: React.CSSProperties // Necessary for Halo
    onMouseEnter?: React.MouseEventHandler<SVGElement>
    onMouseLeave?: React.MouseEventHandler<SVGElement>
}): React.ReactElement {
    return (
        <text
            id={id}
            style={style}
            fontSize={fontSize}
            opacity={opacity}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <TextSpanFragment x={x} y={y} fragment={fragment} fill={fill} />
        </text>
    )
}

function TextSpanFragment({
    x,
    y,
    fragment,
    fill,
}: {
    x: number
    y: number
    fragment: PositionedTextFragment
    fill: string
}): React.ReactElement {
    return (
        <tspan
            x={roundForSvg(x + fragment.x)}
            y={roundForSvg(y + fragment.y)}
            fontWeight={fragment.fontWeight}
            fill={fill}
        >
            {fragment.text}
        </tspan>
    )
}

function TooltipTrigger({
    x,
    y,
    target,
    textAnchor,
    fontSize,
    stroke,
    onTooltipShow,
    onTooltipHide,
    onMouseEnter,
    onMouseLeave,
}: {
    x: number
    y: number
    target: SeriesLabelTooltipTarget
    textAnchor: "start" | "end"
    fontSize: number
    stroke: string
    onTooltipShow?: () => void
    onTooltipHide?: () => void
    onMouseEnter?: React.MouseEventHandler<SVGElement>
    onMouseLeave?: React.MouseEventHandler<SVGElement>
}): React.ReactElement {
    // Used as react key to remount RegionTooltip with fresh state
    const [tooltipRemountKey, setTooltipRemountKey] = useState(false)

    const { annotations, regionTooltip } = target.content
    const hasAnnotations = annotations !== undefined && annotations.length > 0

    const minHitAreaHeight = getMinHitAreaSize()
    const verticalPadding = Math.ceil(
        Math.max(0, minHitAreaHeight - fontSize) / 2
    )
    const hitAreaBounds = target.textBounds
        .set({ x: x + target.textBounds.x, y: y + target.textBounds.y })
        .expand({ top: verticalPadding, bottom: verticalPadding })

    return (
        <g>
            {target.fragments.map((fragment) => {
                const left = x + fragment.x
                const underlineY = roundForSvg(
                    y + fragment.y + UNDERLINE_OFFSET
                )
                return (
                    <line
                        key={`${fragment.x},${fragment.y}`}
                        x1={roundForSvg(left)}
                        x2={roundForSvg(left + fragment.width)}
                        y1={underlineY}
                        y2={underlineY}
                        stroke={stroke}
                        strokeWidth={1}
                        strokeDasharray={1}
                    />
                )
            })}

            {/* Hit area for tooltip interaction */}
            <Tippy
                theme="grapher-explanation"
                placement={TOOLTIP_PLACEMENTS[textAnchor].preferred}
                arrow={false}
                offset={[0, 4]}
                popperOptions={{
                    modifiers: [
                        {
                            name: "flip",
                            options: {
                                fallbackPlacements: [
                                    TOOLTIP_PLACEMENTS[textAnchor].fallback,
                                ],
                                padding: 8,
                            },
                        },
                        { name: "preventOverflow", options: { padding: 8 } },
                    ],
                }}
                interactive={hasAnnotations || !isTouchDevice()}
                delay={[100, 200]}
                appendTo={() => document.body}
                onShow={(instance) => {
                    // Hide any other open tooltips
                    hideAll({ exclude: instance })

                    onTooltipShow?.()
                }}
                onHide={() => onTooltipHide?.()}
                // Changing the key forces RegionTooltip to remount on the
                // next show, resetting its internal hover state back to
                // the initially highlighted region
                onHidden={() => setTooltipRemountKey((k) => !k)}
                content={
                    <>
                        {hasAnnotations && (
                            <SeriesLabelAnnotations annotations={annotations} />
                        )}
                        {regionTooltip && (
                            <RegionTooltip
                                key={tooltipRemountKey.toString()}
                                description={getDescriptionForKey(
                                    regionTooltip.tooltipKey
                                )}
                                regions={getRegionsForKey(
                                    regionTooltip.tooltipKey
                                )}
                                initiallyHighlightedRegion={
                                    regionTooltip.regionName
                                }
                            />
                        )}
                    </>
                }
            >
                <rect
                    {...hitAreaBounds.toProps()}
                    fill="transparent"
                    style={{ pointerEvents: "auto", cursor: "help" }}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                />
            </Tippy>
        </g>
    )
}

function getSpanX({
    spanIndex,
    x,
}: {
    spanIndex: number
    x: number
}): number | undefined {
    const isLineStart = spanIndex === 0
    return isLineStart ? roundForSvg(x) : undefined
}

function getSpanDy({
    spanLines,
    lineIndex,
    spanIndex,
    lineHeight,
    textAnchor,
}: {
    spanLines: SpanLine[]
    lineIndex: number
    spanIndex: number
    lineHeight: number
    textAnchor: "start" | "end"
}): number | undefined {
    const isFirstLine = lineIndex === 0
    const isLineStart = spanIndex === 0
    const isSecondSpan = spanIndex === 1

    // The first line sits on the text element's y
    if (isLineStart && isFirstLine) return undefined

    // Move down to the next line, undoing the previous line's Figma nudge, if any
    if (isLineStart) {
        const previousLineBreakDy = getFigmaNodeBreakDy(
            spanLines[lineIndex - 1],
            textAnchor
        )
        return roundForSvg(lineHeight - previousLineBreakDy)
    }

    // Nudge the rest of the line so Figma gives it its own text node
    if (isSecondSpan)
        return (
            getFigmaNodeBreakDy(spanLines[lineIndex], textAnchor) || undefined
        )

    return undefined
}

/** Figma nudge for a left-aligned line whose name is followed by text in another weight, otherwise 0 */
function getFigmaNodeBreakDy(
    spans: SpanLine,
    textAnchor: "start" | "end"
): number {
    return textAnchor === "start" &&
        spans.length > 1 &&
        spans[0].fontWeight !== spans[1].fontWeight
        ? FIGMA_TEXT_NODE_BREAK_DY
        : 0
}
