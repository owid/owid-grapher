import { format, FormatSpecifier } from "d3-format"
import { createFormatter } from "./Util.js"
import {
    OwidVariableRoundingMode,
    TickFormattingOptions,
} from "@ourworldindata/types"

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

function getTrim({
    roundingMode,
    trailingZeroes,
}: {
    roundingMode: OwidVariableRoundingMode
    trailingZeroes: boolean
}): "~" | "" {
    // always show trailing zeroes when rounding to significant figures
    return roundingMode === OwidVariableRoundingMode.significantFigures
        ? ""
        : trailingZeroes
          ? ""
          : "~"
}

function getSign({ showPlus }: { showPlus: boolean }): "+" | "" {
    return showPlus ? "+" : ""
}

function getSymbol({ unit }: { unit: string }): "$" | "" {
    return checkIsUnitCurrency(unit) ? "$" : ""
}

function getType({
    roundingMode,
    numberAbbreviation,
    value,
    unit,
}: {
    roundingMode: OwidVariableRoundingMode
    numberAbbreviation: "long" | "short" | false
    value: number
    unit: string
}): "f" | "s" | "r" {
    // f: fixed-point notation (i.e. fixed number of decimal points)
    // r: decimal notation, rounded to significant digits
    // s: decimal notation with an SI prefix, rounded to significant digits

    const typeMap: Record<OwidVariableRoundingMode, "f" | "r"> = {
        [OwidVariableRoundingMode.decimalPlaces]: "f",
        [OwidVariableRoundingMode.significantFigures]: "r",
    }
    const type = typeMap[roundingMode]

    if (checkIsUnitPercent(unit)) {
        return type
    }
    if (numberAbbreviation === "long") {
        // do not abbreviate until 1 million
        return Math.abs(value) < 1e6 ? type : "s"
    }
    if (numberAbbreviation === "short") {
        // do not abbreviate until 1 thousand
        return Math.abs(value) < 1e3 ? type : "s"
    }

    return type
}

// For values below 1, rounding to significant figures is capped at
// numDecimalPlaces decimal places: when sig-fig rounding would show more
// decimals than that, the value is rounded to numDecimalPlaces instead.
// This keeps small values from being spuriously precise, e.g. "0.902" deaths
// when whole numbers are configured. Values of 1 or more always round to
// significant figures
function getEffectiveRoundingMode({
    value,
    roundingMode,
    numDecimalPlaces,
    numSignificantFigures,
}: {
    value: number
    roundingMode: OwidVariableRoundingMode
    numDecimalPlaces: number
    numSignificantFigures: number
}): OwidVariableRoundingMode {
    if (roundingMode !== OwidVariableRoundingMode.significantFigures)
        return roundingMode

    // Only values below 1 are ever capped
    if (Math.abs(value) >= 1) return roundingMode

    // Keep sig figs when they show no more decimals than the cap allows
    const roundedToSigFigs = format(`.${numSignificantFigures}r`)(
        Math.abs(value)
    )
    const sigFigDecimals = roundedToSigFigs.split(".")[1]?.length ?? 0
    if (sigFigDecimals <= numDecimalPlaces) return roundingMode

    return OwidVariableRoundingMode.decimalPlaces
}

function getPrecision({
    value,
    roundingMode,
    numDecimalPlaces,
    numSignificantFigures,
    type,
}: {
    value: number
    roundingMode: OwidVariableRoundingMode
    numDecimalPlaces: number
    numSignificantFigures: number
    type: "f" | "s" | "r"
}): string {
    if (roundingMode === OwidVariableRoundingMode.significantFigures) {
        return `${numSignificantFigures}`
    }

    if (type === "f") {
        return `${numDecimalPlaces}`
    }

    // when dealing with abbreviated numbers, adjust precision so we get 12.84 million instead of 13 million
    // the modulo one-liner counts the "place columns" of the number, resetting every 3
    // 1 -> 1, 48 -> 2, 981 -> 3, 7222 -> 1
    const numberOfDigits = String(Math.floor(Math.abs(value))).length
    const precisionPadding = ((numberOfDigits - 1) % 3) + 1

    // hard-coded 2 decimal places for abbreviated numbers
    return `${precisionPadding + 2}`
}

