import * as _ from "lodash-es"
import * as R from "remeda"
import React from "react"
import { observer } from "mobx-react"
import { computed } from "mobx"
import {
    excludeNullish,
    excludeUndefined,
    calculateTrendDirection,
    Time,
} from "@ourworldindata/utils"
import { CoreColumn } from "@ourworldindata/core-table"
import {
    Tooltip,
    TooltipState,
    TooltipValueRange,
    makeTooltipToleranceNotice,
    makeTooltipRoundingNotice,
    formatTooltipRangeValues,
} from "../tooltip/Tooltip"
import { FooterItem, TooltipFooterIcon } from "../tooltip/TooltipProps.js"
import { ScatterSeries, SeriesPoint } from "./ScatterPlotChartConstants"
import { ScatterPlotChartState } from "./ScatterPlotChartState"

export interface ScatterPlotTooltipProps {
    chartState: ScatterPlotChartState
    tooltipState: TooltipState<{ series: ScatterSeries }>
}

interface TooltipValueRangeProps {
    chartState: ScatterPlotChartState
    points: SeriesPoint[]
    values: SeriesPoint[]
    showSignificanceSuperscript: boolean
    showOriginalTimes?: boolean
}

@observer
export class ScatterPlotTooltip extends React.Component<ScatterPlotTooltipProps> {
    @computed private get chartState(): ScatterPlotChartState {
        return this.props.chartState
    }

    @computed private get points(): SeriesPoint[] {
        return this.props.tooltipState.target?.series.points ?? []
    }

    @computed private get values(): SeriesPoint[] {
        return excludeNullish(
            _.uniq([R.first(this.points), R.last(this.points)])
        )
    }

    @computed private get toleranceNotice(): FooterItem | undefined {
        const { points, values } = this
        const { xColumn, yColumn, manager, isTimeScatter } = this.chartState
        const { startTime, endTime } = manager

        // No tolerance notice needed if comparing the same variable across years
        if (hasSameVariableWithTimeOverride(xColumn, yColumn, points)) {
            return undefined
        }

        // No tolerance notice needed for time scatter plots
        if (isTimeScatter) return undefined

        // Check the time span in relative mode
        if (manager.isRelativeMode) {
            const [start, end] = points[0].time.span ?? []
            const noticeNeeded = hasTimeMismatch({
                actualStartTime: start,
                actualEndTime: end,
                targetStartTime: startTime,
                targetEndTime: endTime,
            })

            if (!noticeNeeded) return undefined

            return makeToleranceNotice({
                startTime,
                endTime,
                formatTime: (time) => yColumn.formatTime(time),
            })
        }

        const { x: xStart, y: yStart } = R.first(values)?.time ?? {}
        const { x: xEnd, y: yEnd } = R.last(values)?.time ?? {}

        const xNoticeNeeded = hasTimeMismatch({
            actualStartTime: xStart,
            actualEndTime: xEnd,
            targetStartTime: startTime,
            targetEndTime: endTime,
        })
        const yNoticeNeeded = hasTimeMismatch({
            actualStartTime: yStart,
            actualEndTime: yEnd,
            targetStartTime: startTime,
            targetEndTime: endTime,
        })

        if (!xNoticeNeeded && !yNoticeNeeded) return undefined

        return makeToleranceNotice({
            startTime,
            endTime,
            formatTime: (time) => yColumn.formatTime(time),
        })
    }

    @computed private get roundingNotice(): FooterItem | undefined {
        const { xColumn, yColumn, sizeColumn } = this.props.chartState

        const columns = [xColumn, yColumn, sizeColumn].filter(
            (column) => !column.isMissing && !column.isTimeColumn
        )

        const allRoundedToSigFigs = columns.every(
            (column) => column.roundsToSignificantFigures
        )
        const anyRoundedToSigFigs = columns.some(
            (column) => column.roundsToSignificantFigures
        )

        if (!anyRoundedToSigFigs) return undefined

        const sigFigs = excludeUndefined(
            columns.map((column) =>
                column.roundsToSignificantFigures
                    ? column.numSignificantFigures
                    : undefined
            )
        )

        return {
            icon: allRoundedToSigFigs
                ? TooltipFooterIcon.None
                : TooltipFooterIcon.Significance,
            text: makeTooltipRoundingNotice(sigFigs, {
                plural: sigFigs.length > 1,
            }),
        }
    }

    @computed private get showSignificanceSuperscript(): boolean {
        return this.roundingNotice?.icon === TooltipFooterIcon.Significance
    }

    @computed private get footer(): FooterItem[] {
        return excludeUndefined([this.toleranceNotice, this.roundingNotice])
    }

    @computed private get subtitle(): string {
        const { manager, yColumn, xColumn } = this.chartState
        const { startTime, endTime, isRelativeMode } = manager

        let times: Time[]
        if (hasSameVariableWithTimeOverride(xColumn, yColumn, this.points)) {
            times = _.sortBy([this.points[0].time.x, this.points[0].time.y])
        } else if (this.chartState.isTimeScatter) {
            times = _.uniq(excludeNullish(this.values.map((v) => v.time.y)))
        } else {
            times = _.uniq(excludeNullish([startTime, endTime]))
        }

        const timeRange = times.map((t) => yColumn.formatTime(t)).join(" to ")

        return timeRange + (isRelativeMode ? " (avg. annual change)" : "")
    }

