/**
 * Short-scale names for powers of a thousand. FLOP counts in this chart reach
 * ~10^27, well past the "quadrillion" where the shared formatValue stops.
 */
const SCALE_NAMES: { exponent: number; name: string }[] = [
    { exponent: 27, name: "octillion" },
    { exponent: 24, name: "septillion" },
    { exponent: 21, name: "sextillion" },
    { exponent: 18, name: "quintillion" },
    { exponent: 15, name: "quadrillion" },
    { exponent: 12, name: "trillion" },
    { exponent: 9, name: "billion" },
    { exponent: 6, name: "million" },
]

/**
 * "940 septillion", "1.5 million", "4,000". Rounds to `significantDigits`
 * so readers aren't handed false precision from estimates.
 */
export function formatFlopInWords(
    value: number,
    { significantDigits = 2 }: { significantDigits?: number } = {}
): string {
    const rounded = Number(value.toPrecision(significantDigits))
    const scale = SCALE_NAMES.find(({ exponent }) => rounded >= 10 ** exponent)
    if (!scale) return rounded.toLocaleString("en-US")
    const mantissa = Number(
        (rounded / 10 ** scale.exponent).toPrecision(significantDigits)
    )
    return `${mantissa.toLocaleString("en-US")} ${scale.name}`
}

/** Axis tick label for an exact power of ten: "1 million", "100 trillion" */
export function formatPowerOfTenTick(exponent: number): string {
    return formatFlopInWords(10 ** exponent, { significantDigits: 1 })
}

const SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹"

/** "10²⁶" */
export function formatPowerOfTen(exponent: number): string {
    const superscript = String(exponent)
        .split("")
        .map((char) => (char === "-" ? "⁻" : SUPERSCRIPT_DIGITS[Number(char)]))
        .join("")
    return `10${superscript}`
}

/** "9.4 × 10²⁶" */
export function formatScientific(value: number): string {
    const exponent = Math.floor(Math.log10(value))
    const mantissa = Number((value / 10 ** exponent).toPrecision(2))
    if (mantissa === 10) return formatPowerOfTen(exponent + 1)
    return mantissa === 1
        ? formatPowerOfTen(exponent)
        : `${mantissa} × ${formatPowerOfTen(exponent)}`
}
