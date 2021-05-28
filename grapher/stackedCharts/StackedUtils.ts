import { flatten, keyBy, sortNumeric, uniq } from "../../clientUtils/Util"
import { StackedPointPositionType, StackedSeries } from "./StackedConstants"

// This method shift up the Y Values of a Series with Points in place.
// Todo: use a lib?
export const stackSeries = <PositionType extends StackedPointPositionType>(
    seriesArr: readonly StackedSeries<PositionType>[]
) => {
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

// Adds a Y = 0 value for each missing x value (where X is usually Time)
export const withZeroesAsInterpolatedPoints = <
    PositionType extends StackedPointPositionType
>(
    seriesArr: readonly StackedSeries<PositionType>[]
): StackedSeries<PositionType>[] => {
    const allXValuesSorted = sortNumeric(
        uniq(
            flatten(seriesArr.map((series) => series.points)).map(
                (point) => point.position
            )
        )
    )
    return seriesArr.map((series) => {
        const pointsByPosition = keyBy(series.points, "position")
        return {
            ...series,
            points: allXValuesSorted.map((position) => {
                const point = pointsByPosition[position]
                const value = point?.value ?? 0
                const time = point?.time ?? 0
                return {
                    time,
                    position,
                    value,
                    valueOffset: 0,
                    fake: !point,
                }
            }),
        }
    })
}
