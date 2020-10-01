import { StackedBarSeries } from "./StackedBarChartConstants"

// This method shift up the Y Values of a Series with Points.
// Todo: unit test. Maybe generalize to work for other charts.
export const stackBars = (seriesArr: StackedBarSeries[]) => {
    // should be an easy one to speed up if necessary
    const getPointForTime = (series: StackedBarSeries, time: number) =>
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