    override render(): React.ReactElement | null {
        const { showSignificanceSuperscript } = this
        const { chartState, tooltipState } = this.props

        const { target, position, fading } = tooltipState
        if (!target) return null

        const hasToleranceNotice = this.toleranceNotice !== undefined

        return (
            <Tooltip
                id="scatterTooltip"
                tooltipManager={chartState.manager}
                x={position.x}
                y={position.y}
                offsetX={20}
                offsetY={-16}
                style={{ maxWidth: "250px" }}
                title={target.series.label}
                subtitle={this.subtitle}
                dissolve={fading}
                footer={this.footer}
                dismiss={() => (tooltipState.target = null)}
            >
                <TooltipValueRangeX
                    chartState={chartState}
                    points={this.points}
                    values={this.values}
                    showSignificanceSuperscript={showSignificanceSuperscript}
                    showOriginalTimes={hasToleranceNotice}
                />
                <TooltipValueRangeY
                    chartState={chartState}
                    points={this.points}
                    values={this.values}
                    showSignificanceSuperscript={showSignificanceSuperscript}
                    showOriginalTimes={hasToleranceNotice}
                />
                <TooltipValueRangeSize
                    chartState={chartState}
                    points={this.points}
                    values={this.values}
                    showSignificanceSuperscript={showSignificanceSuperscript}
                />
            </Tooltip>
        )
    }
}

function TooltipValueRangeX({
    chartState,
    points,
    values,
    showSignificanceSuperscript,
    showOriginalTimes,
}: TooltipValueRangeProps): React.ReactElement | null {
    const { xColumn } = chartState

    if (xColumn.isMissing || xColumn.isTimeColumn) return null

    const { values: xValues, originalTimes = [] } = getXValuesWithTimes(
        chartState,
        points,
        values
    )

    const formattedOriginalTimes = showOriginalTimes
        ? originalTimes.map((time) => formatTime(time, xColumn))
        : []

    return (
        <TooltipValueRange
            label={xColumn.displayName}
            unit={xColumn.displayUnit}
            values={formatTooltipRangeValues(xValues, xColumn)}
            trend={calculateTrendDirection(...xValues)}
            originalTimes={formattedOriginalTimes}
            isRoundedToSignificantFigures={xColumn.roundsToSignificantFigures}
            showSignificanceSuperscript={showSignificanceSuperscript}
        />
    )
}

function TooltipValueRangeY({
    chartState,
    points,
    values,
    showSignificanceSuperscript,
    showOriginalTimes,
}: TooltipValueRangeProps): React.ReactElement | null {
    const { yColumn } = chartState

    if (yColumn.isMissing) return null

    const { values: yValues, originalTimes = [] } = getYValuesWithTimes(
        chartState,
        points,
        values
    )

    const formattedOriginalTimes = showOriginalTimes
        ? originalTimes.map((time) => formatTime(time, yColumn))
        : []

    return (
        <TooltipValueRange
            label={yColumn.displayName}
            unit={yColumn.displayUnit}
            values={formatTooltipRangeValues(yValues, yColumn)}
            trend={calculateTrendDirection(...yValues)}
            originalTimes={formattedOriginalTimes}
            isRoundedToSignificantFigures={yColumn.roundsToSignificantFigures}
            showSignificanceSuperscript={showSignificanceSuperscript}
        />
    )
}

function TooltipValueRangeSize({
    chartState,
    values,
    showSignificanceSuperscript,
}: TooltipValueRangeProps): React.ReactElement | null {
    const { sizeColumn } = chartState

    if (sizeColumn.isMissing) return null

    const sizeValues = excludeNullish(values.map((v) => v.size))

    return (
        <TooltipValueRange
            label={sizeColumn.displayName}
            unit={sizeColumn.displayUnit}
            values={formatTooltipRangeValues(sizeValues, sizeColumn)}
            trend={calculateTrendDirection(...sizeValues)}
            isRoundedToSignificantFigures={
                sizeColumn.roundsToSignificantFigures
            }
            showSignificanceSuperscript={showSignificanceSuperscript}
        />
    )
}

/**
 * Detects when a scatter plot compares the same variable across two different years.
 *
 * Example: GDP in 2020 (y-axis) vs GDP in 2010 (x-axis).
 */
function hasSameVariableWithTimeOverride(
    xColumn: CoreColumn,
    yColumn: CoreColumn,
    points: SeriesPoint[]
): boolean {
    // Check if there is exactly one point
    if (points.length !== 1) return false

    // Check if both axes use the same dataset/variable
    const isSameDataset = xColumn.def.datasetId === yColumn.def.datasetId
    if (!isSameDataset) return false

    // Check if the point has different time points for x and y
    const point = points[0]
    const hasDifferentTimes =
        point.time.x !== point.time.y &&
        _.isNumber(point.time.x) &&
        _.isNumber(point.time.y)

    return hasDifferentTimes
}

