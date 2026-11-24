import * as R from "remeda"

/**
 * Exponent range of the log y axis. The bottom snaps down to a multiple of
 * three, so the lowest gridline is always a labeled "1", "1,000", "1
 * million" …; the top gets a little headroom over the largest value.
 */
export function getYExponentDomain(values: number[]): [number, number] {
    const positive = values.filter((value) => value > 0)
    if (positive.length === 0) return [0, 3]
    const minExp = Math.max(
        0,
        Math.floor(Math.log10(Math.min(...positive)) / 3) * 3
    )
    const maxExp = Math.ceil(Math.log10(Math.max(...positive)) + 0.15)
    return [minExp, Math.max(maxExp, minExp + 3)]
}

/**
 * Exponents that get a labeled tick: every third (thousand, million, …)
 * normally, every one when zoomed in close, every sixth when space is
 * tight. Always multiples of the step, so labels stay on round names.
 */
export function getYTickExponents(
    [minExp, maxExp]: [number, number],
    plotHeight: number
): number[] {
    const decades = maxExp - minExp
    const minSpacing = 26
    const step = [1, 3, 6, 9].find(
        (candidate) => (plotHeight / decades) * candidate >= minSpacing
    )
    return R.range(minExp, maxExp + 1).filter((exp) => exp % (step ?? 9) === 0)
}

/** Year ticks at a round step that leaves room for each label */
export function getYearTicks(
    [start, end]: [number, number],
    plotWidth: number
): number[] {
    const minSpacing = 44
    const step =
        [1, 2, 5, 10, 20, 50].find(
            (candidate) => (plotWidth / (end - start)) * candidate >= minSpacing
        ) ?? 50
    return R.range(Math.ceil(start / step) * step, Math.floor(end) + 1).filter(
        (year) => year % step === 0
    )
}
