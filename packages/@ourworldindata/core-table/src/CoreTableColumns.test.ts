import { expect, it, describe } from "vitest"

import { ColumnTypeNames } from "@ourworldindata/types"
import { convertDateToDaysSinceEpoch, dayjs } from "@ourworldindata/utils"
import { ColumnTypeMap } from "./CoreTableColumns.js"
import { OwidTable } from "./OwidTable.js"

describe(ColumnTypeNames.Quarter, () => {
    const col = new ColumnTypeMap.Numeric(new OwidTable(), { slug: "test" })

    it("should format correctly for csv", () => {
        const testValue = 12345678.9
        const parsed = col.parse(testValue) as number
        const csvFormatted = col.formatForCsv(parsed)
        expect(csvFormatted).toEqual("12345678.9")
    })
})

describe(ColumnTypeNames.Quarter, () => {
    const col = new ColumnTypeMap.Quarter(new OwidTable(), { slug: "test" })

    it("formats days-since-epoch as quarters", () => {
        // day 0 = EPOCH_DATE = 2020-01-21 (Q1 2020)
        expect(col.formatValue(0)).toEqual("Q1 2020")
        expect(col.formatForCsv(0)).toEqual("2020-Q1")
        // 200 days later = 2020-08-08 (Q3 2020)
        expect(col.formatValue(200)).toEqual("Q3 2020")
        expect(col.formatForCsv(200)).toEqual("2020-Q3")
        // 400 days later = 2021-02-24 (Q1 2021)
        expect(col.formatValue(400)).toEqual("Q1 2021")
        expect(col.formatForCsv(400)).toEqual("2021-Q1")
    })

    it("formats the period start as the quarter's start month", () => {
        // day 0 = 2020-01-21 (Q1 2020) → start month Jan 2020
        expect(col.formatTimePeriodStart(0)).toEqual("Jan 2020")
        // day 200 = 2020-08-08 (Q3 2020) → start month Jul 2020
        expect(col.formatTimePeriodStart(200)).toEqual("Jul 2020")
    })

    it("formats a range from start-quarter start month to end-quarter end month", () => {
        const day = (iso: string): number =>
            convertDateToDaysSinceEpoch(dayjs.utc(iso))
        // 2025-02-15 → Q1 2025 (starts Jan)
        // 2026-11-20 → Q4 2026 (ends Dec)
        expect(
            col.formatTimeRange(day("2025-02-15"), day("2026-11-20"))
        ).toEqual("Jan 2025 to Dec 2026")
    })

    it("formats a comparison as the two quarters themselves", () => {
        const day = (iso: string): number =>
            convertDateToDaysSinceEpoch(dayjs.utc(iso))
        expect(
            col.formatTimeComparison(day("2025-02-15"), day("2026-11-20"))
        ).toEqual("Q1 2025 vs. Q4 2026")
    })
})

describe(ColumnTypeNames.Decade, () => {
    const col = new ColumnTypeMap.Decade(new OwidTable(), { slug: "test" })

    it("formats representative years as decades", () => {
        expect(col.formatValue(2020)).toEqual("2020s")
        expect(col.formatValue(2025)).toEqual("2020s")
        expect(col.formatForCsv(2025)).toEqual("2020s")
        expect(col.formatValue(-500)).toEqual("500s BCE")
        expect(col.formatValue(-505)).toEqual("510s BCE")
    })
})

describe(ColumnTypeNames.Month, () => {
    const col = new ColumnTypeMap.Month(new OwidTable(), { slug: "test" })

    it("formats days-since-epoch as months", () => {
        // day 0 = EPOCH_DATE = 2020-01-21
        expect(col.formatValue(0)).toEqual("Jan 2020")
        expect(col.formatForCsv(0)).toEqual("2020-01")
        // 400 days later = 2021-02-24
        expect(col.formatValue(400)).toEqual("Feb 2021")
        expect(col.formatForCsv(400)).toEqual("2021-02")
    })
})

describe(ColumnTypeNames.Day, () => {
    const col = new ColumnTypeMap.Day(new OwidTable(), { slug: "test" })

    it("formats days-since-epoch as days", () => {
        // day 0 = EPOCH_DATE = 2020-01-21
        expect(col.formatValue(0)).toEqual("Jan 21, 2020")
        expect(col.formatForCsv(0)).toEqual("2020-01-21")
        // 400 days later = 2021-02-24
        expect(col.formatValue(400)).toEqual("Feb 24, 2021")
        expect(col.formatForCsv(400)).toEqual("2021-02-24")
    })
})

