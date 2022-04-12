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
        ["$ noSpaceUnit true", 1.1, "$1.1", { noSpaceUnit: true, unit: "$" }],
        ["$ noSpaceUnit false", 1.1, "$1.1", { noSpaceUnit: false, unit: "$" }],
        ["% noSpaceUnit false", 1.1, "1.1 %", { noSpaceUnit: false, unit: "%" }],
        ["% noSpaceUnit false", 1.1, "1.1%", { noSpaceUnit: true, unit: "%" }],
        ["numberPrefixes true", 1000000000, "1 billion", { numberPrefixes: true }],
        ["numberPrefixes true with unit", 1000000000, "$1 billion", { numberPrefixes: true, unit: "$" }],
        // this case appears to not currently work
        // ["numberPrefixes false", 1000000000, "1,000,000,000", { numberPrefixes: false }],
        ["shortNumberPrefixes true", 1000000000, "1B", { shortNumberPrefixes: true }],
        ["shortNumberPrefixes false", 1000000000, "1,000,000,000", { shortNumberPrefixes: false }],
        ["showPlus true", 1, "+1", { showPlus: true }],
        ["showPlus false", 1, "1", { showPlus: false }],
        ["showPlus false with negative number", -1, "-1", { showPlus: false }],
        ["showPlus true with unit", 1, "+$1", { showPlus: true, unit: "$" }],
        ["showPlus true with % and 4 decimals", 1.23456, "+1.2346%", {showPlus: true, numDecimalPlaces: 4, unit: "%"}],
        ["showPlus false with $ and trailingZeroes false", 1234.5678, "$1,234.57", {showPlus: false, unit: "$", trailingZeroes: false}],
        ["showPlus false with $, trailingZeroes true, and noSpaceUnit false", 1234.5678, "$1,234.57", {showPlus: false, unit: "$", trailingZeroes: true, noSpaceUnit: false}],
    ]
    cases.forEach(([description, input, output, options]) => {
        it(description, () => {
            expect(formatValue(input, options)).toBe(output)
        })
    })
})
