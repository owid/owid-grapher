import { match } from "ts-pattern"
import Tippy from "@tippyjs/react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"
import { TextWrap } from "@ourworldindata/components"
import { GRAPHER_LIGHT_TEXT } from "../color/ColorConstants.js"
import {
    SeriesLabelState,
    SuffixLayoutWithIcon,
    TextLayout,
} from "./SeriesLabelState.js"

export interface SeriesLabelProps {
    state: SeriesLabelState
    x: number
    y: number
    id?: string
    fill?: string
    opacity?: number
    textAnchor?: "start" | "end"
    onMouseEnter?: React.MouseEventHandler<SVGTextElement>
    onMouseLeave?: React.MouseEventHandler<SVGTextElement>
}

/**
 * Renders a series label with up to three fragments: name, suffix, and value.
 *
 * Fragments:
 * - Name: The main label text, which may wrap across multiple lines
 * - Suffix: Parenthetical text like "(WHO)" rendered in muted gray
 * - Value: Optional formatted value
 *
 * Examples:
 * - "France" -> Name only
 * - "Europe (WB)" -> Name with suffix
 * - "United States 45,000" -> Name and value
 * - "Middle East and North Africa (WHO) 2,500" -> Name with suffix and value
 */
export function SeriesLabel({
    state,
    x,
    y,
    id,
    fill,
    opacity,
    textAnchor = "start",
    onMouseEnter,
    onMouseLeave,
}: SeriesLabelProps): React.ReactElement {
    const { nameWrap, suffixLayout, valueLayout } = state

    const textProps: React.SVGProps<SVGTextElement> = {
        fill,
        opacity,
        textAnchor,
    }

    const suffixTextProps = { ...textProps, fill: GRAPHER_LIGHT_TEXT }

    // When textAnchor="end" and a fragment is on the same line as the name,
    // we need special rendering to ensure proper right-alignment
    const needsManualEndAlignment =
        textAnchor === "end" &&
        ((suffixLayout && !suffixLayout.onNewLine) ||
            (valueLayout && !valueLayout.onNewLine))
    if (needsManualEndAlignment) {
        return (
            <g id={id} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
                <ManuallyEndAlignedLabel
                    state={state}
                    x={x}
                    y={y}
                    textProps={textProps}
                />

                {/* Only render fragments on new lines.
                    If they are on the same line as the name,
                    they are rendered inside ManuallyEndAlignedLabel above */}
                {suffixLayout?.onNewLine && (
                    <SeriesLabelSuffix
                        x={x}
                        y={y}
                        suffixLayout={suffixLayout}
                        textProps={suffixTextProps}
                        textAnchor={textAnchor}
                    />
                )}
                {valueLayout?.onNewLine && (
                    <SeriesLabelText
                        x={getFragmentX(x, valueLayout, textAnchor)}
                        y={getFragmentY(y, valueLayout)}
                        textWrap={valueLayout.textWrap}
                        textProps={textProps}
                    />
                )}
            </g>
        )
    }

    return (
        <g id={id} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
            <SeriesLabelText
                x={x}
                y={y}
                textWrap={nameWrap}
                textProps={textProps}
            />

            {suffixLayout && (
                <SeriesLabelSuffix
                    x={x}
                    y={y}
                    suffixLayout={suffixLayout}
                    textProps={suffixTextProps}
                    textAnchor={textAnchor}
                />
            )}

            {valueLayout && (
                <SeriesLabelText
                    x={getFragmentX(x, valueLayout, textAnchor)}
                    y={getFragmentY(y, valueLayout)}
                    textWrap={valueLayout.textWrap}
                    textProps={textProps}
                />
            )}
        </g>
    )
}

/**
 * Renders the name and suffix/value fragments if one fragment is placed on the
 * same line as the name. This ensures proper alignment when textAnchor is set
 * to "end"
 */
function ManuallyEndAlignedLabel({
    state,
    x,
    y,
    textProps,
}: {
    state: SeriesLabelState
    x: number
    y: number
    textProps: React.SVGProps<SVGTextElement>
}): React.ReactElement {
    const { nameWrap, suffixLayout, valueLayout } = state
    const { lines, singleLineHeight, fontSize, fontWeight } = nameWrap

    // Get the corrected y position from TextWrap
    const [, renderY] = nameWrap.getPositionForSvgRendering(x, y)

    const allButLastLine = lines.slice(0, -1)
    const lastLine = lines[lines.length - 1]
    const lastLineY = renderY + (lines.length - 1) * singleLineHeight

    return (
        <text
            fontSize={fontSize.toFixed(2)}
            fontWeight={fontWeight}
            {...textProps}
        >
            {/* Render all lines except the last one normally */}
            {allButLastLine.map((line, i) => (
                <tspan key={i} x={x} y={renderY + i * singleLineHeight}>
                    {line.text}
                </tspan>
            ))}

            {/* Last line of the name + any same-line fragments */}
            <tspan x={x} y={lastLineY}>
                {lastLine.text}{" "}
                {suffixLayout &&
                    // TODO: Add support for icons
                    suffixLayout.type === "text" &&
                    !suffixLayout.onNewLine && (
                        <tspan
                            fill={GRAPHER_LIGHT_TEXT}
                            fontWeight={suffixLayout.textWrap.fontWeight}
                        >
                            {suffixLayout.textWrap.text}
                        </tspan>
                    )}
                {valueLayout && !valueLayout.onNewLine && (
                    <tspan fontWeight={valueLayout.textWrap.fontWeight}>
                        {valueLayout.textWrap.text}
                    </tspan>
                )}
            </tspan>
        </text>
    )
}

