import * as React from "react"
import { createPortal } from "react-dom"
import { computed, action, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { FontFamily } from "@ourworldindata/utils"
import {
    IRToken,
    IRText,
    IRFontParams,
    convertMarkdownToIRTokens,
    splitIntoLines,
    getLineWidth,
    combineTokensWithWrapBehavior,
} from "../MarkdownTextWrap/MarkdownTextWrap.js"
import {
    parseProviderFromEntityName,
    PROVIDER_INFO,
    type ParsedProvider,
} from "./ProviderInfo.js"

const INFO_ICON_SIZE_FACTOR = 0.9 // Relative to font size
const HEIGHT_CORRECTION_FACTOR = 0.74 // Magic number from MarkdownTextWrap

/**
 * Icon placeholder token - takes up space in text layout but renders nothing.
 * The actual icon is rendered separately by EntityLabel.
 */
class IRIcon implements IRToken {
    readonly type = "icon" as const

    constructor(
        public iconWidth: number,
        public id: string = "icon"
    ) {}

    get width(): number {
        return this.iconWidth
    }

    getBreakpointBefore(): undefined {
        return undefined
    }

    toSVG(key?: React.Key): React.ReactElement {
        return <React.Fragment key={key} />
    }

    toHTML(key?: React.Key): React.ReactElement {
        return (
            <span
                key={key}
                style={{ display: "inline-block", width: this.iconWidth }}
            />
        )
    }

    toPlaintext(): string {
        return ""
    }
}

function isIRIcon(token: IRToken): token is IRIcon {
    return (token as IRIcon).type === "icon"
}

/**
 * Muted text token - renders with reduced opacity for secondary information.
 * Used for provider suffixes like "(WHO)".
 */
class IRMutedText extends IRText {
    readonly type = "muted" as const
}

function isIRMutedText(token: IRToken): token is IRMutedText {
    return (token as IRMutedText).type === "muted"
}

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

interface ProviderSuffixBounds {
    lineIndex: number
    x: number
    width: number
}

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

    @computed private get fontParams(): IRFontParams {
        return {
            fontSize: this.props.fontSize,
            fontWeight: this.props.fontWeight,
            fontFamily: this.props.fontFamily,
        }
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

    @computed private get tokens(): IRToken[] {
        const { entityName, maxWidth } = this.props

        if (!this.shouldShowIcon || !this.parsedProvider) {
            return convertMarkdownToIRTokens(entityName, this.fontParams)
        }

        // Split into main text and provider suffix, combine with avoid-wrap
        // so "(WHO ⓘ)" stays together on one line
        const { mainName, providerCode } = this.parsedProvider

        const mainTokens = convertMarkdownToIRTokens(mainName, this.fontParams)
        const providerTokens = this.createProviderTokens(providerCode)

        return combineTokensWithWrapBehavior(
            mainTokens,
            providerTokens,
            maxWidth,
            "avoid-wrap",
            this.fontParams
        )
    }

    /**
     * Create tokens for the provider suffix: "(WHO ⓘ)"
     * These tokens have no breakpoints, keeping them together.
     */
    private createProviderTokens(providerCode: string): IRToken[] {
        return [
            new IRMutedText(`(${providerCode} `, this.fontParams),
            new IRIcon(this.iconSize, "provider-info"),
            new IRMutedText(")", this.fontParams),
        ]
    }

    @computed get lines(): IRToken[][] {
        return splitIntoLines(this.tokens, this.props.maxWidth)
    }

    @computed get width(): number {
        const lineWidths = this.lines.map(getLineWidth)
        return Math.max(...lineWidths, 0)
    }

    @computed get height(): number {
        return this.lines.length * this.singleLineHeight
    }

    /**
     * Find the bounds of the provider suffix "(WHO ⓘ)" within the laid-out lines.
     * The suffix includes all muted text tokens and the icon token.
     */
    @computed private get providerSuffixBounds():
        | ProviderSuffixBounds
        | undefined {
        if (!this.shouldShowIcon) return undefined

        for (let lineIndex = 0; lineIndex < this.lines.length; lineIndex++) {
            let offsetX = 0
            let suffixStartX: number | undefined
            let suffixWidth = 0

            for (const token of this.lines[lineIndex]) {
                const isSuffixToken = isIRMutedText(token) || isIRIcon(token)

                if (isSuffixToken) {
                    if (suffixStartX === undefined) {
                        suffixStartX = offsetX
                    }
                    suffixWidth += token.width
                }

                offsetX += token.width
            }

            if (suffixStartX !== undefined) {
                return { lineIndex, x: suffixStartX, width: suffixWidth }
            }
        }
        return undefined
    }

    /**
     * Find the position of the icon token within the laid-out lines.
     */
    @computed private get iconPosition():
        | { lineIndex: number; x: number }
        | undefined {
        if (!this.shouldShowIcon) return undefined

        for (let lineIndex = 0; lineIndex < this.lines.length; lineIndex++) {
            let offsetX = 0
            for (const token of this.lines[lineIndex]) {
                if (isIRIcon(token)) {
                    return { lineIndex, x: offsetX }
                }
                offsetX += token.width
            }
        }
        return undefined
    }

    private renderTextLines(
        x: number,
        y: number,
        textProps?: React.SVGProps<SVGTextElement>
    ): React.ReactElement {
        const { lines, singleLineHeight, fontParams } = this

        const yOffset = y + this.props.fontSize * HEIGHT_CORRECTION_FACTOR

        return (
            <text
                x={x.toFixed(1)}
                y={yOffset.toFixed(1)}
                fontSize={fontParams.fontSize}
                fontWeight={fontParams.fontWeight}
                {...textProps}
            >
                {lines.map((line, lineIndex) => {
                    let offsetX = 0
                    const lineY = yOffset + singleLineHeight * lineIndex
                    return line.map((token, tokenIndex) => {
                        const tokenX = x + offsetX
                        offsetX += token.width
                        // Skip icon tokens - rendered separately
                        if (isIRIcon(token)) return null
                        const isMuted = isIRMutedText(token)
                        return (
                            <tspan
                                key={`${lineIndex}-${tokenIndex}`}
                                x={tokenX.toFixed(1)}
                                y={lineY.toFixed(1)}
                                className={
                                    isMuted
                                        ? "entity-label__text--muted"
                                        : undefined
                                }
                            >
                                {token.toPlaintext()}
                            </tspan>
                        )
                    })
                })}
            </text>
        )
    }

    private renderIcon(
        baseX: number,
        baseY: number
    ): React.ReactElement | null {
        const { iconPosition, iconSize, singleLineHeight, parsedProvider } =
            this
        if (!iconPosition || !parsedProvider) return null

        const x = baseX + iconPosition.x
        const y = baseY + iconPosition.lineIndex * singleLineHeight
        // Align icon with text x-height (shift up from center)
        // TODO: should not be hard-coded
        const iconY = (singleLineHeight - iconSize) / 2 - iconSize * 0.2

        return (
            <g
                className="provider-info-icon"
                transform={`translate(${x}, ${y})`}
            >
                {/* Font Awesome info circle icon - viewBox cropped to visible content */}
                <svg
                    x={0}
                    y={iconY}
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
        )
    }

    /**
     * Render an invisible hit area over the provider suffix for hover interactions.
     */
    private renderProviderSuffixHitArea(
        baseX: number,
        baseY: number
    ): React.ReactElement | null {
        const { providerSuffixBounds, singleLineHeight } = this
        if (!providerSuffixBounds) return null

        const x = baseX + providerSuffixBounds.x
        const y = baseY + providerSuffixBounds.lineIndex * singleLineHeight

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
                width={providerSuffixBounds.width}
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
                {this.renderTextLines(x, y, options?.textProps)}
                {this.renderIcon(x, y)}
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
