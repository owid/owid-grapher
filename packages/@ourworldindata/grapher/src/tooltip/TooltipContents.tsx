import * as _ from "lodash-es"
import * as React from "react"
import classnames from "classnames"
import { CoreColumn } from "@ourworldindata/core-table"
import { NO_DATA_LABEL } from "../color/ColorScale.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faInfoCircle, faS } from "@fortawesome/free-solid-svg-icons"
import { formatInlineList, GrapherTooltipAnchor } from "@ourworldindata/utils"
import { GrapherTrendArrow } from "@ourworldindata/components"
import {
    TooltipTableProps,
    TooltipValueProps,
    TooltipValueRangeProps,
    TooltipContext,
} from "./TooltipProps"
import { makeAxisLabel } from "../chart/ChartUtils.js"
import * as R from "remeda"

export const NO_DATA_COLOR = "#999"

export function TooltipValue({
    column,
    value,
    color,
    notice,
    isProjection,
    showSignificanceSuperscript,
}: TooltipValueProps): React.ReactElement | null {
    const displayValue = _.isNumber(value)
        ? column.formatValueShort(value)
        : (value ?? NO_DATA_LABEL)
    const displayColor = displayValue === NO_DATA_LABEL ? NO_DATA_COLOR : color

    const { roundsToSignificantFigures } = column
    const showSuperscript =
        showSignificanceSuperscript && roundsToSignificantFigures
    const superscript = showSuperscript ? <IconCircledS asSup={true} /> : null

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

export function TooltipValueRange({
    column,
    values,
    color,
    notice,
    showSignificanceSuperscript,
}: TooltipValueRangeProps): React.ReactElement | null {
    const [firstValue, lastValue] = values.map((v) =>
        column.formatValueShort(v)
    )
    const [firstTerm, lastTerm] =
        // TODO: would be nicer to actually measure the typeset text but we would need to
        // add Lato's metrics to the `string-pixel-width` module to use Bounds.forText
        _.sum([firstValue?.length, lastValue?.length]) > 20
            ? values.map((v) => column.formatValueShortWithAbbreviations(v))
            : [firstValue, lastValue]
    const trend =
        values.length < 2
            ? null
            : values[0] < values[1]
              ? "up"
              : values[0] > values[1]
                ? "down"
                : "right"

    const { roundsToSignificantFigures } = column
    const showSuperscript =
        showSignificanceSuperscript && roundsToSignificantFigures
    const superscript = showSuperscript ? <IconCircledS asSup={true} /> : null

    return values.length ? (
        <Variable column={column} color={color} notice={notice}>
            <span className="range">
                <span className="term">
                    {firstTerm}
                    {!lastTerm && superscript}
                </span>
                {trend && <GrapherTrendArrow direction={trend} />}
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

function Variable({
    column,
    children,
    color,
    notice,
    isProjection,
}: {
    column: CoreColumn
    color?: string
    isProjection?: boolean
    notice?: (number | string | undefined)[]
    children?: React.ReactNode
}): React.ReactElement | null {
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

export function TooltipTable({
    columns,
    totals,
    rows,
    format: formatProp,
}: TooltipTableProps): React.ReactElement | null {
    const context = React.useContext(TooltipContext)
    const focal = rows.some((row) => row.focused)
    const swatched = rows.some((row) => row.swatch)
    const format = { trailingZeroes: true, ...formatProp }
    const tooEmpty =
        rows.length < 2 ||
        totals?.every((value) => value === undefined) ||
        rows.some(({ values }) => values.every((value) => value === undefined))
    const tooTrivial = R.zip(columns, totals ?? []).every(
        ([column, total]) =>
            !!column?.formatValueShort(total).match(/^100(\.0+)?%/)
    )
    const showTotals = totals && !(tooEmpty || tooTrivial)

    // if the tooltip is pinned to the bottom, show the total at the top,
    // so that it's always visible even if the tooltip is scrollable
    const showTotalsAtTop = context?.anchor === GrapherTooltipAnchor.bottom

    const totalsCells = R.zip(columns, totals ?? []).map(([column, total]) => (
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
                            {R.zip(columns, values).map(([column, value]) => {
                                const missing = value === undefined
                                return column ? (
                                    <td
                                        key={column.slug}
                                        className={classnames("series-value", {
                                            missing,
                                        })}
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
