/**
 * DARK MODE PROTOTYPE — proposal C: dark charts with adapted data colors.
 *
 * Data colors are adapted in the OKLCH color space (perceptual lightness L,
 * chroma C, hue h). Hue is never changed, so "the blue line" stays blue and
 * continent colors stay recognisable. What changes is lightness, following one
 * rule: keep the *contrast relationships* that the author designed against a
 * white background, now against a dark one.
 *
 *  - Categorical colors (lines, stacked areas, continents, custom entity
 *    colors): lightness is lifted into a band that reads on the dark
 *    background, preserving the lightness order between colors.
 *
 *  - Sequential ramps whose lightness *decreases* with value (most ColorBrewer
 *    schemes, OWID single-color gradients, most custom bins): on white, high
 *    values are dark = high contrast. On dark, we mirror lightness so high
 *    values are light = high contrast. Hue and chroma of each step are kept.
 *
 *  - Sequential ramps whose lightness *increases* with value (viridis, magma,
 *    plasma, inferno): these already work on dark; only the darkest end is
 *    lifted so it doesn't disappear into the background.
 *
 *  - Diverging ramps (lightest in the middle, e.g. RdBu): the neutral
 *    midpoint must stay the least prominent, so it becomes dark and the
 *    extremes become light — the same mirroring as above.
 *
 * Because the rules work on any list of colors, they also cover author-entered
 * colors (customNumericColors, customCategoryColors, selectedEntityColors,
 * indicator display colors) without curating thousands of charts by hand.
 *
 * In production, the theme would be a prop on GrapherState. For the
 * prototype it is a global observable synced to <html data-chart-theme>, so
 * the whole page can be switched live.
 */

import { observable, runInAction } from "mobx"
import { Color } from "@ourworldindata/types"
import { color as d3color } from "d3-color"

export type ChartThemeName = "light" | "dark"

const themeBox = observable.box<ChartThemeName>("light")

export function getChartTheme(): ChartThemeName {
    return themeBox.get()
}

export function isDarkChartTheme(): boolean {
    return themeBox.get() === "dark"
}

export function setChartTheme(theme: ChartThemeName): void {
    if (themeBox.get() !== theme) runInAction(() => themeBox.set(theme))
}

/**
 * Exports (PNG/SVG downloads, thumbnails) always use the light theme, so a
 * chart downloaded from a dark page looks the same as one from a light page.
 */
export function withLightChartTheme<T>(fn: () => T): T {
    const previous = themeBox.get()
    if (previous === "light") return fn()
    return runInAction(() => {
        themeBox.set("light")
        try {
            return fn()
        } finally {
            themeBox.set(previous)
        }
    })
}

// Keep in sync with <html data-chart-theme="…"> (set by site/ThemeScript.tsx)
if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
    const root = document.documentElement
    const sync = (): void =>
        setChartTheme(
            root.getAttribute("data-chart-theme") === "dark" ? "dark" : "light"
        )
    sync()
    new MutationObserver(sync).observe(root, {
        attributes: true,
        attributeFilter: ["data-chart-theme"],
    })
}

/** The dark chart background, matching `--white` in the dark palette */
export const DARK_CHART_BACKGROUND = "#14181e"

// ---------------------------------------------------------------------------
// OKLab / OKLCH conversion (https://bottosson.github.io/posts/oklab/)

interface Oklch {
    l: number
    c: number
    h: number
}

const toLinear = (v: number): number =>
    v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
const fromLinear = (v: number): number =>
    v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055

function hexToOklch(hex: Color): Oklch | undefined {
    const c = d3color(hex)?.rgb()
    if (!c) return undefined
    const r = toLinear(c.r / 255)
    const g = toLinear(c.g / 255)
    const b = toLinear(c.b / 255)
    const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
    const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
    const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
    return {
        l: L,
        c: Math.sqrt(A * A + B * B),
        h: Math.atan2(B, A),
    }
}

function oklchToLinearRgb({ l, c, h }: Oklch): [number, number, number] {
    const A = c * Math.cos(h)
    const B = c * Math.sin(h)
    const l_ = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3
    const m_ = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3
    const s_ = (l - 0.0894841775 * A - 1.291485548 * B) ** 3
    return [
        4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
        -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
        -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
    ]
}

