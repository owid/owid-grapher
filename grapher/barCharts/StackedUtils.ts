import { flatten, keyBy, sortNumeric, uniq } from "grapher/utils/Util"
import { StackedSeries } from "./StackedConstants"

// This method shift up the Y Values of a Series with Points in place.
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

// Ensure each series has a point for each X time.
export const withFakePoints = (seriesArr: StackedSeries[]) => {
    const allPoints = flatten(seriesArr.map((series) => series.points))
    const allTimesSorted = sortNumeric(uniq(allPoints.map((point) => point.x)))
    return seriesArr.map((series) => {
        const valueMap = keyBy(series.points, "x")
        return {
            ...series,
            points: allTimesSorted.map((time) => {
                const point = valueMap[time]
                return {
                    x: time,
                    y: point?.y ?? 0,
                    yOffset: 0,
                    fake: !!point,
                }
            }),
        }
    })
}
