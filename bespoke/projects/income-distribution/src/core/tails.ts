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

/**
 * Or when the very end, the 0.1th percentile (or 99.9th), is this far in log
 * terms from the 0.5th (99.5th): the one bin that a smaller bottom-coded
 * group lands in. The end bin is naturally further out (log-normal: about
 * 0.35; the feed's median is 0.6, and regional models sit at 0.8–1.15), so
 * the bar is higher; the income surveys with such a group sit at 1.3–3.7.
 */
export const EXTREME_TAIL_LOG_GAP = 1.2

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
 * between the 2nd and the 0.5th percentile, or, when only its very end is
 * far out, between the 1st and the 0.1th; mirrored on the right
 */
export function tailFades(avgs: number[]): TailFades {
    if (avgs.length < 1000) return {}
    const fades: TailFades = {}
    const left = tailFade(
        [0.001, 0.005, 0.01, 0.02].map((p) => quantile(avgs, p, "lower"))
    )
    if (left) fades.left = left
    const right = tailFade(
        [0.999, 0.995, 0.99, 0.98].map((p) => quantile(avgs, p, "upper"))
    )
    if (right) fades.right = right
    return fades
}

/**
 * One side's fade from its four quantiles, outermost first: the 0.1th,
 * 0.5th, 1st and 2nd percentile on the left (the mirror on the right)
 */
function tailFade([end, p05, p1, p2]: number[]): TailFade | undefined {
    const gap = (inner: number, outer: number): number =>
        outer > 0 && inner > 0 ? Math.abs(Math.log(inner / outer)) : 0
    if (gap(p1, p05) > LONG_TAIL_LOG_GAP) return { from: p05, to: p2 }
    if (gap(p05, end) > EXTREME_TAIL_LOG_GAP) return { from: end, to: p1 }
    return undefined
}