const inGamut = (rgb: [number, number, number]): boolean =>
    rgb.every((v) => v >= -0.0001 && v <= 1.0001)

/** Convert back to hex, reducing chroma until the color fits in sRGB */
function oklchToHex(color: Oklch): Color {
    let { c } = color
    let rgb = oklchToLinearRgb({ ...color, c })
    if (!inGamut(rgb)) {
        let lo = 0
        let hi = c
        for (let i = 0; i < 20; i++) {
            const mid = (lo + hi) / 2
            if (inGamut(oklchToLinearRgb({ ...color, c: mid }))) lo = mid
            else hi = mid
        }
        c = lo
        rgb = oklchToLinearRgb({ ...color, c })
    }
    const to255 = (v: number): string =>
        Math.round(Math.min(1, Math.max(0, fromLinear(v))) * 255)
            .toString(16)
            .padStart(2, "0")
    return `#${to255(rgb[0])}${to255(rgb[1])}${to255(rgb[2])}`
}

const clamp = (v: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, v))

// ---------------------------------------------------------------------------
// Adaptation rules

/** Lightness band for categorical colors on the dark background */
const CATEGORICAL_L_MIN = 0.6
const CATEGORICAL_L_SPAN = 0.35

/** Lightness range used for sequential/diverging ramps on dark */
const RAMP_L_DARK_END = 0.33
const RAMP_L_LIGHT_END = 0.93

/** Minimum lightness for colored text (series labels) on dark */
const TEXT_L_MIN = 0.74

const categoricalCache = new Map<Color, Color>()

/** Adapt a single categorical color (line, area, bar, category) for dark */
export function adaptCategoricalColorForDark(color: Color): Color {
    const cached = categoricalCache.get(color)
    if (cached) return cached
    const lch = hexToOklch(color)
    if (!lch) return color
    const l = clamp(CATEGORICAL_L_MIN + CATEGORICAL_L_SPAN * lch.l, 0, 0.96)
    // A touch more chroma counteracts the "washed out" look of lifted colors
    const result = oklchToHex({ ...lch, l, c: lch.c * 1.08 })
    categoricalCache.set(color, result)
    return result
}

/** Ramps whose hues span more than this are treated as multi-hue (radians) */
const MULTI_HUE_THRESHOLD = (40 / 180) * Math.PI

/** The smallest arc of the hue circle that contains all chromatic colors */
function hueSpan(colors: Oklch[]): number {
    const hues = colors
        .filter((c) => c.c > 0.04)
        .map((c) => (c.h + 2 * Math.PI) % (2 * Math.PI))
        .sort((a, b) => a - b)
    if (hues.length < 2) return 0
    let largestGap = 2 * Math.PI - hues[hues.length - 1] + hues[0]
    for (let i = 1; i < hues.length; i++)
        largestGap = Math.max(largestGap, hues[i] - hues[i - 1])
    return 2 * Math.PI - largestGap
}

export type RampShape = "increasing" | "decreasing" | "diverging" | "irregular"

export function detectRampShape(lightness: number[]): RampShape {
    const n = lightness.length
    if (n < 3) {
        if (n === 2)
            return lightness[1] > lightness[0] ? "increasing" : "decreasing"
        return "irregular"
    }
    // A palette whose colors all have similar lightness (e.g. Pastel 2) is
    // not a ramp, whatever the order of its colors
    if (Math.max(...lightness) - Math.min(...lightness) < 0.15)
        return "irregular"
    const tolerance = 0.03
    const steps = lightness.slice(1).map((l, i) => l - lightness[i])
    if (steps.every((s) => s >= -tolerance)) return "increasing"
    if (steps.every((s) => s <= tolerance)) return "decreasing"

    // Diverging: lightness rises to a peak somewhere in the middle, then falls
    const peak = lightness.indexOf(Math.max(...lightness))
    const rises = steps.slice(0, peak).every((s) => s >= -tolerance)
    const falls = steps.slice(peak).every((s) => s <= tolerance)
    if (peak > 0 && peak < n - 1 && rises && falls) return "diverging"

    return "irregular"
}

