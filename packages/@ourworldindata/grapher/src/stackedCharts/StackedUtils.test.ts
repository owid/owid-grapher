import { expect, it, describe } from "vitest"

import { ColumnTypeMap, OwidTable } from "@ourworldindata/core-table"
import { Time } from "@ourworldindata/types"
import { Bounds } from "@ourworldindata/utils"
import { DualAxis } from "../axis/Axis"
import { AxisConfig } from "../axis/AxisConfig"
import { StackedSeries } from "./StackedConstants"
import {
    findLoneNegativeSeriesAtBottom,
    stackSeries,
    stackSeriesInBothDirections,
    toPlacedStackedAreaSeries,
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

    it("stacks a zero value on the positive side", () => {
        const series = stackSeriesInBothDirections([
            makeSeries("sink", [[2000, -10]]),
            makeSeries("zero", [[2000, 0]]),
            makeSeries("source", [[2000, 5]]),
        ])
        expect(series[1].points[0].valueOffset).toEqual(0)
    })
})

const makeSeries = (
    seriesName: string,
    valuesByTime: [Time, number][],
    { isAllZeros }: { isAllZeros?: boolean } = {}
): StackedSeries<Time> => ({
    seriesName,
    columnSlug: seriesName,
    color: "grey",
    isAllZeros,
    points: valuesByTime.map(([time, value]) => ({
        position: time,
        time,
        value,
        valueOffset: 0,
    })),
})

const makeLandUseCrossingZero = (): StackedSeries<Time> =>
    makeSeries("landUse", [
        [1990, 30],
        [2000, -10],
    ])

const makeAllZeros = (): StackedSeries<Time> =>
    makeSeries(
        "allZeros",
        [
            [1990, 0],
            [2000, 0],
        ],
        { isAllZeros: true }
    )

const makeFossil = (): StackedSeries<Time> =>
    makeSeries("fossil", [
        [1990, 100],
        [2000, 120],
    ])

describe(findLoneNegativeSeriesAtBottom, () => {
    it("returns the bottom series when only it goes negative", () => {
        const landUse = makeLandUseCrossingZero()
        expect(findLoneNegativeSeriesAtBottom([landUse, makeFossil()])).toBe(
            landUse
        )
    })

    it("skips series that are all zeroes when looking for the bottom", () => {
        const landUse = makeLandUseCrossingZero()
        expect(
            findLoneNegativeSeriesAtBottom([
                makeAllZeros(),
                landUse,
                makeFossil(),
            ])
        ).toBe(landUse)
    })

    it("returns nothing when the bottom series is never negative", () => {
        const landUse = makeSeries("landUse", [
            [1990, 20],
            [2000, 10],
        ])
        expect(
            findLoneNegativeSeriesAtBottom([landUse, makeFossil()])
        ).toBeUndefined()
    })

    it("returns nothing when a series above the bottom one is also negative", () => {
        const alsoNegative = makeSeries("fossil", [
            [1990, 100],
            [2000, -120],
        ])
        expect(
            findLoneNegativeSeriesAtBottom([
                makeLandUseCrossingZero(),
                alsoNegative,
            ])
        ).toBeUndefined()
    })
})

