import { expect, it, describe } from "vitest"

import {
    stackSeries,
    stackSeriesInBothDirections,
    withMissingValuesAsZeroes,
    withUniformSpacing,
} from "./StackedUtils"

const seriesArr = [
    {
        seriesName: "Canada",
        columnSlug: "var",
        color: "red",
        points: [
            { position: 2000, time: 2000, value: 10, valueOffset: 0 },
            { position: 2002, time: 2002, value: 12, valueOffset: 0 },
        ],
    },
    {
        seriesName: "USA",
        columnSlug: "var",
        color: "red",
        points: [{ position: 2000, time: 2000, value: 2, valueOffset: 0 }],
    },
    {
        seriesName: "France",
        columnSlug: "var",
        color: "red",
        points: [
            { position: 2000, time: 2000, value: 6, valueOffset: 0 },
            { position: 2003, time: 2003, value: 4, valueOffset: 0 },
        ],
    },
]

const seriesArrWithNegativeValues = [
    {
        seriesName: "Canada",
        columnSlug: "var",
        color: "red",
        points: [
            { position: 2000, time: 2000, value: -10, valueOffset: 0 },
            { position: 2002, time: 2002, value: 12, valueOffset: 0 },
        ],
    },
    {
        seriesName: "USA",
        columnSlug: "var",
        color: "red",
        points: [{ position: 2000, time: 2000, value: 2, valueOffset: 0 }],
    },
    {
        seriesName: "France",
        columnSlug: "var",
        color: "red",
        points: [
            { position: 2000, time: 2000, value: -6, valueOffset: 0 },
            { position: 2002, time: 2002, value: -4, valueOffset: 0 },
        ],
    },
]

describe(withUniformSpacing, () => {
    it("can add values to make an array evenly spaced", () => {
        expect(withUniformSpacing([])).toEqual([])
        expect(withUniformSpacing([5])).toEqual([5])
        expect(withUniformSpacing([5, 10])).toEqual([5, 10])
        expect(withUniformSpacing([5, 10, 15])).toEqual([5, 10, 15])
        expect(withUniformSpacing([2, 4, 8])).toEqual([2, 4, 6, 8])
        expect(withUniformSpacing([1, 2, 4, 8])).toEqual([
            1, 2, 3, 4, 5, 6, 7, 8,
        ])
        expect(withUniformSpacing([7, 12, 17])).toEqual([7, 12, 17])
    })
})

describe(withMissingValuesAsZeroes, () => {
    it("can add fake points", () => {
        expect(seriesArr[1].points[1]).toEqual(undefined)
        const series = withMissingValuesAsZeroes(seriesArr)
        expect(series[1].points[1].position).toEqual(2002)
    })

    it("can enforce uniform spacing on the x-axis", () => {
        expect(seriesArr[1].points[1]).toEqual(undefined)
        expect(seriesArr[1].points[2]).toEqual(undefined)
        expect(seriesArr[1].points[3]).toEqual(undefined)
        const series = withMissingValuesAsZeroes(seriesArr, {
            enforceUniformSpacing: true,
        })
        expect(series[1].points[1].position).toEqual(2001)
        expect(series[1].points[2].position).toEqual(2002)
        expect(series[1].points[3].position).toEqual(2003)
    })
})

describe(stackSeries, () => {
    it("can stack series", () => {
        expect(seriesArr[1].points[0].valueOffset).toEqual(0)
        const series = stackSeries(withMissingValuesAsZeroes(seriesArr))
        expect(series[1].points[0].valueOffset).toEqual(10)
        expect(series[2].points[0].valueOffset).toEqual(12)
    })
})

describe(stackSeriesInBothDirections, () => {
    it("can stack positive values", () => {
        const series = stackSeriesInBothDirections(
            withMissingValuesAsZeroes(seriesArr)
        )
        expect(series[1].points[0].valueOffset).toEqual(10) // USA 2000
        expect(series[2].points[0].valueOffset).toEqual(12) // France 2000
    })

    it("can stack positive & negative values", () => {
        const series = stackSeriesInBothDirections(
            withMissingValuesAsZeroes(seriesArrWithNegativeValues)
        )
        expect(series[1].points[0].valueOffset).toEqual(0) // USA 2000
        expect(series[2].points[0].valueOffset).toEqual(-10) // France 2000
        expect(series[2].points[1].valueOffset).toEqual(0) // France 2002
    })
})
