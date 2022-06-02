import { ColumnTypeNames } from "./CoreColumnDef.js"
import { ColumnTypeMap } from "./CoreTableColumns.js"
import { ErrorValueTypes } from "./ErrorValues.js"
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

    it("should parse and format values correctly", () => {
        const testValues = [
            // Input string, parsed value, formatted output string
            ["2020-Q3", 8082, "Q3/2020"],
            ["2000-Q1", 8000, "Q1/2000"],
            ["02000-Q1", 8000, "Q1/2000"],
            ["1999-Q0", ErrorValueTypes.InvalidQuarterValue],
            ["2018-Q5", ErrorValueTypes.InvalidQuarterValue],
            ["2018-Q-1", ErrorValueTypes.InvalidQuarterValue],
            ["0-Q1", 0, "Q1/0"],
            ["-1-Q3", -2, "Q3/-1"],
        ]

        for (const [inStr, expected, formattedStr] of testValues) {
            const parsed = col.parse(inStr)
            expect(parsed).toEqual(expected)

            if (formattedStr !== undefined && typeof parsed === "number")
                expect(col.formatValue(parsed)).toEqual(formattedStr)
        }
    })

    it("should format correctly for csv", () => {
        const inStr = "2020-Q1"
        const parsed = col.parse(inStr) as number
        const csvFormatted = col.formatForCsv(parsed)
        expect(csvFormatted).toEqual("2020-Q1")
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