describe(ColumnTypeNames.Week, () => {
    const col = new ColumnTypeMap.Week(new OwidTable(), { slug: "test" })

    it("formats a week as 'Week of <week-start Monday>'", () => {
        // day 0 = EPOCH_DATE = 2020-01-21, a Tuesday in the ISO week
        // that starts on Monday 2020-01-20
        expect(col.formatValue(0)).toEqual("Week of Jan 20, 2020")
        // CSV keeps the machine-readable ISO week
        expect(col.formatForCsv(0)).toEqual("2020-W04")
    })

    it("anchors 'Week of' on the Monday across a year boundary", () => {
        // day -22 = Monday 2019-12-30 (ISO week 1 of 2020)
        expect(col.formatValue(-22)).toEqual("Week of Dec 30, 2019")
        // day -20 = 2020-01-01 falls into the same week
        expect(col.formatValue(-20)).toEqual("Week of Dec 30, 2019")
    })

    it("formats a range as start-week Monday to end-week Sunday", () => {
        const day = (iso: string): number =>
            convertDateToDaysSinceEpoch(dayjs.utc(iso))
        // 2026-06-03 (Wed) → week starts Mon 2026-06-01
        // 2026-07-08 (Wed) → week ends Sun 2026-07-12
        expect(
            col.formatTimeRange(day("2026-06-03"), day("2026-07-08"))
        ).toEqual("Jun 1, 2026 to Jul 12, 2026")
    })

    it("formats a comparison as the two weeks themselves", () => {
        const day = (iso: string): number =>
            convertDateToDaysSinceEpoch(dayjs.utc(iso))
        expect(
            col.formatTimeComparison(day("2026-06-03"), day("2026-07-08"))
        ).toEqual("Week of Jun 1, 2026 vs. Week of Jul 6, 2026")
    })

    it("formats the period start as the plain week-start date", () => {
        const day = (iso: string): number =>
            convertDateToDaysSinceEpoch(dayjs.utc(iso))
        // 2026-06-03 (Wed) → week starts Mon 2026-06-01, no "Week of" prefix
        expect(col.formatTimePeriodStart(day("2026-06-03"))).toEqual(
            "Jun 1, 2026"
        )
    })
})

describe("periodEndTime", () => {
    const day = (iso: string): number =>
        convertDateToDaysSinceEpoch(dayjs.utc(iso))

    it("moves a quarter's time to the quarter's last day", () => {
        const col = new ColumnTypeMap.Quarter(new OwidTable(), { slug: "test" })
        // 2026-04-01 is Q2 2026, which ends on Jun 30
        expect(col.periodEndTime(day("2026-04-01"))).toEqual(day("2026-06-30"))
        // Any day in the quarter lands on that same last day...
        expect(col.periodEndTime(day("2026-05-15"))).toEqual(day("2026-06-30"))
        // ...including the last day itself, so the method is idempotent
        expect(col.periodEndTime(day("2026-06-30"))).toEqual(day("2026-06-30"))
        // The formatted period end names the same month as the time it returns
        expect(col.formatTimePeriodEnd(day("2026-04-01"))).toEqual("Jun 2026")
    })

    it("moves a week's time to the ISO week's Sunday", () => {
        const col = new ColumnTypeMap.Week(new OwidTable(), { slug: "test" })
        // Mon 2026-06-01 starts the ISO week that ends on Sun 2026-06-07
        expect(col.periodEndTime(day("2026-06-01"))).toEqual(day("2026-06-07"))
        expect(col.periodEndTime(day("2026-06-03"))).toEqual(day("2026-06-07"))
        expect(col.periodEndTime(day("2026-06-07"))).toEqual(day("2026-06-07"))
        // Weeks before the epoch, and across a year boundary, work the same:
        // Mon 2019-12-30 starts the week ending Sun 2020-01-05
        expect(col.periodEndTime(day("2019-12-30"))).toEqual(day("2020-01-05"))
        // The formatted period end names the same day as the time it returns
        expect(col.formatTimePeriodEnd(day("2026-06-01"))).toEqual(
            "Jun 7, 2026"
        )
    })

    it("leaves times that already are their own period end alone", () => {
        for (const type of ["Month", "Day"] as const) {
            const col = new ColumnTypeMap[type](new OwidTable(), {
                slug: "test",
            })
            expect(col.periodEndTime(day("2026-05-15"))).toEqual(
                day("2026-05-15")
            )
        }
        // Yearly times are plain years rather than days-since-epoch
        const year = new ColumnTypeMap.Year(new OwidTable(), { slug: "test" })
        expect(year.periodEndTime(2005)).toEqual(2005)
    })
})

