import React from "react"
import classnames from "classnames"
import { CoreColumn } from "@ourworldindata/core-table"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { NO_DATA_LABEL } from "../color/ColorScale.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons"
import { Bounds, PointVector, sum, zip } from "@ourworldindata/utils"
import {
    TooltipProps,
    TooltipManager,
    TooltipTableProps,
    TooltipValueProps,
    TooltipValueRangeProps,
} from "./TooltipProps"

export const NO_DATA_COLOR = "#999"
export const TOOLTIP_FADE_DURATION = 400 // $fade-time + $fade-delay in scss

export class TooltipState<T> {
    @observable position = new PointVector(0, 0)
    @observable _target?: T
    @observable _timer?: NodeJS.Timeout

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
            this._timer = setTimeout(() => {
                this._target = undefined
                this._timer = undefined
            }, TOOLTIP_FADE_DURATION)
        } else {
            this._target = newTarget
            this._timer = undefined
        }
    }

    @computed
    get fading(): boolean {
        // returns true during the timeout after clearing the target
        return !!this._timer && !!this._target
    }
}

export class TooltipValue extends React.Component<TooltipValueProps> {
    render(): JSX.Element | null {
        const { column, value, color, notice } = this.props,
            displayValue =
                (value !== undefined && column.formatValueShort(value)) ||
                NO_DATA_LABEL,
            displayColor =
                displayValue === NO_DATA_LABEL ? NO_DATA_COLOR : color

        return (
            <Variable column={column} color={displayColor} notice={notice}>
                {displayValue}
            </Variable>
        )
    }
}

export class TooltipValueRange extends React.Component<TooltipValueRangeProps> {
    ARROW_PATHS = {
        up: "m14,0H5c-.552,0-1,.448-1,1s.448,1,1,1h6.586L.29303,13.29297l1.41394,1.414L13,3.41394v6.58606c0,.552.448,1,1,1s1-.448,1-1V1c0-.552-.448-1-1-1Z",
        down: "m14,4c-.552,0-1,.448-1,1v6.586L1.56049.14648.14655,1.56042l11.43958,11.43958h-6.58612c-.552,0-1,.448-1,1s.448,1,1,1h9c.552,0,1-.448,1-1V5c0-.552-.448-1-1-1Z",
        right: "m19.59198,6.82422L13.22803.46021c-.39105-.39099-1.02405-.39099-1.414,0-.39105.39001-.39105,1.02405,0,1.414l4.65698,4.65704H.5v2h15.97101l-4.65698,4.65698c-.39105.39001-.39105,1.02399,0,1.414.38995.39099,1.02295.39099,1.414,0l6.36395-6.36401c.39001-.39001.39001-1.02399,0-1.414Z",
    }

    arrowIcon(direction: "up" | "right" | "down"): JSX.Element {
        return (
            <svg
                className={classnames("arrow", direction)}
                xmlns="http://www.w3.org/2000/svg"
                viewBox={`0 0 ${direction == "right" ? 20 : 15} 15`}
            >
                <path d={this.ARROW_PATHS[direction]} />
            </svg>
        )
    }

    render(): JSX.Element | null {
        const { column, values, color, notice } = this.props,
            [firstValue, lastValue] = values.map((v) =>
                column.formatValueShort(v)
            ),
            [firstTerm, lastTerm] =
                // TODO: would be nicer to actually measure the typeset text
                sum([firstValue?.length, lastValue?.length]) > 20
                    ? values.map((v) =>
                          column.formatValueShortWithAbbreviations(v)
                      )
                    : [firstValue, lastValue],
            trend =
                values.length < 2
                    ? null
                    : values[0] < values[1]
                    ? this.arrowIcon("up")
                    : values[0] > values[1]
                    ? this.arrowIcon("down")
                    : this.arrowIcon("right")

        return (
            <Variable column={column} color={color} notice={notice}>
                <span className="range">
                    {firstTerm} {trend} {lastTerm}
                </span>
            </Variable>
        )
    }
}

class Variable extends React.Component<{
    column: CoreColumn
    color?: string
    notice?: number | string
    children?: React.ReactNode
}> {
    render(): JSX.Element | null {
        const { column, children, color, notice } = this.props
        if (column.isMissing || column.name == "time") return null

        const { displayName, unit, shortUnit } = column,
            displayUnit =
                unit && displayName != unit && unit != shortUnit
                    ? unit.replace(/(^\(|\)$)/g, "")
                    : null,
            noticeSpan = notice && (
                <span className="notice">
                    <FontAwesomeIcon icon={faInfoCircle} />
                    {notice}
                </span>
            )
        return (
            <div className="variable">
                <div className="definition">
                    <b>{displayName}</b>
                    {displayUnit && <em> ({displayUnit})</em>}
                </div>
                <div className="values" style={{ color }}>
                    {children}
                    {noticeSpan}
                </div>
            </div>
        )
    }
}

