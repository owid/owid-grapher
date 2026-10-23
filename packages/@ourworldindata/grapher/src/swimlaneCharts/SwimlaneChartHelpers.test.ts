import { describe, expect, it } from "vitest"

import { ColumnTypeNames, Time } from "@ourworldindata/types"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState"
import { FocusArray } from "../focus/FocusArray"
import { CategoricalBin } from "../color/ColorScaleBin"
import { NO_DATA_LABEL } from "../color/ColorScale"
import { Emphasis } from "../interaction/Emphasis"
import {
    MAX_HEIGHT_PER_SERIES,
    SwimlaneSegment,
    PlacedSwimlaneSeries,
    SizedSwimlaneSeries,
} from "./SwimlaneChartConstants"
import {
    computeHeightPerSeries,
    findRowAtY,
    findSegmentAtX,
    formatSegmentDuration,
    formatSegmentTimeRange,
    toPlacedSwimlaneSeries,
    toRenderSwimlaneSeries,
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
        timeRangeLabel: `${startTime}–${endTime}`,
    }
}

function makeMissingSegment(startTime: Time, endTime: Time): SwimlaneSegment {
    return {
        kind: "missing",
        startTime,
        endTime,
        visibleStartTime: startTime,
        visibleEndTime: endTime,
        timeRangeLabel: `${startTime}–${endTime}`,
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

/** Places the rows one under the other from y = 0, 20px apart by default */
function placeRows(
    series: SizedSwimlaneSeries[],
    { heightPerSeries = 20 }: { heightPerSeries?: number } = {}
): PlacedSwimlaneSeries[] {
    const seriesNames = series.map((s) => s.seriesName)
    return toPlacedSwimlaneSeries({
        series,
        labelX: 0,
        heightPerSeries,
        placeSeries: (seriesName) =>
            (seriesNames.indexOf(seriesName) + 0.5) * heightPerSeries,
        placeTime,
        shouldShowSegmentLabels: false,
        segmentLabelStyle: {
            category: { fontSize: 12, fontWeight: 700, lineHeight: 1.2 },
            timeRange: { fontSize: 12, fontWeight: 500, lineHeight: 1.2 },
        },
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

    it("draws each bar centred in its series, with the row spacing split above and below", () => {
        const [row] = placeRows(
            [makeSizedSeries("France", [makeCategorySegment("X", 2000, 2001)])],
            { heightPerSeries: MAX_HEIGHT_PER_SERIES }
        )

        expect(row.height).toBeCloseTo(MAX_HEIGHT_PER_SERIES)
        expect(row.placedSegments[0].height).toBeCloseTo(36)
        expect(row.placedSegments[0].y).toBeCloseTo(-18)
    })
})

describe(computeHeightPerSeries, () => {
    it("caps a lone series at the height whose bar is the maximum row height", () => {
        expect(
            computeHeightPerSeries({ height: 400, rowCount: 1 })
        ).toBeCloseTo(MAX_HEIGHT_PER_SERIES)
    })

    it("splits the height evenly between many series", () => {
        expect(computeHeightPerSeries({ height: 400, rowCount: 20 })).toBe(20)
    })
})

describe("hit-testing", () => {
    const [france, germany] = placeRows([
        makeSizedSeries("France", [
            makeCategorySegment("X", 2000, 2001),
            makeCategorySegment("Y", 2002, 2003),
        ]),
        makeSizedSeries("Germany", [makeCategorySegment("X", 2000, 2003)]),
    ])
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

    it("finds a row from halfway to the row above up to, but not including, halfway to the row below", () => {
        const rows = placeRows([
            makeSizedSeries("France", []),
            makeSizedSeries("Germany", []),
        ])

        expect(findRowAtY(rows, 0)).toBe(rows[0])
        expect(findRowAtY(rows, 19.9)).toBe(rows[0])
        expect(findRowAtY(rows, 20)).toBe(rows[1])
        expect(findRowAtY(rows, 40)).toBeUndefined()
    })

    it("finds no row above the first or below the last", () => {
        expect(findRowAtY([france, germany], -1)).toBeUndefined()
        expect(findRowAtY([france, germany], 40)).toBeUndefined()
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

describe(formatSegmentTimeRange, () => {
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
        ).toEqual("2000 to 2002")
    })
})

describe(formatSegmentDuration, () => {
    function makeYearColumn(): CoreColumn {
        return new OwidTable(
            [2000, 2002].map((year) => ({ entityName: "France", year })),
            [{ slug: "year", type: ColumnTypeNames.Year }]
        ).timeColumn
    }

    it("counts a category's run from its first to its last time", () => {
        expect(
            formatSegmentDuration({
                segment: makeCategorySegment("Monarchy", 2000, 2002),
                timeColumn: makeYearColumn(),
            })
        ).toEqual("2 years")
    })

    it("gives a single-time run and a missing segment no duration", () => {
        const timeColumn = makeYearColumn()
        expect(
            formatSegmentDuration({
                segment: makeCategorySegment("Republic", 2005, 2005),
                timeColumn,
            })
        ).toBeUndefined()
        expect(
            formatSegmentDuration({
                segment: makeMissingSegment(2003, 2004),
                timeColumn,
            })
        ).toBeUndefined()
    })
})