export type RampStrategy =
    | "mirror lightness"
    | "run backwards (multi-hue)"
    | "keep order, lift dark end"
    | "treated as categorical"

/** Which rule adaptRampForDark applies to a list of colors (for the lab page) */
export function describeRampStrategy(colors: Color[]): RampStrategy {
    const lchs = colors.map(hexToOklch)
    if (lchs.some((c) => c === undefined)) return "treated as categorical"
    const valid = lchs as Oklch[]
    const shape = detectRampShape(valid.map((c) => c.l))
    if (shape === "irregular") return "treated as categorical"
    if (shape === "increasing") return "keep order, lift dark end"
    if (shape === "decreasing" && hueSpan(valid) > MULTI_HUE_THRESHOLD)
        return "run backwards (multi-hue)"
    return "mirror lightness"
}

/**
 * Adapt an ordered list of colors (e.g. the numeric bins of a map legend) for
 * the dark background, keeping their order readable.
 */
export function adaptRampForDark(colors: (Color | undefined)[]): Color[] {
    const lchs = colors.map((c) => (c ? hexToOklch(c) : undefined))
    if (lchs.some((c) => c === undefined))
        return colors.map((c) => (c ? adaptCategoricalColorForDark(c) : c!))
    let valid = lchs as Oklch[]
    let lightness = valid.map((c) => c.l)
    let shape = detectRampShape(lightness)

    // Multi-hue sequential ramps (YlGnBu, OrRd, …) can't simply have their
    // lightness mirrored: a dark yellow turns into a muddy olive. Instead we
    // run them backwards, which gives the viridis-like "dark, saturated low
    // end → bright high end" that works on dark backgrounds. The legend shows
    // the mapping, so readers aren't misled.
    if (shape === "decreasing" && hueSpan(valid) > MULTI_HUE_THRESHOLD) {
        valid = valid.toReversed()
        lightness = valid.map((c) => c.l)
        shape = "increasing"
    }

    if (shape === "irregular")
        return colors.map((c) => adaptCategoricalColorForDark(c!))

    const lMin = Math.min(...lightness)
    const lMax = Math.max(...lightness)
    const span = Math.max(lMax - lMin, 0.0001)

    return valid.map((lch) => {
        const t = (lch.l - lMin) / span // 0 = darkest step, 1 = lightest step
        let l: number
        if (shape === "increasing") {
            // Already "more = brighter": keep the order, lift the dark end
            const lo = Math.max(lMin, RAMP_L_DARK_END + 0.04)
            // …and cap the bright end so large areas don't glare
            const hi = clamp(lMax, 0.85, RAMP_L_LIGHT_END)
            l = lo + t * (hi - lo)
        } else {
            // "More = darker" on white becomes "more = lighter" on dark
            l = RAMP_L_DARK_END + (1 - t) * (RAMP_L_LIGHT_END - RAMP_L_DARK_END)
        }
        // Pale steps that become dark keep a little chroma so they don't turn
        // into an indistinct gray
        // Diverging: fade chroma towards the midpoint so it becomes a neutral
        // dark gray rather than a muddy dark tint
        const c =
            shape === "diverging"
                ? lch.c * Math.pow(1 - t, 0.6)
                : Math.max(lch.c, shape === "increasing" ? 0 : 0.03)
        return oklchToHex({ ...lch, l, c })
    })
}

/** Make a colored label readable on the dark background */
export function lightenColorForDarkText(color: Color): Color {
    const lch = hexToOklch(color)
    if (!lch) return color
    if (lch.l >= TEXT_L_MIN) return color
    return oklchToHex({ ...lch, l: TEXT_L_MIN + (lch.l * (1 - TEXT_L_MIN)) / 2 })
}

/** Theme-aware helpers used by the chart code */
export function themeCategoricalColor<T extends Color | undefined>(
    color: T
): T {
    if (!color || !isDarkChartTheme()) return color
    return adaptCategoricalColorForDark(color) as T
}

export function themeRamp(colors: (Color | undefined)[]): (Color | undefined)[] {
    if (!isDarkChartTheme() || colors.length === 0) return colors
    return adaptRampForDark(colors)
}
