import { d3Format } from "./Util.js"

export interface TickFormattingOptions {
    numDecimalPlaces?: number
    unit?: string
    trailingZeroes?: boolean
    spaceBeforeUnit?: boolean
    numberPrefixes?: boolean
    shortNumberPrefixes?: boolean
    showPlus?: boolean
}

// Used outside this module to figure out if the unit will be joined with the number.
export function isVeryShortUnit(unit: string): boolean {
    return ["%", "$", "£"].includes(unit)
}

const checkIsCurrency = (unit: string): unit is "$" | "£" => {
    return ["$", "£"].includes(unit)
}

// todo: Should this be numberSuffixes instead of Prefixes?
export function formatValue(
    value: number,
    options: TickFormattingOptions
): string {
    const {
        trailingZeroes = false,
        unit = "",
        spaceBeforeUnit = unit[0] !== "%",
    } = options
    const numberPrefixes =
        (options.numberPrefixes || options.shortNumberPrefixes) ?? true

    const shortNumberPrefixes = options.shortNumberPrefixes ?? false
    const showPlus = options.showPlus ?? false
    const numDecimalPlaces = options.numDecimalPlaces ?? 2
    const unitIsCurrency = checkIsCurrency(unit)

    let output: string = value.toString()

    const absValue = Math.abs(value)
    if (spaceBeforeUnit && numberPrefixes && absValue >= 1e6) {
        if (!isFinite(absValue)) output = "Infinity"
        else if (absValue >= 1e12)
            output = formatValue(value / 1e12, {
                ...options,
                unit: shortNumberPrefixes ? "T" : "trillion",
                spaceBeforeUnit: !shortNumberPrefixes,
                numDecimalPlaces: 2,
            })
        else if (absValue >= 1e9)
            output = formatValue(value / 1e9, {
                ...options,
                unit: shortNumberPrefixes ? "B" : "billion",
                spaceBeforeUnit: !shortNumberPrefixes,
                numDecimalPlaces: 2,
            })
        else if (absValue >= 1e6)
            output = formatValue(value / 1e6, {
                ...options,
                unit: shortNumberPrefixes ? "M" : "million",
                spaceBeforeUnit: !shortNumberPrefixes,
                numDecimalPlaces: 2,
            })
    } else if (spaceBeforeUnit && shortNumberPrefixes && absValue >= 1e3) {
        output = formatValue(value / 1e3, {
            ...options,
            unit: "k",
            spaceBeforeUnit: false,
            numDecimalPlaces: 2,
        })
    } else {
        const targetDigits = Math.pow(10, -numDecimalPlaces)

        if (value !== 0 && Math.abs(value) < targetDigits) {
            if (value < 0) output = `>-${targetDigits}`
            else output = `<${targetDigits}`
        } else if (unitIsCurrency) {
            output = d3Format(unit)(
                `${showPlus ? "+" : ""}$,.${numDecimalPlaces}f`
            )(value)
        } else {
            output = d3Format()(`${showPlus ? "+" : ""},.${numDecimalPlaces}f`)(
                value
            )
        }

        if (!trailingZeroes) {
            // Convert e.g. 2.200 to 2.2
            const m = output.match(/(.*?[0-9,-]+.[0-9,]*?)0*$/)
            if (m) output = m[1]
            if (output[output.length - 1] === ".")
                output = output.slice(0, output.length - 1)
        }
    }

    if (!unitIsCurrency) {
        if (!spaceBeforeUnit) output = output + unit
        else if (unit.length > 0) output = output + " " + unit
    }

    return output
}