function SeriesLabelSuffix({
    suffixLayout,
    textProps,
    textAnchor,
    x,
    y,
}: {
    suffixLayout: TextLayout | SuffixLayoutWithIcon
    textProps: React.SVGProps<SVGTextElement>
    textAnchor: "start" | "end"
    x: number
    y: number
}): React.ReactElement {
    return match(suffixLayout)
        .with({ type: "text" }, (layout) => (
            <SeriesLabelText
                x={getFragmentX(x, layout, textAnchor)}
                y={getFragmentY(y, layout)}
                textWrap={layout.textWrap}
                textProps={textProps}
            />
        ))
        .with({ type: "suffix-with-icon" }, (layout) => (
            <SeriesLabelSuffixWithIcon
                suffixLayout={layout}
                x={x}
                y={y}
                textProps={textProps}
            />
        ))
        .exhaustive()
}

function SeriesLabelText({
    x,
    y,
    textWrap,
    textProps,
}: {
    textWrap: TextWrap
    x: number
    y: number
    textProps: React.SVGProps<SVGTextElement>
}): React.ReactElement {
    return textWrap.renderSVG(x, y, { textProps })
}

/**
 * Renders the suffix portion of a series label with a provider icon.
 *
 * Renders "(WHO ⓘ)" with the info icon and handles tooltip display on hover.
 */
function SeriesLabelSuffixWithIcon({
    suffixLayout,
    x,
    y,
    textProps,
}: {
    suffixLayout: SuffixLayoutWithIcon
    x: number
    y: number
    textProps: React.SVGProps<SVGTextElement>
}): React.ReactElement {
    const [textBeforeIcon, _, icon, textAfterIcon] = suffixLayout.parts

    // Icon positioning
    const iconX = x + icon.position.dx
    const iconY = y + icon.position.dy

    // Make the hit area a bit larger than the icon itself
    const hitAreaPadding = 4

    return (
        <g className="series-label__suffix">
            {/* Opening text "(WHO " */}
            <SeriesLabelText
                x={x + textBeforeIcon.position.dx}
                y={y + textBeforeIcon.position.dy}
                textWrap={textBeforeIcon.textWrap}
                textProps={textProps}
            />

            {/* Info icon */}
            <g transform={`translate(${iconX}, ${iconY})`}>
                <FontAwesomeIcon
                    className="provider-info-icon"
                    icon={faCircleInfo}
                    width={icon.dimensions.width}
                    height={icon.dimensions.height}
                    color={textProps.fill}
                />
            </g>

            {/* Closing ")" */}
            <SeriesLabelText
                x={x + textAfterIcon.position.dx}
                y={y + textAfterIcon.position.dy}
                textWrap={textAfterIcon.textWrap}
                textProps={textProps}
            />

            {/* Hit area for tooltip interaction */}
            <Tippy
                content={
                    <SeriesLabelProviderTooltip
                        providerKey={suffixLayout.providerKey}
                    />
                }
                theme="grapher-explanation"
                placement="top"
            >
                <rect
                    className="provider-icon-hit-area"
                    x={iconX - hitAreaPadding}
                    y={iconY - hitAreaPadding}
                    width={icon.dimensions.width + 2 * hitAreaPadding}
                    height={icon.dimensions.height + 2 * hitAreaPadding}
                    fill="transparent"
                    style={{ pointerEvents: "auto" }}
                />
            </Tippy>
        </g>
    )
}

function SeriesLabelProviderTooltip({
    providerKey,
}: {
    providerKey: string
}): React.ReactElement {
    return <div>{providerKey}</div>
}

// Calculate x position for a fragment
const getFragmentX = (
    x: number,
    layout: TextLayout,
    textAnchor: "start" | "end" = "start"
) => {
    return x + (textAnchor === "end" ? -1 : 1) * layout.position.dx
}

// Calculate y position for a fragment
const getFragmentY = (y: number, layout: TextLayout) => {
    return y + layout.position.dy
}
