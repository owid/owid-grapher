import { ColumnTypeNames } from "./CoreColumnDef"
import { ColumnTypeMap } from "./CoreTableColumns"
import { ErrorValueTypes } from "./ErrorValues"
import { OwidTable } from "./OwidTable"

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
})
