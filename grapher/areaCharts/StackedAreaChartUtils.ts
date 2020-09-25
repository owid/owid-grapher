import { StackedAreaSeries } from "./StackedAreaChartConstants"

// This method shift up the Y Values of a Series with Points.
// It assumes all series have the same number of points
export const stackAreas = (seriesArr: StackedAreaSeries[]) => {
    seriesArr.forEach((series, seriesIndex) => {
        if (!seriesIndex) return // The first series does not need to be shifted
        series.points.forEach((point, pointIndex) => {
            const pointBelowThisOne =
                seriesArr[seriesIndex - 1].points[pointIndex]
            point.y += pointBelowThisOne.y
        })
    })
}
