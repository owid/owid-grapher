import { expect, it, describe } from "vitest"
import {
    dayjs,
    convertDaysSinceEpochToDate,
    convertDateToDaysSinceEpoch,
} from "@ourworldindata/utils"
import {
    buildDiscreteMonthlyAxisTicks,
    buildContinuousMonthlyAxisTicks,
    getDiscreteMonthlyTickOptions,
} from "./timeAxisTicks"

// Day-since-epoch for a "YYYY-MM-DD" date
const day = (date: string): number =>
    convertDateToDaysSinceEpoch(dayjs.utc(date))

const asDates = (ticks: number[]): string[] =>
    ticks.map((t) => convertDaysSinceEpochToDate(t).format("YYYY-MM-DD"))

describe(buildContinuousMonthlyAxisTicks, () => {
    // The grid tick values, as YYYY-MM-DD (or undefined for a degenerate span).
    const gridDates = (
        min: string,
        max: string,
        targetCount: number
    ): string[] | undefined => {
        const ticks = buildContinuousMonthlyAxisTicks({
            domain: [day(min), day(max)],
            targetCount,
        })
        return ticks && asDates(ticks.map((tick) => tick.value))
    }

    it("steps every month for short spans", () => {
        expect(gridDates("2020-01-01", "2020-03-01", 6)).toEqual([
            "2020-01-01",
            "2020-02-01",
            "2020-03-01",
        ])
    })

    it("steps every other month, anchored to January", () => {
        expect(gridDates("2020-01-01", "2020-09-01", 6)).toEqual([
            "2020-01-01",
            "2020-03-01",
            "2020-05-01",
            "2020-07-01",
            "2020-09-01",
        ])
    })

    it("steps by quarter (Jan/Apr/Jul/Oct) across a ~1.5-year span", () => {
        expect(gridDates("2020-01-01", "2021-06-01", 6)).toEqual([
            "2020-01-01",
            "2020-04-01",
            "2020-07-01",
            "2020-10-01",
            "2021-01-01",
            "2021-04-01",
        ])
    })

    it("steps by whole years for multi-year spans", () => {
        expect(gridDates("2018-03-01", "2021-11-01", 4)).toEqual([
            "2019-01-01",
            "2020-01-01",
            "2021-01-01",
        ])
    })

    it("snaps to a 5-year grid for long spans", () => {
        expect(gridDates("2007-06-01", "2022-06-01", 6)).toEqual([
            "2010-01-01",
            "2015-01-01",
            "2020-01-01",
        ])
    })

    it("returns undefined for a degenerate (single-month) span", () => {
        expect(gridDates("2020-05-01", "2020-05-01", 6)).toBeUndefined()
        expect(gridDates("2020-05-03", "2020-05-28", 6)).toBeUndefined()
    })

    it("only produces first-of-month ticks within the domain", () => {
        const minDay = day("2015-07-15")
        const maxDay = day("2019-02-20")
        const ticks = buildContinuousMonthlyAxisTicks({
            domain: [minDay, maxDay],
            targetCount: 6,
        })!
        for (const { value } of ticks) {
            expect(value).toBeGreaterThanOrEqual(minDay)
            expect(value).toBeLessThanOrEqual(maxDay)
            expect(convertDaysSinceEpochToDate(value).date()).toBe(1)
        }
    })

    // The tick labels (grid values are covered above).
    const labels = (min: string, max: string, targetCount: number): string[] =>
        buildContinuousMonthlyAxisTicks({
            domain: [day(min), day(max)],
            targetCount,
        })!.map((tick) => tick.label!)

    it("gives every tick priority 2", () => {
        const ticks = buildContinuousMonthlyAxisTicks({
            domain: [day("2020-01-01"), day("2022-01-01")],
            targetCount: 3,
        })!
        expect(ticks.map((t) => t.priority)).toEqual([2, 2, 2])
    })

    it("labels a yearly-cadence grid with bare years", () => {
        expect(labels("2020-01-01", "2023-01-01", 4)).toEqual([
            "2020",
            "2021",
            "2022",
            "2023",
        ])
    })

    it("shows the year on the first tick and each January, month-only otherwise", () => {
        expect(labels("2020-01-01", "2021-06-01", 6)).toEqual([
            "Jan 2020",
            "Apr",
            "Jul",
            "Oct",
            "Jan 2021",
            "Apr",
        ])
    })

    it("shows the year only on the first tick when the grid has no January", () => {
        expect(labels("2020-02-01", "2020-11-01", 4)).toEqual([
            "Apr 2020",
            "Jul",
            "Oct",
        ])
    })
})

describe(buildDiscreteMonthlyAxisTicks, () => {
    it("labels every bar with month + year (the year is never dropped)", () => {
        const ticks = buildDiscreteMonthlyAxisTicks({
            bandValues: [
                "2020-01-01",
                "2020-04-01",
                "2020-07-01",
                "2021-01-01",
                "2021-04-01",
            ].map(day),
        })
        expect(ticks.map((t) => t.label)).toEqual([
            "Jan 2020",
            "Apr 2020",
            "Jul 2020",
            "Jan 2021",
            "Apr 2021",
        ])
    })
})

describe(getDiscreteMonthlyTickOptions, () => {
    const monthlyBars = (startYear: number, endYear: number): number[] => {
        const values: number[] = []
        for (let y = startYear; y <= endYear; y++)
            for (let m = 1; m <= 12; m++)
                values.push(day(`${y}-${String(m).padStart(2, "0")}-01`))
        return values
    }
    const monthGaps = (ticks: { value: number }[]): number[] => {
        const idx = ticks.map((t) => {
            const d = convertDaysSinceEpochToDate(t.value)
            return d.year() * 12 + d.month()
        })
        return idx.slice(1).map((m, i) => m - idx[i])
    }

    it("makes every option a single uniform spacing", () => {
        const options = getDiscreteMonthlyTickOptions({
            bandValues: monthlyBars(2010, 2026),
        })
        for (const option of options)
            expect(new Set(monthGaps(option)).size).toBeLessThanOrEqual(1)
    })

    it("gives an every-2-year option of even years only (never 2015/2025)", () => {
        const options = getDiscreteMonthlyTickOptions({
            bandValues: monthlyBars(2010, 2026),
        })
        const twoYearOption = options.find(
            (option) => monthGaps(option)[0] === 24 // 2 years
        )
        expect(twoYearOption?.map((t) => t.label)).toEqual([
            "Jan 2010",
            "Jan 2012",
            "Jan 2014",
            "Jan 2016",
            "Jan 2018",
            "Jan 2020",
            "Jan 2022",
            "Jan 2024",
            "Jan 2026",
        ])
    })

    it("orders options from finest to coarsest", () => {
        const options = getDiscreteMonthlyTickOptions({
            bandValues: monthlyBars(2010, 2026),
        })
        const counts = options.map((option) => option.length)
        expect(counts).toEqual([...counts].sort((a, b) => b - a))
    })
})
