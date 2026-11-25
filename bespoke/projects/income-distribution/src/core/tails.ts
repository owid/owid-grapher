/**
 * Long tails of a country's distribution. A few countries' lowest incomes
 * run far below the rest (income surveys record near-zero and bottom-coded
 * incomes, around $0.28 a day, for the poorest half-percent), which the
 * density estimate draws as a thin sliver trailing off to the chart's edge.
 * Rather than claim precision there, the chart fades such a tail out.
 */

/**
 * A tail counts as long when the log gap between the 0.5th and 1st
 * percentile (or the 99th and 99.5th) is above this. In a log-normal
 * distribution of typical spread the gap is about 0.2, and across the feed
 * the median is 0.24 with most countries below 0.5; the bottom-coded income
 * surveys sit at 1.4–2.4.
 */
export const LONG_TAIL_LOG_GAP = 0.8

/** Where a fade runs, in int-$/day: fully faded at `from`, fully drawn at `to` */
export interface TailFade {
    from: number
    to: number
}

export interface TailFades {
    left?: TailFade
    right?: TailFade
}

/**
 * The bin just inside the `p` quantile (0–1) of equally populated, ascending
 * bin means: the last bin of the poorest `p` (`side: "lower"`), or the first
 * bin of the richest `1 - p` (`side: "upper"`), so a run of odd values at
 * either end is caught at the boundary
 */
function quantile(avgs: number[], p: number, side: "lower" | "upper"): number {
    const boundary = Math.round(p * avgs.length)
    const index = side === "lower" ? boundary - 1 : boundary
    return avgs[Math.min(avgs.length - 1, Math.max(0, index))]
}

/**
 * The fades a country's curve needs, if any: a long left tail fades out
 * between the 2nd and the 0.5th percentile, a long right tail between the
 * 98th and the 99.5th
 */
export function tailFades(avgs: number[]): TailFades {
    if (avgs.length < 200) return {}
    const p05 = quantile(avgs, 0.005, "lower")
    const p1 = quantile(avgs, 0.01, "lower")
    const p2 = quantile(avgs, 0.02, "lower")
    const p98 = quantile(avgs, 0.98, "upper")
    const p99 = quantile(avgs, 0.99, "upper")
    const p995 = quantile(avgs, 0.995, "upper")
    const fades: TailFades = {}
    if (p05 > 0 && Math.log(p1 / p05) > LONG_TAIL_LOG_GAP)
        fades.left = { from: p05, to: p2 }
    if (p99 > 0 && Math.log(p995 / p99) > LONG_TAIL_LOG_GAP)
        fades.right = { from: p995, to: p98 }
    return fades
}
