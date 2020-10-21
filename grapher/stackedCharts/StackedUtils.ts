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

// Adds a Y = (Y[t-1] + Y[next T])/2 value for each missing x value (where X is usually Time)
// Todo: use a lib?
export const withLinearInterpolatedPoints = (
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
        let lastYValue: number
        const { points } = series
        const xValueToPoint = keyBy(points, "x")
        return {
            ...series,
            points: allXValuesSorted.map((x, index) => {
                const point = xValueToPoint[x]
                if (point) {
                    lastYValue = point.y
                    return {
                        x,
                        y: point.y,
                        yOffset: 0,
                        fake: false,
                    }
                }

                if (lastYValue === undefined) {
                    return {
                        x,
                        y: 0,
                        yOffset: 0,
                        fake: true,
                    }
                }

                const nextX = allXValuesSorted
                    .slice(index + 1)
                    .find((x) => xValueToPoint[x] !== undefined)
                const nextY =
                    nextX == undefined ? lastYValue : xValueToPoint[nextX].y
                lastYValue = (nextY + lastYValue) / 2

                return {
                    x,
                    y: lastYValue,
                    yOffset: 0,
                    fake: true,
                }
            }),
        }
    })
}
