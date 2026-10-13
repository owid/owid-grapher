import { describe, expect, it } from "vitest"

import { ColumnTypeNames, SwimlaneSegmentLabels } from "@ourworldindata/types"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import { convertDateToDaysSinceEpoch, dayjs } from "@ourworldindata/utils"
import { textWidth } from "../chart/ChartUtils"
import { FontSettings } from "../core/GrapherConstants"
import { formatSegmentTimeRange, shouldLabelSegment } from "./SwimlaneLabels"

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

describe(shouldLabelSegment, () => {
    const fontSettings: FontSettings = {
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.2,
    }
    const twoLinesHeight = 2 * 12 * 1.2
    const padding = 2 * 8

    const category = "Monarchy"
    const timeRange = "2000–2002"
    const widestLine = Math.max(
        textWidth(category, fontSettings),
        textWidth(timeRange, fontSettings)
    )

    function shouldLabel(
        size: { width: number; height: number },
        segmentLabels = SwimlaneSegmentLabels.CategoryAndTimeRange
    ): boolean {
        return shouldLabelSegment({
            segmentLabels,
            category,
            timeRange,
            fontSettings,
            ...size,
        })
    }

    it("labels a segment with room for both lines and their padding", () => {
        expect(
            shouldLabel({
                width: widestLine + padding,
                height: twoLinesHeight,
            })
        ).toBe(true)
    })

    it("skips a segment that is too narrow for the wider line", () => {
        expect(
            shouldLabel({
                width: widestLine + padding - 1,
                height: twoLinesHeight,
            })
        ).toBe(false)
    })

    it("measures the time range when it is wider than the category", () => {
        expect(
            shouldLabelSegment({
                segmentLabels: SwimlaneSegmentLabels.CategoryAndTimeRange,
                category: "X",
                timeRange,
                fontSettings,
                width: textWidth("X", fontSettings) + padding,
                height: twoLinesHeight,
            })
        ).toBe(false)
    })

    it("skips a segment that is too short for two lines", () => {
        expect(
            shouldLabel({
                width: widestLine + padding,
                height: twoLinesHeight - 0.1,
            })
        ).toBe(false)
    })

    it("never labels when segment labels are turned off", () => {
        expect(
            shouldLabel(
                { width: 1000, height: 1000 },
                SwimlaneSegmentLabels.None
            )
        ).toBe(false)
    })
})
