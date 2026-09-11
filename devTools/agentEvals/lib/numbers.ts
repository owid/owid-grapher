// Grapher spells multipliers out; single letters would collide with units
// such as "t" for tonnes.
const MULTIPLIERS: Record<string, number> = {
    thousand: 1e3,
    million: 1e6,
    billion: 1e9,
    trillion: 1e12,
}

/**
 * Parse a number the way grapher prints it: "79.6 years", "1.18 million",
 * "$1,234", "12.5%", "−3.2", "609 million people". Returns undefined for
 * anything that is not a single number (empty cells, "<0.1", text).
 */
export function parseFormattedNumber(input: string): number | undefined {
    let s = input.trim().replace(/−/g, "-").replace(/,/g, "")
    if (!s) return undefined
    // Strip a leading currency symbol.
    s = s.replace(/^[$€£¥]\s*/, "")
    const match = s.match(/^(-?\d+(?:\.\d+)?)(?:\s*([a-zA-Z]+))?/)
    if (!match) return undefined
    let value = Number(match[1])
    if (!Number.isFinite(value)) return undefined
    const word = match[2]?.toLowerCase()
    if (word && word in MULTIPLIERS) value *= MULTIPLIERS[word]
    return value
}

/**
 * Half a unit of the last printed digit, scaled by any multiplier word — the
 * largest rounding error a displayed value can carry.
 */
export function displayedHalfUnit(display: string): number {
    const s = display.trim().replace(/−/g, "-").replace(/,/g, "")
    const match = s.match(/^[$€£¥]?\s*-?(\d+)(?:\.(\d+))?(?:\s*([a-zA-Z]+))?/)
    if (!match) return 0
    const decimals = match[2]?.length ?? 0
    const word = match[3]?.toLowerCase()
    const multiplier = word && word in MULTIPLIERS ? MULTIPLIERS[word] : 1
    return (0.5 * multiplier) / 10 ** decimals
}

/** "<0.01 °C" → 0.01: the bound grapher prints for values below its display precision. */
export function parseUpperBound(input: string): number | undefined {
    const s = input.trim()
    if (!s.startsWith("<")) return undefined
    return parseFormattedNumber(s.slice(1))
}

export function approxEqual(
    a: number,
    b: number,
    relTol: number,
    absTol = 0
): boolean {
    const tol = Math.max(relTol * Math.abs(b), absTol)
    return Math.abs(a - b) <= tol
}
