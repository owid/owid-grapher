import * as _ from "lodash-es"
import {
    sortNumeric,
    isArrayOfNumbers,
    findGreatestCommonDivisorOfArray,
    rollingMap,
    omitUndefinedValues,
} from "@ourworldindata/utils"
import { StackedPointPositionType, StackedSeries } from "./StackedConstants"

// This method shift up the Y Values of a Series with Points in place.
export const stackSeries = <PositionType extends StackedPointPositionType>(
    seriesArr: readonly StackedSeries<PositionType>[]
): readonly StackedSeries<PositionType>[] => {
    seriesArr.forEach((series, seriesIndex) => {
        if (!seriesIndex) return // The first series does not need to be shifted
        series.points.forEach((point, pointIndex) => {
            const pointBelowThisOne =
                seriesArr[seriesIndex - 1].points[pointIndex]
            point.valueOffset =
                pointBelowThisOne.value + pointBelowThisOne.valueOffset
        })
    })
    return seriesArr
}

// This method shifts up positive y values and shifts down negative y values of a Series with Points in place.
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

// Makes sure that values are evenly spaced
export function withUniformSpacing(values: number[]): number[] {
    const deltas = rollingMap(values, (a, b) => b - a)
    const gcd = findGreatestCommonDivisorOfArray(deltas)
    if (gcd === null) return values
    return _.range(values[0], values[values.length - 1] + gcd, gcd)
}

// Adds a Y = 0 value for each missing x value (where X is usually Time)
export const withMissingValuesAsZeroes = <
    PositionType extends StackedPointPositionType,
>(
    seriesArr: readonly StackedSeries<PositionType>[],
    { enforceUniformSpacing = false }: { enforceUniformSpacing?: boolean } = {}
): StackedSeries<PositionType>[] => {
    let allXValuesSorted = sortNumeric(
        _.uniq(
            seriesArr
                .flatMap((series) => series.points)
                .map((point) => point.position)
        )
    )

    if (enforceUniformSpacing && isArrayOfNumbers(allXValuesSorted)) {
        allXValuesSorted = withUniformSpacing(
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
                    interpolated: point?.interpolated,
                    fake: !point || !!point.interpolated,
                    color: point?.color,
                })
            }),
        }
    })
}
