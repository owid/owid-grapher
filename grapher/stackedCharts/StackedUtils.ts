import { flatten, keyBy, sortNumeric, uniq } from "grapher/utils/Util"
import { StackedSeries } from "./StackedConstants"

// This method shift up the Y Values of a Series with Points in place.
// Todo: use a lib?
export const stackSeries = (seriesArr: StackedSeries[]) => {
    seriesArr.forEach((series, seriesIndex) => {
        if (!seriesIndex) return // The first series does not need to be shifted
        series.points.forEach((point, pointIndex) => {
            const pointBelowThisOne =
                seriesArr[seriesIndex - 1].points[pointIndex]
            point.yOffset = pointBelowThisOne.y + pointBelowThisOne.yOffset
        })
    })
    return seriesArr
}

// Adds a Y = 0 value for each missing x value (where X is usually Time)
export const withZeroesAsInterpolatedPoints = (
    seriesArr: StackedSeries[]
): StackedSeries[] => {
    const allXValuesSorted = sortNumeric(
        uniq(
            flatten(seriesArr.map((series) => series.points)).map(
                (point) => point.x
            )
        )
    )
    return seriesArr.map((series) => {
        const xValueToPoint = keyBy(series.points, "x")
        return {
            ...series,
            points: allXValuesSorted.map((x) => {
                const point = xValueToPoint[x]
                const y = point?.y ?? 0
                return {
                    x,
                    y,
                    yOffset: 0,
                    fake: !!point,
                }
            }),
        }
    })
}