export class TooltipTable extends React.Component<TooltipTableProps> {
    render(): JSX.Element | null {
        const { columns, totals, rows } = this.props,
            focal = rows.some((row) => row.focused),
            swatched = rows.some((row) => row.swatch),
            format = { trailingZeroes: true, ...this.props.format },
            tooEmpty =
                rows.length < 2 ||
                totals?.every((value) => value === undefined) ||
                rows.some(({ values }) =>
                    values.every((value) => value === undefined)
                ),
            tooTrivial = zip(columns, totals ?? []).every(
                ([column, total]) =>
                    !!column?.formatValueShort(total).match(/^100(\.0+)?%/)
            )

        return (
            <table className={classnames({ focal, swatched })}>
                {columns.length > 1 && (
                    <thead>
                        <tr>
                            <td className="series-color"></td>
                            <td className="series-name"></td>
                            {columns.map((column) => (
                                <td className="series-value" key={column.slug}>
                                    {column.displayName}
                                </td>
                            ))}
                        </tr>
                    </thead>
                )}
                <tbody>
                    {rows.map((row) => {
                        const {
                            name,
                            focused,
                            blurred,
                            annotation,
                            values,
                            notice,
                            swatch = "transparent",
                        } = row
                        const [_m, seriesName, seriesParenthetical] =
                            name.match(/^(.*?)(\(.*)?$/) ?? []

                        return (
                            <tr
                                key={name}
                                className={classnames({ focused, blurred })}
                            >
                                <td className="series-color">
                                    <div
                                        className="swatch"
                                        style={{ backgroundColor: swatch }}
                                    />
                                </td>
                                <td className="series-name">
                                    {seriesName}
                                    {seriesParenthetical && (
                                        <span className="parenthetical">
                                            {seriesParenthetical}
                                        </span>
                                    )}
                                    {annotation && (
                                        <span className="annotation">
                                            {annotation}
                                        </span>
                                    )}
                                </td>
                                {zip(columns, values).map(([column, value]) => {
                                    const missing = value === undefined
                                    return column ? (
                                        <td
                                            key={column.slug}
                                            className={classnames(
                                                "series-value",
                                                { missing }
                                            )}
                                        >
                                            {!missing &&
                                                column.formatValueShort(
                                                    value,
                                                    format
                                                )}
                                        </td>
                                    ) : null
                                })}
                                {notice && (
                                    <td className="notice">
                                        <FontAwesomeIcon icon={faInfoCircle} />{" "}
                                        {notice}
                                    </td>
                                )}
                            </tr>
                        )
                    })}
                    {totals && !(tooEmpty || tooTrivial) && (
                        <>
                            <tr className="spacer"></tr>
                            <tr className="total">
                                <td className="series-color"></td>
                                <td className="series-name">Total</td>
                                {zip(columns, totals).map(([column, total]) => (
                                    <td
                                        key={column?.slug}
                                        className="series-value"
                                    >
                                        {column && total !== undefined
                                            ? column.formatValueShort(
                                                  total,
                                                  format
                                              )
                                            : null}
                                    </td>
                                ))}
                            </tr>
                        </>
                    )}
                </tbody>
            </table>
        )
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

    render(): JSX.Element {
        let {
            title,
            subtitle,
            subtitleFormat,
            footer,
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
        let x = this.props.x + offsetX
        let y = this.props.y + offsetY
        if (this.bounds) {
            if (x + this.bounds.width > this.props.containerWidth)
                x -= this.bounds.width + 2 * offsetX
            if (y + this.bounds.height > this.props.containerHeight)
                y -= this.bounds.height + 2 * offsetY
            if (x < 0) x = 0
            if (y < 0) y = 0
        }

        // add a preposition to unit-based subtitles
        const hasHeader = title !== undefined || subtitle !== undefined
        if (!!subtitle && subtitleFormat == "unit") {
            const unit = subtitle.toString()
            const preposition = !unit.match(/^(per|in|\() /i) ? "in " : ""
            subtitle = preposition + unit.replace(/(^\(|\)$)/g, "")
        }
        const notice = !!subtitle && subtitleFormat == "notice"

        // style the box differently if just displaying title/subtitle
        const plain = hasHeader && !children

        return (
            <div
                ref={this.base}
                className={classnames("Tooltip", { plain, dissolve })}
                style={{
                    left: `${x}px`,
                    top: `${y}px`,
                    ...this.props.style,
                }}
            >
                {hasHeader && (
                    <header>
                        {title && <h1>{title}</h1>}
                        {subtitle && (
                            <h2>
                                {notice && (
                                    <FontAwesomeIcon icon={faInfoCircle} />
                                )}
                                {subtitle}
                            </h2>
                        )}
                    </header>
                )}
                {children && <section>{children}</section>}
                {footer && (
                    <footer>
                        <FontAwesomeIcon icon={faInfoCircle} />
                        <p>{footer}</p>
                    </footer>
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
    @computed private get rendered(): JSX.Element | null {
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

    render(): JSX.Element | null {
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
