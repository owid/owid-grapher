<<<<<<< HEAD
import { GRAPHER_LIGHT_TEXT } from "../color/ColorConstants.js"
import { FragmentLayout, SeriesLabelState } from "./SeriesLabelState.js"
||||||| parent of a5426d0900 (🎉 add provider info icons to EntityLabel)
import * as React from "react"
import { SeriesLabelState } from "./SeriesLabelState.js"
=======
import * as React from "react"
import { useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { Bounds } from "@ourworldindata/utils"
import { SeriesLabelState } from "./SeriesLabelState.js"
import { PROVIDER_INFO } from "./ProviderInfo.js"

const SUFFIX_COLOR = "#6e7581"
>>>>>>> a5426d0900 (🎉 add provider info icons to EntityLabel)

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
    /** Set to true for static exports (disables tooltips) */
    isStatic?: boolean
    /** Called when mouse enters the provider suffix area */
    onProviderMouseEnter?: (seriesName: string) => void
    /** Called when mouse leaves the provider suffix area */
    onProviderMouseLeave?: () => void
}

/**
<<<<<<< HEAD
 * Renders a series label with up to three fragments: name, suffix, and value.
||||||| parent of a5426d0900 (🎉 add provider info icons to EntityLabel)
 * SeriesLabel renders a series label with optional suffix styling
 * and formatted value.
=======
 * SeriesLabel renders a series label with optional suffix styling,
 * provider info icon with tooltip, and formatted value.
>>>>>>> a5426d0900 (🎉 add provider info icons to EntityLabel)
 *
<<<<<<< HEAD
 * Fragments:
 * - Name: The main label text, which may wrap across multiple lines
 * - Suffix: Parenthetical text like "(WHO)" rendered in muted gray
 * - Value: Optional formatted value
||||||| parent of a5426d0900 (🎉 add provider info icons to EntityLabel)
 * For entity names with trailing parenthetical suffixes like "Something (whatever)":
 * - Displays the suffix in muted (gray) text
=======
 * For entity names with trailing parenthetical suffixes like "Something (whatever)":
 * - Displays the suffix in muted (gray) text
 * - Recognized provider suffixes (e.g., "WHO", "UN") show an info icon with tooltip
>>>>>>> a5426d0900 (🎉 add provider info icons to EntityLabel)
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
    isStatic,
    onProviderMouseEnter,
    onProviderMouseLeave,
}: SeriesLabelProps): React.ReactElement {
<<<<<<< HEAD
    const { nameWrap, suffixLayout, valueLayout } = state
||||||| parent of a5426d0900 (🎉 add provider info icons to EntityLabel)
    const { mainTextWrap, suffixPosition, valuePosition, parsedText } = state

    // Get the render Y position from the main text wrap
    const [, renderY] = mainTextWrap.getPositionForSvgRendering(x, y)
=======
    const [tooltipVisible, setTooltipVisible] = useState(false)
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })

    const {
        mainTextWrap,
        suffixPosition,
        valuePosition,
        parsedText,
        shouldShowSuffix,
        shouldShowIcon,
        iconSize,
        suffixFontSettings,
        singleLineHeight,
    } = state

    // Get the render Y position from the main text wrap
    const [, renderY] = mainTextWrap.getPositionForSvgRendering(x, y)
>>>>>>> a5426d0900 (🎉 add provider info icons to EntityLabel)

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

<<<<<<< HEAD
    return (
        <g id={id} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
            {nameWrap.renderSVG(x, y, { textProps })}
||||||| parent of a5426d0900 (🎉 add provider info icons to EntityLabel)
    return (
        <g id={id} className="series-label">
            {/* Main text */}
            {mainTextWrap.renderSVG(x, y, { textProps })}
=======
    // Tooltip handlers
    const handleIconMouseEnter = useCallback(
        (event: React.MouseEvent<SVGRectElement>): void => {
            const rect = event.currentTarget.getBoundingClientRect()
            setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top })
            setTooltipVisible(true)
            onProviderMouseEnter?.(state.text)
        },
        [onProviderMouseEnter, state.text]
    )
>>>>>>> a5426d0900 (🎉 add provider info icons to EntityLabel)

<<<<<<< HEAD
            {suffixLayout?.textWrap.renderSVG(
                fragmentX(suffixLayout),
                fragmentY(suffixLayout),
                { textProps: suffixTextProps }
            )}
||||||| parent of a5426d0900 (🎉 add provider info icons to EntityLabel)
            {/* Suffix in muted style */}
            {state.shouldShowSuffix && suffixPosition && parsedText && (
                <text
                    x={x + suffixPosition.x}
                    y={renderY + suffixPosition.y}
                    fontSize={state.suffixFontSettings.fontSize}
                    fontWeight={state.suffixFontSettings.fontWeight}
                    fill={SUFFIX_COLOR}
                    opacity={opacity}
                    textAnchor={textAnchor}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    className="series-label__text--muted"
                >
                    ({parsedText.suffix})
                </text>
            )}
