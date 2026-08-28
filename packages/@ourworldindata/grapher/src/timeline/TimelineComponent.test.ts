/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it } from "vitest"
import * as React from "react"
import * as R from "remeda"
import { fireEvent, render } from "@testing-library/react"
import { ColumnTypeNames, OwidTableSlugs } from "@ourworldindata/types"
import {
    MissingColumn,
    OwidTable,
    TimeColumn,
} from "@ourworldindata/core-table"
import { convertDateToDaysSinceEpoch, dayjs } from "@ourworldindata/utils"
import {
    daysSinceEpochToCalendarDate,
    calendarDateToDaysSinceEpoch,
    TimelineComponent,
} from "./TimelineComponent"
import { TimelineController } from "./TimelineController"

it("performs round-trip date conversion correctly", () => {
    const testValues = [
        // Epoch and nearby
        0,
        1,
        -1,
        // First week
        7,
        -7,
        // First month
        30,
        31,
        -30,
        -31,
        // Around leap day 2020 (Feb 29 = day 39)
        38,
        39,
        40,
        // First 100 days
        100,
        -100,
        // End of first year (2020 was leap year, so 366 days)
        345,
        346,
        365,
        366,
        // Multiple years
        730, // ~2 years
        1095, // ~3 years
        1461, // ~4 years (includes leap year)
        -365,
        -366,
        -730,
        // Large values (10+ years)
        3650, // ~10 years
        -3650,
        // Very large values (100+ years)
        36500, // ~100 years
        -36500,
        // Random values to catch edge cases
        999,
        1000,
        1001,
        -999,
        -1000,
        -1001,
    ]

    for (const original of testValues) {
        const roundTrip = calendarDateToDaysSinceEpoch(
            daysSinceEpochToCalendarDate(original)
        )
        expect(roundTrip).toEqual(original)
    }
})

/** A time column of the given type, to format the timeline's labels with */
function makeTimeColumn(type: ColumnTypeNames): TimeColumn {
    const slug = OwidTableSlugs.Time
    const table = new OwidTable({ entityName: ["usa"], [slug]: [0] }, [
        { slug, type },
    ])
    const column = table.timeColumn
    if (column instanceof MissingColumn)
        throw new Error(`No time column for ${type}`)
    return column
}

// dayjs splits "quarter" off into its own `add` overload, so these can't share
// one helper parameterised by unit without a cast

/** Days-since-epoch for `count` consecutive quarters starting at `start` */
const quarters = (start: string, count: number): number[] =>
    R.range(0, count).map((index) =>
        convertDateToDaysSinceEpoch(dayjs.utc(start).add(index, "quarter"))
    )

/** Days-since-epoch for `count` consecutive ISO weeks starting at `start` */
const weeks = (start: string, count: number): number[] =>
    R.range(0, count).map((index) =>
        convertDateToDaysSinceEpoch(dayjs.utc(start).add(index, "week"))
    )

function renderTimeline({
    type,
    times,
    startTime,
    endTime,
}: {
    type: ColumnTypeNames
    times: number[]
    startTime: number
    endTime: number
}): { container: HTMLElement; controller: TimelineController } {
    const controller = new TimelineController({
        times,
        startHandleTimeBound: startTime,
        endHandleTimeBound: endTime,
        timeColumn: makeTimeColumn(type),
        disablePlay: true,
    })
    const { container } = render(
        React.createElement(TimelineComponent, {
            timelineController: controller,
        })
    )
    return { container, controller }
}

