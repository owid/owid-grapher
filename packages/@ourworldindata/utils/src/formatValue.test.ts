import { expect, it, describe } from "vitest"
import {
    TickFormattingOptions,
    OwidVariableRoundingMode,
} from "@ourworldindata/types"
import { formatValue } from "./formatValue"

describe("rounding to a fixed number of decimals", () => {
    // oxfmt-ignore
    const cases: [string, number, string, TickFormattingOptions][] = [
        ["default", 1, "1", {}],
        ["default negative", -1, "-1", {}],
        ["default small", 0.001, "<0.01", {}],
        ["default million specific", 1_179_766, "1.18 million", {}],
        ["default billion specific", 1_234_567_890, "1.23 billion", {}],
        ["default 10 billion specific", 12_345_678_901, "12.3 billion", {}],
        ["default billion with rounding", 1_239_999_999, "1.24 billion", {}],
        ["default small", 0.0000000001, "<0.01", {}],
        ["thousand", 1000, "1,000", {}],
        ["thousand rounding", 1002, "1,002", {}],
        ["ten thousand", 10000, "10,000", {}],
        ["hundred thousand default", 100_000, "100,000", {}],
        ["hundred thousand specific default", 123_456, "123,456", {}],
        ["hundred thousand rounding default", 12_388, "12,388", {}],
        ["hundred thousand specific decimals", 123_456.789, "123,456.79", {}],
        ["999999 specific default", 999_999.99, "999,999.99", {}],
        // TODO: should round to '1 million' but returns '1,000,000'
        // ["999999 rounding default", 999999.999, "1 million", {}],
        ["million", 1_000_000, "1 million", {}],
        ["billion", 1_000_000_000, "1 billion", {}],
        ["trillion", 1_000_000_000_000, "1 trillion", {}],
        ["quadrillion", 1_000_000_000_000_000, "1 quadrillion", {}],
        ["negative million", -1_000_000, "-1 million", {}],
        ["negative billion", -1_000_000_000, "-1 billion", {}],
        ["negative trillion", -1_000_000_000_000, "-1 trillion", {}],
        ["negative quadrillion", -1_000_000_000_000_000, "-1 quadrillion", {}],
        ["1000 short written out", 1000, "1,000", { numberAbbreviation: "short" }],
        ["1499 short written out", 1499, "1,499", { numberAbbreviation: "short" }],
        ["1001 short written out", 1001, "1,001", { numberAbbreviation: "short" }],
        ["1009 short written out", 1009, "1,009", { numberAbbreviation: "short" }],
        ["12345 short written out", 12_345, "12,345", { numberAbbreviation: "short" }],
        ["123456 short prefix", 123_456, "123k", { numberAbbreviation: "short" }],
        ["98712 decimal short drops decimals", 98_712.78901, "98,713", { numberAbbreviation: "short", numDecimalPlaces: 10 }],
        ["hundred thousand short prefix decimal", 100_000.44, "100k", { numberAbbreviation: "short" }],
        ["1000 long prefix", 1000, "1,000", { numberAbbreviation: "long" }],
        ["1499 long prefix", 1499, "1,499", { numberAbbreviation: "long" }],
        ["1001 long prefix", 1001, "1,001", { numberAbbreviation: "long" }],
        ["1009 long prefix", 1009, "1,009", { numberAbbreviation: "long" }],
        ["ten thousand long prefix", 10_000, "10,000", { numberAbbreviation: "long" }],
        ["hundred thousand long prefix", 100_000, "100,000", { numberAbbreviation: "long" }],
        ["hundred thousand long prefix decimal", 100_000.44, "100,000.44", { numberAbbreviation: "long" }],
        ["million short prefix", 1_000_000, "1M", { numberAbbreviation: "short" }],
        ["billion short prefix", 1_000_000_000, "1B", { numberAbbreviation: "short" }],
        ["trillion short prefix", 1_000_000_000_000, "1T", { numberAbbreviation: "short" }],
        ["quadrillion short prefix", 1_000_000_000_000_000, "1quad", { numberAbbreviation: "short" }],
        ["2 decimals with integer", 1, "1", { numDecimalPlaces: 2 }],
        ["2 decimals with float", 1.123, "1.12", { numDecimalPlaces: 2 }],
        ["4 decimals with float", 1.123, "1.123", { numDecimalPlaces: 4 }],
        ["numSignificantFigures has no effect on long abbreviations", 12_840_000, "12.8 million", { numSignificantFigures: 5, numberAbbreviation: "long" }],
        ["numSignificantFigures has no effect on short abbreviations", 123_456, "123k", { numSignificantFigures: 5, numberAbbreviation: "short" }],
        ["abbreviated values default to 3 significant figures", 10_020_000, "10 million", { numberAbbreviation: "long" }],
        ["abbreviationSignificantFigures widens abbreviated precision", 10_020_000, "10.02 million", { numberAbbreviation: "long", abbreviationSignificantFigures: 4 }],
        ["abbreviationSignificantFigures keeps trailing-zero trim", 10_000_000, "10 million", { numberAbbreviation: "long", abbreviationSignificantFigures: 4 }],
        ["0 decimals with abbreviation", 1_234_567, "1.23 million", { numDecimalPlaces: 0, numberAbbreviation: "long" }],
        ["1 decimal with abbreviation", 1_234_567, "1.23 million", { numDecimalPlaces: 1, numberAbbreviation: "long" }],
        ["1 decimal with short abbreviation", 1234, "1,234", { numDecimalPlaces: 1, numberAbbreviation: "short" }],
        ["2 decimal with percentage", 19.985, "19.98%", { numDecimalPlaces: 2, unit: "%" }],
        ["with unit", 1, "$1", { unit: "$" }],
        ["with custom unit", 1, "1pp", { unit: "pp", spaceBeforeUnit: false }],
        ["with custom unit and space", 1, "1 pp", { unit: "pp", spaceBeforeUnit: true }],
        ["negative with unit", -1, "-$1", { unit: "$" }],
        ["trailingZeroes true", 1.10, "1.1", { trailingZeroes: false }],
        ["trailingZeroes false", 1.10, "1.10", { trailingZeroes: true }],
        ["$ spaceBeforeUnit false", 1.1, "$1.1", { spaceBeforeUnit: false, unit: "$" }],
        ["$ spaceBeforeUnit true", 1.1, "$1.1", { spaceBeforeUnit: true, unit: "$" }],
        ["% spaceBeforeUnit true", 1.1, "1.1 %", { spaceBeforeUnit: true, unit: "%" }],
        ["% spaceBeforeUnit false", 1.1, "1.1%", { spaceBeforeUnit: false, unit: "%" }],
        ["% small", 0.1, "0.1%", { unit: "%" }],
        ["% very small", 0.001, "<0.01%", { unit: "%" }],
        ["$ very small", 0.001, "<$0.01", { unit: "$" }],
        ["%compound spaceBeforeUnit false", 1.1, "1.1%compound", { spaceBeforeUnit: false, unit: "%compound" }],
        ["numberAbbreviation long", 1_000_000_000, "1 billion", { numberAbbreviation: "long" }],
        ["numberAbbreviation million specific", 846_691_846.8, "847 million", { numberAbbreviation: "long" }],
        ["numberAbbreviation billion specific", 123_456_789_012, "123 billion", { numberAbbreviation: "long" }],
        ["numberAbbreviation long with unit", 1_000_000_000, "$1 billion", { numberAbbreviation: "long", unit: "$" }],
        ["numberAbbreviation short", 1_000_000_000, "1B", { numberAbbreviation: "short" }],
        ["numberAbbreviation %", 20_000, "20,000%", { numberAbbreviation: "short", unit: "%" }],
        ["numberAbbreviation false", 1_000_000_000, "1,000,000,000", { numberAbbreviation: false }],
        ["numberAbbreviation false very small", 0.000000001, "0.000000001", { numberAbbreviation: false, numDecimalPlaces: 10 }],
        ["showPlus true", 1, "+1", { showPlus: true }],
        ["showPlus false", 1, "1", { showPlus: false }],
        ["showPlus false with negative number", -1, "-1", { showPlus: false }],
        ["showPlus true with unit", 1, "+$1", { showPlus: true, unit: "$" }],
        ["showPlus true with % and 4 decimals", 1.23456, "+1.2346%", { showPlus: true, numDecimalPlaces: 4, unit: "%" }],
        ["showPlus false with $ and trailingZeroes false", 1234.5678, "$1,234.57", { showPlus: false, unit: "$", trailingZeroes: false }],
        ["showPlus false with $, trailingZeroes true, and spaceBeforeUnit true", 1234.5678, "$1,234.57", { showPlus: false, unit: "$", trailingZeroes: true, spaceBeforeUnit: true }],
        ["showPlus true with $, trailingZeroes true, and spaceBeforeUnit true", 1234.5678, "+$1,234.57", { showPlus: true, unit: "$", trailingZeroes: true, spaceBeforeUnit: true }],
    ]
    cases.forEach(([description, input, output, options]) => {
        it(description, () => {
            expect(formatValue(input, options)).toBe(output)
        })
    })
})

