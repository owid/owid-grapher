import * as React from "react"
import { createPortal } from "react-dom"
import { computed, action, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { Bounds, FontFamily } from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"
import {
    parseProviderFromEntityName,
    PROVIDER_INFO,
    type ParsedProvider,
} from "./ProviderInfo.js"

const INFO_ICON_SIZE_FACTOR = 0.9 // Relative to font size
const HEIGHT_CORRECTION_FACTOR = 0.74 // Magic number from TextWrap

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
 * EntityLabel renders an entity name with optional provider info icon and tooltip.
 *
 * For entity names with recognized provider suffixes like "Africa (WHO)", it:
 * - Displays the provider suffix in muted (gray) text
 * - Shows an info icon that reveals provider details on hover
 * - Uses avoid-wrap behavior to keep the suffix on one line when possible
 *
 * This implementation uses TextWrap for the main entity name and manually
 * positions the provider suffix as separate SVG elements, avoiding tight
 * coupling with MarkdownTextWrap internals.
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

    @computed private get parsedProvider(): ParsedProvider | undefined {
        return parseProviderFromEntityName(this.props.entityName)
    }

    @computed private get shouldShowIcon(): boolean {
        return !!(this.props.showProviderIcon && this.parsedProvider)
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

    /**
     * Calculate the width of the provider suffix "(WHO ⓘ)" using Bounds.forText
     */
    @computed private get suffixWidth(): number {
        if (!this.parsedProvider) return 0

        const textWidth = Bounds.forText(
            `(${this.parsedProvider.providerCode} `,
            this.fontSettings
        ).width
        const closingWidth = Bounds.forText(")", this.fontSettings).width

        return textWidth + this.iconSize + closingWidth
    }

    /**
     * Determine the maxWidth for the main text TextWrap.
     * If the suffix won't fit on the same line as the last word,
     * reduce the maxWidth so the suffix gets its own line.
     */
    @computed private get mainTextMaxWidth(): number {
        if (!this.shouldShowIcon) return this.props.maxWidth

        const { maxWidth } = this.props
        const suffixWithSpace =
            this.suffixWidth + Bounds.forText(" ", this.fontSettings).width

        // First, try to see if the full text (name + suffix) fits on one line
        const fullTextWidth =
            Bounds.forText(this.parsedProvider!.mainName, this.fontSettings)
                .width + suffixWithSpace

        if (fullTextWidth <= maxWidth) {
            // Everything fits on one line, use full width
            return maxWidth
        }

        // Otherwise, reduce maxWidth so suffix has room on the last line
        // This implements "avoid-wrap" behavior
        return Math.max(maxWidth - suffixWithSpace, maxWidth * 0.5)
    }

    @computed private get mainTextWrap(): TextWrap {
        const text = this.shouldShowIcon
            ? this.parsedProvider!.mainName
            : this.props.entityName

        return new TextWrap({
            text,
            maxWidth: this.mainTextMaxWidth,
            fontSize: this.props.fontSize,
            fontWeight: this.props.fontWeight,
            fontFamily: this.props.fontFamily,
            lineHeight: this.lineHeight,
        })
    }

    @computed get width(): number {
        if (!this.shouldShowIcon) {
            return this.mainTextWrap.width
        }

        // Width is the max of all lines
        // If suffix is on the last line, add its width to that line
        const mainWidth = this.mainTextWrap.width
        const lastLineWidth = this.mainTextWrap.lastLineWidth
        const suffixOnLastLine = lastLineWidth + this.suffixWidth

        return Math.max(mainWidth, suffixOnLastLine)
    }

    @computed get height(): number {
        return this.mainTextWrap.height
    }

    /**
     * Get the position where the suffix should be rendered (after the last line of text)
     */
    @computed private get suffixPosition():
        | { x: number; y: number }
        | undefined {
        if (!this.shouldShowIcon) return undefined

        const lastLineIndex = this.mainTextWrap.lineCount - 1
        return {
            x: this.mainTextWrap.lastLineWidth,
            y: lastLineIndex * this.singleLineHeight,
        }
    }

    private renderMainText(
        x: number,
        y: number,
        textProps?: React.SVGProps<SVGTextElement>
    ): React.ReactElement {
        return this.mainTextWrap.renderSVG(x, y, { textProps })
    }

    private renderProviderSuffix(
        baseX: number,
        baseY: number
    ): React.ReactElement | null {
        const {
            suffixPosition,
            parsedProvider,
            singleLineHeight,
            iconSize,
            fontSettings,
        } = this
        if (!suffixPosition || !parsedProvider) return null

        const x = baseX + suffixPosition.x
        const yOffset = baseY + this.props.fontSize * HEIGHT_CORRECTION_FACTOR
        const lineY = yOffset + suffixPosition.y

        // Measure individual parts for positioning
        const openingText = `(${parsedProvider.providerCode} `
        const openingWidth = Bounds.forText(openingText, fontSettings).width

        // Icon vertical positioning - align with text x-height
        const iconY =
            suffixPosition.y +
            (singleLineHeight - iconSize) / 2 -
            iconSize * 0.2

        return (
            <g className="entity-label__suffix">
                {/* Opening text "(WHO " */}
                <text
                    x={x}
                    y={lineY}
                    fontSize={fontSettings.fontSize}
                    fontWeight={fontSettings.fontWeight}
                    className="entity-label__text--muted"
                >
                    {openingText}
                </text>

                {/* Info icon */}
                <g
                    className="provider-info-icon"
                    transform={`translate(${x + openingWidth}, ${baseY + iconY})`}
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

                {/* Closing ")" */}
                <text
                    x={x + openingWidth + iconSize}
                    y={lineY}
                    fontSize={fontSettings.fontSize}
                    fontWeight={fontSettings.fontWeight}
                    className="entity-label__text--muted"
                >
                    )
                </text>
            </g>
        )
    }

    /**
     * Render an invisible hit area over the provider suffix for hover interactions.
     */
    private renderProviderSuffixHitArea(
        baseX: number,
        baseY: number
    ): React.ReactElement | null {
        const { suffixPosition, singleLineHeight, suffixWidth } = this
        if (!suffixPosition) return null

        const x = baseX + suffixPosition.x
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
                className="provider-suffix-hit-area"
                x={x}
                y={y}
                width={suffixWidth}
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
        const { parsedProvider } = this
        const showInteraction = parsedProvider && !this.props.isStatic

        return (
            <g className="entity-label">
                {this.renderMainText(x, y, options?.textProps)}
                {this.renderProviderSuffix(x, y)}
                {showInteraction && this.renderProviderSuffixHitArea(x, y)}
            </g>
        )
    }

    private renderTooltip(): React.ReactElement | null {
        const { parsedProvider } = this
        const provider = parsedProvider
            ? PROVIDER_INFO[parsedProvider.providerCode]
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
