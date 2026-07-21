import type { MetricFormat } from "../types.js"

const round = (v: number, d: number): string => {
    const f = Math.pow(10, d)
    return (Math.round(v * f) / f).toString()
}

export function formatValue(
    v: number | null | undefined,
    format?: MetricFormat
): string {
    if (v === null || v === undefined || !Number.isFinite(v)) return "–"
    if (format === "pct") return round(v, 1) + "%"
    if (format === "usd") return "$" + Math.round(v).toLocaleString("en-US")
    if (format === "years") return round(v, 1)
    if (format === "index") return round(v, 2)
    if (format === "kg") return round(v, Math.abs(v) < 10 ? 1 : 0) + " kg"
    if (format === "tonnes") {
        const t = Math.abs(v)
        if (t >= 1e9) return round(v / 1e9, 1) + "B t"
        if (t >= 1e6) return round(v / 1e6, 1) + "M t"
        if (t >= 1e4) return round(v / 1e3, 0) + "k t"
        return round(v, t < 10 ? 1 : 0) + " t"
    }
    const a = Math.abs(v)
    if (a >= 1e9) return round(v / 1e9, 1) + "B"
    if (a >= 1e6) return round(v / 1e6, 1) + "M"
    if (a >= 1e4) return round(v / 1e3, 0) + "k"
    if (a >= 100) return Math.round(v).toLocaleString("en-US")
    return round(v, a < 1 ? 2 : 1)
}

/**
 * The one-line change summary. The AI curator picks the framing per metric
 * ("relative" = the multiple is the story; "absolute" = the change in the
 * metric's own units); this just renders it against the user's then/now numbers.
 */
export function changePhrase(
    framing: "relative" | "absolute",
    format: MetricFormat | undefined,
    then: number,
    now: number
): string {
    const d = now - then
    const sign = d >= 0 ? "+" : "−"
    const abs = Math.abs(d)
    if (framing === "absolute") {
        if (format === "years")
            return sign + round(abs, 1) + (abs === 1 ? " year" : " years")
        // percentage POINTS, not % of a %
        if (format === "pct") return sign + round(abs, abs < 10 ? 1 : 0) + " pp"
        if (format === "index") return sign + round(abs, 2)
        if (format === "usd")
            return sign + "$" + Math.round(abs).toLocaleString("en-US")
        return sign + formatValue(abs, format)
    }
    // Bounded 0-1ish composite scores (V-Dem indices, HDI-style metrics) land in
    // format "number" rather than a %/rate. Near their floor or ceiling, a tiny
    // absolute move (0.01 -> 0.02) produces a mathematically correct but
    // misleading ratio ("≈ doubled") — a rate/count metric moving the same
    // ratio off a small base (e.g. a mortality rate) is a genuine story, but a
    // fractional-point score isn't. Report the point difference instead.
    const NEGLIGIBLE_SCORE_DELTA = 0.1
    if (format === "number" && abs < NEGLIGIBLE_SCORE_DELTA) {
        return sign + formatValue(abs, format)
    }
    // relative: the multiple / ratio is the story (GDP, income, mortality rates, counts)
    if (then > 0 && now > 0) {
        const r = now / then
        if (r >= 1.85 && r <= 2.25) return "≈ doubled"
        if (r > 2.25) return "×" + round(r, 1)
        if (r >= 0.45 && r <= 0.55) return "≈ halved"
        if (r < 0.45) return "down by " + round((1 - r) * 100, 0) + "%"
    }
    const pc = then !== 0 ? (d / Math.abs(then)) * 100 : null
    if (pc === null) return now > then ? "rose" : "fell"
    return (
        (pc >= 0 ? "+" : "−") +
        round(Math.abs(pc), Math.abs(pc) < 10 ? 1 : 0) +
        "%"
    )
}