describe("period-aware timeline labels", () => {
    /** The two edge button labels, in DOM order: min then max */
    const edgeLabels = (container: HTMLElement): (string | null)[] =>
        [
            ...container.querySelectorAll(
                ".GrapherTimeline__TimelineEdgeButton"
            ),
        ].map((button) => button.textContent)

    /** The start and end handle labels */
    const handleLabels = (container: HTMLElement): (string | null)[] =>
        [".startMarker", ".endMarker"].map(
            (selector) =>
                container
                    .querySelector(`.GrapherTimeline__Handle${selector}`)
                    ?.getAttribute("aria-label") ?? null
        )

    it("ends the end-side labels on the last quarter's final month", () => {
        // Q1 2025 through Q2 2026
        const times = quarters("2025-01-01", 6)
        const { container } = renderTimeline({
            type: ColumnTypeNames.Quarter,
            times,
            startTime: times[2], // Q3 2025
            endTime: times[5], // Q2 2026
        })

        // The min edge stays on the first quarter's opening month, the max edge
        // runs to the last quarter's closing month, matching the chart's axis.
        expect(edgeLabels(container)).toEqual(["Jan 2025", "Jun 2026"])
        expect(handleLabels(container)).toEqual([
            "Start time: Jul 2025",
            "End time: Jun 2026",
        ])
    })

    it("ends the end-side labels on the last week's final day", () => {
        // Five ISO weeks, the last one running Jun 1-7, 2026
        const times = weeks("2026-05-04", 5)
        const { container } = renderTimeline({
            type: ColumnTypeNames.Week,
            times,
            startTime: times[1],
            endTime: times[4],
        })

        expect(edgeLabels(container)).toEqual(["May 4, 2026", "Jun 7, 2026"])
        expect(handleLabels(container)).toEqual([
            "Start time: May 11, 2026",
            "End time: Jun 7, 2026",
        ])
    })

    it("leaves yearly labels unchanged", () => {
        const times = R.range(2000, 2006)
        const { container } = renderTimeline({
            type: ColumnTypeNames.Year,
            times,
            startTime: 2002,
            endTime: 2005,
        })

        expect(edgeLabels(container)).toEqual(["2000", "2005"])
        expect(handleLabels(container)).toEqual([
            "Start time: 2002",
            "End time: 2005",
        ])
    })

    it("shows a single label when both handles sit on the same period", () => {
        const times = quarters("2025-01-01", 6)
        const { container } = renderTimeline({
            type: ColumnTypeNames.Quarter,
            times,
            startTime: times[5],
            endTime: times[5], // both handles on Q2 2026
        })

        // The two handles describe the ends of the one selected quarter...
        expect(handleLabels(container)).toEqual([
            "Start time: Apr 2026",
            "End time: Jun 2026",
        ])

        // ...but only the end handle carries a tooltip, so the two never appear
        // on screen at once and cannot read as disagreeing.
        const endHandle = container.querySelector(
            ".GrapherTimeline__Handle.endMarker"
        )!
        fireEvent.focus(endHandle)
        const tooltips = container.querySelectorAll(
            ".EditableTimeTooltip, .SimpleTimeTooltip"
        )
        expect(tooltips).toHaveLength(1)
        expect(tooltips[0].textContent).toEqual("Jun 2026")
    })
})

