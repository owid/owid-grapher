import * as React from "react"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons"
import {
    Bounds,
    PointVector,
    GrapherTooltipAnchor,
} from "@ourworldindata/utils"
import {
    TooltipProps,
    TooltipFadeMode,
    TooltipFooterIcon,
    TooltipContext,
    TooltipContextProps,
    TooltipContainerCoreProps,
} from "./TooltipProps"
import { IconCircledS } from "./TooltipContents.js"

export const TOOLTIP_FADE_DURATION = 400 // $fade-time + $fade-delay in scss
const TOOLTIP_ICON: Record<TooltipFooterIcon, React.ReactElement | null> = {
    notice: <FontAwesomeIcon className="icon" icon={faInfoCircle} />,
    stripes: <div className="stripes icon"></div>,
    significance: (
        <div className="icon">
            <IconCircledS />
        </div>
    ),
    none: null,
}

// Non-MobX tooltip state management
export class TooltipStateCore<T> {
    position = new PointVector(0, 0)
    private _target: T | undefined = undefined
    private _timer: number | undefined = undefined
    private _fade: TooltipFadeMode

    constructor({ fade }: { fade?: TooltipFadeMode } = {}) {
        // "delayed" mode is good for charts with gaps between targetable areas
        // "immediate" is better if the tooltip is displayed for all points in the chart's bounds
        // "none" disables the fade transition altogether
        this._fade = fade ?? "delayed"
    }

    get target(): T | undefined {
        return this._target
    }

    resetTarget(): void {
        this._target = undefined
        this._timer = undefined
    }

    set target(newTarget: T | null) {
        // delay clearing the target (and hiding the tooltip) for a bit to prevent
        // flicker when frobbing between neighboring elements and allow an opacity
        // transition to smoothly fade the tooltip out
        clearTimeout(this._timer)

        if (newTarget === null) {
            const speed = { delayed: 1, immediate: 0.5, none: 0 }[this._fade]
            this._timer = window.setTimeout(
                () => this.resetTarget(),
                speed * TOOLTIP_FADE_DURATION
            )
        } else {
            this._target = newTarget
            this._timer = undefined
        }
    }

    get fading(): TooltipFadeMode | undefined {
        // returns "delayed"|"immediate" during the timeout after clearing the target
        return !!this._timer && !!this._target ? this._fade : undefined
    }
}

// Core tooltip card component without MobX
export type TooltipCardCoreProps = TooltipProps

export class TooltipCardCore extends React.Component<TooltipCardCoreProps> {
    static override contextType = TooltipContext
    declare context: React.ContextType<typeof TooltipContext>

    private base = React.createRef<HTMLDivElement>()
    private bounds: Bounds | undefined = undefined

    private updateBounds(): void {
        if (this.base.current) {
            this.bounds = Bounds.fromElement(this.base.current)
        }
    }

    override componentDidMount(): void {
        this.updateBounds()
    }

    override componentDidUpdate(): void {
        this.updateBounds()
    }

