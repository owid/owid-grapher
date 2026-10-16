import { describe, expect, it } from "vitest"

import {
    Bounds,
    convertDateToDaysSinceEpoch,
    dayjs,
} from "@ourworldindata/utils"
import { ColumnTypeNames, Time } from "@ourworldindata/types"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState"
import { FocusArray } from "../focus/FocusArray"
import { CategoricalBin } from "../color/ColorScaleBin"
import { NO_DATA_LABEL } from "../color/ColorScale"
import { Emphasis } from "../interaction/Emphasis"
import {
    SwimlaneSegment,
    PlacedSwimlaneSeries,
    SizedSwimlaneSeries,
} from "./SwimlaneChartConstants"
import {
    findRowAtY,
    findSegmentAtX,
    formatSegmentTimeRange,
    toPlacedSwimlaneSeries,
    toRenderSwimlaneSeries,
    toSegmentOutlinePath,
} from "./SwimlaneChartHelpers"

const placeTime = (time: Time): number => (time - 2000) * 10

function makeCategorySegment(
    category: string,
    startTime: Time,
    endTime: Time
): SwimlaneSegment {
    return {
        kind: "category",
        category,
        startTime,
        endTime,
        visibleStartTime: startTime,
        visibleEndTime: endTime,
        color: "#000",
        categoryLabel: category,
    }
}

function makeMissingSegment(startTime: Time, endTime: Time): SwimlaneSegment {
    return {
        kind: "missing",
        startTime,
        endTime,
        visibleStartTime: startTime,
        visibleEndTime: endTime,
    }
}

function makeSizedSeries(
    entityName: string,
    segments: SwimlaneSegment[]
): SizedSwimlaneSeries {
    return {
        seriesName: entityName,
        entityName,
        color: "#000",
        segments,
        label: new SeriesLabelState({
            text: entityName,
            maxWidth: 100,
            fontSize: 12,
        }),
    }
}

function placeRows(
    series: SizedSwimlaneSeries[],
    bounds = new Bounds(0, 0, 200, 400),
    visibleExclusiveEndTime: Time = 2005
): PlacedSwimlaneSeries[] {
    return toPlacedSwimlaneSeries({
        series,
        bounds,
        placeTime,
        visibleExclusiveEndTime,
    })
}

describe("placement", () => {
    it("extends each segment to where the next one starts, and the last one a step past its end", () => {
        const [row] = placeRows([
            makeSizedSeries("France", [
                makeCategorySegment("X", 2000, 2001),
                makeMissingSegment(2002, 2003),
                makeCategorySegment("Y", 2004, 2004),
            ]),
        ])

        expect(
            row.placedSegments.map(({ x, width }) => ({ x, width }))
        ).toEqual([
            { x: 0, width: 20 },
            { x: 20, width: 20 },
            { x: 40, width: 10 },
        ])
    })

    it("ends the last segment at the plot end, however long a time interval is", () => {
        const [row] = placeRows(
            [makeSizedSeries("France", [makeCategorySegment("X", 2000, 2010)])],
            new Bounds(0, 0, 200, 400),
            2020
        )

        expect(row.placedSegments[0]).toMatchObject({ x: 0, width: 200 })
    })

    it("caps a lone row at the maximum row height and centers it", () => {
        const [row] = placeRows([
            makeSizedSeries("France", [makeCategorySegment("X", 2000, 2001)]),
        ])

        expect(row.y).toBeCloseTo(200)
        expect(row.placedSegments[0].height).toBeCloseTo(36)
        expect(row.placedSegments[0].y).toBeCloseTo(-18)
    })

    it("splits the plot height evenly between many rows", () => {
        const rows = placeRows(
            Array.from({ length: 20 }, (_, index) =>
                makeSizedSeries(`Entity ${index}`, [
                    makeCategorySegment("X", 2000, 2001),
                ])
            )
        )

        expect(rows.map((row) => row.slotHeight)).toEqual(Array(20).fill(20))
        expect(rows[0].y).toBeCloseTo(10)
        expect(rows[19].y).toBeCloseTo(390)
    })
})

