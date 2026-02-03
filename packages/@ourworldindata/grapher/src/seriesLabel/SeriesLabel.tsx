import { GRAPHER_LIGHT_TEXT } from "../color/ColorConstants.js"
import { FragmentLayout, SeriesLabelState } from "./SeriesLabelState.js"

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

    // Calculate x position for a fragment
    const fragmentX = (layout: FragmentLayout) => {
        return x + (textAnchor === "end" ? -1 : 1) * layout.position.dx
    }

    // Calculate y position for a fragment
    const fragmentY = (layout: FragmentLayout) => {
        return y + layout.position.dy
    }

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
                {suffixLayout?.onNewLine &&
                    suffixLayout?.textWrap.renderSVG(
                        fragmentX(suffixLayout),
                        fragmentY(suffixLayout),
                        { textProps: suffixTextProps }
                    )}
                {valueLayout?.onNewLine &&
                    valueLayout?.textWrap.renderSVG(
                        fragmentX(valueLayout),
                        fragmentY(valueLayout),
                        { textProps }
                    )}
            </g>
        )
    }

    return (
        <g id={id} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
            {nameWrap.renderSVG(x, y, { textProps })}

            {suffixLayout?.textWrap.renderSVG(
                fragmentX(suffixLayout),
                fragmentY(suffixLayout),
                { textProps: suffixTextProps }
            )}

            {valueLayout?.textWrap.renderSVG(
                fragmentX(valueLayout),
                fragmentY(valueLayout),
                { textProps }
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
                {suffixLayout && !suffixLayout.onNewLine && (
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