    override render(): React.ReactElement {
        let {
            id,
            title,
            titleAnnotation,
            subtitle,
            subtitleFormat,
            footer,
            dissolve,
            children,
            x = 0,
            y = 0,
            offsetX = 0,
            offsetY = 0,
        } = this.props
        const {
            containerDimensions: {
                width: containerWidth,
                height: containerHeight,
            } = {},
            anchor,
        } = this.context

        const isPinnedToBottom = anchor === GrapherTooltipAnchor.Bottom

        // if container dimensions are given, we make sure the tooltip
        // is positioned within the container bounds
        const style = { ...this.props.style }
        if (containerWidth && containerHeight && !isPinnedToBottom) {
            if (this.props.offsetYDirection === "upward") {
                offsetY = -offsetY - (this.bounds?.height ?? 0)
            }

            if (
                this.props.offsetXDirection === "left" &&
                x > (this.bounds?.width ?? 0)
            ) {
                offsetX = -offsetX - (this.bounds?.width ?? 0)
            }

            // Ensure tooltip remains inside chart
            let left = x + offsetX
            let top = y + offsetY
            if (this.bounds) {
                if (left + this.bounds.width > containerWidth)
                    left -= this.bounds.width + 2 * offsetX // flip left
                if (top + this.bounds.height * 0.75 > containerHeight)
                    top -= this.bounds.height + 2 * offsetY // flip upwards eventually...
                if (top + this.bounds.height > containerHeight)
                    top = containerHeight - this.bounds.height // ...but first pin at bottom

                if (left < 0) left = 0 // pin on left
                if (top < 0) top = 0 // pin at top
            }

            style.position = "absolute"
            style.left = left
            style.top = top
        }

        // add a preposition to unit-based subtitles
        const hasHeader = title !== undefined || subtitle !== undefined
        if (!!subtitle && subtitleFormat === "unit") {
            const unit = subtitle.toString()
            const preposition = !unit.match(/^(per|in|\() /i) ? "in " : ""
            subtitle = preposition + unit.replace(/(^\(|\)$)/g, "")
        }

        // flag the year in the header and add note in footer (if necessary)
        const timeNotice = !!subtitle && subtitleFormat === "notice"

        // style the box differently if just displaying title/subtitle
        const plain = hasHeader && !children

        // skip transition delay if requested
        const immediate = dissolve === "immediate"

        // ignore the given width and max-width if the tooltip position is fixed
        // since we want to use the full width of the screen in that case
        if (isPinnedToBottom && (style.width || style.maxWidth)) {
            style.width = style.maxWidth = undefined
        }

        return (
            <div
                ref={this.base}
                id={id?.toString()}
                role="tooltip"
                className={classnames("Tooltip", {
                    plain,
                    dissolve,
                    immediate,
                })}
                style={style}
            >
                {hasHeader && (
                    <div className="frontmatter">
                        {title && (
                            <div className="title">
                                {title}{" "}
                                <span className="annotation">
                                    {titleAnnotation}
                                </span>
                            </div>
                        )}
                        {subtitle && (
                            <div className="subtitle">
                                {timeNotice && TOOLTIP_ICON.notice}
                                <span>{subtitle}</span>
                            </div>
                        )}
                    </div>
                )}
                <div className="content-and-endmatter">
                    {children && <div className="content">{children}</div>}
                    {footer && footer.length > 0 && (
                        <div
                            className={classnames("endmatter", {
                                "multiple-lines": footer.length > 1,
                            })}
                        >
                            {footer?.map(({ icon, text }) => (
                                <div
                                    key={text}
                                    className={classnames("line", {
                                        "icon-sig":
                                            icon ===
                                            TooltipFooterIcon.significance,
                                        "no-icon":
                                            icon === TooltipFooterIcon.none,
                                    })}
                                >
                                    {TOOLTIP_ICON[icon]}
                                    <p>{text}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )
    }
}

export class TooltipContainerCore extends React.Component<TooltipContainerCoreProps> {
    override render(): React.ReactElement | null {
        const tooltip = this.props.tooltipProvider.tooltip
        if (!tooltip) return null

        const isFixedToBottom =
            this.props.anchor === GrapherTooltipAnchor.Bottom
        const className = classnames("tooltip-container", {
            "fixed-bottom": isFixedToBottom,
        })

        const context = {
            containerDimensions: this.props.containerDimensions,
            anchor: this.props.anchor,
        }

        return (
            <TooltipContext.Provider value={context}>
                <div className={className}>
                    <TooltipCardCore {...tooltip} />
                </div>
            </TooltipContext.Provider>
        )
    }
}

export type TooltipCoreProps = TooltipProps &
    Omit<TooltipContainerCoreProps, "tooltipProvider">

export class TooltipCore extends React.Component<TooltipCoreProps> {
    override render(): React.ReactElement | null {
        const { containerDimensions, anchor, ...tooltipProps } = this.props

        const tooltipProvider = { tooltip: tooltipProps }

        return (
            <TooltipContainerCore
                tooltipProvider={tooltipProvider}
                containerDimensions={containerDimensions}
                anchor={anchor}
            />
        )
    }
}