describe("rounding to significant figures", () => {
    // oxfmt-ignore
    const cases: [string, number, string, TickFormattingOptions][] = [
        ["default", 1, "1.00", {}],
        ["default negative", -1, "-1.00", {}],
        ["default small", 0.001, "<0.01", {}],
        ["default very small", 0.0000000001, "<0.01", {}],
        ["default million specific", 1_179_766, "1.18 million", {}],
        ["default billion specific", 1_234_567_890, "1.23 billion", {}],
        ["default 10 billion specific", 12_345_678_901, "12.3 billion", {}],
        ["default billion with rounding", 1_239_999_999, "1.24 billion", {}],
        ["thousand", 1000, "1,000", {}],
        ["thousand rounding", 1234, "1,230", {}],
        ["ten thousand", 10_000, "10,000", {}],
        ["hundred thousand default", 100_000, "100,000", {}],
        ["hundred thousand specific default", 123_456, "123,000", {}],
        ["hundred thousand rounding default", 12_388, "12,400", {}],
        ["hundred thousand specific decimals", 123_456.789, "123,000", {}],
        // TODO: should round to '1.00 million' but returns '1,000,000'
        // ["999999 specific default", 999999, "1.00 million", {}],
        ["million", 1_000_000, "1.00 million", {}],
        ["billion", 1_000_000_000, "1.00 billion", {}],
        ["trillion", 1_000_000_000_000, "1.00 trillion", {}],
        ["quadrillion", 1_000_000_000_000_000, "1.00 quadrillion", {}],
        ["negative million", -1_000_000, "-1.00 million", {}],
        ["negative billion", -1_000_000_000, "-1.00 billion", {}],
        ["negative trillion", -1_000_000_000_000, "-1.00 trillion", {}],
        ["negative quadrillion", -1_000_000_000_000_000, "-1.00 quadrillion", {}],
        ["1000 short written out", 1000, "1,000", { numberAbbreviation: "short" }],
        ["1499 short written out", 1499, "1,500", { numberAbbreviation: "short" }],
        ["1001 short written out", 1001, "1,000", { numberAbbreviation: "short" }],
        ["1009 short written out", 1009, "1,010", { numberAbbreviation: "short" }],
        ["12345 short written out", 12_345, "12,300", { numberAbbreviation: "short" }],
        ["123456 short prefix", 123_456, "123k", { numberAbbreviation: "short" }],
        ["hundred thousand short prefix decimal", 100_000.44, "100k", { numberAbbreviation: "short" }],
        ["1000 long prefix", 1000, "1,000", { numberAbbreviation: "long" }],
        ["1499 long prefix", 1499, "1,500", { numberAbbreviation: "long" }],
        ["1001 long prefix", 1001, "1,000", { numberAbbreviation: "long" }],
        ["1009 long prefix", 1009, "1,010", { numberAbbreviation: "long" }],
        ["ten thousand long prefix", 10000, "10,000", { numberAbbreviation: "long" }],
        ["hundred thousand long prefix", 100_000, "100,000", { numberAbbreviation: "long" }],
        ["hundred thousand long prefix decimal", 100_000.44, "100,000", { numberAbbreviation: "long" }],
        ["million short prefix", 1_000_000, "1.00M", { numberAbbreviation: "short" }],
        ["billion short prefix", 1_000_000_000, "1.00B", { numberAbbreviation: "short" }],
        ["trillion short prefix", 1_000_000_000_000, "1.00T", { numberAbbreviation: "short" }],
        ["quadrillion short prefix", 1_000_000_000_000_000, "1.00quad", { numberAbbreviation: "short" }],
        ["1 with 1 significant figure", 1, "1", { numSignificantFigures: 1 }],
        ["1 with 2 significant figures", 1, "1.0", { numSignificantFigures: 2 }],
        ["1 with 3 significant figures", 1, "1.00", { numSignificantFigures: 3 }],
        ["0.999 with 1 significant figure", 0.999, "1", { numSignificantFigures: 1 }],
        ["0.999 with 2 significant figures", 0.999, "1.0", { numSignificantFigures: 2 }],
        ["0.999 with 3 significant figures", 0.999, "1.00", { numSignificantFigures: 3 }], // capped at the default of 2 decimal places
        ["0.999 with 4 significant figures", 0.999, "1.00", { numSignificantFigures: 4 }], // capped at the default of 2 decimal places
        // TODO: should round to '20.0' but returns '19.95'
        // ["19.95 with 4 significant figures", 19.95, "20.0", {numSignificantFigures: 3}],
        ["1234 with 1 significant figure", 1234, "1,000", { numSignificantFigures: 1 }],
        ["1234 with 2 significant figures", 1234, "1,200", { numSignificantFigures: 2 }],
        ["1234 with 3 significant figures", 1234, "1,230", { numSignificantFigures: 3 }],
        ["1234 with 4 significant figures", 1234, "1,234", { numSignificantFigures: 4 }],
        ["1234 with 5 significant figures", 1234, "1,234.0", { numSignificantFigures: 5 }],
        ["1234 with 6 significant figures", 1234, "1,234.00", { numSignificantFigures: 6 }],
        ["0.0012 with 1 significant figure", 0.0012, "<0.01", { numSignificantFigures: 1 }], // capped at the default of 2 decimal places
        ["0.0012 with 2 significant figures", 0.0012, "<0.01", { numSignificantFigures: 2 }], // capped at the default of 2 decimal places
        ["0.0012 with 3 significant figures", 0.0012, "<0.01", { numSignificantFigures: 3 }], // capped at the default of 2 decimal places
        ["2 significant figures with abbreviation", 1_234_567, "1.2 million", { numSignificantFigures: 2, numberAbbreviation: "long" }],
        ["3 significant figures with abbreviation", 1_234_567, "1.23 million", { numSignificantFigures: 3, numberAbbreviation: "long" }],
        ["2 significant figures with short abbreviation", 1234, "1,200", { numSignificantFigures: 2, numberAbbreviation: "short" }],
        ["3 significant figures with percentage", 19.986, "20.0%", { numSignificantFigures: 3, unit: "%" }],
        ["4 significant figures with percentage", 19.986, "19.99%", { numSignificantFigures: 4, unit: "%" }],
        ["with unit", 1, "$1.00", { unit: "$" }],
        ["with custom unit", 1, "1.00pp", { unit: "pp", spaceBeforeUnit: false }],
        ["with custom unit and space", 1, "1.00 pp", { unit: "pp", spaceBeforeUnit: true }],
        ["negative with unit", -1, "-$1.00", { unit: "$" }],
        ["trailingZeroes true", 1.10, "1.10", { trailingZeroes: false }], // trailingZeroes is ignored
        ["trailingZeroes false", 1.10, "1.10", { trailingZeroes: true }], // trailingZeroes is ignored
        ["$ spaceBeforeUnit false", 1.1, "$1.10", { spaceBeforeUnit: false, unit: "$" }],
        ["$ spaceBeforeUnit true", 1.1, "$1.10", { spaceBeforeUnit: true, unit: "$" }],
        ["% spaceBeforeUnit true", 1.1, "1.10 %", { spaceBeforeUnit: true, unit: "%" }],
        ["% spaceBeforeUnit false", 1.1, "1.10%", { spaceBeforeUnit: false, unit: "%" }],
        ["% small", 0.1, "0.10%", { unit: "%" }], // capped at the default of 2 decimal places
        ["% very small", 0.001, "<0.01%", { unit: "%" }], // capped at the default of 2 decimal places
        ["%compound spaceBeforeUnit false", 1.1, "1.10%compound", { spaceBeforeUnit: false, unit: "%compound" }],
        ["numberAbbreviation long", 1_000_000_000, "1.00 billion", { numberAbbreviation: "long" }],
        ["numberAbbreviation million specific", 846_691_846.8, "847 million", { numberAbbreviation: "long" }],
        ["numberAbbreviation billion specific", 123_456_789_012, "123 billion", { numberAbbreviation: "long" }],
        ["numberAbbreviation long with unit", 1_000_000_000, "$1.00 billion", { numberAbbreviation: "long", unit: "$" }],
        ["numberAbbreviation short", 1_000_000_000, "1.00B", { numberAbbreviation: "short" }],
        ["numberAbbreviation %", 20_000, "20,000%", { numberAbbreviation: "short", unit: "%" }],
        ["numberAbbreviation false", 1_000_000_000, "1,000,000,000", { numberAbbreviation: false }],
        ["numberAbbreviation false very small", 0.000000001, "<0.01", { numberAbbreviation: false, numSignificantFigures: 1 }], // capped at the default of 2 decimal places
        ["abbreviationSignificantFigures has no effect in sig-fig mode", 1_234_567, "1.23 million", { numberAbbreviation: "long", abbreviationSignificantFigures: 5 }],
        ["showPlus true", 1, "+1.00", { showPlus: true }],
        ["showPlus false", 1, "1.00", { showPlus: false }],
        ["showPlus false with negative number", -1, "-1.00", { showPlus: false }],
        ["showPlus true with unit", 1, "+$1.00", { showPlus: true, unit: "$" }],
        ["showPlus true with % and 4 significant numbers", 1.23456, "+1.235%", { showPlus: true, unit: "%", numSignificantFigures: 4 }],
    ]
    cases.forEach(([description, input, output, options]) => {
        it(description, () => {
            expect(
                formatValue(input, {
                    ...options,
                    roundingMode: OwidVariableRoundingMode.significantFigures,
                })
            ).toBe(output)
        })
    })
})

