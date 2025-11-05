import * as _ from "lodash-es"
import * as React from "react"
import classnames from "classnames"
import { NO_DATA_LABEL } from "../color/ColorScale.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faInfoCircle, faS } from "@fortawesome/free-solid-svg-icons"
import { formatInlineList, GrapherTooltipAnchor } from "@ourworldindata/utils"
import { GrapherTrendArrow } from "@ourworldindata/components"
import {
    TooltipValueProps,
    TooltipValueRangeProps,
    TooltipContext,
    TooltipTableProps,
    TooltipVariableProps,
} from "./TooltipProps"
import { makeAxisLabel } from "../chart/ChartUtils.js"
import * as R from "remeda"
import { CoreColumn } from "@ourworldindata/core-table"

type TooltipValue = number | string | undefined

export const NO_DATA_COLOR = "#999"

// Helper function to extract grouped props from column
function getDisplayInfoFromColumn(column: CoreColumn): DisplayInfo {
    return {
        displayName: column.displayName,
        unit: column.unit,
        shortUnit: column.shortUnit,
        isMissing: column.isMissing,
        name: column.name,
    }
}

function getValueFormatterFromColumn(column: CoreColumn): ValueFormatter {
    return {
        formatValue: (value) => column.formatValueShort(value),
        formatValueShort: (value) => formatValueShort(value, column),
        formatValueShortWithAbbreviations: (value) =>
            formatValueShortWithAbbreviations(value, column),
        formatTime: (time) => column.formatTime(time),
    }
}

function getSignificanceInfoFromColumn(column: CoreColumn): SignificanceInfo {
    return {
        roundsToSignificantFigures: column.roundsToSignificantFigures,
    }
}

// Core components that don't depend on column
export function TooltipValueCore({
    value,
    color,
    notice,
    isProjection,
    labelVariant = "name+unit",
    displayInfo,
    valueFormatter,
    significanceInfo,
}: {
    value?: number | string
    color?: string
    notice?: number | string
    isProjection?: boolean
    labelVariant?: "name+unit" | "unit-only"
    displayInfo?: DisplayInfo
    valueFormatter?: ValueFormatter
    significanceInfo?: SignificanceInfo
}): React.ReactElement | null {
    const displayValue = _.isNumber(value)
        ? (valueFormatter?.formatValue?.(value) ?? value.toString())
        : (value ?? NO_DATA_LABEL)
    const displayColor = displayValue === NO_DATA_LABEL ? NO_DATA_COLOR : color

    const showSuperscript =
        significanceInfo?.showSignificanceSuperscript &&
        significanceInfo?.roundsToSignificantFigures
    const superscript = showSuperscript ? <IconCircledS asSup={true} /> : null

    return (
        <VariableCore
            displayInfo={displayInfo}
            valueFormatter={valueFormatter}
            color={displayColor}
            isProjection={isProjection}
            notice={notice ? [notice] : undefined}
            labelVariant={labelVariant}
        >
            <span>
                {displayValue}
                {superscript}
            </span>
        </VariableCore>
    )
}

export function TooltipValueRangeCore({
    values,
    colors,
    notice,
    labelVariant = "name+unit",
    displayInfo,
    valueFormatter,
    significanceInfo,
}: {
    values: (number | string | undefined)[]
    colors?: string[]
    notice?: (number | string | undefined)[]
    labelVariant?: "name+unit" | "unit-only"
    displayInfo?: DisplayInfo
    valueFormatter?: ValueFormatter
    significanceInfo?: SignificanceInfo
}): React.ReactElement | null {
    const defaultFormatValue = (v: number | string | undefined): string => {
        if (v === undefined) return NO_DATA_LABEL
        if (typeof v === "string") return v
        return v.toString()
    }

    const [firstValue, lastValue] = values.map((v) =>
        valueFormatter?.formatValueShort
            ? valueFormatter.formatValueShort(v)
            : defaultFormatValue(v)
    )

    const [firstTerm, lastTerm] =
        _.sum([firstValue?.length, lastValue?.length]) > 20
            ? values.map((v) =>
                  valueFormatter?.formatValueShortWithAbbreviations
                      ? valueFormatter.formatValueShortWithAbbreviations(v)
                      : defaultFormatValue(v)
              )
            : [firstValue, lastValue]

    const trend = getTrendArrowDirection(values)

    const showSuperscript =
        significanceInfo?.showSignificanceSuperscript &&
        significanceInfo?.roundsToSignificantFigures
    const superscript = showSuperscript ? <IconCircledS asSup={true} /> : null

    return values.length ? (
        <VariableCore
            displayInfo={displayInfo}
            valueFormatter={valueFormatter}
            notice={notice}
            labelVariant={labelVariant}
        >
            <span className="range">
                <span className="term">
                    <span style={{ color: colors?.[0] }}>{firstTerm}</span>
                    {!lastTerm && superscript}
                </span>
                {trend && (
                    <GrapherTrendArrow direction={trend} isColored={!colors} />
                )}
                {lastTerm && (
                    <span className="term">
                        <span style={{ color: colors?.[1] }}>{lastTerm}</span>
                        {superscript}
                    </span>
                )}
            </span>
        </VariableCore>
    ) : null
}