function hasTimeMismatch({
    actualStartTime,
    actualEndTime,
    targetStartTime,
    targetEndTime,
}: {
    actualStartTime?: Time
    actualEndTime?: Time
    targetStartTime?: Time
    targetEndTime?: Time
}): boolean {
    const startTimesDiffer =
        actualStartTime !== undefined && actualStartTime !== targetStartTime
    const endTimesDiffer =
        actualEndTime !== undefined && actualEndTime !== targetEndTime

    return startTimesDiffer || endTimesDiffer
}

function makeToleranceNotice({
    startTime,
    endTime,
    formatTime,
}: {
    startTime?: Time
    endTime?: Time
    formatTime: (time: Time) => string
}): FooterItem {
    const targetNotice = _.uniq(excludeNullish([startTime, endTime]))
        .map((t) => formatTime(t))
        .join(" to ")

    return {
        icon: TooltipFooterIcon.Notice,
        text: makeTooltipToleranceNotice(targetNotice),
    }
}

function getXValuesWithTimes(
    chartState: ScatterPlotChartState,
    points: SeriesPoint[],
    values: SeriesPoint[]
): {
    values: number[]
    originalTimes: (number | undefined)[]
} {
    const { xColumn, yColumn, manager } = chartState
    const { startTime, endTime, isRelativeMode } = manager

    const firstValue = R.first(values)
    const lastValue = R.last(values)

    if (!firstValue || !lastValue) return { values: [], originalTimes: [] }

    // Handle the special case where the same variable is used for both axes
    // with a different year's value on each
    if (hasSameVariableWithTimeOverride(xColumn, yColumn, points)) {
        const point = points[0]
        const values =
            point.time.x < point.time.y
                ? [point.x, point.y]
                : [point.y, point.x]
        return { values, originalTimes: [] }
    }

    const xStart = firstValue.time.x
    const xEnd = lastValue.time.x

    const xValues = xStart === xEnd ? [firstValue.x] : values.map((v) => v.x)

    if (isRelativeMode) {
        const originalTimes = getOriginalTimesForRelativeMode({
            span: firstValue.time.span,
            startTime,
            endTime,
        })

        return { values: xValues, originalTimes }
    }

    // Check if tolerance notice is needed
    const noticeNeeded = hasTimeMismatch({
        actualStartTime: xStart,
        actualEndTime: xEnd,
        targetStartTime: startTime,
        targetEndTime: endTime,
    })

    const originalTimes = noticeNeeded
        ? xStart === xEnd
            ? [xEnd]
            : [xStart, xEnd]
        : []

    return { values: xValues, originalTimes }
}

function getYValuesWithTimes(
    chartState: ScatterPlotChartState,
    points: SeriesPoint[],
    values: SeriesPoint[]
): {
    values: number[]
    originalTimes: (number | undefined)[]
} {
    const { xColumn, yColumn, manager } = chartState
    const { startTime, endTime, isRelativeMode } = manager

    // Handle the special case where the x-axis is time
    if (chartState.isTimeScatter) {
        return { values: values.map((v) => v.y), originalTimes: [] }
    }

    // Handle the special case where the same variable is used for both axes
    // with a different year's value on each
    if (hasSameVariableWithTimeOverride(xColumn, yColumn, points)) {
        // Don't return anything (values shown on X axis)
        return { values: [], originalTimes: [] }
    }

    const firstValue = R.first(values)
    const lastValue = R.last(values)

    if (!firstValue || !lastValue) {
        return { values: [], originalTimes: [] }
    }

    const yStart = firstValue.time.y
    const yEnd = lastValue.time.y

    const yValues = yStart === yEnd ? [firstValue.y] : values.map((v) => v.y)

    if (isRelativeMode) {
        const originalTimes = getOriginalTimesForRelativeMode({
            span: firstValue.time.span,
            startTime,
            endTime,
        })

        return { values: yValues, originalTimes }
    }

    // Check if tolerance notice is needed
    const noticeNeeded = hasTimeMismatch({
        actualStartTime: yStart,
        actualEndTime: yEnd,
        targetStartTime: startTime,
        targetEndTime: endTime,
    })

    const originalTimes = noticeNeeded
        ? yStart === yEnd
            ? [yEnd]
            : [yStart, yEnd]
        : []

    return { values: yValues, originalTimes }
}

function getOriginalTimesForRelativeMode({
    startTime,
    endTime,
    span,
}: {
    span?: [number, number]
    startTime?: Time
    endTime?: Time
}): (number | undefined)[] {
    if (!span) return []

    const [spanStart, spanEnd] = span
    const noticeNeeded = hasTimeMismatch({
        actualStartTime: spanStart,
        actualEndTime: spanEnd,
        targetStartTime: startTime,
        targetEndTime: endTime,
    })

    return noticeNeeded
        ? spanStart === spanEnd
            ? [spanEnd]
            : [spanStart, spanEnd]
        : []
}

function formatTime(
    time: Time | undefined,
    column: CoreColumn
): string | undefined {
    if (time === undefined) return undefined
    return column.formatTime(time)
}
