import { describe, expect, it } from "vitest"

import { convertDateToDaysSinceEpoch, dayjs } from "@ourworldindata/utils"
import { ColumnTypeNames, Time } from "@ourworldindata/types"
import { OwidTable, TimeColumn } from "@ourworldindata/core-table"
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
    {
        heightPerSeries = 20,
        visibleExclusiveEndTime = 2005,
    }: { heightPerSeries?: number; visibleExclusiveEndTime?: Time } = {}
): PlacedSwimlaneSeries[] {
    const seriesNames = series.map((s) => s.seriesName)
    return toPlacedSwimlaneSeries({
        series,
        labelX: 0,
        heightPerSeries,
        placeSeries: (seriesName) =>
            (seriesNames.indexOf(seriesName) + 0.5) * heightPerSeries,
        placeTime,
        visibleExclusiveEndTime,
        shouldShowSegmentLabels: false,
        segmentLabelStyle: {
            category: { fontSize: 12, fontWeight: 700, lineHeight: 1.2 },
            timeRange: { fontSize: 12, fontWeight: 500, lineHeight: 1.2 },
        },
    })
}

describe("placement", () => {
    it("extends each segment to where the next one starts, and the last one to the exclusive end of the visible range", () => {
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
            { visibleExclusiveEndTime: 2020 }
        )

        expect(row.placedSegments[0]).toMatchObject({ x: 0, width: 200 })
    })

    it("draws each bar centred in its series, with the row spacing split above and below", () => {
        const [row] = placeRows(
            [makeSizedSeries("France", [makeCategorySegment("X", 2000, 2001)])],
            { heightPerSeries: MAX_HEIGHT_PER_SERIES }
        )

        expect(row.height).toBeCloseTo(MAX_HEIGHT_PER_SERIES)
        expect(row.placedSegments[0].height).toBeCloseTo(54)
        expect(row.placedSegments[0].y).toBeCloseTo(-27)
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

describe("emphasis", () => {
    function makeBin(value: string): CategoricalBin {
        return new CategoricalBin({ index: 0, value, label: value, color: "" })
    }

    function findEmphases(
        options: Omit<Parameters<typeof toRenderSwimlaneSeries>[0], "series">
    ): { row: Emphasis; segments: Emphasis[] }[] {
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
    const day = (iso: string): number =>
        convertDateToDaysSinceEpoch(dayjs.utc(iso))

    function makeTimeColumn(
        type: ColumnTypeNames,
        times: number[]
    ): TimeColumn {
        const { timeColumn } = new OwidTable(
            times.map((time) => ({ entityName: "France", time })),
            [{ slug: "time", type }]
        )
        if (!(timeColumn instanceof TimeColumn))
            throw new Error("No time column")
        return timeColumn
    }

    it("formats a run of years as a range", () => {
        expect(
            formatSegmentTimeRange({
                startTime: 2000,
                endTime: 2002,
                timeColumn: makeTimeColumn(ColumnTypeNames.Year, [2000, 2002]),
            })
        ).toEqual("2000 to 2002")
    })

    it("formats a single week as the week's own dates", () => {
        const monday = day("2020-01-20")
        expect(
            formatSegmentTimeRange({
                startTime: monday,
                endTime: monday,
                timeColumn: makeTimeColumn(ColumnTypeNames.Week, [monday]),
            })
        ).toEqual("Week of Jan 20, 2020")
    })

    it("ends a run of weeks where its last week ends", () => {
        const [first, last] = [day("2020-01-20"), day("2020-02-03")]
        expect(
            formatSegmentTimeRange({
                startTime: first,
                endTime: last,
                timeColumn: makeTimeColumn(ColumnTypeNames.Week, [first, last]),
            })
        ).toEqual("Jan 20, 2020 to Feb 9, 2020")
    })
})

describe(formatSegmentDuration, () => {
    function makeYearColumn(): TimeColumn {
        const { timeColumn } = new OwidTable(
            [2000, 2002].map((year) => ({ entityName: "France", year })),
            [{ slug: "year", type: ColumnTypeNames.Year }]
        )
        if (!(timeColumn instanceof TimeColumn))
            throw new Error("No time column")
        return timeColumn
    }

    it("counts a category's run inclusively, so a single time lasts one", () => {
        const timeColumn = makeYearColumn()
        expect(
            formatSegmentDuration({
                segment: makeCategorySegment("Monarchy", 2000, 2002),
                timeColumn,
            })
        ).toEqual("3 years")
        expect(
            formatSegmentDuration({
                segment: makeCategorySegment("Republic", 2005, 2005),
                timeColumn,
            })
        ).toEqual("a year")
    })

    it("counts a gap in the data the same way", () => {
        expect(
            formatSegmentDuration({
                segment: makeMissingSegment(2003, 2004),
                timeColumn: makeYearColumn(),
            })
        ).toEqual("2 years")
    })
})
