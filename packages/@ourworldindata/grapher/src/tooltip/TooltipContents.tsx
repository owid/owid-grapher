import * as _ from "lodash-es"
import * as React from "react"
import classnames from "classnames"
import { CoreColumn } from "@ourworldindata/core-table"
import { NO_DATA_LABEL } from "../color/ColorScale.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faInfoCircle, faS } from "@fortawesome/free-solid-svg-icons"
import { formatInlineList, GrapherTooltipAnchor } from "@ourworldindata/utils"
import {
    TooltipTableProps,
    TooltipValueProps,
    TooltipValueRangeProps,
    TooltipContext,
} from "./TooltipProps"
import { makeAxisLabel } from "../chart/ChartUtils.js"
import * as R from "remeda"

export const NO_DATA_COLOR = "#999"

export class TooltipValue extends React.Component<TooltipValueProps> {
    render(): React.ReactElement | null {
        const { column, value, color, notice, isProjection } = this.props,
            displayValue = _.isNumber(value)
                ? column.formatValueShort(value)
                : (value ?? NO_DATA_LABEL),
            displayColor =
                displayValue === NO_DATA_LABEL ? NO_DATA_COLOR : color

        const { roundsToSignificantFigures } = column
        const showSignificanceSuperscript =
            this.props.showSignificanceSuperscript && roundsToSignificantFigures
        const superscript = showSignificanceSuperscript ? (
            <IconCircledS asSup={true} />
        ) : null

        return (
            <Variable
                column={column}
                color={displayColor}
                isProjection={isProjection}
                notice={notice ? [notice] : undefined}
            >
                <span>
                    {displayValue}
                    {superscript}
                </span>
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
                _.sum([firstValue?.length, lastValue?.length]) > 20
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

        const { roundsToSignificantFigures } = column
        const showSignificanceSuperscript =
            this.props.showSignificanceSuperscript && roundsToSignificantFigures
        const superscript = showSignificanceSuperscript ? (
            <IconCircledS asSup={true} />
        ) : null

        return values.length ? (
            <Variable column={column} color={color} notice={notice}>
                <span className="range">
                    <span className="term">
                        {firstTerm}
                        {!lastTerm && superscript}
                    </span>
                    {trend}
                    {lastTerm && (
                        <span className="term">
                            {lastTerm}
                            {superscript}
                        </span>
                    )}
                </span>
            </Variable>
        ) : null
    }
}

class Variable extends React.Component<{
    column: CoreColumn
    color?: string
    isProjection?: boolean
    notice?: (number | string | undefined)[]
    children?: React.ReactNode
}> {
    render(): React.ReactElement | null {
        const { column, children, color, notice, isProjection } = this.props

        if (column.isMissing || column.name === "time") return null

        const { mainLabel: label, unit } = makeAxisLabel({
            label: column.displayName,
            unit: column.unit,
            shortUnit: column.shortUnit,
        })

        const displayNotice =
            _.uniq((notice ?? []).filter((t) => t !== undefined))
                .map((time) =>
                    typeof time === "number" ? column.formatTime(time) : time
                )
                .join("\u2013") || null

        return (
            <div className="variable">
                <div className="definition">
                    {label && <span className="name">{label}</span>}
                    {unit && unit.length > 1 && (
                        <span className="unit">{unit}</span>
                    )}
                    {isProjection && (
                        <span className="projection">projected data</span>
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
            tooTrivial = R.zip(columns, totals ?? []).every(
                ([column, total]) =>
                    !!column?.formatValueShort(total).match(/^100(\.0+)?%/)
            ),
            showTotals = totals && !(tooEmpty || tooTrivial)

        // if the tooltip is pinned to the bottom, show the total at the top,
        // so that it's always visible even if the tooltip is scrollable
        const showTotalsAtTop =
            this.context?.anchor === GrapherTooltipAnchor.bottom

        const totalsCells = R.zip(columns, totals ?? []).map(
            ([column, total]) => (
                <td key={column?.slug} className="series-value">
                    {column && total !== undefined
                        ? column.formatValueShort(total, format)
                        : null}
                </td>
            )
        )

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
                    {showTotals && showTotalsAtTop && (
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
                            swatch = {},
                        } = row
                        const {
                            color: swatchColor = "transparent",
                            opacity: swatchOpacity = 1,
                        } = swatch

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
                                        style={{
                                            backgroundColor: swatchColor,
                                            opacity: swatchOpacity,
                                        }}
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
                                {R.zip(columns, values).map(
                                    ([column, value]) => {
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
                                    }
                                )}
                                {notice && (
                                    <td className="time-notice">
                                        <FontAwesomeIcon icon={faInfoCircle} />{" "}
                                        {notice}
                                    </td>
                                )}
                            </tr>
                        )
                    })}
                    {showTotals && !showTotalsAtTop && (
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

export function IconCircledS({
    asSup = false,
}: {
    asSup?: boolean
}): React.ReactElement {
    return (
        <div
            className={classnames("icon-circled-s", {
                "as-superscript": asSup,
            })}
        >
            <div className="circle" />
            <FontAwesomeIcon icon={faS} />
        </div>
    )
}

export function makeTooltipToleranceNotice(
    targetYear: string,
    { plural }: { plural: boolean } = { plural: false }
): string {
    const dataPoint = plural ? "data points" : "data point"
    return `Data not available for ${targetYear}. Showing closest available ${dataPoint} instead`
}

export function makeTooltipRoundingNotice(
    numSignificantFigures: number[],
    { plural }: { plural: boolean } = { plural: true }
): string {
    const uniqueNumSigFigs = _.uniq(numSignificantFigures)
    const formattedNumSigFigs = formatInlineList(
        _.sortBy(uniqueNumSigFigs),
        "or"
    )

    const values = plural ? "Values" : "Value"
    const are = plural ? "are" : "is"
    const figures = formattedNumSigFigs === "1" ? "figure" : "figures"
    return `${values} ${are} rounded to ${formattedNumSigFigs} significant ${figures}`
}
