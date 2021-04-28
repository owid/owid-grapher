import { last } from "lodash"
import {
    first,
    flatten,
    keyBy,
    sortNumeric,
    uniq,
} from "../../clientUtils/Util"
import { StackedPoint, StackedSeries } from "./StackedConstants"

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

export const stackSeriesOrthogonal = (seriesArr: StackedSeries[]) => {
    seriesArr.forEach((series) => {
        series.points.forEach((point, pointIndex) => {
            // first point doesn't need to be shifted
            if (pointIndex === 0) return
            const pointBelowThisOne = series.points[pointIndex - 1]
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
                    fake: !point,
                }
            }),
        }
    })
}

export const stackedSeriesMaxY = (series: StackedSeries): number => {
    const { points } = series
    if (points.length === 0) return 0
    if (points.length === 1) return first(points)!.y
    const lastPoint = last(points)!
    return lastPoint.y + lastPoint.yOffset
}
