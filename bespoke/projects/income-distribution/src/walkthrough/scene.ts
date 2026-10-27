/**
 * The walkthrough's plot is drawn from a plain-data Scene. Every step of the
 * walkthrough is a function from the scene it starts from and its own
 * progress (0–1) to a new scene, so any point of the story can be computed
 * directly, scrolling backwards works the same as forwards, and two scenes can
 * be blended for the transition when the reader jumps between steps.
 */

/** A curve on the plot. x values are log2 of international-$ per day. */
export interface SceneSeries {
    /** One value per point of DENSITY_GRID */
    density: number[]
    color: string
    /** Opacity of the area under the curve; 0 draws no area */
    fill: number
    /** Opacity of the outline; 0 draws no outline */
    stroke: number
    strokeWidth: number
    /** How much of the curve is drawn, from the left: 0 nothing, 1 all of it */
    reveal: number
    alpha: number
    /** Paint order; higher is drawn later */
    z: number
    /** Takes part in the regional stack */
    stacked: boolean
    /** With focusMix > 0, the part outside [focusLo, focusHi] is faded */
    focusLo: number
    focusHi: number
    focusMix: number
}

interface MarkBase {
    alpha: number
}

/** The name of a curve, above its peak */
export interface CurveLabelMark extends MarkBase {
    kind: "curveLabel"
    series: string
    text: string
    color: string
}

/** A note in the top-right corner of the plot */
export interface CornerMark extends MarkBase {
    kind: "corner"
    text: string
}

/** A box above a country's peak saying what kind of survey its data comes from */
export interface SurveyMark extends MarkBase {
    kind: "survey"
    series: string
    title: string
    method: string
    year: number
    color: string
    /** 0–1: how far the "nowcast to <year>" line has faded in */
    nowcast: number
}

/** A vertical line with the share (and number) of people living below it */
export interface ReadoutMark extends MarkBase {
    kind: "readout"
    x: number
    /** Which population the share is of; a key of the plot's `stats` */
    stats: string
    unit: "day" | "month"
    color: string
    caption: string
    title?: string
}

/** An arrow from one income to another, labelled with the ratio */
export interface HopMark extends MarkBase {
    kind: "hop"
    from: number
    to: number
    text: string
    sub: string
    /** 0–1: how much of the arrow is drawn */
    draw: number
}

/** A line at an income with a two-line label beside it */
export interface TagMark extends MarkBase {
    kind: "tag"
    x: number
    /** Which side of the line the label sits on */
    side: "left" | "right"
    lines: [string, string]
    color: string
}

/** A shaded income band with a two-line label */
export interface BandMark extends MarkBase {
    kind: "band"
    lo: number
    hi: number
    lines: [string, string]
}

/** A label pointing at the peak of the stacked total */
export interface PeakLabelMark extends MarkBase {
    kind: "peakLabel"
    text: string
    sub: string
}

export type SceneMark =
    | CurveLabelMark
    | CornerMark
    | SurveyMark
    | ReadoutMark
    | HopMark
    | TagMark
    | BandMark
    | PeakLabelMark

export interface Scene {
    /** Top of the y-axis, in the same units as the series' densities */
    yMax: number
    /** 0: stacked series sit on the axis; 1: stacked on each other */
    stack: number
    /** 0: the axis is labelled per month; 1: per day */
    unit: number
    series: Record<string, SceneSeries>
    /** The outline over the stacked total */
    outline: { draw: number; alpha: number }
    marks: Record<string, SceneMark>
    /** Keys of the series in the legend, top first */
    legend: string[]
    legendAlpha: number
}

export const lerp = (from: number, to: number, t: number): number =>
    from + (to - from) * t

export const clamp01 = (t: number): number => Math.min(Math.max(t, 0), 1)

export const easeInOut = (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2

export const easeOut = (t: number): number => 1 - (1 - t) ** 3

/**
 * Progress through the part [from, to] of a step, eased: 0 before it, 1
 * after it
 */
export function phase(
    t: number,
    from: number,
    to: number,
    ease: (t: number) => number = easeInOut
): number {
    if (to <= from) return t >= to ? 1 : 0
    return ease(clamp01((t - from) / (to - from)))
}

export function cloneScene(scene: Scene): Scene {
    return {
        ...scene,
        series: Object.fromEntries(
            Object.entries(scene.series).map(([key, s]) => [key, { ...s }])
        ),
        outline: { ...scene.outline },
        marks: Object.fromEntries(
            Object.entries(scene.marks).map(([key, m]) => [key, { ...m }])
        ),
        legend: [...scene.legend],
    }
}

/** Drops series and marks that have faded out completely */
export function pruneScene(scene: Scene): Scene {
    for (const [key, s] of Object.entries(scene.series))
        if (s.alpha <= 0.001) delete scene.series[key]
    for (const [key, m] of Object.entries(scene.marks))
        if (m.alpha <= 0.001) delete scene.marks[key]
    return scene
}

/**
 * Blends two scenes: numbers are interpolated, everything else is taken from
 * `to`. A series or mark in only one of them fades in or out.
 */
export function mixScenes(from: Scene, to: Scene, t: number): Scene {
    if (t <= 0) return from
    if (t >= 1) return to

    const series: Record<string, SceneSeries> = {}
    for (const key of new Set([
        ...Object.keys(from.series),
        ...Object.keys(to.series),
    ])) {
        const a = from.series[key] ?? { ...to.series[key], alpha: 0 }
        const b = to.series[key] ?? { ...from.series[key], alpha: 0 }
        series[key] = mixNumbers(a, b, t)
    }

    const marks: Record<string, SceneMark> = {}
    for (const key of new Set([
        ...Object.keys(from.marks),
        ...Object.keys(to.marks),
    ])) {
        const a = from.marks[key]
        const b = to.marks[key]
        if (a && b && a.kind === b.kind) marks[key] = mixNumbers(a, b, t)
        else if (b) marks[key] = { ...b, alpha: b.alpha * t }
        else marks[key] = { ...a, alpha: a.alpha * (1 - t) }
    }

    return {
        yMax: lerp(from.yMax, to.yMax, t),
        stack: lerp(from.stack, to.stack, t),
        unit: lerp(from.unit, to.unit, t),
        series,
        outline: mixNumbers(from.outline, to.outline, t),
        marks,
        // The legend's rows can't be blended, so it fades through
        legend: t < 0.5 ? from.legend : to.legend,
        legendAlpha:
            from.legend.join() === to.legend.join()
                ? lerp(from.legendAlpha, to.legendAlpha, t)
                : t < 0.5
                  ? from.legendAlpha * (1 - 2 * t)
                  : to.legendAlpha * (2 * t - 1),
    }
}

/** `to` with each of its numeric fields interpolated from `from` */
function mixNumbers<T extends object>(from: T, to: T, t: number): T {
    const result = { ...to }
    for (const key of Object.keys(to) as (keyof T)[]) {
        const a = from[key]
        const b = to[key]
        if (typeof a === "number" && typeof b === "number")
            result[key] = lerp(a, b, t) as T[keyof T]
    }
    return result
}
