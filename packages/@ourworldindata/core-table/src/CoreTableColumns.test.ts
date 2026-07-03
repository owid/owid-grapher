import { expect, it, describe } from "vitest"

import { ColumnTypeNames } from "@ourworldindata/types"
import { diffDateISOStringInDays, EPOCH_DATE } from "@ourworldindata/utils"
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

    it("formats days-since-epoch as weeks", () => {
        // day 0 = EPOCH_DATE = 2020-01-21, a Tuesday in ISO week 4 of 2020,
        // which starts on Monday 2020-01-20
        expect(col.formatValue(0)).toEqual("W4 2020")
        expect(col.formatForCsv(0)).toEqual("2020-W04")
    })

    it("formats weeks across year boundaries with the ISO week year", () => {
        // day -22 = Monday 2019-12-30, ISO week 1 of 2020
        expect(col.formatValue(-22)).toEqual("W1 2020")
        // day -20 = 2020-01-01 falls into the same week starting in 2019
        expect(col.formatValue(-20)).toEqual("W1 2020")
    })
})

describe("getUniformlySpacedTimes", () => {
    const table = new OwidTable()

    const day = (iso: string): number =>
        diffDateISOStringInDays(iso, EPOCH_DATE)

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

    it("fills one filler per missing month and keeps observed days", () => {
        const col = new ColumnTypeMap.Month(table, { slug: "t" })
        // Monthly cadence (Jan→Feb) with March missing before April
        const result = col.getUniformlySpacedTimes([
            day("2021-01-31"),
            day("2021-02-28"),
            day("2021-04-30"),
        ])
        expect(result.length).toEqual(4)
        expect(result[0]).toEqual(day("2021-01-31"))
        expect(result[1]).toEqual(day("2021-02-28"))
        expect(col.formatValue(result[2])).toEqual("Mar 2021") // filler
        expect(result[3]).toEqual(day("2021-04-30"))
    })

    it("respects a regular cadence (e.g. two points per year) without inserting fillers", () => {
        const col = new ColumnTypeMap.Month(table, { slug: "t" })
        // Two data points per year, 6 months apart
        const input = [
            day("2021-01-15"),
            day("2021-07-15"),
            day("2022-01-15"),
            day("2022-07-15"),
        ]
        expect(col.getUniformlySpacedTimes(input)).toEqual(input)
    })

    it("handles months before the epoch date and across the epoch boundary", () => {
        const col = new ColumnTypeMap.Month(table, { slug: "t" })
        // EPOCH_DATE is 2020-01-21. Nov 2019, Dec 2019, Feb 2020 (Jan 2020
        // missing) — all around/before the epoch, so month numbers go negative.
        const result = col.getUniformlySpacedTimes([
            day("2019-11-15"),
            day("2019-12-15"),
            day("2020-02-15"),
        ])
        expect(result.length).toEqual(4)
        expect(result[0]).toEqual(day("2019-11-15"))
        expect(result[1]).toEqual(day("2019-12-15"))
        expect(col.formatValue(result[2])).toEqual("Jan 2020") // filler
        expect(result[3]).toEqual(day("2020-02-15"))
    })

    it("fills one filler per missing quarter and keeps observed days", () => {
        const col = new ColumnTypeMap.Quarter(table, { slug: "t" })
        // Q1, Q2 and Q4 of 2021 present; Q3 missing
        const result = col.getUniformlySpacedTimes([
            day("2021-02-15"),
            day("2021-05-15"),
            day("2021-11-15"),
        ])
        expect(result.length).toEqual(4)
        expect(result[0]).toEqual(day("2021-02-15"))
        expect(result[1]).toEqual(day("2021-05-15"))
        expect(col.formatValue(result[2])).toEqual("Q3 2021") // filler
        expect(result[3]).toEqual(day("2021-11-15"))
    })

    it("respects a regular quarterly cadence (e.g. semiannual) without inserting fillers", () => {
        const col = new ColumnTypeMap.Quarter(table, { slug: "t" })
        // Two data points per year, two quarters (6 months) apart
        const input = [
            day("2021-01-15"),
            day("2021-07-15"),
            day("2022-01-15"),
            day("2022-07-15"),
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
