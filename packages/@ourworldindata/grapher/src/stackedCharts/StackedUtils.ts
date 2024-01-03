import {
    flatten,
    keyBy,
    sortNumeric,
    uniq,
    range,
    isArrayOfNumbers,
    findGreatestCommonDivisorOfArray,
    rollingMap,
    omitUndefinedValues,
} from "@ourworldindata/utils"
import { StackedPointPositionType, StackedSeries } from "./StackedConstants"

// This method shift up the Y Values of a Series with Points in place.
// Todo: use a lib?
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

// Makes sure that values are evenly spaced
export function withUniformSpacing(values: number[]): number[] {
    const deltas = rollingMap(values, (a, b) => b - a)
    const gcd = findGreatestCommonDivisorOfArray(deltas)
    if (gcd === null) return values
    return range(values[0], values[values.length - 1] + gcd, gcd)
}

// Adds a Y = 0 value for each missing x value (where X is usually Time)
export const withMissingValuesAsZeroes = <
    PositionType extends StackedPointPositionType,
>(
    seriesArr: readonly StackedSeries<PositionType>[],
    { enforceUniformSpacing = false }: { enforceUniformSpacing?: boolean } = {}
): StackedSeries<PositionType>[] => {
    let allXValuesSorted = sortNumeric(
        uniq(
            flatten(seriesArr.map((series) => series.points)).map(
                (point) => point.position
            )
        )
    )

    if (enforceUniformSpacing && isArrayOfNumbers(allXValuesSorted)) {
        allXValuesSorted = withUniformSpacing(
            allXValuesSorted
        ) as PositionType[]
    }

    return seriesArr.map((series) => {
        const pointsByPosition = keyBy(series.points, "position")
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
                })
            }),
        }
    })
}
