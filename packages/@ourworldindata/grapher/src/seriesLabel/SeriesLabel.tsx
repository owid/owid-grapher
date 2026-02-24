import * as R from "remeda"
import Tippy from "@tippyjs/react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"
import {
    GRAPHER_DARK_TEXT,
    GRAPHER_LIGHT_TEXT,
} from "../color/ColorConstants.js"
import {
    SeriesLabelState,
    PositionedTextFragment,
    PositionedIconFragment,
    TextRole,
    SpanLine,
} from "./SeriesLabelState.js"
import { Bounds, isTouchDevice } from "@ourworldindata/utils"
import { AnyRegionDataProvider } from "../core/RegionGroups.js"

const defaultColors: Record<TextRole, string> = {
    name: GRAPHER_DARK_TEXT,
    value: GRAPHER_DARK_TEXT,
    suffix: GRAPHER_LIGHT_TEXT,
}

export interface SeriesLabelProps {
    state: SeriesLabelState
    x: number
    y: number
    id?: string
    color?: Partial<Record<TextRole, string>>
    opacity?: number
    onMouseEnter?: React.MouseEventHandler<SVGElement>
    onMouseLeave?: React.MouseEventHandler<SVGElement>
    onInfoTooltipShow?: () => void
}

/**
 * Renders a series label that consists of up to three fragments:
 * - The main label text (e.g. "United States")
 * - An optional suffix that describes the region provider (e.g. "(WHO)")
 * - An optional value label (e.g. "70 years")
 *
 * If the label includes a region provider suffix, an info icon may be
 * rendered next to the suffix, which shows a tooltip with more information
 * about the region provider on hover.
 */
export function SeriesLabel({
    state,
    x,
    y,
    id,
    color,
    opacity,
    onMouseEnter,
    onMouseLeave,
    onInfoTooltipShow,
}: SeriesLabelProps): React.ReactElement {
    // Get the corrected position for SVG text rendering
    const [renderX, renderY] = state.getPositionForSvgRendering(x, y)

    const fontSize = state.fontSettings.fontSize.toFixed(2)
    const colors = { ...defaultColors, ...color }
    const props = { id, opacity, onMouseEnter, onMouseLeave }

    // Rely on browser rendering if there are no icons
    if (!state.hasIcon) {
        return (
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

    // Otherwise, text and icon fragments are both manually positioned
    const [textFragments, iconFragments] = R.partition(
        state.positionedFragments,
        (f) => f.type === "text"
    )

    return (
        <g {...props}>
            <LabelText
                x={renderX}
                y={renderY}
                fragments={textFragments}
                fontSize={fontSize}
                colors={colors}
            />
            {iconFragments.map((fragment) => (
                <IconFragment
                    key={fragment.providerKey}
                    x={renderX}
                    y={renderY}
                    fragment={fragment}
                    fill={colors.suffix}
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
    onMouseEnter,
    onMouseLeave,
}: {
    x: number
    y: number
    spanLines: SpanLine[]
    textAnchor: "start" | "end"
    fontSize: string
    lineHeight: number
    colors: Record<TextRole, string>
    id?: string
    opacity?: number
    onMouseEnter?: React.MouseEventHandler<SVGElement>
    onMouseLeave?: React.MouseEventHandler<SVGElement>
}): React.ReactElement {
    return (
        <text
            id={id}
            x={x.toFixed(1)}
            y={y.toFixed(1)}
            textAnchor={textAnchor}
            fontSize={fontSize}
            opacity={opacity}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {spanLines.map((spans, lineIndex) =>
                spans.map((span, spanIndex) => {
                    const isFirstLine = lineIndex === 0
                    const isLineStart = spanIndex === 0

                    const renderX = isLineStart ? x.toFixed(1) : undefined
                    const renderY =
                        isLineStart && !isFirstLine
                            ? lineHeight.toFixed(1)
                            : undefined

                    return (
                        <tspan
                            key={span.text}
                            x={renderX}
                            dy={renderY}
                            fontWeight={span.fontWeight}
                            fill={colors[span.role]}
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
    onMouseEnter,
    onMouseLeave,
}: {
    x: number
    y: number
    fragments: PositionedTextFragment[]
    fontSize: string
    colors: Record<TextRole, string>
    id?: string
    opacity?: number
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
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
            />
        )
    }

    return (
        <text
            id={id}
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
    onMouseEnter,
    onMouseLeave,
}: {
    x: number
    y: number
    fragment: PositionedTextFragment
    fontSize: string
    fill: string
    id?: string
    opacity?: number
    onMouseEnter?: React.MouseEventHandler<SVGElement>
    onMouseLeave?: React.MouseEventHandler<SVGElement>
}): React.ReactElement {
    return (
        <text
            id={id}
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
            x={(x + fragment.x).toFixed(1)}
            y={(y + fragment.y).toFixed(1)}
            fontWeight={fragment.fontWeight}
            fill={fill}
        >
            {fragment.text}
        </tspan>
    )
}

function IconFragment({
    x,
    y,
    fragment,
    fill,
    onMouseEnter,
    onMouseLeave,
    onInfoTooltipShow,
}: {
    x: number
    y: number
    fragment: PositionedIconFragment
    fill: string
    onMouseEnter?: React.MouseEventHandler<SVGElement>
    onMouseLeave?: React.MouseEventHandler<SVGElement>
    onInfoTooltipShow?: () => void
}): React.ReactElement {
    const iconX = x + fragment.x
    const iconY = y + fragment.y

    const hitAreaSize = isTouchDevice() ? 40 : 20
    const padding = Math.ceil((hitAreaSize - fragment.iconSize) / 2)
    const hitAreaBounds = new Bounds(
        iconX,
        iconY,
        fragment.iconSize,
        fragment.iconSize
    ).expand(padding)

    return (
        <g>
            {/* Info icon */}
            <g transform={`translate(${iconX}, ${iconY})`}>
                <FontAwesomeIcon
                    icon={faCircleInfo}
                    width={fragment.iconSize}
                    height={fragment.iconSize}
                    color={fill}
                />
            </g>

            {/* Hit area for tooltip interaction */}
            <Tippy
                theme="grapher-explanation"
                placement="top"
                content={
                    <RegionProviderTooltipContent
                        providerKey={fragment.providerKey}
                    />
                }
                onShow={onInfoTooltipShow}
            >
                <rect
                    {...hitAreaBounds.toProps()}
                    fill="transparent"
                    style={{ pointerEvents: "auto" }}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                />
            </Tippy>
        </g>
    )
}

function RegionProviderTooltipContent({
    providerKey,
}: {
    providerKey: AnyRegionDataProvider
}): React.ReactElement {
    return <div>{providerKey}</div>
}