=======
    const handleIconMouseLeave = useCallback((): void => {
        setTooltipVisible(false)
        onProviderMouseLeave?.()
    }, [onProviderMouseLeave])

    // Render suffix (with or without icon)
    const renderSuffix = (): React.ReactElement | null => {
        if (!shouldShowSuffix || !suffixPosition || !parsedText) return null

        const suffixX = x + suffixPosition.x
        const lineY = renderY + suffixPosition.y

        // For non-provider suffix, render simple gray text
        if (!shouldShowIcon) {
            return (
                <text
                    x={suffixX}
                    y={lineY}
                    fontSize={suffixFontSettings.fontSize}
                    fontWeight={suffixFontSettings.fontWeight}
                    fill={SUFFIX_COLOR}
                    opacity={opacity}
                    textAnchor={textAnchor}
                    className="series-label__text--muted"
                >
                    ({parsedText.suffix})
                </text>
            )
        }
>>>>>>> a5426d0900 (🎉 add provider info icons to EntityLabel)

<<<<<<< HEAD
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
||||||| parent of a5426d0900 (🎉 add provider info icons to EntityLabel)
            {/* Formatted value */}
            {state.formattedValue && valuePosition && (
                <text
                    x={x + valuePosition.x}
                    y={renderY + valuePosition.y}
                    fontSize={state.fontSize}
                    fontWeight={400}
                    fill={fill}
                    opacity={opacity}
                    textAnchor={textAnchor}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                >
                    {state.formattedValue}
                </text>
            )}
        </g>
=======
        // For provider suffix, render with icon
        const openingText = `(${parsedText.suffix} `
        const openingWidth = Bounds.forText(
            openingText,
            suffixFontSettings
        ).width

        // Icon vertical positioning - center relative to text baseline
        const iconY = lineY - iconSize * 0.8

        return (
            <g className="series-label__suffix">
                {/* Opening text "(WHO " */}
                <text
                    x={suffixX}
                    y={lineY}
                    fontSize={suffixFontSettings.fontSize}
                    fontWeight={suffixFontSettings.fontWeight}
                    fill={SUFFIX_COLOR}
                    opacity={opacity}
                    textAnchor={textAnchor}
                    className="series-label__text--muted"
                >
                    {openingText}
                </text>

                {/* Info icon */}
                <g
                    className="provider-info-icon"
                    transform={`translate(${suffixX + openingWidth}, ${iconY})`}
                >
                    <svg
                        x={0}
                        y={0}
                        width={iconSize}
                        height={iconSize}
                        viewBox="64 64 512 512"
                        className="provider-info-icon__svg"
                    >
                        <path
                            fill={SUFFIX_COLOR}
                            opacity={opacity}
                            d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"
                        />
                    </svg>
                </g>

                {/* Closing ")" */}
                <text
                    x={suffixX + openingWidth + iconSize}
                    y={lineY}
                    fontSize={suffixFontSettings.fontSize}
                    fontWeight={suffixFontSettings.fontWeight}
                    fill={SUFFIX_COLOR}
                    opacity={opacity}
                    textAnchor={textAnchor}
                    className="series-label__text--muted"
                >
                    )
                </text>
            </g>
        )
    }

    // Render icon hit area for hover interactions
    const renderIconHitArea = (): React.ReactElement | null => {
        if (!shouldShowIcon || !suffixPosition || !parsedText || isStatic)
            return null

        const openingText = `(${parsedText.suffix} `
        const openingWidth = Bounds.forText(
            openingText,
            suffixFontSettings
        ).width
        const hitX = x + suffixPosition.x + openingWidth
        const hitY = y + suffixPosition.y

        return (
            <rect
                className="provider-icon-hit-area"
                x={hitX}
                y={hitY}
                width={iconSize}
                height={singleLineHeight}
                fill="transparent"
                style={{ pointerEvents: "auto" }}
                onMouseEnter={handleIconMouseEnter}
                onMouseLeave={handleIconMouseLeave}
            />
        )
    }

    // Render tooltip via portal
    const renderTooltip = (): React.ReactElement | null => {
        if (!tooltipVisible || !parsedText || isStatic) return null

        const provider =
            parsedText.type === "regionWithProviderSuffix" &&
            parsedText.suffix in PROVIDER_INFO
                ? PROVIDER_INFO[parsedText.suffix]
                : undefined

        if (!provider) return null

        return createPortal(
            <div
                className="provider-info-tooltip-container"
                style={{
                    position: "fixed",
                    left: tooltipPosition.x,
                    top: tooltipPosition.y,
                    transform: "translate(-50%, -100%)",
                    paddingBottom: 8,
                    zIndex: 10000,
                }}
            >
                <div className="provider-info-tooltip">
                    <strong>{provider.name}</strong>
                    <p>{provider.description}</p>
                </div>
            </div>,
            document.body
        )
    }

    return (
        <>
            <g id={id} className="series-label">
                {/* Main text */}
                {mainTextWrap.renderSVG(x, y, { textProps })}

                {/* Suffix (with optional icon) */}
                {renderSuffix()}

                {/* Formatted value */}
                {state.formattedValue && valuePosition && (
                    <text
                        x={x + valuePosition.x}
                        y={renderY + valuePosition.y}
                        fontSize={state.fontSize}
                        fontWeight={400}
                        fill={fill}
                        opacity={opacity}
                        textAnchor={textAnchor}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                    >
                        {state.formattedValue}
                    </text>
                )}

                {/* Icon hit area for interactions */}
                {renderIconHitArea()}
            </g>

            {/* Tooltip rendered via portal */}
            {renderTooltip()}
        </>
>>>>>>> a5426d0900 (🎉 add provider info icons to EntityLabel)
    )
}