function VariableCore({
    displayInfo,
    valueFormatter,
    children,
    color,
    notice,
    isProjection,
    labelVariant = "name+unit",
}: VariableProps): React.ReactElement | null {
    if (displayInfo?.isMissing || displayInfo?.name === "time") return null

    const { mainLabel: columnName, unit } = makeAxisLabel({
        label: displayInfo?.displayName || "",
        unit: displayInfo?.unit,
        shortUnit: displayInfo?.shortUnit,
    })

    const displayNotice =
        _.uniq((notice ?? []).filter((t) => t !== undefined))
            .map((time) =>
                typeof time === "number" && valueFormatter?.formatTime
                    ? valueFormatter.formatTime(time)
                    : time
            )
            .join("\u2013") || null

    return (
        <div
            className={classnames("variable", {
                "variable--no-name": labelVariant === "unit-only",
            })}
        >
            <div className="definition">
                {columnName && <span className="name">{columnName}</span>}
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

export function TooltipValue({
    label,
    unit,
    value,
    color,
    originalTime,
    isProjection,
    labelVariant = "label+unit",
    isRoundedToSignificantFigures,
    showSignificanceSuperscript,
}: TooltipValueProps): React.ReactElement {
    const displayValue = value || NO_DATA_LABEL
    const displayColor = displayValue === NO_DATA_LABEL ? NO_DATA_COLOR : color

    const showSuperscript =
        showSignificanceSuperscript && isRoundedToSignificantFigures
    const superscript = showSuperscript ? (
        <SignificanceIcon asSuperscript={true} />
    ) : null

    return (
        <Variable
            label={label}
            unit={unit}
            color={displayColor}
            isProjection={isProjection}
            originalTimes={originalTime ? [originalTime] : undefined}
            labelVariant={labelVariant}
            displayInfo={displayInfo}
            valueFormatter={valueFormatter}
            significanceInfo={significanceInfo}
        />
    )
}

export function TooltipValueRange({
    label,
    unit,
    values,
    colors,
    originalTimes,
    trend,
    labelVariant = "label+unit",
    isRoundedToSignificantFigures,
    showSignificanceSuperscript,
}: TooltipValueRangeProps): React.ReactElement | null {
    const [firstTerm, lastTerm] = values

    if (firstTerm === undefined && lastTerm === undefined) return null

    const showSuperscript =
        showSignificanceSuperscript && isRoundedToSignificantFigures
    const superscript = showSuperscript ? (
        <SignificanceIcon asSuperscript={true} />
    ) : null

    return (
        <Variable
            label={label}
            unit={unit}
            originalTimes={originalTimes}
            labelVariant={labelVariant}
        >
            <span className="range">
                <span className="term">
                    <span style={{ color: colors?.[0] }}>{firstTerm}</span>
                    {!lastTerm && superscript}
                </span>
                {trend && (
                    <GrapherTrendArrow direction={trend} isColored={!colors} />
                )}
                {lastTerm && (
                    <span className="term">
                        <span style={{ color: colors?.[1] }}>{lastTerm}</span>
                        {superscript}
                    </span>
                )}
            </span>
        </Variable>
    )
}

function Variable({
    label,
    unit,
    children,
    color,
    originalTimes,
    isProjection,
    labelVariant = "label+unit",
}: TooltipVariableProps): React.ReactElement {
    const { mainLabel: columnName, unit: formattedUnit } = makeAxisLabel({
        label: label || "",
        displayUnit: unit,
    })

    const displayOriginalTimes =
        _.uniq((originalTimes ?? []).filter((t) => t !== undefined)).join(
            "\u2013"
        ) || null

    return (
        <div
            className={classnames("variable", {
                "variable--no-name": labelVariant === "unit-only",
            })}
        >
            <div className="definition">
                {columnName && <span className="name">{columnName}</span>}
                {formattedUnit && formattedUnit.length > 1 && (
                    <span className="unit">{formattedUnit}</span>
                )}
                {isProjection && (
                    <span className="projection">projected data</span>
                )}
            </div>
            <div className="values" style={{ color }}>
                {children}
                {displayOriginalTimes && (
                    <span className="time-notice">
                        <FontAwesomeIcon icon={faInfoCircle} />
                        {displayOriginalTimes}
                    </span>
                )}
            </div>
        </div>
    )
}

export function TooltipTable({
    columns,
    rows,
    totals = [],
}: TooltipTableProps): React.ReactElement | null {
    const context = React.useContext(TooltipContext)
    const focal = rows.some((row) => row.focused)
    const swatched = rows.some((row) => row.swatch)

    const tooEmpty =
        rows.length < 2 ||
        totals.every((value) => value === undefined) ||
        rows.some(({ values }) => values.every((value) => value === undefined))
    const tooTrivial = R.zip(columns, totals).every(
        ([column, total]) => !!column?.formatValue(total).match(/^100(\.0+)?%/)
    )
    const showTotals = totals && !(tooEmpty || tooTrivial)

    // if the tooltip is pinned to the bottom, show the total at the top,
    // so that it's always visible even if the tooltip is scrollable
    const showTotalsAtTop = context?.anchor === GrapherTooltipAnchor.Bottom

    const totalsCells = R.zip(columns, totals).map(([column, total]) => (
        <td key={column?.label} className="series-value">
            {column && total !== undefined ? column.formatValue(total) : null}
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
                            <td className="series-value" key={column.label}>
                                {column.label}
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
                        originalTime,
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
                                        key={column.label}
                                        className={classnames("series-value", {
                                            missing,
                                        })}
                                    >
                                        {!missing && column.formatValue(value)}
                                    </td>
                                ) : null
                            })}
                            {originalTime && (
                                <td className="time-notice">
                                    <FontAwesomeIcon icon={faInfoCircle} />{" "}
                                    {originalTime}
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

export function SignificanceIcon({
    asSuperscript = false,
}: {
    asSuperscript?: boolean
}): React.ReactElement {
    return (
        <div
            className={classnames("icon-circled-s", {
                "as-superscript": asSuperscript,
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

export function toTooltipTableColumns(
    columns: CoreColumn | CoreColumn[]
): TooltipTableProps["columns"] {
    const columnsArray = Array.isArray(columns) ? columns : [columns]

    return columnsArray.map((column) => ({
        label: column.displayName,
        formatValue: (value) =>
            column.formatValueShort(value, { trailingZeroes: true }),
    }))
}

export function formatTooltipRangeValues(
    values: TooltipValue[],
    column: CoreColumn
): [string, string] {
    const formatTooltipValueShort = (value: TooltipValue): string =>
        formatTooltipValue(value, (value) => column.formatValueShort(value))
    const formatTooltipValueShortWithAbbreviations = (
        value: TooltipValue
    ): string =>
        formatTooltipValue(value, (value) =>
            column.formatValueShortWithAbbreviations(value)
        )

    const [firstValue, lastValue] = values.map((v) =>
        formatTooltipValueShort(v)
    )

    const [firstTerm, lastTerm] =
        // TODO: would be nicer to actually measure the typeset text but we would need to
        // add Lato's metrics to the `string-pixel-width` module to use Bounds.forText
        _.sum([firstValue?.length, lastValue?.length]) > 20
            ? values.map((v) => formatTooltipValueShortWithAbbreviations(v))
            : [firstValue, lastValue]

    return [firstTerm, lastTerm]
}

function formatTooltipValue(
    value: TooltipValue,
    formatValue: (value: number) => string
): string {
    if (value === undefined) return NO_DATA_LABEL
    if (typeof value === "string") return value
    return formatValue(value)
}