function replaceSIPrefixes({
    string,
    numberAbbreviation,
}: {
    string: string
    numberAbbreviation: "short" | "long"
}): string {
    const prefix = string[string.length - 1]

    const prefixMap: Record<string, Record<string, string>> = {
        short: {
            k: "k",
            M: "M",
            G: "B",
            T: "T",
            P: "quad",
            E: "quint",
            Z: "sext",
            Y: "sept",
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

    if (prefixMap[numberAbbreviation][prefix]) {
        return string.replace(prefix, prefixMap[numberAbbreviation][prefix])
    }
    return string
}

function postprocessString({
    string,
    roundingMode,
    effectiveRoundingMode,
    numberAbbreviation,
    spaceBeforeUnit,
    useNoBreakSpace,
    unit,
    value,
    numDecimalPlaces,
}: {
    string: string
    roundingMode: OwidVariableRoundingMode
    effectiveRoundingMode: OwidVariableRoundingMode
    numberAbbreviation: "long" | "short" | false
    spaceBeforeUnit: boolean
    useNoBreakSpace: boolean
    unit: string
    value: number
    numDecimalPlaces: number
}): string {
    let output = string

    // handling infinitesimal values
    if (effectiveRoundingMode !== OwidVariableRoundingMode.significantFigures) {
        // true when a sig-fig value was rounded to decimal places instead
        const sigFigCapApplied =
            roundingMode === OwidVariableRoundingMode.significantFigures
        const tooSmallThreshold = Math.pow(10, -numDecimalPlaces).toPrecision(1)
        if (
            (numberAbbreviation || sigFigCapApplied) &&
            0 < value &&
            value < +tooSmallThreshold
        ) {
            output = "<" + output.replace(/0\.?(\d+)?/, tooSmallThreshold)
        }
    }

    if (numberAbbreviation) {
        output = replaceSIPrefixes({
            string: output,
            numberAbbreviation,
        })
    }

    if (unit && !checkIsUnitCurrency(unit)) {
        const spaceCharacter = useNoBreakSpace ? "\u00a0" : " "
        const appendage = spaceBeforeUnit ? spaceCharacter + unit : unit
        output += appendage
    }

    return output
}

export function formatValue(
    value: number,
    {
        roundingMode = OwidVariableRoundingMode.decimalPlaces,
        trailingZeroes = false, // only applies to fixed-point notation
        unit = "",
        spaceBeforeUnit = !checkIsUnitPercent(unit),
        useNoBreakSpace = false,
        showPlus = false,
        numDecimalPlaces = 2, // only applies to fixed-point notation
        numSignificantFigures = 3, // only applies to sig fig rounding
        numberAbbreviation = "long",
    }: TickFormattingOptions
): string {
    const formatter = createFormatter(unit)

    const effectiveRoundingMode = getEffectiveRoundingMode({
        value,
        roundingMode,
        numDecimalPlaces,
        numSignificantFigures,
    })
    const type = getType({
        roundingMode: effectiveRoundingMode,
        numberAbbreviation,
        value,
        unit,
    })

    // Explore how specifiers work here
    // https://observablehq.com/@ikesau/d3-format-interactive-demo
    const specifier = new FormatSpecifier({
        zero: "0",
        // trim is based on the configured rounding mode so that all values of
        // a sig-fig column share the same trailing-zero convention
        trim: getTrim({ roundingMode, trailingZeroes }),
        sign: getSign({ showPlus }),
        symbol: getSymbol({ unit }),
        comma: ",",
        precision: getPrecision({
            roundingMode: effectiveRoundingMode,
            value,
            numDecimalPlaces,
            numSignificantFigures,
            type,
        }),
        type,
    }).toString()

    const formattedString = formatter(specifier)(value)

    const postprocessedString = postprocessString({
        string: formattedString,
        roundingMode,
        effectiveRoundingMode,
        numberAbbreviation,
        spaceBeforeUnit,
        useNoBreakSpace,
        unit,
        value,
        numDecimalPlaces,
    })

    return postprocessedString
}
