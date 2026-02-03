import * as React from "react"
import { createPortal } from "react-dom"
import { computed, action, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { Bounds, FontFamily } from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"
import {
    parseSuffixFromEntityName,
    PROVIDER_INFO,
    type ParsedSuffix,
} from "./ProviderInfo.js"

const INFO_ICON_SIZE_FACTOR = 0.9 // Relative to font size
const ANNOTATION_PADDING = 1 // Space between label and annotation

export interface EntityLabelProps {
    entityName: string
    maxWidth: number
    fontSize: number
    fontWeight?: number
    fontFamily?: FontFamily
    lineHeight?: number

    /** Whether to show info icons for recognized provider suffixes */
    showProviderIcon?: boolean
    /** Set to true for static exports (disables tooltip) */
    isStatic?: boolean

    /** Optional formatted value to display after the entity name (e.g., "1,234") */
    formattedValue?: string
    /** Font weight for the formatted value */
    formattedValueFontWeight?: number
    /** If true, always place the formatted value on a new line */
    placeFormattedValueInNewLine?: boolean

    /** Optional annotation text rendered below the label */
    annotation?: string
    /** Font size for annotation (default: fontSize * 0.9) */
    annotationFontSize?: number
    /** Font weight for annotation (default: 300) */
    annotationFontWeight?: number

    /** Called when mouse enters the provider suffix area */
    onProviderMouseEnter?: (seriesName: string) => void
    /** Called when mouse leaves the provider suffix area */
    onProviderMouseLeave?: () => void

    // Rendering position (required when rendering as a React component)
    x?: number
    y?: number
    textProps?: React.SVGProps<SVGTextElement>
}

/**
 * EntityLabel renders an entity name with optional provider info icon, tooltip,
 * formatted value, and annotation.
 *
 * For entity names with recognized provider suffixes like "Africa (WHO)", it:
 * - Displays the provider suffix in muted (gray) text
 * - Shows an info icon that reveals provider details on hover
 * - Uses avoid-wrap behavior to keep the suffix with the entity name
 *
 * When a formatted value is provided (e.g., for slope charts):
 * - Displays: "Africa (WHO ⓘ) 1,234"
 * - Value wraps to new line if it doesn't fit
 * - placeFormattedValueInNewLine forces value to always be on new line
 *
 * When an annotation is provided:
 * - Renders below all other content with smaller, lighter text
 */
@observer
export class EntityLabel extends React.Component<EntityLabelProps> {
    // Tooltip state
    tooltipVisible = false
    tooltipPosition = { x: 0, y: 0 }

    constructor(props: EntityLabelProps) {
        super(props)
        makeObservable(this, {
            tooltipVisible: observable,
            tooltipPosition: observable,
        })
    }

    @action.bound showTooltip(x: number, y: number): void {
        this.tooltipVisible = true
        this.tooltipPosition = { x, y }
    }

    @action.bound hideTooltip(): void {
        this.tooltipVisible = false
    }

    @computed private get lineHeight(): number {
        return this.props.lineHeight ?? 1.1
    }

    @computed get singleLineHeight(): number {
        return this.props.fontSize * this.lineHeight
    }

    @computed private get iconSize(): number {
        return Math.round(this.props.fontSize * INFO_ICON_SIZE_FACTOR)
    }

    @computed private get parsedSuffix(): ParsedSuffix | undefined {
        return parseSuffixFromEntityName(this.props.entityName)
    }

    /** Whether to show the suffix in gray (any trailing parenthetical) */
    @computed private get shouldShowSuffix(): boolean {
        return !!this.parsedSuffix
    }

    /** Whether to show the info icon (only for recognized providers) */
    @computed private get shouldShowIcon(): boolean {
        return !!(this.props.showProviderIcon && this.parsedSuffix?.isProvider)
    }

    @computed private get fontSettings(): {
        fontSize: number
        fontWeight?: number
        fontFamily?: FontFamily
    } {
        return {
            fontSize: this.props.fontSize,
            fontWeight: this.props.fontWeight,
            fontFamily: this.props.fontFamily,
        }
    }

    @computed private get valueFontSettings(): {
        fontSize: number
        fontWeight?: number
        fontFamily?: FontFamily
    } {
        return {
            fontSize: this.props.fontSize,
            fontWeight: this.props.formattedValueFontWeight,
            fontFamily: this.props.fontFamily,
        }
    }

    @computed private get annotationFontSettings(): {
        fontSize: number
        fontWeight: number
        fontFamily?: FontFamily
    } {
        return {
            fontSize:
                this.props.annotationFontSize ?? this.props.fontSize * 0.9,
            fontWeight: this.props.annotationFontWeight ?? 300,
            fontFamily: this.props.fontFamily,
        }
    }

    /**
     * Width of space character
     */
    @computed private get spaceWidth(): number {
        return Bounds.forText(" ", this.fontSettings).width
    }

    /**
     * Font settings for the suffix (always normal weight)
     */
    @computed private get suffixFontSettings(): {
        fontSize: number
        fontWeight: number
        fontFamily?: FontFamily
    } {
        return {
            fontSize: this.props.fontSize,
            fontWeight: 400,
            fontFamily: this.props.fontFamily,
        }
    }

    /**
     * Calculate the width of the suffix "(WHO ⓘ)" or "(whatever)"
     */
    @computed private get suffixWidth(): number {
        if (!this.parsedSuffix) return 0

        if (this.shouldShowIcon) {
            // Provider suffix with icon: "(WHO ⓘ)"
            const textWidth = Bounds.forText(
                `(${this.parsedSuffix.suffix} `,
                this.suffixFontSettings
            ).width
            const closingWidth = Bounds.forText(
                ")",
                this.suffixFontSettings
            ).width
            return textWidth + this.iconSize + closingWidth
        } else {
            // Regular suffix without icon: "(whatever)"
            return Bounds.forText(
                `(${this.parsedSuffix.suffix})`,
                this.suffixFontSettings
            ).width
        }
    }

    /**
     * Calculate the width of the formatted value
     */
    @computed private get valueWidth(): number {
        if (!this.props.formattedValue) return 0
        return Bounds.forText(this.props.formattedValue, this.valueFontSettings)
            .width
    }

    /**
     * The main entity name (without suffix if we're showing it separately)
     */
    @computed private get mainName(): string {
        return this.shouldShowSuffix
            ? this.parsedSuffix!.mainName
            : this.props.entityName
    }

    /**
     * Width of just the main name
     */
    @computed private get mainNameWidth(): number {
        return Bounds.forText(this.mainName, this.fontSettings).width
    }

    /**
     * Width needed for suffix (with leading space) if showing
     */
    @computed private get suffixWithSpaceWidth(): number {
        return this.shouldShowSuffix ? this.spaceWidth + this.suffixWidth : 0
    }

    /**
     * Width needed for value (with leading space) if present
     */
    @computed private get valueWithSpaceWidth(): number {
        return this.props.formattedValue ? this.spaceWidth + this.valueWidth : 0
    }

    /**
     * Determine if the formatted value should be on a new line.
     * This happens if:
     * 1. placeFormattedValueInNewLine is explicitly true, OR
     * 2. There's a suffix (value always on new line with suffix), OR
     * 3. Everything doesn't fit on one line (avoid-wrap behavior)
     */
    @computed private get valueOnNewLine(): boolean {
        if (!this.props.formattedValue) return false
        if (this.props.placeFormattedValueInNewLine) return true
        // Always put value on new line when there's a suffix
        if (this.shouldShowSuffix) return true

        // Check if everything fits on one line
        const totalWidth =
            this.mainNameWidth +
            this.suffixWithSpaceWidth +
            this.valueWithSpaceWidth
        return totalWidth > this.props.maxWidth
    }

    /**
     * Determine the maxWidth for the main text TextWrap.
     * Reserve space on the last line for suffix (and value if on same line).
     */
    @computed private get mainTextMaxWidth(): number {
        const { maxWidth } = this.props

        // If no suffix and no value, use full width
        if (!this.shouldShowSuffix && !this.props.formattedValue) {
            return maxWidth
        }

        // Calculate what needs to fit on the last line with the main text
        let reservedWidth = this.suffixWithSpaceWidth

        // If value is NOT on a new line, it also needs to fit on the last line
        if (this.props.formattedValue && !this.valueOnNewLine) {
            reservedWidth += this.valueWithSpaceWidth
        }

        // Check if everything fits on one line
        const fullWidth = this.mainNameWidth + reservedWidth
        if (fullWidth <= maxWidth) {
            return maxWidth
        }

        // Otherwise, reduce maxWidth so reserved content fits on last line
        return Math.max(maxWidth - reservedWidth, maxWidth * 0.5)
    }

    @computed private get mainTextWrap(): TextWrap {
        return new TextWrap({
            text: this.mainName,
            maxWidth: this.mainTextMaxWidth,
            fontSize: this.props.fontSize,
            fontWeight: this.props.fontWeight,
            fontFamily: this.props.fontFamily,
            lineHeight: this.lineHeight,
        })
    }

    /**
     * TextWrap for the annotation (if provided)
     */
    @computed private get annotationTextWrap(): TextWrap | undefined {
        if (!this.props.annotation) return undefined

        return new TextWrap({
            text: this.props.annotation,
            maxWidth: this.props.maxWidth,
            fontSize: this.annotationFontSettings.fontSize,
            fontWeight: this.annotationFontSettings.fontWeight,
            fontFamily: this.annotationFontSettings.fontFamily,
            lineHeight: this.lineHeight,
        })
    }

    /**
     * Get the position where the suffix should be rendered
     */
    @computed private get suffixPosition():
        | { x: number; y: number }
        | undefined {
        if (!this.shouldShowSuffix) return undefined

        const lastLineIndex = this.mainTextWrap.lineCount - 1
        return {
            x: this.mainTextWrap.lastLineWidth + this.spaceWidth,
            y: lastLineIndex * this.singleLineHeight,
        }
    }

    /**
     * Get the position where the formatted value should be rendered
     */
    @computed private get valuePosition():
        | { x: number; y: number }
        | undefined {
        if (!this.props.formattedValue) return undefined

        if (this.valueOnNewLine) {
            // Value on new line, starts at x=0
            const lineIndex = this.mainTextWrap.lineCount
            return {
                x: 0,
                y: lineIndex * this.singleLineHeight,
            }
        }

        // Value on same line as suffix (or main text if no suffix)
        const lastLineIndex = this.mainTextWrap.lineCount - 1
        let x = this.mainTextWrap.lastLineWidth + this.spaceWidth

        if (this.shouldShowSuffix) {
            // After suffix
            x += this.suffixWidth + this.spaceWidth
        }

        return {
            x,
            y: lastLineIndex * this.singleLineHeight,
        }
    }

    /**
     * Height of the main content (text + suffix + value) without annotation
     */
    @computed private get mainContentHeight(): number {
        let height = this.mainTextWrap.height
        if (this.valueOnNewLine && this.props.formattedValue) {
            height += this.singleLineHeight
        }
        return height
    }

    /**
     * Get the position where the annotation should be rendered
     */
    @computed private get annotationPosition():
        | { x: number; y: number }
        | undefined {
        if (!this.annotationTextWrap) return undefined

        return {
            x: 0,
            y: this.mainContentHeight + ANNOTATION_PADDING,
        }
    }

    @computed get width(): number {
        const mainWidth = this.mainTextWrap.width

        if (
            !this.shouldShowSuffix &&
            !this.props.formattedValue &&
            !this.annotationTextWrap
        ) {
            return mainWidth
        }

        // Calculate width of the last line (which has suffix and possibly value)
        let lastLineWidth = this.mainTextWrap.lastLineWidth

        if (this.shouldShowSuffix) {
            lastLineWidth += this.spaceWidth + this.suffixWidth
        }

        if (this.props.formattedValue && !this.valueOnNewLine) {
            lastLineWidth += this.spaceWidth + this.valueWidth
        }

        // If value is on new line, also consider its width
        const valueLineWidth = this.valueOnNewLine ? this.valueWidth : 0

        // Consider annotation width
        const annotationWidth = this.annotationTextWrap?.width ?? 0

        return Math.max(
            mainWidth,
            lastLineWidth,
            valueLineWidth,
            annotationWidth
        )
    }

    @computed get height(): number {
        let height = this.mainContentHeight

        if (this.annotationTextWrap) {
            height += ANNOTATION_PADDING + this.annotationTextWrap.height
        }

        return height
    }

    private renderMainText(
        x: number,
        y: number,
        textProps?: React.SVGProps<SVGTextElement>
    ): React.ReactElement {
        return this.mainTextWrap.renderSVG(x, y, { textProps })
    }

    private renderSuffix(
        baseX: number,
        baseY: number
    ): React.ReactElement | null {
        const {
            suffixPosition,
            parsedSuffix,
            shouldShowIcon,
            iconSize,
            suffixFontSettings,
            mainTextWrap,
        } = this
        if (!suffixPosition || !parsedSuffix) return null

        const x = baseX + suffixPosition.x
        // Use TextWrap's positioning to match the main text baseline
        const [, renderY] = mainTextWrap.getPositionForSvgRendering(
            baseX,
            baseY
        )
        const lineY = renderY + suffixPosition.y

        // For non-provider suffix, render simple gray text
        if (!shouldShowIcon) {
            return (
                <g className="entity-label__suffix">
                    <text
                        x={x}
                        y={lineY}
                        fontSize={suffixFontSettings.fontSize}
                        fontWeight={suffixFontSettings.fontWeight}
                        className="entity-label__text--muted"
                    >
                        ({parsedSuffix.suffix})
                    </text>
                </g>
            )
        }

        // For provider suffix, render with icon
        const openingText = `(${parsedSuffix.suffix} `
        const openingWidth = Bounds.forText(
            openingText,
            suffixFontSettings
        ).width

        // Icon vertical positioning - center relative to text baseline
        const iconY = lineY - iconSize * 0.8

        return (
            <g className="entity-label__suffix">
                {/* Opening text "(WHO " - always normal weight */}
                <text
                    x={x}
                    y={lineY}
                    fontSize={suffixFontSettings.fontSize}
                    fontWeight={suffixFontSettings.fontWeight}
                    className="entity-label__text--muted"
                >
                    {openingText}
                </text>

                {/* Info icon */}
                <g
                    className="provider-info-icon"
                    transform={`translate(${x + openingWidth}, ${iconY})`}
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
                            fill="currentColor"
                            d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"
                        />
                    </svg>
                </g>

                {/* Closing ")" - always normal weight */}
                <text
                    x={x + openingWidth + iconSize}
                    y={lineY}
                    fontSize={suffixFontSettings.fontSize}
                    fontWeight={suffixFontSettings.fontWeight}
                    className="entity-label__text--muted"
                >
                    )
                </text>
            </g>
        )
    }

    private renderFormattedValue(
        baseX: number,
        baseY: number,
        textProps?: React.SVGProps<SVGTextElement>
    ): React.ReactElement | null {
        const { valuePosition, props, mainTextWrap, valueFontSettings } = this
        if (!valuePosition || !props.formattedValue) return null

        const [, renderY] = mainTextWrap.getPositionForSvgRendering(
            baseX,
            baseY
        )
        const x = baseX + valuePosition.x
        const y = renderY + valuePosition.y

        return (
            <text
                x={x}
                y={y}
                fontSize={valueFontSettings.fontSize}
                fontWeight={valueFontSettings.fontWeight}
                {...textProps}
            >
                {props.formattedValue}
            </text>
        )
    }

    private renderAnnotation(
        baseX: number,
        baseY: number,
        textProps?: React.SVGProps<SVGTextElement>
    ): React.ReactElement | null {
        const { annotationTextWrap, annotationPosition } = this
        if (!annotationTextWrap || !annotationPosition) return null

        const x = baseX + annotationPosition.x
        const y = baseY + annotationPosition.y

        return annotationTextWrap.renderSVG(x, y, {
            textProps: {
                ...textProps,
                className: "entity-label__text--muted",
            },
        })
    }

    /**
     * Render an invisible hit area over the info icon for hover interactions.
     * Only rendered when there's a recognized provider suffix with icon.
     */
    private renderIconHitArea(
        baseX: number,
        baseY: number
    ): React.ReactElement | null {
        const {
            suffixPosition,
            singleLineHeight,
            iconSize,
            parsedSuffix,
            shouldShowIcon,
            suffixFontSettings,
        } = this
        // Only show hit area for provider icons
        if (!suffixPosition || !parsedSuffix || !shouldShowIcon) return null

        // Calculate icon position (after the opening text "(WHO ")
        const openingText = `(${parsedSuffix.suffix} `
        const openingWidth = Bounds.forText(
            openingText,
            suffixFontSettings
        ).width
        const x = baseX + suffixPosition.x + openingWidth
        const y = baseY + suffixPosition.y

        const handleMouseEnter = (
            event: React.MouseEvent<SVGRectElement>
        ): void => {
            const rect = event.currentTarget.getBoundingClientRect()
            this.showTooltip(rect.left + rect.width / 2, rect.top)
            this.props.onProviderMouseEnter?.(this.props.entityName)
        }

        const handleMouseLeave = (): void => {
            this.hideTooltip()
            this.props.onProviderMouseLeave?.()
        }

        return (
            <rect
                className="provider-icon-hit-area"
                x={x}
                y={y}
                width={iconSize}
                height={singleLineHeight}
                fill="transparent"
                style={{ pointerEvents: "auto" }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            />
        )
    }

    /**
     * Render just the SVG content (for backwards compatibility with TextWrap pattern).
     * Prefer using EntityLabel as a React component for full tooltip support.
     */
    renderSVG(
        x: number,
        y: number,
        options?: { textProps?: React.SVGProps<SVGTextElement> }
    ): React.ReactElement {
        const showInteraction = this.shouldShowIcon && !this.props.isStatic

        return (
            <g className="entity-label">
                {this.renderMainText(x, y, options?.textProps)}
                {this.renderSuffix(x, y)}
                {this.renderFormattedValue(x, y, options?.textProps)}
                {this.renderAnnotation(x, y, options?.textProps)}
                {showInteraction && this.renderIconHitArea(x, y)}
            </g>
        )
    }

    private renderTooltip(): React.ReactElement | null {
        const { parsedSuffix } = this
        // Only show tooltip for recognized providers
        const provider =
            parsedSuffix?.isProvider && parsedSuffix.suffix in PROVIDER_INFO
                ? PROVIDER_INFO[parsedSuffix.suffix]
                : undefined

        if (!this.tooltipVisible || !provider) return null

        return createPortal(
            <div
                className="provider-info-tooltip-container"
                style={{
                    position: "fixed",
                    left: this.tooltipPosition.x,
                    top: this.tooltipPosition.y,
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

    // For compatibility with TextWrap/MarkdownTextWrap interface
    get fontSize(): number {
        return this.props.fontSize
    }

    override render(): React.ReactElement | null {
        const { x, y, textProps } = this.props

        // If x and y are provided, render as a full component with tooltip
        if (x !== undefined && y !== undefined) {
            return (
                <>
                    {this.renderSVG(x, y, { textProps })}
                    {this.renderTooltip()}
                </>
            )
        }

        // Otherwise, just render the tooltip (SVG is rendered via renderSVG)
        return this.renderTooltip()
    }
}
