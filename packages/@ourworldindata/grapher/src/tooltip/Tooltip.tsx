import * as React from "react"
import { computed, action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import classnames from "classnames"
import { match } from "ts-pattern"
import {
    Bounds,
    GrapherTooltipAnchor,
    stripOuterParentheses,
} from "@ourworldindata/utils"
import {
    TooltipProps,
    TooltipManager,
    TooltipContainerProps,
    TooltipContext,
    TooltipFooterIcon,
} from "./TooltipProps"
import { SignificanceIcon } from "./TooltipContents.js"

export * from "./TooltipContents.js"
export { TooltipState } from "./TooltipState.js"
import * as R from "remeda"

export class TooltipCard extends React.Component<
    TooltipProps & TooltipContainerProps
> {
    private base = React.createRef<HTMLDivElement>()
    private bounds: Bounds | undefined = undefined

    private updateBounds(): void {
        if (this.base.current) {
            const el = this.base.current
            this.bounds = Bounds.fromProps({
                x: 0,
                y: 0,
                width: el.scrollWidth + 2 * el.clientLeft, // account for left/right border
                height: el.scrollHeight + 2 * el.clientTop, // account for top/bottom border
            })
        }
    }

    private get tooltipStyle(): React.CSSProperties {
        const { bounds } = this
        const {
            containerBounds,
            anchor,
            x = 0,
            y = 0,
            offsetX = 0,
            offsetY = 0,
        } = this.props
        const isPinnedToBottom = anchor === GrapherTooltipAnchor.bottom

        const containerWidth = containerBounds?.width
        const containerHeight = containerBounds?.height

        const tooltipWidth = bounds?.width
        const tooltipHeight = bounds?.height

        const style = { ...this.props.style }

        // if container dimensions are given, we make sure the tooltip
        // is positioned within the container bounds
        if (containerWidth && containerHeight && !isPinnedToBottom) {
            let adjustedOffsetY = offsetY
            let adjustedOffsetX = offsetX

            if (this.props.offsetYDirection === "upward") {
                adjustedOffsetY = -offsetY - (tooltipHeight ?? 0)
            }

            if (
                this.props.offsetXDirection === "left" &&
                x > (tooltipWidth ?? 0)
            ) {
                adjustedOffsetX = -offsetX - (tooltipWidth ?? 0)
            }

            // Ensure tooltip remains inside chart
            let left = x + adjustedOffsetX
            let top = y + adjustedOffsetY
            if (tooltipHeight && tooltipWidth) {
                if (left + tooltipWidth > containerWidth)
                    left -= tooltipWidth + 2 * adjustedOffsetX // flip left
                if (top + tooltipHeight * 0.75 > containerHeight)
                    top -= tooltipHeight + 2 * adjustedOffsetY // flip upwards eventually...

                // Clamp to prevent any overflow
                left = R.clamp(left, {
                    min: 0,
                    max: containerWidth - tooltipWidth,
                })
                top = R.clamp(top, {
                    min: 0,
                    max: containerHeight - tooltipHeight,
                })
            }

            style.position = "absolute"
            style.left = left
            style.top = top

            // Set a max-height to prevent the case where the tooltip contents grow, causing the tooltip to overflow the
            // container briefly until it is rerendered with the updated bounds. The quickly-appearing scrollbar is
            // jarring and causes unneeded, brief content reflows and resize events.
            // The max-height together with overflow: clip prevents the tooltip from overflowing, instead briefly
            // cutting off content until the bounds are updated in the next render.
            style.maxHeight = containerHeight - top
            style.overflow = "clip"
        }

        // ignore the given width and max-width if the tooltip position is fixed
        // since we want to use the full width of the screen in that case
        if (isPinnedToBottom && (style.width || style.maxWidth)) {
            style.width = style.maxWidth = undefined
        }

        return style
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
            anchor,
        } = this.props
        const isPinnedToBottom = anchor === GrapherTooltipAnchor.bottom

        // add a preposition to unit-based subtitles
        const hasHeader = title !== undefined || subtitle !== undefined
        if (!!subtitle && subtitleFormat === "unit") {
            const unit = subtitle.toString()
            const preposition = !unit.match(/^(per|in|\() /i) ? "in " : ""
            subtitle = preposition + stripOuterParentheses(unit)
        }

        // flag the year in the header and add note in footer (if necessary)
        const timeNotice = !!subtitle && subtitleFormat === "notice"

        // style the box differently if just displaying title/subtitle
        const plain = hasHeader && !children

        // skip transition delay if requested
        const immediate = dissolve === "immediate"

        return (
            <TooltipContext.Provider value={{ anchor }}>
                <div
                    className={classnames("tooltip-container", {
                        "fixed-bottom": isPinnedToBottom,
                    })}
                >
                    <div
                        ref={this.base}
                        id={id?.toString()}
                        role="tooltip"
                        className={classnames("Tooltip", {
                            plain,
                            dissolve,
                            immediate,
                        })}
                        style={this.tooltipStyle}
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
                                        {timeNotice && (
                                            <TooltipIcon
                                                icon={TooltipFooterIcon.Notice}
                                            />
                                        )}
                                        <span>{subtitle}</span>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="content-and-endmatter">
                            {children && (
                                <div className="content">{children}</div>
                            )}
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
                                                    TooltipFooterIcon.Significance,
                                                "no-icon":
                                                    icon ===
                                                    TooltipFooterIcon.None,
                                            })}
                                        >
                                            <TooltipIcon icon={icon} />
                                            <p>{text}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </TooltipContext.Provider>
        )
    }
}

interface ManagedTooltipContainerProps extends TooltipContainerProps {
    tooltipManager: TooltipManager
}

@observer
export class TooltipContainer extends React.Component<ManagedTooltipContainerProps> {
    constructor(props: ManagedTooltipContainerProps) {
        super(props)
        makeObservable(this)
    }

    @computed private get tooltip(): TooltipProps | undefined {
        const { tooltip } = this.props.tooltipManager
        return tooltip?.get()
    }

    override render(): React.ReactElement | null {
        const { props, tooltip } = this
        if (!tooltip) return null
        return <TooltipCard {...props} {...tooltip} />
    }
}

interface ManagedTooltipProps extends TooltipProps {
    tooltipManager: TooltipManager
}

@observer
export class Tooltip extends React.Component<ManagedTooltipProps> {
    constructor(props: ManagedTooltipProps) {
        super(props)
        makeObservable(this)
    }

    override componentDidMount(): void {
        this.connectTooltipToContainer()
    }

    @action.bound private connectTooltipToContainer(): void {
        this.props.tooltipManager.tooltip?.set(this.props)
    }

    @action.bound private removeToolTipFromContainer(): void {
        this.props.tooltipManager.tooltip?.set(undefined)
    }

    override componentDidUpdate(): void {
        this.connectTooltipToContainer()
    }

    override componentWillUnmount(): void {
        this.removeToolTipFromContainer()
    }

    override render(): null {
        return null
    }
}

function TooltipIcon({
    icon,
}: {
    icon: TooltipFooterIcon
}): React.ReactElement | null {
    return match(icon)
        .with(TooltipFooterIcon.Notice, () => (
            <FontAwesomeIcon className="icon" icon={faInfoCircle} />
        ))
        .with(TooltipFooterIcon.Stripes, () => (
            <div className="stripes icon"></div>
        ))
        .with(TooltipFooterIcon.Significance, () => (
            <div className="icon">
                <SignificanceIcon />
            </div>
        ))
        .with(TooltipFooterIcon.None, () => null)
        .exhaustive()
}