describe("getUniformlySpacedTimes", () => {
    const table = new OwidTable()

    const day = (iso: string): number =>
        convertDateToDaysSinceEpoch(dayjs.utc(iso))

    it("fills missing years for year columns", () => {
        const col = new ColumnTypeMap.Year(table, { slug: "t" })
        // GCD of the gaps is 1 (from 2000→2001), so the missing 2002 is filled
        expect(col.getUniformlySpacedTimes([2000, 2001, 2003])).toEqual([
            2000, 2001, 2002, 2003,
        ])
    })

    it("respects a regular multi-year cadence (e.g. every 5 years)", () => {
        const col = new ColumnTypeMap.Year(table, { slug: "t" })
        // GCD of the gaps is 5
        expect(col.getUniformlySpacedTimes([2000, 2005, 2010, 2025])).toEqual([
            2000, 2005, 2010, 2015, 2020, 2025,
        ])
    })

    it("fills missing days for day columns", () => {
        const col = new ColumnTypeMap.Day(table, { slug: "t" })
        expect(col.getUniformlySpacedTimes([0, 1, 3])).toEqual([0, 1, 2, 3])
    })

    it("fills one filler per missing week for week columns", () => {
        const col = new ColumnTypeMap.Week(table, { slug: "t" })
        // weeks are 7 days apart; a gap of 14 means one missing week
        expect(col.getUniformlySpacedTimes([0, 7, 21])).toEqual([0, 7, 14, 21])
    })

    it("snaps observed days to the first of their month", () => {
        const col = new ColumnTypeMap.Month(table, { slug: "t" })
        expect(
            col.getUniformlySpacedTimes([day("2021-01-31"), day("2021-02-28")])
        ).toEqual([day("2021-01-01"), day("2021-02-01")])
    })

    it("fills one filler per missing month", () => {
        const col = new ColumnTypeMap.Month(table, { slug: "t" })
        // Jan and Feb present, March missing before April
        const result = col.getUniformlySpacedTimes([
            day("2021-01-01"),
            day("2021-02-01"),
            day("2021-04-01"),
        ])
        expect(result).toEqual([
            day("2021-01-01"),
            day("2021-02-01"),
            day("2021-03-01"), // filler
            day("2021-04-01"),
        ])
    })

    it("respects a regular cadence (e.g. two points per year) without inserting fillers", () => {
        const col = new ColumnTypeMap.Month(table, { slug: "t" })
        // Two data points per year, 6 months apart
        const input = [
            day("2021-01-01"),
            day("2021-07-01"),
            day("2022-01-01"),
            day("2022-07-01"),
        ]
        expect(col.getUniformlySpacedTimes(input)).toEqual(input)
    })

    it("handles months before the epoch date and across the epoch boundary", () => {
        const col = new ColumnTypeMap.Month(table, { slug: "t" })
        // EPOCH_DATE is 2020-01-21. Nov 2019, Dec 2019, Feb 2020 (Jan 2020
        // missing) — all around/before the epoch, so month numbers go negative.
        const result = col.getUniformlySpacedTimes([
            day("2019-11-01"),
            day("2019-12-01"),
            day("2020-02-01"),
        ])
        expect(result).toEqual([
            day("2019-11-01"),
            day("2019-12-01"),
            day("2020-01-01"), // filler
            day("2020-02-01"),
        ])
    })

    it("fills one filler per missing quarter", () => {
        const col = new ColumnTypeMap.Quarter(table, { slug: "t" })
        // Q1, Q2 and Q4 of 2021 present; Q3 missing
        const result = col.getUniformlySpacedTimes([
            day("2021-01-01"), // Q1
            day("2021-04-01"), // Q2
            day("2021-10-01"), // Q4
        ])
        expect(result).toEqual([
            day("2021-01-01"), // Q1
            day("2021-04-01"), // Q2
            day("2021-07-01"), // Q3 filler
            day("2021-10-01"), // Q4
        ])
    })

    it("respects a regular quarterly cadence (e.g. semiannual) without inserting fillers", () => {
        const col = new ColumnTypeMap.Quarter(table, { slug: "t" })
        // Two data points per year, two quarters (6 months) apart
        const input = [
            day("2021-01-01"),
            day("2021-07-01"),
            day("2022-01-01"),
            day("2022-07-01"),
        ]
        expect(col.getUniformlySpacedTimes(input)).toEqual(input)
    })
})

describe(ColumnTypeMap.NumberOrString, () => {
    const col = new ColumnTypeMap.NumberOrString(new OwidTable(), {
        slug: "test",
    })

    it("should format values correctly", () => {
        expect(col.formatValue(null)).toEqual("")
        expect(col.formatValue("")).toEqual("")
        expect(col.formatValue("test")).toEqual("test")
        expect(col.formatValue(1.19)).toEqual("1.19")
        expect(col.formatValue(1.191919)).toEqual("1.19")
    })

    it("should parse values correctly", () => {
        expect(col.parse(1.19)).toEqual(1.19)
        expect(col.parse("1.19")).toEqual(1.19)
        expect(col.parse(-5.62431784101729e-5)).toEqual(-5.62431784101729e-5)
        expect(col.parse("test")).toEqual("test")
    })
})
