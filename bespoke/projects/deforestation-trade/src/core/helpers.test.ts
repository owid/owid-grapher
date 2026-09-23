import { describe, expect, it } from "vitest"

import {
    describeYearRange,
    formatYearRange,
    resolveYearIndexRange,
    rowsForYearRange,
    worldContextForYearRange,
} from "./helpers.js"
import type { TradeSeries } from "./types.js"

const series = (
    partner: string,
    values: (number | null)[],
    group = "soy"
): TradeSeries => ({ partner, group, values })

describe(rowsForYearRange, () => {
    const data = [
        series("A", [1, 2, 3, 4, 5]),
        series("B", [null, null, 10, null, 20]),
        series("C", [null, null, null, null, null]),
        series("D", [0, -1, null, 0, 0]),
    ]

    it("slices at one year when the range is a single index", () => {
        expect(rowsForYearRange(data, 2, 2)).toEqual([
            { partner: "A", group: "soy", value: 3 },
            { partner: "B", group: "soy", value: 10 },
        ])
    })

    it("sums every series over the range, skipping nulls", () => {
        expect(rowsForYearRange(data, 1, 4)).toEqual([
            { partner: "A", group: "soy", value: 14 },
            { partner: "B", group: "soy", value: 30 },
        ])
    })

    it("drops series with no flow in the range", () => {
        expect(rowsForYearRange(data, 0, 1)).toEqual([
            { partner: "A", group: "soy", value: 3 },
        ])
    })
})

describe(resolveYearIndexRange, () => {
    it("is the slider's year for a single year", () => {
        expect(resolveYearIndexRange("single-year", 3, 19)).toEqual({
            startIndex: 3,
            endIndex: 3,
        })
    })

    it("ends a preset at the most recent year, ignoring the slider", () => {
        expect(resolveYearIndexRange("last-5-years", 3, 19)).toEqual({
            startIndex: 14,
            endIndex: 18,
        })
        expect(resolveYearIndexRange("last-10-years", 3, 19)).toEqual({
            startIndex: 9,
            endIndex: 18,
        })
    })

    it("reaches back only as far as the data goes", () => {
        expect(resolveYearIndexRange("last-10-years", 0, 4)).toEqual({
            startIndex: 0,
            endIndex: 3,
        })
    })
})

describe("year range labels", () => {
    it("names a single year plainly", () => {
        expect(formatYearRange({ start: 2023, end: 2023 })).toBe("2023")
        expect(describeYearRange({ start: 2023, end: 2023 })).toBe("in 2023")
    })

    it("spells out a span", () => {
        expect(formatYearRange({ start: 2019, end: 2023 })).toBe("2019–2023")
        expect(describeYearRange({ start: 2019, end: 2023 })).toBe(
            "between 2019 and 2023"
        )
    })
})

describe(worldContextForYearRange, () => {
    const worldTotals = [
        { group: "Pasture", values: [60, 40, 30] },
        { group: "Cereals", values: [40, 60, 30] },
        { group: "Vegetables", values: [0, 0, 40] },
    ]

    it("sums a single year and names its largest group", () => {
        expect(worldContextForYearRange(worldTotals, 0, 0)).toEqual({
            total: 100,
            topGroup: "Pasture",
            topShare: 0.6,
        })
    })

    it("sums every group over a range of years", () => {
        expect(worldContextForYearRange(worldTotals, 1, 2)).toEqual({
            total: 200,
            topGroup: "Cereals",
            topShare: 0.45,
        })
    })

    it("has nothing to say without data", () => {
        expect(worldContextForYearRange([], 0, 0)).toBeUndefined()
    })
})
