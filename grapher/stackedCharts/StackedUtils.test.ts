#! /usr/bin/env jest

import { stackSeries, withZeroesAsInterpolatedPoints } from "./StackedUtils"

const seriesArr = [
    {
        seriesName: "Canada",
        color: "red",
        points: [
            { x: 2000, y: 10, yOffset: 0 },
            { x: 2002, y: 12, yOffset: 0 },
        ],
    },
    {
        seriesName: "USA",
        color: "red",
        points: [{ x: 2000, y: 2, yOffset: 0 }],
    },
]

it("can add fake points", () => {
    expect(seriesArr[1].points[1]).toEqual(undefined)
    const series = withZeroesAsInterpolatedPoints(seriesArr)
    expect(series[1].points[1].x).toEqual(2002)
})

it("can stack series", () => {
    expect(seriesArr[1].points[0].yOffset).toEqual(0)
    const series = stackSeries(withZeroesAsInterpolatedPoints(seriesArr))
    expect(series[1].points[0].yOffset).toEqual(10)
})
