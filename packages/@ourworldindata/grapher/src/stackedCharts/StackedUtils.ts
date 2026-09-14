import * as R from "remeda"
import * as _ from "lodash-es"
import {
    sortNumeric,
    isArrayOfNumbers,
    omitUndefinedValues,
    AxisConfigInterface,
    Point,
} from "@ourworldindata/utils"
import {
    PlacedStackedAreaSeries,
    StackedPoint,
    StackedPointPositionType,
    StackedSeries,
    PlacedStackedBarSeries,
} from "./StackedConstants"
import { DualAxis, HorizontalAxis } from "../axis/Axis"
import { Time } from "@ourworldindata/types"
import { TimeColumn } from "@ourworldindata/core-table"
import { StackedBarChartState } from "./StackedBarChartState.js"

/**
 * Shifts up positive y values and shifts down negative y values of a Series
 * with Points in place
 */
export const stackSeriesInBothDirections = <
    PositionType extends StackedPointPositionType,
>(
    seriesArr: readonly StackedSeries<PositionType>[]
): readonly StackedSeries<PositionType>[] => {
    seriesArr.forEach((series, seriesIndex) => {
        if (!seriesIndex) return // The first series does not need to be shifted
        series.points.forEach((point, pointIndex) => {
            const pointsBelowThisOne = seriesArr
                .slice(0, seriesIndex)
                .map((s) => s.points[pointIndex])
            const pointBelowThisOne =
                point.value < 0
                    ? pointsBelowThisOne.findLast((p) => p.value < 0)
                    : pointsBelowThisOne.findLast((p) => p.value >= 0)
            point.valueOffset = pointBelowThisOne
                ? pointBelowThisOne.value + pointBelowThisOne.valueOffset
                : 0
        })
    })
    return seriesArr
}

// When enforcing uniform spacing, a `timeColumn` is required: its
// `getUniformlySpacedTimes` fills gaps so positions are evenly spaced (e.g. one
// position per missing month).
type WithMissingValuesAsZeroesOptions =
    | { enforceUniformSpacing: true; timeColumn: TimeColumn }
    | { enforceUniformSpacing?: false }

// Adds a Y = 0 value for each missing x value (where X is usually Time)
export const withMissingValuesAsZeroes = <
    PositionType extends StackedPointPositionType,
>(
    seriesArr: readonly StackedSeries<PositionType>[],
    options: WithMissingValuesAsZeroesOptions = {}
): StackedSeries<PositionType>[] => {
    let allXValuesSorted = sortNumeric(
        _.uniq(
            seriesArr
                .flatMap((series) => series.points)
                .map((point) => point.position)
        )
    )

    if (options.enforceUniformSpacing && isArrayOfNumbers(allXValuesSorted)) {
        allXValuesSorted = options.timeColumn.getUniformlySpacedTimes(
            allXValuesSorted
        ) as PositionType[]
    }

    return seriesArr.map((series) => {
        const pointsByPosition = _.keyBy(series.points, "position")
        return {
            ...series,
            points: allXValuesSorted.map((position) => {
                const point = pointsByPosition[position]
                const value = point?.value ?? 0
                const time = point?.time ?? 0
                return omitUndefinedValues({
                    time,
                    position,
                    value,
                    valueOffset: 0,
                    formattedTime: point?.formattedTime,
                    missing: !point,
                    interpolated: point?.interpolated,
                    color: point?.color,
                })
            }),
        }
    })
}

export function resolveCollision(
    s1: StackedSeries<number>,
    s2: StackedSeries<number>
): StackedSeries<number> | undefined {
    // Early return if one series is all zeroes
    if (s1.isAllZeros && !s2.isAllZeros) return s2
    if (s2.isAllZeros && !s1.isAllZeros) return s1

    // Prefer series with a higher maximum value
    const yMax1 = _.maxBy(s1.points, (p) => p.value)?.value ?? 0
    const yMax2 = _.maxBy(s2.points, (p) => p.value)?.value ?? 0
    if (yMax1 > yMax2) return s1
    if (yMax2 > yMax1) return s2

    // Prefer series with a higher last value
    const yLast1 = R.last(s1.points)?.value ?? 0
    const yLast2 = R.last(s2.points)?.value ?? 0
    if (yLast1 > yLast2) return s1
    if (yLast2 > yLast1) return s2

    // Prefer series with a higher total area
    const area1 = _.sumBy(s1.points, (p) => p.value)
    const area2 = _.sumBy(s2.points, (p) => p.value)
    if (area1 > area2) return s1
    if (area2 > area1) return s2

    return undefined // no preference
}

