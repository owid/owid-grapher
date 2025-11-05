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
    TooltipContainerProps,
} from "./TooltipProps"
import { IconCircledS } from "./TooltipContents.js"

export const DEFAULT_TOOLTIP_FADE_MODE = "delayed"
const TOOLTIP_FADE_DURATION = 400 // $fade-time + $fade-delay in scss

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
    position = new PointVector(0, 0)
    private _target: T | undefined = undefined
    private _timer: number | undefined = undefined
    private _fade: TooltipFadeMode

    constructor({ fade }: { fade?: TooltipFadeMode } = {}) {
        this._fade = fade ?? DEFAULT_TOOLTIP_FADE_MODE
    }

    get target(): T | undefined {
        return this._target
    }

    resetTarget(): void {
        this._target = undefined
        this._timer = undefined
    }

    set target(newTarget: T | null) {
        const result = calculateTooltipTargetWithFade({
            newTarget,
            fade: this._fade,
            timer: this._timer,
            resetTarget: () => this.resetTarget(),
        })
        this._target = result.target
        this._timer = result.timer
    }

    get fading(): TooltipFadeMode | undefined {
        return getTooltipFadeMode({
            timer: this._timer,
            target: this._target,
            fade: this._fade,
        })
    }
}

/**
 * Get the tooltip fade mode based on timer and target state.
 * Returns the fade mode ("delayed"|"immediate") during the timeout after clearing the target,
 * or undefined if not currently fading.
 */
export function getTooltipFadeMode<T>({
    timer,
    target,
    fade,
}: {
    timer: number | undefined
    target: T | undefined
    fade: TooltipFadeMode
}): TooltipFadeMode | undefined {
    return !!timer && !!target ? fade : undefined
}

/**
 * Update the tooltip target with fade handling.
 * Delays clearing the target (and hiding the tooltip) for a bit to prevent
 * flicker when moving between neighboring elements and allow an opacity
 * transition to smoothly fade the tooltip out.
 */
export function calculateTooltipTargetWithFade<T>({
    newTarget,
    fade,
    timer,
    resetTarget,
}: {
    newTarget: T | null
    fade: TooltipFadeMode
    timer: number | undefined
    resetTarget: () => void
}): { target: T | undefined; timer: number | undefined } {
    clearTimeout(timer)

    if (newTarget === null) {
        const speed = { delayed: 1, immediate: 0.5, none: 0 }[fade]
        const timer = window.setTimeout(
            () => resetTarget(),
            speed * TOOLTIP_FADE_DURATION
        )
        return { target: undefined, timer }
    } else {
        return { target: newTarget, timer: undefined }
    }
}

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
