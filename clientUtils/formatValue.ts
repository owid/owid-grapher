import { FormatSpecifier } from "d3-format"
import { createFormatter } from "./Util.js"

export interface TickFormattingOptions {
    numDecimalPlaces?: number
    unit?: string
    trailingZeroes?: boolean
    spaceBeforeUnit?: boolean
    showPlus?: boolean
    numberAbreviation?: "short" | "long" | false
}

// Used outside this module to figure out if the unit will be joined with the number.
export function checkIsVeryShortUnit(unit: string): unit is "$" | "£" | "%" {
    return ["%", "$", "£"].includes(unit)
}

function checkIsUnitCurrency(unit: string): unit is "$" | "£" {
    return ["$", "£"].includes(unit)
}

function checkIsUnitPercent(unit: string): unit is "%" {
    return unit[0] === "%"
}

function getTrim({ trailingZeroes }: { trailingZeroes: boolean }): "~" | "" {
    return trailingZeroes ? "" : "~"
}

function getSign({ showPlus }: { showPlus: boolean }): "+" | "" {
    return showPlus ? "+" : ""
}

function getSymbol({ unit }: { unit: string }): "$" | "" {
    return checkIsUnitCurrency(unit) ? "$" : ""
}

function getType({
    numberAbreviation,
    unit,
    value,
}: {
    numberAbreviation: "long" | "short" | false
    unit: string
    value: number
}): string {
    if (checkIsUnitPercent(unit)) {
        // multiply by 100, and then decimal notation with a percent sign
        return "%"
    }
    if (value <= 1) {
        // no adjustment
        return ""
    }
    if (numberAbreviation == "long" || numberAbreviation == "short") {
        if (value > 10000) {
            // decimal notation with an SI prefix, rounded to significant digits
            return "s"
        }
    }

    // decimal notation, rounded to significant digits
    return "r"
}

// Awkard logic to preserve decimal-based precision as opposed to d3's significant-figure based precision
function getPrecision({
    value,
    numDecimalPlaces,
}: {
    value: number
    numDecimalPlaces: number
}): string {
    if (value < 1) {
        return `${numDecimalPlaces}`
    }
    const decimalIndex = String(value).indexOf(".")
    if (decimalIndex !== -1) {
        return `${decimalIndex + numDecimalPlaces}`
    }
    return `${numDecimalPlaces + 1}`
}

// these are still called SI prefixes even though they're at the end of the string
function checkStringIncludesPrefix(str: string): boolean {
    return /(y|z|a|f|p|n|µ|m|k|M|G|T|P|E|Z|Y)/.test(str[str.length - 1])
}

function replaceSIPrefixes({
    string,
    numberAbreviation,
}: {
    string: string
    numberAbreviation: "short" | "long"
}): string {
    if (!checkStringIncludesPrefix(string)) return string
    const map: Record<string, Record<string, string>> = {
        short: {
            M: "M",
            G: "B",
            T: "T",
            P: "Quad",
            E: "Quint",
        },
        long: {
            M: " million",
            G: " billion",
            T: " trillion",
            P: " quadrillion",
            E: " quintillion",
        },
    }

    const prefix = string[string.length - 1]

    return string.replace(prefix, map[numberAbreviation][prefix])
}

function postprocessString({
    string,
    numberAbreviation,
    spaceBeforeUnit,
    unit,
}: {
    string: string
    numberAbreviation: "long" | "short" | false
    spaceBeforeUnit: boolean
    unit: string
}): string {
    let output = string
    if (numberAbreviation) {
        output = replaceSIPrefixes({
            string,
            numberAbreviation,
        })
    }
    if (spaceBeforeUnit && unit && !checkIsUnitCurrency(unit)) {
        output = output.replace(unit, ` ${unit}`)
    }
    return output
}

export function formatValue(
    value: number,
    {
        trailingZeroes = false,
        unit = "",
        spaceBeforeUnit = unit[0] !== "%",
        showPlus = false,
        numDecimalPlaces = 2,
        numberAbreviation = "long",
    }: TickFormattingOptions
): string {
    // when type = "%", d3.format multiples the value by 100
    // an old version of this function didn't use d3.format for percentages
    // so all our figures involving percentages are now 100x too large
    // thus we have to convert it to counteract d3's conversion
    // TODO: divide all percentage chart data by 100
    const convertedValue = checkIsUnitPercent(unit) ? value / 100 : value

    if (0 < convertedValue && convertedValue < 0.01) return "<0.01"

    const formatter = createFormatter(unit)

    const specifier = new FormatSpecifier({
        zero: "0",
        trim: getTrim({ trailingZeroes }),
        sign: getSign({ showPlus }),
        symbol: getSymbol({ unit }),
        comma: ",",
        precision: getPrecision({ value: convertedValue, numDecimalPlaces }),
        type: getType({ numberAbreviation, unit, value: convertedValue }),
    }).toString()

    const formattedString = formatter(specifier)(convertedValue)

    const postprocessedString = postprocessString({
        string: formattedString,
        numberAbreviation,
        spaceBeforeUnit,
        unit,
    })

    return postprocessedString
}
