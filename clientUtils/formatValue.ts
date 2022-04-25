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
    value,
}: {
    numberAbreviation: "long" | "short" | false
    value: number
}): string {
    // f: fixed-point notation (i.e. fixed number of decimal points)
    // s: decimal notation with an SI prefix, rounded to significant digits
    if (numberAbreviation === "long") {
        // do not abbreviate until 1 million
        return Math.abs(value) < 1e6 ? "f" : "s"
    }
    if (numberAbreviation === "short") {
        // do not abbreviate until 1 thousand
        return Math.abs(value) < 1000 ? "f" : "s"
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
    // the modulo one-liner counts the "place columns" of the number, resetting every 3
    // 1 -> 1, 48 -> 2, 981 -> 3, 7222 -> 1
    const numberOfDigits = String(Math.floor(Math.abs(value))).length
    const precisionPadding = ((numberOfDigits - 1) % 3) + 1

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

    // handling infinitesimal values
    const tooSmallThreshold = Math.pow(10, -numDecimalPlaces).toPrecision(1)
    if (numberAbreviation && 0 < value && value < +tooSmallThreshold) {
        output = "<" + output.replace(/0\.?(\d+)?/, tooSmallThreshold)
    }

    if (numberAbreviation) {
        output = replaceSIPrefixes({
            string: output,
            numberAbreviation,
        })
    }

    if (unit && !checkIsUnitCurrency(unit)) {
        const appendage = spaceBeforeUnit ? ` ${unit}` : unit
        output += appendage
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
            value,
            numDecimalPlaces,
            numberAbreviation,
        }),
        type: getType({ numberAbreviation, value }),
    }).toString()

    const formattedString = formatter(specifier)(value)

    const postprocessedString = postprocessString({
        string: formattedString,
        numberAbreviation,
        spaceBeforeUnit,
        unit,
        value,
        numDecimalPlaces,
    })

    return postprocessedString
}
