#! /usr/bin/env jest

import { stackSeries, withZeroesAsInterpolatedPoints } from "./StackedUtils"

const seriesArr = [
    {
        seriesName: "Canada",
        color: "red",
        points: [
            { position: 2000, time: 2000, value: 10, valueOffset: 0 },
            { position: 2002, time: 2002, value: 12, valueOffset: 0 },
        ],
    },
    {
        seriesName: "USA",
        color: "red",
        points: [{ position: 2000, time: 2000, value: 2, valueOffset: 0 }],
    },
]

it("can add fake points", () => {
    expect(seriesArr[1].points[1]).toEqual(undefined)
    const series = withZeroesAsInterpolatedPoints(seriesArr)
    expect(series[1].points[1].position).toEqual(2002)
})

it("can stack series", () => {
    expect(seriesArr[1].points[0].valueOffset).toEqual(0)
    const series = stackSeries(withZeroesAsInterpolatedPoints(seriesArr))
    expect(series[1].points[0].valueOffset).toEqual(10)
})