describe("the 'short' abbreviation bands", () => {
    // "short" is used for space-constrained value labels (slope charts, map
    // annotations, thumbnails). Values below 1k keep the configured decimals,
    // values between 1k and 100k are written out as whole numbers, and values
    // of 100k or more are abbreviated to significant figures (see #5172).
    // Axis ticks opt back into abbreviating from 1k via abbreviationThreshold
    // oxfmt-ignore
    const cases: [string, number, string, TickFormattingOptions][] = [
        ["author decimals below 1k", 999.99, "999.99", {}],
        ["decimals dropped from 1k", 1234.56, "1,235", {}],
        ["decimals dropped in the ten thousands", 25_240.99, "25,241", {}],
        ["negative value with decimals dropped", -25_240.99, "-25,241", {}],
        ["written out just below 100k", 99_999, "99,999", {}],
        ["rounds across the threshold but stays written out", 99_999.99, "100,000", {}],
        ["abbreviated from 100k", 100_000, "100k", {}],
        ["abbreviations rounded to 3 significant figures", 123_456.78, "123k", {}],
        ["round abbreviation", 950_000, "950k", {}],
        ["abbreviates up just below 1M", 999_999, "1M", {}],
        ["millions", 1_500_000, "1.5M", {}],
        ["two-digit millions", 12_840_000, "12.8M", {}],
        ["currency drops decimals", 25_240.99, "$25,241", { unit: "$" }],
        ["percent never abbreviates and keeps author decimals", 1_234.56, "1,234.56%", { unit: "%" }],
        ["tick-like threshold of 1k keeps abbreviating", 25_000, "25k", { abbreviationThreshold: 1e3 }],
        ["1k threshold abbreviates messy values too", 25_240, "25.2k", { abbreviationThreshold: 1e3 }],
        ["axis-requested precision keeps narrow-domain ticks apart", 10_020_000, "10.02M", { abbreviationSignificantFigures: 4 }],
        ["sig-fig column below the threshold", 25_240, "25,200", { roundingMode: OwidVariableRoundingMode.significantFigures }],
        ["sig-fig column above the threshold keeps trailing zeroes", 999_999, "1.00M", { roundingMode: OwidVariableRoundingMode.significantFigures }],
    ]
    cases.forEach(([description, input, output, options]) => {
        it(description, () => {
            expect(
                formatValue(input, {
                    numberAbbreviation: "short",
                    ...options,
                })
            ).toBe(output)
        })
    })
})

