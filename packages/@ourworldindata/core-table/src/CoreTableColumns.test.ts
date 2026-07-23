import { expect, it, describe } from "vitest"

import { ColumnTypeNames } from "@ourworldindata/types"
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
