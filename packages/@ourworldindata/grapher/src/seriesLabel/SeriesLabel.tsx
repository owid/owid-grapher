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
    RegionTooltipFragment,
    TextRole,
    SpanLine,
} from "./SeriesLabelState.js"
import { Bounds, isTouchDevice, roundForSvg } from "@ourworldindata/utils"
import { FIGMA_TEXT_NODE_BREAK_DY, Halo } from "@ourworldindata/components"
import { RegionTooltip } from "./RegionTooltip.js"
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
    onInfoTooltipShow?: () => void
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
    onInfoTooltipShow,
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

    if (!state.hasRegionTooltip) {
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
            {state.regionTooltipFragments.map((fragment, index) => (
                <RegionTooltipTrigger
                    key={index}
                    x={renderX}
                    y={renderY}
                    fragment={fragment}
                    fontSize={fontSize}
                    stroke={colors[fragment.role]}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    onInfoTooltipShow={onInfoTooltipShow}
                />
            ))}
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

function RegionTooltipTrigger({
    x,
    y,
    fragment,
    fontSize,
    stroke,
    onMouseEnter,
    onMouseLeave,
    onInfoTooltipShow,
}: {
    x: number
    y: number
    fragment: RegionTooltipFragment
    fontSize: number
    stroke: string
    onMouseEnter?: React.MouseEventHandler<SVGElement>
    onMouseLeave?: React.MouseEventHandler<SVGElement>
    onInfoTooltipShow?: () => void
}): React.ReactElement {
    // Used as react key to remount RegionTooltip with fresh state
    const [tooltipRemountKey, setTooltipRemountKey] = useState(false)

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
                placement="top"
                interactive={!isTouchDevice()}
                appendTo={() => document.body}
                onShow={(instance) => {
                    // Hide any other open tooltips
                    hideAll({ exclude: instance })

                    onInfoTooltipShow?.()
                }}
                // Changing the key forces RegionTooltip to remount on the
                // next show, resetting its internal hover state back to
                // the initially highlighted region
                onHidden={() => setTooltipRemountKey((k) => !k)}
                content={
                    <RegionTooltip
                        key={tooltipRemountKey.toString()}
                        description={getDescriptionForKey(
                            fragment.regionTooltip.tooltipKey
                        )}
                        regions={getRegionsForKey(
                            fragment.regionTooltip.tooltipKey
                        )}
                        initiallyHighlightedRegion={
                            fragment.regionTooltip.regionName
                        }
                    />
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