describe("hit-testing", () => {
    const [france, germany] = placeRows(
        [
            makeSizedSeries("France", [
                makeCategorySegment("X", 2000, 2001),
                makeCategorySegment("Y", 2002, 2003),
            ]),
            makeSizedSeries("Germany", [makeCategorySegment("X", 2000, 2003)]),
        ],
        new Bounds(0, 0, 200, 400),
        2004
    )
    const [x, y] = france.placedSegments

    it("finds a segment from its start up to, but not including, its end", () => {
        expect(findSegmentAtX(france.placedSegments, 0)).toBe(x)
        expect(findSegmentAtX(france.placedSegments, 19.9)).toBe(x)
        expect(findSegmentAtX(france.placedSegments, 20)).toBe(y)
    })

    it("finds no segment before the first or after the last", () => {
        expect(findSegmentAtX(france.placedSegments, -1)).toBeUndefined()
        expect(findSegmentAtX(france.placedSegments, 40)).toBeUndefined()
    })

    it("finds a row from the top of its slot up to, but not including, the next", () => {
        const rows = placeRows(
            [makeSizedSeries("France", []), makeSizedSeries("Germany", [])],
            new Bounds(0, 0, 200, 40)
        )

        expect(findRowAtY(rows, 0)).toBe(rows[0])
        expect(findRowAtY(rows, 19.9)).toBe(rows[0])
        expect(findRowAtY(rows, 20)).toBe(rows[1])
        expect(findRowAtY(rows, 40)).toBeUndefined()
    })

    it("finds no row above or below the centered block of rows", () => {
        expect(findRowAtY([france, germany], 100)).toBeUndefined()
        expect(findRowAtY([france, germany], 300)).toBeUndefined()
    })
})

describe("emphasis", () => {
    const rows = placeRows([
        makeSizedSeries("France", [
            makeCategorySegment("X", 2000, 2001),
            makeMissingSegment(2002, 2002),
            makeCategorySegment("Y", 2003, 2003),
        ]),
        makeSizedSeries("Germany", [
            makeCategorySegment("Y", 2000, 2001),
            makeCategorySegment("X", 2002, 2003),
        ]),
    ])

    function makeBin(value: string): CategoricalBin {
        return new CategoricalBin({ index: 0, value, label: value, color: "" })
    }

    function findEmphases(
        options: Omit<Parameters<typeof toRenderSwimlaneSeries>[0], "series">
    ): { row: Emphasis; segments: Emphasis[] }[] {
        return toRenderSwimlaneSeries({ series: rows, ...options }).map(
            (series) => ({
                row: series.emphasis,
                segments: series.placedSegments.map(
                    (segment) => segment.emphasis
                ),
            })
        )
    }

    const { Default, Highlighted, Muted } = Emphasis

    it("is default everywhere without hover or focus", () => {
        expect(findEmphases({ focusArray: new FocusArray() })).toEqual([
            { row: Default, segments: [Default, Default, Default] },
            { row: Default, segments: [Default, Default] },
        ])
    })

    it("highlights the hovered segment by its row and start time, and mutes every other segment in every row", () => {
        expect(
            findEmphases({
                focusArray: new FocusArray(),
                hoveredSegment: {
                    entityName: "France",
                    segment: makeCategorySegment("X", 2000, 2001),
                },
            })
        ).toEqual([
            { row: Default, segments: [Highlighted, Muted, Muted] },
            { row: Default, segments: [Muted, Muted] },
        ])
    })

    it("highlights a hovered legend category in every row", () => {
        expect(
            findEmphases({
                focusArray: new FocusArray(),
                hoveredLegendBin: makeBin("X"),
            })
        ).toEqual([
            { row: Default, segments: [Highlighted, Muted, Muted] },
            { row: Default, segments: [Muted, Highlighted] },
        ])
    })

    it("highlights only missing segments for the no-data legend bin", () => {
        expect(
            findEmphases({
                focusArray: new FocusArray(),
                hoveredLegendBin: makeBin(NO_DATA_LABEL),
            })
        ).toEqual([
            { row: Default, segments: [Muted, Highlighted, Muted] },
            { row: Default, segments: [Muted, Muted] },
        ])
    })

    it("highlights a focused row and mutes the others", () => {
        expect(
            findEmphases({ focusArray: new FocusArray().add("Germany") })
        ).toEqual([
            { row: Muted, segments: [Muted, Muted, Muted] },
            { row: Highlighted, segments: [Highlighted, Highlighted] },
        ])
    })
})