describe(withPointsAtZeroLineCrossings, () => {
    const pointRowsOf = (series: StackedSeries<Time>): number[][] =>
        series.points.map((point) => [
            point.position,
            point.value,
            point.valueOffset,
        ])

    it("adds a point to every series where the bottom series reaches zero", () => {
        const series = withPointsAtZeroLineCrossings(
            stackSeriesInBothDirections([
                makeLandUseCrossingZero(),
                makeFossil(),
            ])
        )
        expect(pointRowsOf(series[0])).toEqual([
            [1990, 30, 0],
            [1997.5, 0, 0],
            [2000, -10, 0],
        ])
        expect(pointRowsOf(series[1])).toEqual([
            [1990, 100, 30],
            [1997.5, 115, 0],
            [2000, 120, 0],
        ])
    })

    it("adds one point to each interval in which the bottom series crosses zero", () => {
        const landUse = makeSeries("landUse", [
            [1990, 30],
            [2000, -10],
            [2010, 30],
        ])
        const fossil = makeSeries("fossil", [
            [1990, 100],
            [2000, 120],
            [2010, 140],
        ])
        const series = withPointsAtZeroLineCrossings(
            stackSeriesInBothDirections([landUse, fossil])
        )
        expect(pointRowsOf(series[0])).toEqual([
            [1990, 30, 0],
            [1997.5, 0, 0],
            [2000, -10, 0],
            [2002.5, 0, 0],
            [2010, 30, 0],
        ])
        expect(pointRowsOf(series[1])).toEqual([
            [1990, 100, 30],
            [1997.5, 115, 0],
            [2000, 120, 0],
            [2002.5, 125, 0],
            [2010, 140, 30],
        ])
    })

    it("takes the crossings from the bottom series that gets drawn", () => {
        const series = withPointsAtZeroLineCrossings(
            stackSeriesInBothDirections([
                makeAllZeros(),
                makeLandUseCrossingZero(),
                makeFossil(),
            ])
        )
        expect(pointRowsOf(series[1])).toEqual([
            [1990, 30, 0],
            [1997.5, 0, 0],
            [2000, -10, 0],
        ])
    })

    it("leaves the series it was given alone", () => {
        const input = stackSeriesInBothDirections([
            makeLandUseCrossingZero(),
            makeFossil(),
        ])
        const before = input.map(pointRowsOf)
        withPointsAtZeroLineCrossings(input)
        expect(input.map(pointRowsOf)).toEqual(before)
    })

    it("adds no point where the bottom series touches zero at a data point", () => {
        const landUse = makeSeries("landUse", [
            [1990, 20],
            [2000, 0],
            [2010, -20],
        ])
        const fossil = makeSeries("fossil", [
            [1990, 100],
            [2000, 110],
            [2010, 120],
        ])
        const series = withPointsAtZeroLineCrossings([landUse, fossil])
        expect(series[0].points.map((point) => point.position)).toEqual([
            1990, 2000, 2010,
        ])
    })

    it("does nothing when a series above the bottom one is also negative", () => {
        const input = [
            makeLandUseCrossingZero(),
            makeSeries("fossil", [
                [1990, 100],
                [2000, -120],
            ]),
        ]
        expect(withPointsAtZeroLineCrossings(input)).toBe(input)
    })

    it("does nothing when the negative series is the only one", () => {
        const input = [makeLandUseCrossingZero()]
        expect(withPointsAtZeroLineCrossings(input)).toBe(input)
    })
})

describe(toPlacedStackedAreaSeries, () => {
    const dualAxis = new DualAxis({
        bounds: new Bounds(0, 0, 600, 400),
        horizontalAxis: new AxisConfig({
            min: 1990,
            max: 2000,
        }).toHorizontalAxis(),
        verticalAxis: new AxisConfig({
            min: -40,
            max: 120,
        }).toVerticalAxis(),
    })
    const at = (time: Time, value: number): { x: number; y: number } => ({
        x: dualAxis.horizontalAxis.place(time),
        y: dualAxis.verticalAxis.place(value),
    })

    const [landUse, fossil] = toPlacedStackedAreaSeries(
        stackSeriesInBothDirections([makeLandUseCrossingZero(), makeFossil()]),
        dualAxis
    )

    it("closes the bottom band against the zero line", () => {
        expect(landUse.areaPoints).toEqual([
            at(1990, 30),
            at(1997.5, 0),
            at(2000, -10),
            at(2000, 0),
            at(1990, 0),
        ])
    })

    it("rests the band above on the zero line from the crossing on", () => {
        expect(fossil.areaPoints).toEqual([
            at(1990, 130),
            at(1997.5, 115),
            at(2000, 120),
            at(2000, 0),
            at(1997.5, 0),
            at(1990, 30),
        ])
    })
})
