#! /usr/bin/env jest

import { formatValue, TickFormattingOptions } from "./formatValue"

// {
//     numDecimalPlaces?: number
//     unit?: string
//     noTrailingZeroes?: boolean
//     noSpaceUnit?: boolean
//     numberPrefixes?: boolean
//     shortNumberPrefixes?: boolean
//     showPlus?: boolean
// }

describe(formatValue, () => {
    // prettier-ignore
    const cases: [string, number, string, TickFormattingOptions][] = [
        ["default", 1, "1", {}],
        ["default negative", -1, "-1", {}],
        ["default large", 1000000000, "1 billion", {}],
        ["default large specific", 1234567890, "1.23 billion", {}],
        ["default large specific with rounding", 1239999999, "1.24 billion", {}],
        ["default small", 0.0000000001, "<0.01", {}],
        ["2 decimals for integer", 1, "1", { numDecimalPlaces: 2 }],
        ["2 decimals for float", 1.123, "1.12", { numDecimalPlaces: 2 }],
        ["4 decimals for float", 1.123, "1.123", { numDecimalPlaces: 4 }],
        ["with unit", 1, "$1", { unit: "$" }],
        // ["negative with unit", -1, "-$1", { unit: "$" }],
        ["noTrailingZeroes false", 1.10, "1.1", { noTrailingZeroes: true }], 
        ["noTrailingZeroes true", 1.10, "1.10", { noTrailingZeroes: false }], 
        ["$ noSpaceUnit true", 1.1, "$1.1", { noSpaceUnit: true, unit: "$" }],
        ["$ noSpaceUnit false", 1.1, "$1.1", { noSpaceUnit: false, unit: "$" }],
        ["% noSpaceUnit false", 1.1, "1.1 %", { noSpaceUnit: false, unit: "%" }],
        ["% noSpaceUnit false", 1.1, "1.1%", { noSpaceUnit: true, unit: "%" }],
        ["numberPrefixes true", 1000000000, "1 billion", { numberPrefixes: true }],
        // ["numberPrefixes false", 1000000000, "1,000,000,000", { numberPrefixes: false }],
        ["shortNumberPrefixes true", 1000000000, "1B", { shortNumberPrefixes: true }],
        // ["shortNumberPrefixes true", 1000000000, "1 billion", { shortNumberPrefixes: false }],
        ["showPlus true", 1, "+1", { showPlus: true }],
        ["showPlus false", 1, "1", { showPlus: false }],
        ["showPlus false with negative number", -1, "-1", { showPlus: false }],
        // ["showPlus true with unit", 1, "+$1", { showPlus: true, unit: "$" }],
    ]
    cases.forEach(([testCase, input, output, options]) => {
        it(testCase, () => {
            expect(formatValue(input, options)).toBe(output)
        })
    })
})