describe("period-aware end-time editing", () => {
    /** Opens a handle's editable tooltip and returns the handle */
    function openPicker(
        container: HTMLElement,
        marker: "startMarker" | "endMarker"
    ): HTMLElement {
        const handle = container.querySelector<HTMLElement>(
            `.GrapherTimeline__Handle.${marker}`
        )!
        fireEvent.focus(handle)
        fireEvent.click(handle.querySelector(".EditableTimeTooltip__Button")!)
        return handle
    }

    /** The date an open date picker holds, read off its editable segments */
    function pickerDate(handle: HTMLElement): Record<string, string | null> {
        const segments = handle.querySelectorAll(
            '.GrapherTimeline__DateInputSegment[role="spinbutton"]'
        )
        return Object.fromEntries(
            [...segments].map((segment) => [
                segment.getAttribute("data-type"),
                segment.getAttribute("aria-valuenow"),
            ])
        )
    }

    const monthSegment = (handle: HTMLElement): Element =>
        handle.querySelector(
            '.GrapherTimeline__DateInputSegment[data-type="month"]'
        )!

    /** Commits whatever date an open date picker holds, as Enter does */
    function commitPicker(handle: HTMLElement): void {
        fireEvent.keyDown(monthSegment(handle), { key: "Enter" })
        // Committing closes the picker, so a key that went nowhere shows up here
        expect(
            handle.querySelector(".EditableTimeTooltip__Button")
        ).not.toBeNull()
    }

    it("opens the end handle's input on the quarter's closing month", () => {
        // Q1 2025 through Q2 2026
        const times = quarters("2025-01-01", 6)
        const { container } = renderTimeline({
            type: ColumnTypeNames.Quarter,
            times,
            startTime: times[2], // Q3 2025
            endTime: times[5], // Q2 2026
        })

        // The end label reads the quarter's closing month, so the input has to
        // open on that month rather than on the quarter's representative day.
        expect(pickerDate(openPicker(container, "endMarker"))).toEqual({
            month: "6",
            year: "2026",
        })

        // The start handle still opens on its quarter's opening month
        expect(pickerDate(openPicker(container, "startMarker"))).toEqual({
            month: "7",
            year: "2025",
        })
    })

    it("opens the end handle's input on the week's last day", () => {
        // Five ISO weeks, the last one running Jun 1-7, 2026
        const times = weeks("2026-05-04", 5)
        const { container } = renderTimeline({
            type: ColumnTypeNames.Week,
            times,
            startTime: times[1], // the week of May 11
            endTime: times[4], // the week of Jun 1
        })

        expect(pickerDate(openPicker(container, "endMarker"))).toEqual({
            month: "6",
            day: "7",
            year: "2026",
        })
        expect(pickerDate(openPicker(container, "startMarker"))).toEqual({
            month: "5",
            day: "11",
            year: "2026",
        })
    })

    it("leaves a single selected period untouched when committed unchanged", () => {
        // Both handles on one period is its own path: the input then drives
        // start and end together rather than just the end handle.
        const times = quarters("2025-01-01", 6)
        const { container, controller } = renderTimeline({
            type: ColumnTypeNames.Quarter,
            times,
            startTime: times[5],
            endTime: times[5], // both handles on Q2 2026
        })

        const handle = openPicker(container, "endMarker")
        expect(pickerDate(handle)).toEqual({ month: "6", year: "2026" })

        commitPicker(handle)
        expect(controller.startTime).toEqual(times[5])
        expect(controller.endTime).toEqual(times[5])
    })

    it("resolves a date inside the selected quarter back to that quarter", () => {
        const times = quarters("2025-01-01", 6)
        const { container, controller } = renderTimeline({
            type: ColumnTypeNames.Quarter,
            times,
            startTime: times[2], // Q3 2025
            endTime: times[5], // Q2 2026
        })

        // Stepping back from Jun through May to Apr stays inside Q2 2026...
        const handle = openPicker(container, "endMarker")
        fireEvent.keyDown(monthSegment(handle), { key: "ArrowDown" })
        fireEvent.keyDown(monthSegment(handle), { key: "ArrowDown" })
        expect(pickerDate(handle).month).toEqual("4")

        // ...so committing it must not slip into the quarter before it
        commitPicker(handle)
        expect(controller.endTime).toEqual(times[5])
    })

    it("holds the end input to the timeline's own bounds", () => {
        const times = quarters("2025-01-01", 6)
        const { container, controller } = renderTimeline({
            type: ColumnTypeNames.Quarter,
            times,
            startTime: times[2],
            endTime: times[5], // the last quarter
        })

        // Jul 2026 is past the last quarter's closing month, so committing it
        // leaves the selection on the last quarter instead of moving off it.
        const handle = openPicker(container, "endMarker")
        fireEvent.keyDown(monthSegment(handle), { key: "ArrowUp" })
        expect(pickerDate(handle).month).toEqual("7")

        commitPicker(handle)
        expect(controller.endTime).toEqual(controller.maxTime)
        expect(controller.startTime).toEqual(times[2])
    })
})
