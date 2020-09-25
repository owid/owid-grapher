import { StackedBarSeries } from "./StackedBarChartConstants"

// every subsequent series needs be stacked on top of previous series
export const stackBars = (seriesArr: StackedBarSeries[]) => {
    for (let i = 1; i < seriesArr.length; i++) {
        for (let j = 0; j < seriesArr[0].points.length; j++) {
            seriesArr[i].points[j].yOffset =
                seriesArr[i - 1].points[j].y +
                seriesArr[i - 1].points[j].yOffset
        }
    }
}
