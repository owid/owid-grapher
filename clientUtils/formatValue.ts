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
    // %: multiply by 100, and then decimal notation with a percent sign
    // f: fixed-point notation (i.e. fixed number of decimal points)
    // s: decimal notation with an SI prefix, rounded to significant digits

    if (checkIsUnitPercent(unit)) {
        return "%"
    }
    if (numberAbreviation === "long") {
        // do not abbreviate until 1 million
        if (Math.abs(value) < 1e6) {
            return "f"
        }
        return "s"
    }
    if (numberAbreviation === "short") {
        // do not abbreviate until 1 thousand
        if (Math.abs(value) < 1000) {
            return "f"
        }
        return "s"
    }

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
    // this modulo one-liner counts the "place columns" of the number, resetting every 3
    // 1 -> 1, 48 -> 2, 981 -> 3, 7222 -> 1
    const precisionPadding =
        ((String(Math.floor(Math.abs(value))).length - 1) % 3) + 1

    // hard-coded 2 decimal places for abbreviated numbers
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
            P: "P",
            E: "E",
            Z: "Z",
            Y: "Y",
        },
        long: {
            k: "k",
            M: " million",
            G: " billion",
            T: " trillion",
            P: " quadrillion",
            E: " quintillion",
            Z: " sextillion",
            Y: " septillion",
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
    numDecimalPlaces,
}: {
    string: string
    numberAbreviation: "long" | "short" | false
    spaceBeforeUnit: boolean
    unit: string
    value: number
    numDecimalPlaces: number
}): string {
    let output = string

    // handling infinitesimal values, more logic to convert between d3's percentage magnitude and ours
    const decimals = checkIsUnitPercent(unit)
        ? numDecimalPlaces + 2
        : numDecimalPlaces
    const tooSmallThreshold = Number(Math.pow(10, -decimals).toPrecision(1))
    if (numberAbreviation && 0 < value && value < tooSmallThreshold) {
        output = "<" + output.replace(/0\.?(\d+)?/, `${tooSmallThreshold}`)
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
        numDecimalPlaces,
    })

    return postprocessedString
}