describe("capping sig-fig rounding for values below 1", () => {
    // oxfmt-ignore
    const cases: [string, number, string, TickFormattingOptions][] = [
        ["value below 1 is capped", 0.234, "0.2", { numDecimalPlaces: 1 }],
        ["capped value keeps trailing zeroes", 0.997, "1.00", { numDecimalPlaces: 2 }],
        ["capped value with a unit", 0.345, "0.3%", { numDecimalPlaces: 1, unit: "%" }],
        ["positive value below the cap's resolution", 0.4, "<1", { numDecimalPlaces: 0 }],
        ["0.999 is below the cap's resolution", 0.999, "<1", { numDecimalPlaces: 0 }],
        ["negative value capped to a whole number", -0.7, "-1", { numDecimalPlaces: 0 }],
        ["negative value that would round to zero renders as zero", -0.4, "0", { numDecimalPlaces: 0 }],
        ["small negative value renders as zero with trailing zeroes", -0.004, "0.00", { numDecimalPlaces: 2 }],
        ["zero renders as plain zero", 0, "0", { numDecimalPlaces: 0 }],
        ["1 keeps sig figs", 1, "1.00", { numDecimalPlaces: 0 }],
        ["value above 1 keeps sig figs", 2.34, "2.34", { numDecimalPlaces: 0 }],
        ["large value keeps sig figs", 234.5, "235", { numDecimalPlaces: 0 }],
        ["abbreviated value keeps sig figs", 1_234_567, "1.23 million", { numDecimalPlaces: 0, numberAbbreviation: "long" }],
        ["sig figs kept when they show no more decimals than the cap", 0.0012, "0.00120", { numDecimalPlaces: 5 }],
        ["sig figs capped when they'd show more decimals than the cap", 0.0012, "0.0012", { numDecimalPlaces: 4 }],
        ["cap respects numSignificantFigures", 0.000000001, "0.000000001", { numSignificantFigures: 1, numDecimalPlaces: 9 }],
    ]
    cases.forEach(([description, input, output, options]) => {
        it(description, () => {
            expect(
                formatValue(input, {
                    ...options,
                    roundingMode: OwidVariableRoundingMode.significantFigures,
                })
            ).toBe(output)
        })
    })
})
