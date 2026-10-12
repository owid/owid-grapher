/**
 * Axis domain and ticks, ported from grapher (ScatterPlotChartState.domainDefault /
 * domainsForAnimation, Axis.ts totalTicksTarget / getTickValues, utils domainExtent) and
 * d3-array / d3-scale's tick generators.
 *
 * - At rest the domain is the extent of the points shown for the selected year, so a year in which
 *   child mortality tops out at 12% is drawn on a 0-12% axis, not the 0-50% the 1990s needed.
 * - During play the domain is the extent over every year the animation will pass through, so the
 *   frame holds still while the dots move; when play stops, the axis returns to the year's own extent.
 * - The author's min/max only ever widen the domain (Axis.updateDomainPreservingUserSettings).
 * - The domain is not rounded to the ticks: like a grapher scatter, the extreme dots sit on the edges
 *   of the plot and the gridlines fall where d3's ticks land inside it.
 */

export type Scale = "linear" | "log"
export type Domain = [number, number]

export interface Tick {
    value: number
    /** A log tick of lowest priority drawn as a fainter gridline without a label */
    faint: boolean
    gridLineOnly: boolean
}

export function domainExtent(values: number[], scale: Scale): Domain | null {
    const vs = scale === "log" ? values.filter((v) => v > 0) : values
    if (!vs.length) return null
    let lo = Infinity
    let hi = -Infinity
    for (const v of vs) {
        if (v < lo) lo = v
        if (v > hi) hi = v
    }
    // One value: a made-up spread
    if (lo === hi)
        return scale === "log" ? [lo / 10, lo * 10] : [lo - 1, hi + 1]
    return [lo, hi]
}

export function mergeAuthorDomain(
    extent: Domain | null,
    authorMin: number | undefined,
    authorMax: number | undefined,
    scale: Scale
): Domain {
    const seedMin =
        authorMin === undefined || (scale === "log" && authorMin <= 0)
            ? Infinity
            : authorMin
    const seedMax =
        authorMax === undefined || (scale === "log" && authorMax <= 0)
            ? -Infinity
            : authorMax
    if (!extent) {
        if (isFinite(seedMin) && isFinite(seedMax)) return [seedMin, seedMax]
        return scale === "log" ? [1, 100] : [-1, 1]
    }
    return [Math.min(seedMin, extent[0]), Math.max(seedMax, extent[1])]
}

// d3-array ticks / tickIncrement
function tickIncrement(start: number, stop: number, count: number): number {
    const step = (stop - start) / Math.max(0, count)
    const power = Math.floor(Math.log10(step))
    const error = step / Math.pow(10, power)
    const factor =
        error >= Math.sqrt(50)
            ? 10
            : error >= Math.sqrt(10)
              ? 5
              : error >= Math.sqrt(2)
                ? 2
                : 1
    return power >= 0
        ? factor * Math.pow(10, power)
        : -Math.pow(10, -power) / factor
}

export function linearTicks(
    start: number,
    stop: number,
    count: number
): number[] {
    if (!(count > 0) || start === stop) return [start]
    const reverse = stop < start
    if (reverse) [start, stop] = [stop, start]
    let step = tickIncrement(start, stop, count)
    let ticks: number[]
    if (step === 0 || !isFinite(step)) return []
    if (step > 0) {
        const s0 = Math.ceil(start / step)
        const s1 = Math.floor(stop / step)
        ticks = Array.from({ length: s1 - s0 + 1 }, (_, i) => (s0 + i) * step)
    } else {
        step = -step
        const s0 = Math.ceil(start * step)
        const s1 = Math.floor(stop * step)
        ticks = Array.from({ length: s1 - s0 + 1 }, (_, i) => (s0 + i) / step)
    }
    ticks = ticks.map((t) => +t.toPrecision(12))
    return reverse ? ticks.reverse() : ticks
}

// d3-scale log ticks (base 10)
function logTicks(lo: number, hi: number, count: number): number[] {
    const i = Math.floor(Math.log10(lo))
    const j = Math.ceil(Math.log10(hi))
    let z: number[] = []
    if (j - i < count) {
        for (let d = i; d <= j; d++)
            for (let k = 1; k < 10; k++) {
                const t = k * Math.pow(10, d)
                if (t >= lo && t <= hi) z.push(t)
            }
        if (z.length * 2 < count) z = linearTicks(lo, hi, count)
    } else {
        z = linearTicks(i, j, Math.min(j - i, count)).map((d) =>
            Math.pow(10, d)
        )
    }
    return z
}

function isPowerOfTen(value: number): boolean {
    const l = Math.log10(value)
    return Math.abs(l - Math.round(l)) < 1e-9
}

/** Grapher's tick values for an axis of `rangePx` pixels, with its priority filter for log scales */
export function grapherTicks(
    domain: Domain,
    scale: Scale,
    rangePx: number
): Tick[] {
    const fontSize = 16
    // totalTicksTarget
    const total = Math.round(
        Math.min(6, Math.max(2, rangePx / (fontSize * 1.8)))
    )
    const [lo, hi] = domain
    if (scale !== "log")
        return linearTicks(lo, hi, total).map((value) => ({
            value,
            faint: false,
            gridLineOnly: false,
        }))
    const maxLabelled = Math.round(total * 1.25)
    const maxTicks = Math.round(total * 3)
    let ticks = logTicks(lo, hi, maxLabelled).map((value) => {
        const priority = isPowerOfTen(value)
            ? 1
            : isPowerOfTen(value * 2) || isPowerOfTen(value / 2)
              ? 2
              : 3
        return { value, priority, faint: false, gridLineOnly: false }
    })
    if (ticks.length > maxLabelled) {
        if (ticks.length <= maxTicks) {
            if (ticks.filter((t) => t.priority < 3).length >= 2)
                ticks = ticks.map((t) =>
                    t.priority === 3
                        ? { ...t, faint: true, gridLineOnly: true }
                        : t
                )
        } else {
            for (let pr = 3; pr > 1; pr--)
                if (ticks.length > maxLabelled)
                    ticks = ticks.filter((t) => t.priority < pr)
        }
    }
    return ticks.map(({ value, faint, gridLineOnly }) => ({
        value,
        faint,
        gridLineOnly,
    }))
}
