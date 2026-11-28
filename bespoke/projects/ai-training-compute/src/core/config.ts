const SUPERSCRIPT_DIGITS: Record<string, string> = {
    "⁰": "0",
    "¹": "1",
    "²": "2",
    "³": "3",
    "⁴": "4",
    "⁵": "5",
    "⁶": "6",
    "⁷": "7",
    "⁸": "8",
    "⁹": "9",
    "⁻": "-",
}

/**
 * Parses a FLOP value for a y-axis bound, written the ways authors are
 * likely to: `1e24`, `10e24` (which is 10²⁵), `10^24`, `3 × 10^24`, `10²⁴`
 * or a plain number
 */
export function parseFlopBound(value: string): number {
    const normalized = value
        .replace(/[\s,]+/g, "")
        // "10²⁴" → "10^24"
        .replace(
            /[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+/g,
            (digits) =>
                "^" + [...digits].map((d) => SUPERSCRIPT_DIGITS[d]).join("")
        )
    const power = /^(?:(\d+(?:\.\d+)?)[x×*])?10\^(-?\d+)$/.exec(normalized)
    const number = power
        ? // "3e26" rather than 3 * 10 ** 26, which is off in the last digit
          Number(`${power[1] ?? 1}e${power[2]}`)
        : Number(normalized)
    if (!Number.isFinite(number) || number <= 0)
        throw new Error(
            `"${value}" is not a positive number of FLOP, such as 1e24 or 10^24`
        )
    return number
}
