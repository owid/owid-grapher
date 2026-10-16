import { describe, expect, it } from "vitest"
import { TimeInterval } from "@ourworldindata/types"
import { formatTimeSpan } from "./ChartUtils"

describe(formatTimeSpan, () => {
    it.each([
        { count: 1, interval: TimeInterval.Day, expected: "a day" },
        { count: 3, interval: TimeInterval.Week, expected: "3 weeks" },
        { count: 1, interval: TimeInterval.Month, expected: "a month" },
        { count: 2, interval: TimeInterval.Quarter, expected: "2 quarters" },
        { count: 1, interval: TimeInterval.Year, expected: "a year" },
        { count: 25, interval: TimeInterval.Year, expected: "25 years" },
        { count: 2, interval: TimeInterval.Decade, expected: "2 decades" },
    ])(
        "writes $count $interval as '$expected'",
        ({ count, interval, expected }) => {
            expect(formatTimeSpan(count, interval)).toEqual(expected)
        }
    )
})
