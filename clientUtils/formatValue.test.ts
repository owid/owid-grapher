#! /usr/bin/env jest
import { formatValue, TickFormattingOptions } from "./formatValue"

describe(formatValue, () => {
    // prettier-ignore
    const cases: [string, number, string, TickFormattingOptions][] = [
        ["default", 1, "1", {}],
        ["default negative", -1, "-1", {}],
        ["default large", 1000000000, "1 billion", {}],
        ["default large specific", 1234567890, "1.23 billion", {}],
        ["default large specific with rounding", 1239999999, "1.24 billion", {}],
        ["default small", 0.0000000001, "<0.01", {}],
        ["2 decimals with integer", 1, "1", { numDecimalPlaces: 2 }],
        ["2 decimals with float", 1.123, "1.12", { numDecimalPlaces: 2 }],
        ["4 decimals with float", 1.123, "1.123", { numDecimalPlaces: 4 }],
        ["with unit", 1, "$1", { unit: "$" }],
        ["negative with unit", -1, "-$1", { unit: "$" }],
        ["trailingZeroes true", 1.10, "1.1", { trailingZeroes: false }], 
        ["trailingZeroes false", 1.10, "1.10", { trailingZeroes: true }], 
        ["$ spaceBeforeUnit false", 1.1, "$1.1", { spaceBeforeUnit: false, unit: "$" }],
        ["$ spaceBeforeUnit true", 1.1, "$1.1", { spaceBeforeUnit: true, unit: "$" }],
        ["% spaceBeforeUnit true", 1.1, "1.1 %", { spaceBeforeUnit: true, unit: "%" }],
        ["% spaceBeforeUnit false", 1.1, "1.1%", { spaceBeforeUnit: false, unit: "%" }],
        ["numberAbreviation long", 1000000000, "1 billion", { numberAbreviation: "long" }],
        ["numberAbreviation long with unit", 1000000000, "$1 billion", { numberAbreviation: "long", unit: "$" }],
        ["numberAbreviation short", 1000000000, "1B", { numberAbreviation: "short" }],
        ["numberAbreviation false", 1000000000, "1,000,000,000", {numberAbreviation: false}],
        ["showPlus true", 1, "+1", { showPlus: true }],
        ["showPlus false", 1, "1", { showPlus: false }],
        ["showPlus false with negative number", -1, "-1", { showPlus: false }],
        ["showPlus true with unit", 1, "+$1", { showPlus: true, unit: "$" }],
        ["showPlus true with % and 4 decimals", 1.23456, "+1.2346%", {showPlus: true, numDecimalPlaces: 4, unit: "%"}],
        ["showPlus false with $ and trailingZeroes false", 1234.5678, "$1,234.57", {showPlus: false, unit: "$", trailingZeroes: false}],
        ["showPlus false with $, trailingZeroes true, and spaceBeforeUnit true", 1234.5678, "$1,234.57", {showPlus: false, unit: "$", trailingZeroes: true, spaceBeforeUnit: true}],
    ]
    cases.forEach(([description, input, output, options]) => {
        it(description, () => {
            expect(formatValue(input, options)).toBe(output)
        })
    })
})
