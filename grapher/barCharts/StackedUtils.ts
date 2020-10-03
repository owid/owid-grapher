import { StackedSeries } from "./StackedConstants"

// This method shift up the Y Values of a Series with Points.
// todo: add unit tests
export const stackSeries = (seriesArr: StackedSeries[]) => {
    // should be an easy one to speed up if necessary
    const getPointForTime = (series: StackedSeries, time: number) =>
        series.points.find((point) => point.x === time)

    seriesArr.forEach((series, seriesIndex) => {
        if (!seriesIndex) return // The first series does not need to be shifted
        series.points.forEach((point) => {
            let priorSeriesIndex = seriesIndex
            let pointBelowThisOne
            while (pointBelowThisOne === undefined && priorSeriesIndex > 0) {
                priorSeriesIndex--
                pointBelowThisOne = getPointForTime(
                    seriesArr[priorSeriesIndex],
                    point.x
                )
            }
            point.yOffset = pointBelowThisOne
                ? pointBelowThisOne.y + pointBelowThisOne.yOffset
                : 0
        })
    })
}
