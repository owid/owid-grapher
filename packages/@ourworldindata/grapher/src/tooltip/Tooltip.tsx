import React from "react"
import classnames from "classnames"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons"
import { Bounds, PointVector } from "@ourworldindata/utils"
import { TooltipProps, TooltipManager, TooltipFadeMode } from "./TooltipProps"
export * from "./TooltipContents.js"

export const TOOLTIP_FADE_DURATION = 400 // $fade-time + $fade-delay in scss
const TOOLTIP_ICON = {
    notice: <FontAwesomeIcon className="icon" icon={faInfoCircle} />,
    stripes: <div className="stripes icon"></div>,
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
        containerWidth: number
        containerHeight: number
        bounds?: Bounds
    }
> {
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
            subtitle,
            subtitleFormat,
            footer,
            footerFormat,
            dissolve,
            children,
            offsetX = 0,
            offsetY = 0,
        } = this.props

        if (this.props.offsetYDirection === "upward") {
            offsetY = -offsetY - (this.bounds?.height ?? 0)
        }

        if (
            this.props.offsetXDirection === "left" &&
            this.props.x > (this.bounds?.width ?? 0)
        ) {
            offsetX = -offsetX - (this.bounds?.width ?? 0)
        }

        // Ensure tooltip remains inside chart
        let left = this.props.x + offsetX
        let top = this.props.y + offsetY
        if (this.bounds) {
            if (left + this.bounds.width > this.props.containerWidth)
                left -= this.bounds.width + 2 * offsetX // flip left
            if (top + this.bounds.height * 0.75 > this.props.containerHeight)
                top -= this.bounds.height + 2 * offsetY // flip upwards eventually...
            if (top + this.bounds.height > this.props.containerHeight)
                top = this.props.containerHeight - this.bounds.height // ...but first pin at bottom

            if (left < 0) left = 0 // pin on left
            if (top < 0) top = 0 // pin at top
        }
        const style = { left, top, ...this.props.style }

        // add a preposition to unit-based subtitles
        const hasHeader = title !== undefined || subtitle !== undefined
        if (!!subtitle && subtitleFormat === "unit") {
            const unit = subtitle.toString()
            const preposition = !unit.match(/^(per|in|\() /i) ? "in " : ""
            subtitle = preposition + unit.replace(/(^\(|\)$)/g, "")
        }

        // flag the year in the header and add note in footer (if necessary)
        const timeNotice = !!subtitle && subtitleFormat === "notice"
        const tolerance = footerFormat === "notice"

        // style the box differently if just displaying title/subtitle
        const plain = hasHeader && !children

        // skip transition delay if requested
        const immediate = dissolve === "immediate"

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
                        {title && <div className="title">{title}</div>}
                        {subtitle && (
                            <div className="subtitle">
                                {timeNotice && TOOLTIP_ICON.notice}
                                <span>{subtitle}</span>
                            </div>
                        )}
                    </div>
                )}
                {children && <div className="content">{children}</div>}
                {footer && (
                    <div className="endmatter">
                        {footerFormat && TOOLTIP_ICON[footerFormat]}
                        <p className={classnames({ tolerance })}>{footer}</p>
                    </div>
                )}
            </div>
        )
    }
}

@observer
export class TooltipContainer extends React.Component<{
    tooltipProvider: TooltipManager
    containerWidth: number
    containerHeight: number
}> {
    @computed private get rendered(): React.ReactElement | null {
        const tooltipsMap = this.props.tooltipProvider.tooltips
        if (!tooltipsMap) return null
        const tooltips = Object.entries(tooltipsMap.toJSON())
        return (
            <div className="tooltip-container">
                {tooltips.map(([id, tooltip]) => (
                    <TooltipCard
                        {...tooltip}
                        key={id}
                        containerWidth={this.props.containerWidth}
                        containerHeight={this.props.containerHeight}
                    />
                ))}
            </div>
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
        this.props.tooltipManager.tooltips?.set(this.props.id, this.props)
    }

    @action.bound private removeToolTipFromContainer(): void {
        this.props.tooltipManager.tooltips?.delete(this.props.id)
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
