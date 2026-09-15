import { expect, it, describe } from "vitest"

import { ColumnTypeMap, OwidTable } from "@ourworldindata/core-table"
import { Time } from "@ourworldindata/types"
import { StackedSeries } from "./StackedConstants"
import {
    hasLoneNegativeSeriesAtBottom,
    stackSeriesInBothDirections,
    withMissingValuesAsZeroes,
    withPointsAtZeroLineCrossings,
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
        const timeColumn = new ColumnTypeMap.Year(new OwidTable(), {
            slug: "year",
        })
        const series = withMissingValuesAsZeroes(seriesArr, {
            enforceUniformSpacing: true,
            timeColumn,
        })
        expect(series[1].points[1].position).toEqual(2001)
        expect(series[1].points[2].position).toEqual(2002)
        expect(series[1].points[3].position).toEqual(2003)
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

const landUseCrossingZero = {
    seriesName: "landUse",
    columnSlug: "landUse",
    color: "green",
    points: [
        { position: 1990, time: 1990, value: 20, valueOffset: 0 },
        { position: 2000, time: 2000, value: -20, valueOffset: 0 },
    ],
}

const fossil = {
    seriesName: "fossil",
    columnSlug: "fossil",
    color: "grey",
    points: [
        { position: 1990, time: 1990, value: 100, valueOffset: 0 },
        { position: 2000, time: 2000, value: 120, valueOffset: 0 },
    ],
}

describe(hasLoneNegativeSeriesAtBottom, () => {
    it("is true when only the bottom series goes negative", () => {
        expect(
            hasLoneNegativeSeriesAtBottom([landUseCrossingZero, fossil])
        ).toBe(true)
    })

    it("is false when the bottom series is never negative", () => {
        const landUse = {
            ...landUseCrossingZero,
            points: [
                { position: 1990, time: 1990, value: 20, valueOffset: 0 },
                { position: 2000, time: 2000, value: 10, valueOffset: 0 },
            ],
        }
        expect(hasLoneNegativeSeriesAtBottom([landUse, fossil])).toBe(false)
    })

    it("is false when a series above the bottom one is also negative", () => {
        const alsoNegative = {
            ...fossil,
            points: [
                { position: 1990, time: 1990, value: 100, valueOffset: 0 },
                { position: 2000, time: 2000, value: -120, valueOffset: 0 },
            ],
        }
        expect(
            hasLoneNegativeSeriesAtBottom([landUseCrossingZero, alsoNegative])
        ).toBe(false)
    })
})

describe(withPointsAtZeroLineCrossings, () => {
    const bandsOf = (series: StackedSeries<Time>): number[][] =>
        series.points.map((point) => [
            point.position,
            point.value,
            point.valueOffset,
        ])

    it("adds a point to every series where the bottom series reaches zero", () => {
        const series = withPointsAtZeroLineCrossings(
            stackSeriesInBothDirections([landUseCrossingZero, fossil])
        )
        expect(bandsOf(series[0])).toEqual([
            [1990, 20, 0],
            [1995, 0, 0],
            [2000, -20, 0],
        ])
        expect(bandsOf(series[1])).toEqual([
            [1990, 100, 20],
            [1995, 110, 0],
            [2000, 120, 0],
        ])
    })

    it("leaves the series it was given alone", () => {
        const input = stackSeriesInBothDirections([landUseCrossingZero, fossil])
        const before = input.map(bandsOf)
        withPointsAtZeroLineCrossings(input)
        expect(input.map(bandsOf)).toEqual(before)
    })

    it("skips a pair that already has a point on the zero line", () => {
        const landUse = {
            ...landUseCrossingZero,
            points: [
                { position: 1990, time: 1990, value: 0, valueOffset: 0 },
                { position: 2000, time: 2000, value: -20, valueOffset: 0 },
            ],
        }
        expect(
            withPointsAtZeroLineCrossings([landUse, fossil])[0].points
        ).toHaveLength(2)
    })

    it("does nothing when a series above the bottom one is also negative", () => {
        const input = [
            landUseCrossingZero,
            {
                ...fossil,
                points: [
                    { position: 1990, time: 1990, value: 100, valueOffset: 0 },
                    { position: 2000, time: 2000, value: -120, valueOffset: 0 },
                ],
            },
        ]
        expect(withPointsAtZeroLineCrossings(input)).toBe(input)
    })

    it("does nothing when the negative series is the only one", () => {
        const input = [landUseCrossingZero]
        expect(withPointsAtZeroLineCrossings(input)).toBe(input)
    })
})
