import { expect, it, describe } from "vitest"
import {
    dayjs,
    convertDaysSinceEpochToDate,
    convertDateToDaysSinceEpoch,
} from "@ourworldindata/utils"
import { TimeInterval } from "@ourworldindata/types"
import {
    buildTimeAxisTicks,
    buildDiscreteTimeAxisTicks,
    buildContinuousMonthlyAxisTicks,
    getDiscreteMonthlyTickOptions,
    buildContinuousWeeklyAxisTicks,
    getDiscreteWeeklyTickOptions,
    buildContinuousDailyAxisTicks,
    getDiscreteDailyTickOptions,
    getDiscreteTimeTickOptions,
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

    it("drops grid ticks before a mid-month domain start", () => {
        // The 2-month grid is anchored to January, but the domain only
        // starts on Jan 5, so the Jan 1 tick is dropped
        expect(gridDates("2020-01-05", "2020-08-20", 6)).toEqual([
            "2020-03-01",
            "2020-05-01",
            "2020-07-01",
        ])
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

describe(buildContinuousDailyAxisTicks, () => {
    // The grid tick values, as YYYY-MM-DD (or undefined for a degenerate span).
    const gridDates = (
        min: string,
        max: string,
        targetCount: number
    ): string[] | undefined => {
        const ticks = buildContinuousDailyAxisTicks({
            domain: [day(min), day(max)],
            targetCount,
        })
        return ticks && asDates(ticks.map((tick) => tick.value))
    }

    it("steps every day for short spans", () => {
        expect(gridDates("2020-03-01", "2020-03-05", 6)).toEqual([
            "2020-03-01",
            "2020-03-02",
            "2020-03-03",
            "2020-03-04",
            "2020-03-05",
        ])
    })

    it("steps every other day on a grid that is stable when panning", () => {
        const grid = [
            "2020-03-01",
            "2020-03-03",
            "2020-03-05",
            "2020-03-07",
            "2020-03-09",
        ]
        expect(gridDates("2020-03-01", "2020-03-10", 6)).toEqual(grid)
        // A domain start one day earlier keeps the same grid
        expect(gridDates("2020-02-29", "2020-03-09", 6)).toEqual(grid)
    })

    it("steps weekly on Mondays", () => {
        const dates = gridDates("2020-03-01", "2020-04-05", 6)!
        expect(dates).toEqual([
            "2020-03-02",
            "2020-03-09",
            "2020-03-16",
            "2020-03-23",
            "2020-03-30",
        ])
        for (const date of dates) expect(dayjs.utc(date).day()).toBe(1)
    })

    it("steps biweekly on Mondays for ~2-3 month spans", () => {
        expect(gridDates("2020-03-01", "2020-05-15", 6)).toEqual([
            "2020-03-02",
            "2020-03-16",
            "2020-03-30",
            "2020-04-13",
            "2020-04-27",
            "2020-05-11",
        ])
    })

    it("keeps a day step whose in-domain ticks meet a target the raw span/step estimate exceeds", () => {
        // 29 days / 14 is just over the target of 2, but only two biweekly
        // Mondays land in the domain — prefer them over a single monthly tick
        expect(gridDates("2020-03-04", "2020-04-02", 2)).toEqual([
            "2020-03-16",
            "2020-03-30",
        ])
    })

    it("continues on the monthly grid for multi-month spans", () => {
        const domain: [number, number] = [day("2020-01-01"), day("2020-07-01")]
        const ticks = buildContinuousDailyAxisTicks({ domain, targetCount: 6 })
        expect(ticks).toEqual(
            buildContinuousMonthlyAxisTicks({ domain, targetCount: 6 })
        )
        expect(asDates(ticks!.map((t) => t.value))).toEqual([
            "2020-01-01",
            "2020-02-01",
            "2020-03-01",
            "2020-04-01",
            "2020-05-01",
            "2020-06-01",
            "2020-07-01",
        ])
    })

    it("labels multi-year spans with bare years", () => {
        const ticks = buildContinuousDailyAxisTicks({
            domain: [day("2015-06-15"), day("2022-03-01")],
            targetCount: 6,
        })!
        expect(ticks.map((t) => t.label)).toEqual([
            "2016",
            "2018",
            "2020",
            "2022",
        ])
    })

    it("shows the year on the first tick and wherever the year changes", () => {
        const ticks = buildContinuousDailyAxisTicks({
            domain: [day("2020-12-20"), day("2021-01-20")],
            targetCount: 6,
        })!
        expect(ticks.map((t) => t.label)).toEqual([
            "Dec 21, 2020",
            "Dec 28",
            "Jan 4, 2021",
            "Jan 11",
            "Jan 18",
        ])
    })

    it("only produces ticks within the domain", () => {
        const minDay = day("2020-03-04")
        const maxDay = day("2020-04-02")
        const ticks = buildContinuousDailyAxisTicks({
            domain: [minDay, maxDay],
            targetCount: 6,
        })!
        for (const { value } of ticks) {
            expect(value).toBeGreaterThanOrEqual(minDay)
            expect(value).toBeLessThanOrEqual(maxDay)
        }
    })
})

describe(buildContinuousWeeklyAxisTicks, () => {
    // The grid tick values, as YYYY-MM-DD (or undefined for a degenerate span).
    const gridDates = (
        min: string,
        max: string,
        targetCount: number
    ): string[] | undefined => {
        const ticks = buildContinuousWeeklyAxisTicks({
            domain: [day(min), day(max)],
            targetCount,
        })
        return ticks && asDates(ticks.map((tick) => tick.value))
    }

    it("steps weekly on Mondays for short spans", () => {
        expect(gridDates("2020-03-02", "2020-04-06", 6)).toEqual([
            "2020-03-02",
            "2020-03-09",
            "2020-03-16",
            "2020-03-23",
            "2020-03-30",
            "2020-04-06",
        ])
    })

    it("never steps below a week, even for tiny spans", () => {
        // The daily ladder would pick a 2-day step here
        expect(gridDates("2020-03-02", "2020-03-09", 6)).toEqual([
            "2020-03-02",
            "2020-03-09",
        ])
    })

    it("steps biweekly on Mondays for ~2-3 month spans", () => {
        expect(gridDates("2020-03-02", "2020-05-11", 6)).toEqual([
            "2020-03-02",
            "2020-03-16",
            "2020-03-30",
            "2020-04-13",
            "2020-04-27",
            "2020-05-11",
        ])
    })

    it("continues on the monthly grid for multi-month spans", () => {
        const domain: [number, number] = [day("2020-01-06"), day("2020-07-06")]
        const ticks = buildContinuousWeeklyAxisTicks({ domain, targetCount: 6 })
        expect(ticks).toEqual(
            buildContinuousMonthlyAxisTicks({ domain, targetCount: 6 })
        )
    })

    it("labels multi-year spans with bare years", () => {
        const ticks = buildContinuousWeeklyAxisTicks({
            domain: [day("2015-06-15"), day("2022-03-07")],
            targetCount: 6,
        })!
        expect(ticks.map((t) => t.label)).toEqual([
            "2016",
            "2018",
            "2020",
            "2022",
        ])
    })

    it("shows the year on the first tick and wherever the year changes", () => {
        const ticks = buildContinuousWeeklyAxisTicks({
            domain: [day("2020-12-14"), day("2021-01-25")],
            targetCount: 6,
        })!
        expect(ticks.map((t) => t.label)).toEqual([
            "Dec 14, 2020",
            "Dec 21",
            "Dec 28",
            "Jan 4, 2021",
            "Jan 11",
            "Jan 18",
            "Jan 25",
        ])
    })

    it("returns undefined for a degenerate (single-week) span", () => {
        expect(gridDates("2020-03-02", "2020-03-02", 6)).toBeUndefined()
    })
})

describe(getDiscreteWeeklyTickOptions, () => {
    // `count` consecutive Mondays, starting from a Monday
    const weeklyValues = (firstMonday: string, count: number): number[] => {
        const first = day(firstMonday)
        return Array.from({ length: count }, (_, week) => first + 7 * week)
    }
    const dayGaps = (ticks: { value: number }[]): number[] =>
        ticks.slice(1).map((t, i) => t.value - ticks[i].value)

    // All Mondays of 2020 (Jan 6 through Dec 28)
    const options = getDiscreteWeeklyTickOptions({
        bandValues: weeklyValues("2020-01-06", 52),
    })

    it("orders options from finest to coarsest", () => {
        const counts = options.map((option) => option.length)
        expect(counts).toEqual([...counts].sort((a, b) => b - a))
    })

    it("includes a biweekly option on Mondays", () => {
        const biweekly = options.find((option) => dayGaps(option)[0] === 14)!
        expect(biweekly).toHaveLength(26)
        for (const tick of biweekly)
            expect(convertDaysSinceEpochToDate(tick.value).day()).toBe(1)
    })

    it("puts monthly and coarser options on each month's first week", () => {
        const monthly = options.filter((option) => dayGaps(option)[0] > 14)
        expect(monthly.length).toBeGreaterThan(0)
        for (const option of monthly)
            for (const tick of option) {
                const date = convertDaysSinceEpochToDate(tick.value)
                expect(date.day()).toBe(1) // still a week value (a Monday)
                expect(date.date()).toBeLessThanOrEqual(7) // in the first week
            }
    })

    it("offers only the every-value option for weeks on irregular dates", () => {
        // Not Mondays, and none in a month's first week
        const bandValues = ["2020-03-10", "2020-03-18", "2020-03-25"].map(day)
        const options = getDiscreteWeeklyTickOptions({ bandValues })
        expect(options).toHaveLength(1)
        expect(options[0].map((t) => t.value)).toEqual(bandValues)
    })
})

describe(buildDiscreteTimeAxisTicks, () => {
    it("returns one tick per value, sorted and deduplicated", () => {
        const ticks = buildDiscreteTimeAxisTicks({
            bandValues: [
                "2020-03-03",
                "2020-03-01",
                "2020-03-02",
                "2020-03-01",
            ].map(day),
        })
        expect(asDates(ticks.map((t) => t.value))).toEqual([
            "2020-03-01",
            "2020-03-02",
            "2020-03-03",
        ])
    })

    it("leaves ticks unlabeled so the axis uses the column's own time format", () => {
        const ticks = buildDiscreteTimeAxisTicks({
            bandValues: ["2020-01-01", "2020-04-01"].map(day),
        })
        for (const tick of ticks) expect(tick.label).toBeUndefined()
    })
})

describe(buildTimeAxisTicks, () => {
    it("returns undefined for intervals without special handling", () => {
        const bandValues = ["2020-01-01", "2021-01-01"].map(day)
        const ticks = buildTimeAxisTicks({
            interval: TimeInterval.Year,
            domain: [bandValues[0], bandValues[1]],
            targetCount: 6,
            bandValues,
        })
        expect(ticks).toBeUndefined()
    })
})

describe(getDiscreteDailyTickOptions, () => {
    const dailyBars = (start: string, end: string): number[] => {
        const values: number[] = []
        for (let d = day(start); d <= day(end); d++) values.push(d)
        return values
    }
    const dayGaps = (ticks: { value: number }[]): number[] =>
        ticks.slice(1).map((t, i) => t.value - ticks[i].value)

    const options = getDiscreteDailyTickOptions({
        bandValues: dailyBars("2020-01-01", "2020-06-30"),
    })

    it("orders options from finest to coarsest", () => {
        const counts = options.map((option) => option.length)
        expect(counts).toEqual([...counts].sort((a, b) => b - a))
    })

    it("makes the day and week options a single uniform spacing", () => {
        for (const option of options) {
            const gaps = new Set(dayGaps(option))
            // day/week tiers are uniform; monthly tiers step by
            // calendar months, so their gaps vary by a few days
            if ([...gaps].every((gap) => gap < 28))
                expect(gaps.size).toBeLessThanOrEqual(1)
        }
    })

    it("puts weekly and biweekly options on Mondays", () => {
        const weekly = options.find((option) => dayGaps(option)[0] === 7)!
        const biweekly = options.find((option) => dayGaps(option)[0] === 14)!
        for (const tick of [...weekly, ...biweekly])
            expect(convertDaysSinceEpochToDate(tick.value).day()).toBe(1)
    })

    it("puts monthly and coarser options on the first of the month", () => {
        const monthly = options.filter((option) => dayGaps(option)[0] >= 28)
        expect(monthly.length).toBeGreaterThan(0)
        for (const option of monthly)
            for (const tick of option)
                expect(convertDaysSinceEpochToDate(tick.value).date()).toBe(1)
    })

    it("includes a quarterly option on first-of-month values", () => {
        const quarterly = options.find((option) => option.length === 2)
        expect(asDates(quarterly!.map((t) => t.value))).toEqual([
            "2020-01-01",
            "2020-04-01",
        ])
    })

    it("never offers a single-label option", () => {
        // Jul 1 is the range's only first-of-month and used to be offered as
        // a lone calendar-anchored tick on the last band; instead, the axis
        // should fall back to greedy labeling when no multi-label option fits
        const options = getDiscreteDailyTickOptions({
            bandValues: dailyBars("2025-06-07", "2025-07-01"),
        })
        for (const option of options)
            expect(option.length).toBeGreaterThanOrEqual(2)
    })

    it("never offers a ragged subset of irregular values", () => {
        // Band values on irregular dates. The every-2nd-day grid *contains* four of
        // them — Mar 7, 11, 17 and 21 — but with ragged gaps (4, 6 and 4
        // days), because the values in between sit on odd days. Labeling that
        // subset would look deliberate, so it must not be offered. With no
        // Mondays or first-of-months either, the only option left is
        // labeling every value.
        const bandValues = [
            "2020-03-06",
            "2020-03-07",
            "2020-03-10",
            "2020-03-11",
            "2020-03-17",
            "2020-03-18",
            "2020-03-21",
        ].map(day)
        const options = getDiscreteDailyTickOptions({ bandValues })
        expect(options).toHaveLength(1)
        expect(options[0].map((t) => t.value)).toEqual(bandValues)
    })

    it("thins weekly values to consecutive biweekly Mondays, never a ragged parity subset", () => {
        // Band values on every Monday: the biweekly option must take every other
        // Monday, and no option may have uneven gaps
        const mondays = [
            "2020-03-02",
            "2020-03-09",
            "2020-03-16",
            "2020-03-23",
            "2020-03-30",
            "2020-04-06",
            "2020-04-13",
        ].map(day)
        const options = getDiscreteDailyTickOptions({ bandValues: mondays })
        for (const option of options)
            expect(new Set(dayGaps(option)).size).toBeLessThanOrEqual(1)
        const biweekly = options.find((option) => dayGaps(option)[0] === 14)
        expect(biweekly!).toHaveLength(4)
    })
})

describe(getDiscreteTimeTickOptions, () => {
    const bandValues = ["2020-01-01", "2020-02-01", "2020-03-01"].map(day)

    it("dispatches by time interval", () => {
        expect(
            getDiscreteTimeTickOptions({
                interval: TimeInterval.Month,
                bandValues,
            })
        ).toEqual(getDiscreteMonthlyTickOptions({ bandValues }))
        expect(
            getDiscreteTimeTickOptions({
                interval: TimeInterval.Week,
                bandValues,
            })
        ).toEqual(getDiscreteWeeklyTickOptions({ bandValues }))
        expect(
            getDiscreteTimeTickOptions({
                interval: TimeInterval.Day,
                bandValues,
            })
        ).toEqual(getDiscreteDailyTickOptions({ bandValues }))
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
        expect(asDates(twoYearOption!.map((t) => t.value))).toEqual([
            "2010-01-01",
            "2012-01-01",
            "2014-01-01",
            "2016-01-01",
            "2018-01-01",
            "2020-01-01",
            "2022-01-01",
            "2024-01-01",
            "2026-01-01",
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
