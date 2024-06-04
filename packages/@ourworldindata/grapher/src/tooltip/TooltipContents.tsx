import React from "react"
import classnames from "classnames"
import { CoreColumn } from "@ourworldindata/core-table"
import { NO_DATA_LABEL } from "../color/ColorScale.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons"
import {
    sum,
    zip,
    uniq,
    isNumber,
    GrapherTooltipAnchor,
} from "@ourworldindata/utils"
import {
    TooltipTableProps,
    TooltipValueProps,
    TooltipValueRangeProps,
    TooltipContext,
} from "./TooltipProps"

export const NO_DATA_COLOR = "#999"

export class TooltipValue extends React.Component<TooltipValueProps> {
    render(): React.ReactElement | null {
        const { column, value, color, notice } = this.props,
            displayValue = isNumber(value)
                ? column.formatValueShort(value)
                : value ?? NO_DATA_LABEL,
            displayColor =
                displayValue === NO_DATA_LABEL ? NO_DATA_COLOR : color

        return (
            <Variable
                column={column}
                color={displayColor}
                notice={notice ? [notice] : undefined}
            >
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

    arrowIcon(direction: "up" | "right" | "down"): React.ReactElement {
        return (
            <svg
                className={classnames("arrow", direction)}
                xmlns="http://www.w3.org/2000/svg"
                viewBox={`0 0 ${direction === "right" ? 20 : 15} 15`}
            >
                <path d={this.ARROW_PATHS[direction]} />
            </svg>
        )
    }

    render(): React.ReactElement | null {
        const { column, values, color, notice } = this.props,
            [firstValue, lastValue] = values.map((v) =>
                column.formatValueShort(v)
            ),
            [firstTerm, lastTerm] =
                // TODO: would be nicer to actually measure the typeset text but we would need to
                // add Lato's metrics to the `string-pixel-width` module to use Bounds.forText
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

        return values.length ? (
            <Variable column={column} color={color} notice={notice}>
                <span className="range">
                    <span className="term">{firstTerm}</span>
                    {trend}
                    <span className="term">{lastTerm}</span>
                </span>
            </Variable>
        ) : null
    }
}

class Variable extends React.Component<{
    column: CoreColumn
    color?: string
    notice?: (number | string | undefined)[]
    children?: React.ReactNode
}> {
    render(): React.ReactElement | null {
        const { column, children, color, notice } = this.props

        if (column.isMissing || column.name === "time") return null

        const { unit, shortUnit, displayName } = column,
            displayUnit =
                unit && unit !== shortUnit
                    ? unit.replace(/^\((.*)\)$/, "$1")
                    : undefined,
            displayNotice =
                uniq((notice ?? []).filter((t) => t !== undefined))
                    .map((time) =>
                        typeof time === "number"
                            ? column.formatTime(time)
                            : time
                    )
                    .join("\u2013") || null

        return (
            <div className="variable">
                <div className="definition">
                    {displayName && <span className="name">{displayName}</span>}
                    {displayUnit && displayUnit.length > 1 && (
                        <span className="unit">{displayUnit}</span>
                    )}
                </div>
                <div className="values" style={{ color }}>
                    {children}
                    {displayNotice && (
                        <span className="time-notice">
                            <FontAwesomeIcon icon={faInfoCircle} />
                            {displayNotice}
                        </span>
                    )}
                </div>
            </div>
        )
    }
}

export class TooltipTable extends React.Component<TooltipTableProps> {
    static contextType = TooltipContext

    render(): React.ReactElement | null {
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

        const showTotals = totals && !(tooEmpty || tooTrivial)
        const totalsPosition =
            this.context?.anchor === GrapherTooltipAnchor.bottom
                ? "top"
                : "bottom"
        const totalsCells = zip(columns, totals!).map(([column, total]) => (
            <td key={column?.slug} className="series-value">
                {column && total !== undefined
                    ? column.formatValueShort(total, format)
                    : null}
            </td>
        ))

        return (
            <table className={classnames("series-list", { focal, swatched })}>
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
                    {showTotals && totalsPosition === "top" && (
                        <>
                            <tr className="total--top">
                                <td className="series-color"></td>
                                <td className="series-name">Total</td>
                                {totalsCells}
                            </tr>
                            <tr className="spacer"></tr>
                        </>
                    )}
                    {rows.map((row) => {
                        const {
                            name,
                            focused,
                            blurred,
                            striped,
                            annotation,
                            values,
                            notice,
                            swatch = "transparent",
                        } = row
                        const [_m, seriesName, seriesParenthetical] =
                            name.trim().match(/^(.*?)(\([^()]*\))?$/) ?? []

                        return (
                            <tr
                                key={name}
                                className={classnames({
                                    focused,
                                    blurred,
                                    striped,
                                })}
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
                                    <td className="time-notice">
                                        <FontAwesomeIcon icon={faInfoCircle} />{" "}
                                        {notice}
                                    </td>
                                )}
                            </tr>
                        )
                    })}
                    {showTotals && totalsPosition === "bottom" && (
                        <>
                            <tr className="spacer"></tr>
                            <tr className="total">
                                <td className="series-color"></td>
                                <td className="series-name">Total</td>
                                {totalsCells}
                            </tr>
                        </>
                    )}
                </tbody>
            </table>
        )
    }
}
