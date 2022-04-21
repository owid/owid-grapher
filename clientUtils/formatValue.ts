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
    if (numberAbreviation) {
        // do not abbreviate thousands
        if (numberAbreviation === "long" && Math.abs(value) < 1e6) {
            // fixed-point notation (i.e. fixed number of decimal points)
            return "f"
        }
        // decimal notation with an SI prefix, rounded to significant digits
        return "s"
    }

    // fixed-point notation (i.e. fixed number of decimal points)
    return "f"
}

function getPrecision({
    value,
    numDecimalPlaces,
    numberAbreviation,
}: {
    value: number
    numDecimalPlaces: number
    numberAbreviation: "short" | "long" | false
}): string {
    if (Math.abs(value) < 1e6 && numberAbreviation !== "short") {
        return `${numDecimalPlaces}`
    }

    // when dealing with abreviated numbers, adjust precision so we get 12.84 million instead of 13 million
    // the logarithm division gets the number of "tens columns" a number has, resetting every 3 columns
    // e.g. 1 million -> 0, 10 million -> 1, 100 million -> 2, 1 billion -> 0
    const precisionPadding =
        Math.round((Math.log(value) / Math.log(10)) % 3) + 1
    // always show 2 decimal places for abbreviated numbers
    return `${precisionPadding + 2}`
}

function replaceSIPrefixes({
    string,
    numberAbreviation,
}: {
    string: string
    numberAbreviation: "short" | "long"
}): string {
    const prefix = string[string.length - 1]

    const prefixMap: Record<string, Record<string, string>> = {
        short: {
            k: "k",
            M: "M",
            G: "B",
            T: "T",
            P: "Quad",
            E: "Quint",
        },
        long: {
            k: "k",
            M: " million",
            G: " billion",
            T: " trillion",
            P: " quadrillion",
            E: " quintillion",
        },
    }

    if (prefixMap[numberAbreviation][prefix]) {
        return string.replace(prefix, prefixMap[numberAbreviation][prefix])
    }
    return string
}

function postprocessString({
    string,
    numberAbreviation,
    spaceBeforeUnit,
    unit,
    value,
}: {
    string: string
    numberAbreviation: "long" | "short" | false
    spaceBeforeUnit: boolean
    unit: string
    value: number
}): string {
    let output = string

    // handling insignificant values, more logic to convert between d3's percentage magnitude and ours
    const tooSmallThreshold = checkIsUnitPercent(unit) ? 0.0001 : 0.01
    if (numberAbreviation && 0 < value && value < tooSmallThreshold) {
        output = "<" + output.replace(/0\.?(\d+)?/, "0.01")
    }

    if (numberAbreviation) {
        output = replaceSIPrefixes({
            string: output,
            numberAbreviation,
        })
    }

    if (unit) {
        const appendage = spaceBeforeUnit ? ` ${unit}` : unit
        if (checkIsUnitPercent(unit)) {
            // unit may be something like "% CO2", so we need to replace d3's "%" with the full unit
            output = output.replace("%", appendage)
        } else if (!checkIsUnitCurrency(unit)) {
            // If the unit is not a percentage or currency (e.g. "pp"), d3 won't have included it at all,
            // so we just add it to the end
            output = output + appendage
        }
    }
    return output
}

export function formatValue(
    value: number,
    {
        trailingZeroes = false,
        unit = "",
        spaceBeforeUnit = !checkIsUnitPercent(unit),
        showPlus = false,
        numDecimalPlaces = 2,
        numberAbreviation = "long",
    }: TickFormattingOptions
): string {
    // when type = "%", d3.format multiples the value by 100.
    // an old version of this function didn't use d3.format for percentages
    // so all our figures involving percentages are now 100x too large
    // thus we have to convert it to counteract d3's conversion
    // TODO: divide all percentage chart data by 100
    const convertedValue = checkIsUnitPercent(unit) ? value / 100 : value

    const formatter = createFormatter(unit)

    // Explore how specifiers work here
    // https://observablehq.com/@ikesau/d3-format-interactive-demo
    const specifier = new FormatSpecifier({
        zero: "0",
        trim: getTrim({ trailingZeroes }),
        sign: getSign({ showPlus }),
        symbol: getSymbol({ unit }),
        comma: ",",
        precision: getPrecision({
            value: convertedValue,
            numDecimalPlaces,
            numberAbreviation,
        }),
        type: getType({ numberAbreviation, unit, value: convertedValue }),
    }).toString()

    const formattedString = formatter(specifier)(convertedValue)

    const postprocessedString = postprocessString({
        string: formattedString,
        numberAbreviation,
        spaceBeforeUnit,
        unit,
        value: convertedValue,
    })

    return postprocessedString
}
