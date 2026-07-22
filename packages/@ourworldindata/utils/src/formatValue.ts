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

function getAbbreviationThreshold({
    numberAbbreviation,
    abbreviationThreshold,
}: {
    numberAbbreviation: "long" | "short" | false
    abbreviationThreshold?: number
}): number {
    if (abbreviationThreshold !== undefined) return abbreviationThreshold
    // "short" doesn't abbreviate thousands since e.g. 25.24k is no shorter
    // than 25,240; it only makes sense for round numbers like axis ticks,
    // which pass an explicit threshold of 1,000
    return numberAbbreviation === "short" ? 1e5 : 1e6
}

function getType({
    roundingMode,
    numberAbbreviation,
    abbreviationThreshold,
    value,
    unit,
}: {
    roundingMode: OwidVariableRoundingMode
    numberAbbreviation: "long" | "short" | false
    abbreviationThreshold?: number
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
    if (numberAbbreviation) {
        const threshold = getAbbreviationThreshold({
            numberAbbreviation,
            abbreviationThreshold,
        })
        return Math.abs(value) < threshold ? type : "s"
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
    roundingMode,
    numDecimalPlaces,
    numSignificantFigures,
    abbreviationSignificantFigures,
    type,
}: {
    roundingMode: OwidVariableRoundingMode
    numDecimalPlaces: number
    numSignificantFigures: number
    abbreviationSignificantFigures?: number
    type: "f" | "s" | "r"
}): string {
    if (type === "f") {
        return `${numDecimalPlaces}`
    }

    // "r" and "s" count significant digits
    if (roundingMode === OwidVariableRoundingMode.significantFigures) {
        return `${numSignificantFigures}`
    }

    // abbreviated numbers ("s") in decimal-places mode: fixed decimal places
    // aren't meaningful for an abbreviated mantissa, so round to a hard-coded
    // 3 significant figures — numSignificantFigures deliberately has no
    // effect outside sig-fig mode. The axis may request more precision via
    // abbreviationSignificantFigures to keep neighbouring ticks apart
    return `${abbreviationSignificantFigures ?? 3}`
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
        abbreviationThreshold,
        abbreviationSignificantFigures,
    }: TickFormattingOptions
): string {
    const formatter = createFormatter(unit)

    // in "short" contexts, written-out values of 1,000 or more drop their
    // decimals: the fraction is noise at that magnitude, and full-precision
    // surfaces (tooltips, the data table) don't use "short". The cutoff is
    // 10^3 — where fractional digits fall below the same 3-significant-digit
    // budget that abbreviated values use (see getPrecision). Percent values
    // are exempt: they were never abbreviated, so their configured decimals
    // are honored at any magnitude — the drop only replaces abbreviation,
    // it never overrides numDecimalPlaces where it used to be respected
    const effectiveNumDecimalPlaces =
        numberAbbreviation === "short" &&
        !checkIsUnitPercent(unit) &&
        Math.abs(value) >= 1e3
            ? 0
            : numDecimalPlaces

    const effectiveRoundingMode = getEffectiveRoundingMode({
        value,
        roundingMode,
        numDecimalPlaces: effectiveNumDecimalPlaces,
        numSignificantFigures,
    })
    const type = getType({
        roundingMode: effectiveRoundingMode,
        numberAbbreviation,
        abbreviationThreshold,
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
            roundingMode,
            numDecimalPlaces: effectiveNumDecimalPlaces,
            numSignificantFigures,
            abbreviationSignificantFigures,
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
        numDecimalPlaces: effectiveNumDecimalPlaces,
    })

    return postprocessedString
}
