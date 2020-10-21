#! /usr/bin/env yarn jest

import {
    stackSeries,
    withLinearInterpolatedPoints,
    withZeroesAsInterpolatedPoints,
} from "./StackedUtils"

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

const seriesArrForLinear = [
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
        points: [{ x: 2001, y: 2, yOffset: 0 }],
    },
]

it("can add points with linear interpolation", () => {
    const series = withLinearInterpolatedPoints(seriesArrForLinear)
    expect(series[0].points[1].y).toEqual(11)
})
