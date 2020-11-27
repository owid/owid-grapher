import { d3Format } from "./Util"

export interface TickFormattingOptions {
    numDecimalPlaces?: number
    unit?: string
    noTrailingZeroes?: boolean
    noSpaceUnit?: boolean
    numberPrefixes?: boolean
    shortNumberPrefixes?: boolean
    showPlus?: boolean
    isFirstOrLastTick?: boolean
}

// todo: Should this be numberSuffixes instead of Prefixes?
// todo: we should have unit tests for this one. lot's of great features but hard to see how to use all of them.
export function formatValue(
    value: number,
    options: TickFormattingOptions
): string {
    const noTrailingZeroes = options.noTrailingZeroes ?? true
    const numberPrefixes =
        (options.numberPrefixes || options.shortNumberPrefixes) ?? true

    const shortNumberPrefixes = options.shortNumberPrefixes ?? false
    const showPlus = options.showPlus ?? false
    const numDecimalPlaces = options.numDecimalPlaces ?? 2
    const unit = options.unit ?? ""
    const isNoSpaceUnit = options.noSpaceUnit ?? unit[0] === "%"

    let output: string = value.toString()

    const absValue = Math.abs(value)
    if (!isNoSpaceUnit && numberPrefixes && absValue >= 1e6) {
        if (!isFinite(absValue)) output = "Infinity"
        else if (absValue >= 1e12)
            output = formatValue(value / 1e12, {
                ...options,
                unit: shortNumberPrefixes ? "T" : "trillion",
                noSpaceUnit: shortNumberPrefixes,
                numDecimalPlaces: 2,
            })
        else if (absValue >= 1e9)
            output = formatValue(value / 1e9, {
                ...options,
                unit: shortNumberPrefixes ? "B" : "billion",
                noSpaceUnit: shortNumberPrefixes,
                numDecimalPlaces: 2,
            })
        else if (absValue >= 1e6)
            output = formatValue(value / 1e6, {
                ...options,
                unit: shortNumberPrefixes ? "M" : "million",
                noSpaceUnit: shortNumberPrefixes,
                numDecimalPlaces: 2,
            })
    } else {
        const targetDigits = Math.pow(10, -numDecimalPlaces)

        if (value !== 0 && Math.abs(value) < targetDigits) {
            if (value < 0) output = `>-${targetDigits}`
            else output = `<${targetDigits}`
        } else
            output = d3Format(`${showPlus ? "+" : ""},.${numDecimalPlaces}f`)(
                value
            )

        if (noTrailingZeroes) {
            // Convert e.g. 2.200 to 2.2
            const m = output.match(/(.*?[0-9,-]+.[0-9,]*?)0*$/)
            if (m) output = m[1]
            if (output[output.length - 1] === ".")
                output = output.slice(0, output.length - 1)
        }
    }

    if (unit === "$" || unit === "£") output = unit + output
    else if (isNoSpaceUnit) output = output + unit
    else if (unit.length > 0) output = output + " " + unit

    return output
}
