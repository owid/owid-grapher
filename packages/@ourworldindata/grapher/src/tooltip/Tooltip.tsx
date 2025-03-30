import * as React from "react"
import classnames from "classnames"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons"
import {
    Bounds,
    PointVector,
    GrapherTooltipAnchor,
} from "@ourworldindata/utils"
import {
    TooltipProps,
    TooltipManager,
    TooltipFadeMode,
    TooltipFooterIcon,
    TooltipContext,
} from "./TooltipProps"
import { IconCircledS } from "./TooltipContents.js"
export * from "./TooltipContents.js"

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

export class TooltipState<T> {
    @observable position = new PointVector(0, 0)
    @observable _target?: T
    @observable _timer?: NodeJS.Timeout
    _fade: TooltipFadeMode

    constructor({ fade }: { fade?: TooltipFadeMode } = {}) {
        // "delayed" mode is good for charts with gaps between targetable areas
        // "immediate" is better if the tooltip is displayed for all points in the chart's bounds
        // "none" disables the fade transition altogether
        this._fade = fade ?? "delayed"
    }

    @computed
    get target(): T | undefined {
        return this._target
    }

    set target(newTarget: T | null) {
        // delay clearing the target (and hiding the tooltip) for a bit to prevent
        // flicker when frobbing between neighboring elements and allow an opacity
        // transition to smoothly fade the tooltip out
        clearTimeout(this._timer)
        if (newTarget === null) {
            const speed = { delayed: 1, immediate: 0.5, none: 0 }[this._fade]
            this._timer = setTimeout(() => {
                this._target = undefined
                this._timer = undefined
            }, speed * TOOLTIP_FADE_DURATION)
        } else {
            this._target = newTarget
            this._timer = undefined
        }
    }

    @computed
    get fading(): TooltipFadeMode | undefined {
        // returns "delayed"|"immediate" during the timeout after clearing the target
        return !!this._timer && !!this._target ? this._fade : undefined
    }
}

@observer
class TooltipCard extends React.Component<
    TooltipProps & {
        bounds?: Bounds
        containerWidth?: number
        containerHeight?: number
    }
> {
    static contextType = TooltipContext

    private base: React.RefObject<HTMLDivElement> = React.createRef()

    @observable.struct private bounds?: Bounds
    @action.bound private updateBounds(): void {
        if (this.base.current)
            this.bounds = Bounds.fromElement(this.base.current)
    }

    componentDidMount(): void {
        this.updateBounds()
    }

    componentDidUpdate(): void {
        this.updateBounds()
    }

    render(): React.ReactElement {
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

        const style = { ...this.props.style }

        // if container dimensions are given, we make sure the tooltip
        // is positioned within the container bounds
        if (this.props.containerWidth && this.props.containerHeight) {
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
                if (left + this.bounds.width > this.props.containerWidth)
                    left -= this.bounds.width + 2 * offsetX // flip left
                if (
                    top + this.bounds.height * 0.75 >
                    this.props.containerHeight
                )
                    top -= this.bounds.height + 2 * offsetY // flip upwards eventually...
                if (top + this.bounds.height > this.props.containerHeight)
                    top = this.props.containerHeight - this.bounds.height // ...but first pin at bottom

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
        const isPinnedToBottom =
            this.context.anchor === GrapherTooltipAnchor.bottom
        if (isPinnedToBottom && (style.width || style.maxWidth)) {
            style.width = style.maxWidth = undefined
        }

        return (
            <div
                ref={this.base}
                id={id?.toString()}
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

@observer
export class TooltipContainer extends React.Component<{
    tooltipProvider: TooltipManager
    anchor?: GrapherTooltipAnchor
    // if container dimensions are given, the tooltip will be positioned within its bounds
    containerWidth?: number
    containerHeight?: number
}> {
    @computed private get tooltip(): TooltipProps | undefined {
        const { tooltip } = this.props.tooltipProvider
        return tooltip?.get()
    }

    @computed private get anchor(): GrapherTooltipAnchor {
        return this.props.anchor ?? GrapherTooltipAnchor.mouse
    }

    @computed private get rendered(): React.ReactElement | null {
        const { tooltip } = this
        if (!tooltip) return null
        const isFixedToBottom = this.anchor === GrapherTooltipAnchor.bottom
        return (
            <TooltipContext.Provider value={{ anchor: this.anchor }}>
                <div
                    className={classnames("tooltip-container", {
                        "fixed-bottom": isFixedToBottom,
                    })}
                >
                    <TooltipCard
                        {...tooltip}
                        containerWidth={this.props.containerWidth}
                        containerHeight={this.props.containerHeight}
                    />
                </div>
            </TooltipContext.Provider>
        )
    }

    render(): React.ReactElement | null {
        return this.rendered
    }
}

@observer
export class Tooltip extends React.Component<TooltipProps> {
    componentDidMount(): void {
        this.connectTooltipToContainer()
    }

    @action.bound private connectTooltipToContainer(): void {
        this.props.tooltipManager.tooltip?.set(this.props)
    }

    @action.bound private removeToolTipFromContainer(): void {
        this.props.tooltipManager.tooltip?.set(undefined)
    }

    componentDidUpdate(): void {
        this.connectTooltipToContainer()
    }

    componentWillUnmount(): void {
        this.removeToolTipFromContainer()
    }

    render(): null {
        return null
    }
}
