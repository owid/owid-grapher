import { d3Format } from "./Util.js"

export interface TickFormattingOptions {
    numDecimalPlaces?: number
    unit?: string
    trailingZeroes?: boolean
    spaceBeforeUnit?: boolean
    showPlus?: boolean
    numberAbreviation?: "short" | "long" | false
}

// Used outside this module to figure out if the unit will be joined with the number.
export function isVeryShortUnit(unit: string): boolean {
    return ["%", "$", "£"].includes(unit)
}

const checkIsUnitCurrency = (unit: string): unit is "$" | "£" => {
    return ["$", "£"].includes(unit)
}

export function formatValue(
    value: number,
    options: TickFormattingOptions
): string {
    const {
        trailingZeroes = false,
        unit = "",
        spaceBeforeUnit = unit[0] !== "%",
        showPlus = false,
        numDecimalPlaces = 2,
        numberAbreviation = "long",
    } = options

    const isUnitCurrency = checkIsUnitCurrency(unit)

    let output: string = value.toString()

    const absValue = Math.abs(value)
    if (spaceBeforeUnit && numberAbreviation && absValue >= 1e6) {
        if (!isFinite(absValue)) output = "Infinity"
        else if (absValue >= 1e12)
            output = formatValue(value / 1e12, {
                ...options,
                unit: numberAbreviation === "short" ? "T" : "trillion",
                spaceBeforeUnit: numberAbreviation === "long",
                numDecimalPlaces: 2,
            })
        else if (absValue >= 1e9)
            output = formatValue(value / 1e9, {
                ...options,
                unit: numberAbreviation === "short" ? "B" : "billion",
                spaceBeforeUnit: numberAbreviation === "long",
                numDecimalPlaces: 2,
            })
        else if (absValue >= 1e6)
            output = formatValue(value / 1e6, {
                ...options,
                unit: numberAbreviation === "short" ? "M" : "million",
                spaceBeforeUnit: numberAbreviation === "long",
                numDecimalPlaces: 2,
            })
    } else if (
        spaceBeforeUnit &&
        numberAbreviation === "short" &&
        absValue >= 1e3
    ) {
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
        } else if (isUnitCurrency) {
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

    if (!isUnitCurrency) {
        if (!spaceBeforeUnit) output = output + unit
        else if (unit.length > 0) output = output + " " + unit
    }

    return output
}