describe("segment outline", () => {
    it("points the start inward when the window crops the start", () => {
        expect(
            toSegmentOutlinePath({
                x: 0,
                y: 0,
                width: 30,
                height: 10,
                isStartCropped: true,
                isEndCropped: false,
            })
        ).toEqual("M 0,5 L 4,0 L 30,0 L 30,10 L 4,10 Z")
    })

    it("points the end outward when the window crops the end", () => {
        expect(
            toSegmentOutlinePath({
                x: 0,
                y: 0,
                width: 30,
                height: 10,
                isStartCropped: false,
                isEndCropped: true,
            })
        ).toEqual("M 0,0 L 26,0 L 30,5 L 26,10 L 0,10 Z")
    })

    it("limits the taper to a third of a narrow segment's width", () => {
        expect(
            toSegmentOutlinePath({
                x: 0,
                y: 0,
                width: 6,
                height: 10,
                isStartCropped: true,
                isEndCropped: true,
            })
        ).toEqual("M 0,5 L 2,0 L 4,0 L 6,5 L 4,10 L 2,10 Z")
    })
})

describe(formatSegmentTimeRange, () => {
    const day = (iso: string): number =>
        convertDateToDaysSinceEpoch(dayjs.utc(iso))

    function makeTimeColumn(
        type: ColumnTypeNames,
        times: number[]
    ): CoreColumn {
        const table = new OwidTable(
            times.map((time) => ({ entityName: "France", time })),
            [{ slug: "time", type }]
        )
        return table.timeColumn
    }

    it("formats a single year as one time", () => {
        expect(
            formatSegmentTimeRange({
                startTime: 2000,
                endTime: 2000,
                timeColumn: makeTimeColumn(ColumnTypeNames.Year, [2000]),
            })
        ).toEqual("2000")
    })

    it("formats a run of years as a range", () => {
        expect(
            formatSegmentTimeRange({
                startTime: 2000,
                endTime: 2002,
                timeColumn: makeTimeColumn(ColumnTypeNames.Year, [2000, 2002]),
            })
        ).toEqual("2000–2002")
    })

    it("formats a single week as the week's own dates", () => {
        const monday = day("2020-01-20")
        expect(
            formatSegmentTimeRange({
                startTime: monday,
                endTime: monday,
                timeColumn: makeTimeColumn(ColumnTypeNames.Week, [monday]),
            })
        ).toEqual(
            makeTimeColumn(ColumnTypeNames.Week, [monday]).formatTime(monday)
        )
    })

    it("ends a run of weeks where its last week ends", () => {
        const [first, last] = [day("2020-01-20"), day("2020-02-03")]
        expect(
            formatSegmentTimeRange({
                startTime: first,
                endTime: last,
                timeColumn: makeTimeColumn(ColumnTypeNames.Week, [first, last]),
            })
        ).toEqual("Jan 20, 2020–Feb 9, 2020")
    })

    it("ends a run of quarters where its last quarter ends", () => {
        const [first, last] = [day("2020-01-01"), day("2020-07-01")]
        expect(
            formatSegmentTimeRange({
                startTime: first,
                endTime: last,
                timeColumn: makeTimeColumn(ColumnTypeNames.Quarter, [
                    first,
                    last,
                ]),
            })
        ).toEqual("Jan 2020–Sep 2020")
    })
})