export function getXAxisConfigDefaultsForStackedBar(
    chartState: StackedBarChartState
): AxisConfigInterface {
    return { hideGridlines: true, bandValues: chartState.xValues }
}

/** A stacked point placed on the x axis, before either edge is given a y */
interface HorizontallyPlacedPoint {
    x: number
    point: StackedPoint<number>
}

function placeSeriesHorizontally(
    series: StackedSeries<number>,
    horizontalAxis: HorizontalAxis
): HorizontallyPlacedPoint[] {
    if (series.points.length === 0) return []

    if (series.points.length > 1)
        return series.points.map((point) => ({
            x: horizontalAxis.place(point.position),
            point,
        }))

    // We only have one point, so make it so it stretches out over the whole x axis range
    // There are two cases here that we need to consider:
    // (1) In unfaceted charts, the x domain will be a single year, so we need to ensure that the area stretches
    //     out over the full range of the x axis.
    // (2) In faceted charts, the x domain may span multiple years, so we need to ensure that the area stretches
    //     out only over year - 0.5 to year + 0.5, additionally making sure we don't put points outside the x range.
    //
    // -@marcelgerber, 2023-04-24
    const point = series.points[0]
    const singleValueXDomain =
        horizontalAxis.domain[0] === horizontalAxis.domain[1]

    // Case (1)
    if (singleValueXDomain)
        return [
            { x: horizontalAxis.range[0], point },
            { x: horizontalAxis.range[1], point },
        ]

    // Case (2)
    const leftX = Math.max(
        horizontalAxis.place(point.position - 0.5),
        horizontalAxis.range[0]
    )
    const rightX = Math.min(
        horizontalAxis.place(point.position + 0.5),
        horizontalAxis.range[1]
    )
    return [
        { x: leftX, point },
        { x: rightX, point },
    ]
}

/** Places the bottom and top edges of a series' area */
function placeStackedAreaSeries(
    series: StackedSeries<number>,
    dualAxis: DualAxis
): { bottomEdge: Point[]; topEdge: Point[] } {
    const placed = placeSeriesHorizontally(series, dualAxis.horizontalAxis)
    if (placed.length === 0) return { bottomEdge: [], topEdge: [] }

    const { verticalAxis } = dualAxis
    const bottomEdge = placed.map(({ x, point }) => ({
        x,
        y: verticalAxis.place(point.valueOffset),
    }))
    const topEdge = placed.map(({ x, point }) => ({
        x,
        y: verticalAxis.place(point.value + point.valueOffset),
    }))

    return { bottomEdge, topEdge }
}

export function toPlacedStackedAreaSeries(
    series: readonly StackedSeries<Time>[],
    dualAxis: DualAxis
): PlacedStackedAreaSeries<Time>[] {
    return series
        .filter((series) => !series.isAllZeros)
        .map((series) => {
            const { topEdge, bottomEdge } = placeStackedAreaSeries(
                series,
                dualAxis
            )
            return {
                ...series,
                placedPoints: topEdge,
                areaPoints: [...topEdge, ...bottomEdge.toReversed()],
            }
        })
}

export function toPlacedStackedBarSeries(
    series: readonly StackedSeries<Time>[],
    dualAxis: DualAxis
): readonly PlacedStackedBarSeries<Time>[] {
    const { horizontalAxis, verticalAxis } = dualAxis
    const barWidth = (horizontalAxis.bandWidth ?? 0) * 0.8

    return series.map((series) => ({
        ...series,
        placedPoints: series.points.map((bar) => {
            const x = horizontalAxis.place(bar.position) - barWidth / 2
            const y1 = verticalAxis.place(bar.valueOffset)
            const y2 = verticalAxis.place(bar.value + bar.valueOffset)
            const y = Math.min(y1, y2)
            const barHeight = Math.abs(y2 - y1)
            return { ...bar, x, y, barWidth, barHeight }
        }),
    }))
}
