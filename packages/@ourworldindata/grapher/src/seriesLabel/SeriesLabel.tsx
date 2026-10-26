import React, { useState } from "react"
import Tippy from "@tippyjs/react"
import { hideAll } from "tippy.js"
import {
    GRAPHER_DARK_TEXT,
    GRAPHER_LIGHT_TEXT,
} from "../color/ColorConstants.js"
import {
    SeriesLabelState,
    PositionedTextFragment,
    TextRole,
    SpanLine,
    SeriesLabelAnnotation,
} from "./SeriesLabelState.js"
import { Bounds, isTouchDevice, roundForSvg } from "@ourworldindata/utils"
import { FIGMA_TEXT_NODE_BREAK_DY, Halo } from "@ourworldindata/components"
import { RegionTooltip } from "./RegionTooltip.js"
import { SeriesLabelAnnotations } from "./SeriesLabelAnnotations.js"
import { getDescriptionForKey, getRegionsForKey } from "./RegionTooltipData.js"

const defaultColors: Record<TextRole, string> = {
    name: GRAPHER_DARK_TEXT,
    value: GRAPHER_DARK_TEXT,
    regionPublisherSuffix: GRAPHER_LIGHT_TEXT,
}

const UNDERLINE_OFFSET = 2

export interface SeriesLabelProps {
    state: SeriesLabelState
    x: number
    y: number
    id?: string
    color?: Partial<Record<TextRole, string>>
    opacity?: number
    outline?: boolean
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

    if (!state.hasRegionTooltip && !state.hasAnnotations) {
        return withHalo(
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
    }

    return (
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
            {state.positionedFragments.map((fragment, index) => {
                const isAnnotated =
                    state.hasAnnotations && fragment.role === "name"
                if (!isAnnotated && !fragment.regionTooltip) return null
                return (
                    <TooltipTrigger
                        key={index}
                        x={renderX}
                        y={renderY}
                        fragment={fragment}
                        fontSize={fontSize}
                        stroke={colors[fragment.role]}
                        annotations={isAnnotated ? state.annotations : []}
                        onTooltipShow={onTooltipShow}
                        onTooltipHide={onTooltipHide}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                    />
                )
            })}
        </g>
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
    fragment,
    fontSize,
    stroke,
    annotations,
    onTooltipShow,
    onTooltipHide,
    onMouseEnter,
    onMouseLeave,
}: {
    x: number
    y: number
    fragment: PositionedTextFragment
    fontSize: number
    stroke: string
    annotations: SeriesLabelAnnotation[]
    onTooltipShow?: () => void
    onTooltipHide?: () => void
    onMouseEnter?: React.MouseEventHandler<SVGElement>
    onMouseLeave?: React.MouseEventHandler<SVGElement>
}): React.ReactElement {
    // Used as react key to remount RegionTooltip with fresh state
    const [tooltipRemountKey, setTooltipRemountKey] = useState(false)

    const { regionTooltip } = fragment
    const hasAnnotations = annotations.length > 0

    const left = x + fragment.x
    const baseline = y + fragment.y
    const underlineY = roundForSvg(baseline + UNDERLINE_OFFSET)

    const minHitAreaHeight = isTouchDevice() ? 40 : 20
    const verticalPadding = Math.ceil(
        Math.max(0, minHitAreaHeight - fontSize) / 2
    )
    const hitAreaBounds = new Bounds(
        left,
        baseline - fontSize,
        fragment.width,
        fontSize
    ).expand({ top: verticalPadding, bottom: verticalPadding })

    return (
        <g>
            <line
                x1={roundForSvg(left)}
                x2={roundForSvg(left + fragment.width)}
                y1={underlineY}
                y2={underlineY}
                stroke={stroke}
                strokeWidth={1}
                strokeDasharray={1}
            />

            {/* Hit area for tooltip interaction */}
            <Tippy
                theme="grapher-explanation"
                placement="top-start"
                arrow={false}
                offset={[0, 0]}
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
