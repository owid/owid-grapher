import * as React from "react"
import { computed, action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import classnames from "classnames"
import { Bounds, GrapherTooltipAnchor } from "@ourworldindata/utils"
import {
    TooltipProps,
    TooltipManager,
    TooltipContainerProps,
    TooltipContext,
    TooltipFooterIcon,
} from "./TooltipProps"
import { IconCircledS } from "./TooltipContents.js"

export * from "./TooltipContents.js"
export { TooltipState } from "./TooltipState.js"

export class TooltipCard extends React.Component<
    TooltipProps & TooltipContainerProps
> {
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
        const { bounds } = this
        let {
            id,
            title,
            titleAnnotation,
            subtitle,
            subtitleFormat,
            footer,
            dissolve,
            children,
            containerBounds,
            anchor,
            x = 0,
            y = 0,
            offsetX = 0,
            offsetY = 0,
        } = this.props
        const isPinnedToBottom = anchor === GrapherTooltipAnchor.bottom

        // if container dimensions are given, we make sure the tooltip
        // is positioned within the container bounds
        const style = { ...this.props.style }
        if (
            containerBounds?.width &&
            containerBounds.height &&
            !isPinnedToBottom
        ) {
            if (this.props.offsetYDirection === "upward") {
                offsetY = -offsetY - (bounds?.height ?? 0)
            }

            if (
                this.props.offsetXDirection === "left" &&
                x > (bounds?.width ?? 0)
            ) {
                offsetX = -offsetX - (bounds?.width ?? 0)
            }

            // Ensure tooltip remains inside chart
            let left = x + offsetX
            let top = y + offsetY
            if (bounds) {
                if (left + bounds.width > containerBounds?.width)
                    left -= bounds.width + 2 * offsetX // flip left
                if (top + bounds.height * 0.75 > containerBounds.height)
                    top -= bounds.height + 2 * offsetY // flip upwards eventually...
                if (top + bounds.height > containerBounds.height)
                    top = containerBounds.height - bounds.height // ...but first pin at bottom

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
                                                    TooltipFooterIcon.significance,
                                                "no-icon":
                                                    icon ===
                                                    TooltipFooterIcon.none,
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
