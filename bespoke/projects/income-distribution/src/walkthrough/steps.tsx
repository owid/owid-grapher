import * as R from "remeda"

import { REGION_COLORS } from "../core/constants.js"
import type { Region } from "../core/types.js"
import {
    cloneScene,
    easeOut,
    lerp,
    phase,
    pruneScene,
    type Scene,
    type SceneMark,
    type SceneSeries,
} from "./scene.js"
import {
    AXIS_MAX,
    AXIS_MIN,
    DAYS_PER_MONTH,
    formatPeople,
    formatPerMonth,
    REGION_STACK,
    type WalkthroughData,
} from "./walkthroughData.js"

/** Darker versions of the region colours, for region names in running text */
export const REGION_TEXT_COLORS: Record<Region, string> = {
    "East Asia and Pacific": "#008291",
    "Europe and Central Asia": "#4c6a9c",
    "Latin America and Caribbean": "#c15065",
    "Middle East, North Africa, Afghanistan and Pakistan": "#996d39",
    "North America": "#c4523e",
    "South Asia": "#00875e",
    "Sub-Saharan Africa": "#a2559c",
}

export const BEAT_NAMES = [
    "Surveys",
    "Differences",
    "Comparability",
    "Inequality",
    "The global picture",
]

export interface WalkthroughStep {
    /** Index into BEAT_NAMES */
    beat: number
    text: React.ReactNode
    /** The copy is a stand-in that still needs to be written */
    isPlaceholder?: boolean
    /** Draws attention to the link to the notes on the data */
    pointsAtNotes?: boolean
    /** Length of the step's animation, in ms at normal speed */
    duration: number
    /**
     * Turns `scene`, a copy of the previous step's end state, into this
     * step's state `ms` milliseconds into its animation. Must leave the
     * scene unchanged at ms = 0, so that steps follow on without a jump.
     * Steps that only add text leave it out.
     */
    apply?: (scene: Scene, ms: number) => void
}

const NIGERIA_COLOR = "#286bbb"
const UNITED_STATES_COLOR = "#c15065"
const SURVEY_COLOR = "#5b5b5b"
const FAINT_COLOR = "#7a7a7a"
const DARK = "#2d2d2d"

/**
 * Countries labelled with the kind of survey behind their data.
 * TODO: the survey types and years are illustrative placeholders; the feed
 * doesn't carry them yet (PIP's welfare_type and survey year).
 */
const SURVEYED: [name: string, label: string, method: string, year: number][] =
    [
        ["Democratic Republic of Congo", "DR Congo", "Consumption", 2012],
        ["Nigeria", "Nigeria", "Consumption", 2018],
        ["India", "India", "Consumption", 2022],
        ["Brazil", "Brazil", "Income", 2023],
        ["United States", "United States", "Income", 2023],
    ]

/** The scene the walkthrough opens on: the interactive chart's regional mountain, per month */
export function initialScene(data: WalkthroughData): Scene {
    const scene: Scene = {
        yMax: 0,
        stack: 1,
        unit: 0,
        series: {},
        outline: { draw: 0, alpha: 0 },
        marks: {},
        legend: [...REGION_STACK].reverse(),
        legendAlpha: 1,
    }
    for (const region of REGION_STACK)
        scene.series[region] = regionSeries(data, region, {
            reveal: 1,
            fill: 1,
            strokeWidth: 0.8,
        })
    scene.yMax = stackedMax(data, REGION_STACK) * 1.12
    return scene
}

function makeSeries(
    density: number[],
    props: Partial<SceneSeries>
): SceneSeries {
    return {
        density,
        color: "#777",
        fill: 0.15,
        stroke: 1,
        strokeWidth: 1.5,
        reveal: 0,
        alpha: 1,
        z: 1,
        stacked: false,
        focusLo: AXIS_MIN,
        focusHi: AXIS_MAX,
        focusMix: 0,
        ...props,
    }
}

function regionSeries(
    data: WalkthroughData,
    region: Region,
    props: Partial<SceneSeries> = {}
): SceneSeries {
    return makeSeries(data.regionCurves.get(region) ?? [], {
        color: REGION_COLORS[region],
        stacked: true,
        z: 2,
        fill: 0.55,
        strokeWidth: 2,
        ...props,
    })
}

const peakOf = (density: number[]): number =>
    density.reduce((max, d) => Math.max(max, d), 0)

function stackedMax(data: WalkthroughData, regions: Region[]): number {
    const curves = regions.map((r) => data.regionCurves.get(r) ?? [])
    const length = curves[0]?.length ?? 0
    let max = 0
    for (let i = 0; i < length; i++)
        max = Math.max(
            max,
            R.sumBy(curves, (c) => c[i] ?? 0)
        )
    return max
}

function RegionName({
    name,
    children,
}: {
    name: Region
    children?: React.ReactNode
}): React.ReactElement {
    return (
        <strong style={{ color: REGION_TEXT_COLORS[name] }}>
            {children ?? name}
        </strong>
    )
}

/**
 * Tweening helpers for one step's `apply`. Each tween eases a number from
 * the value it has when the tween is reached to `to`, between two moments
 * of the step, so tweens of the same value chain on from each other.
 */
function timeline(ms: number) {
    const tween = (
        target: object | undefined,
        props: Record<string, number>,
        from: number,
        to: number,
        ease?: (t: number) => number
    ): void => {
        if (!target) return
        const p = phase(ms, from, to, ease)
        if (p <= 0) return
        const values = target as Record<string, number>
        for (const [key, value] of Object.entries(props))
            values[key] = lerp(values[key], value, p)
    }
    /** Runs `fn` once the step reaches `moment` */
    const after = (moment: number, fn: () => void): void => {
        if (ms >= moment) fn()
    }
    return { tween, after }
}

export function buildSteps(data: WalkthroughData): WalkthroughStep[] {
    const { stats, countryCurves } = data
    const curve = (name: string): number[] => countryCurves.get(name) ?? []

    const ssaMedian = stats.subSaharanAfrica.quantile(0.5)
    const naMedian = stats.northAmerica.quantile(0.5)
    const ssaP90 = stats.subSaharanAfrica.quantile(0.9)
    const naP10 = stats.northAmerica.quantile(0.1)
    const ssaHalf = stats.subSaharanAfrica.population / 2
    const medianRatio = Math.round(naMedian / ssaMedian)

    const countryYMax =
        Math.max(...SURVEYED.map(([name]) => peakOf(curve(name)))) * 1.3
    // The other countries, drawn faintly behind; very peaked ones would poke out of the plot
    const faint = R.pipe(
        data.countries,
        R.filter(
            (c) =>
                !["Nigeria", "United States"].includes(c.name) &&
                peakOf(curve(c.name)) < countryYMax * 0.92
        ),
        R.sortBy([(c) => c.population, "desc"]),
        R.take(90)
    )
    const otherRegions = REGION_STACK.filter(
        (r) => r !== "Sub-Saharan Africa" && r !== "North America"
    )
    const bands: [number, number][] = [
        [50, 100],
        [500, 1000],
        [2000, 4000],
    ].map(([lo, hi]) => [lo / DAYS_PER_MONTH, hi / DAYS_PER_MONTH])

    const fadeOut = (
        scene: Scene,
        keys: string[],
        tween: ReturnType<typeof timeline>["tween"],
        from = 0
    ): void => {
        for (const key of keys)
            tween(scene.marks[key], { alpha: 0 }, from, from + 400)
    }

    const addCountry = (
        scene: Scene,
        name: string,
        color: string,
        ms: number,
        start: number
    ): void => {
        const { tween } = timeline(ms)
        if (ms < start) return
        scene.series[name] ??= makeSeries(curve(name), {
            color,
            fill: 0.18,
            strokeWidth: 2,
            z: 5,
        })
        tween(scene.series[name], { reveal: 1 }, start, start + 1100, easeOut)
        const labelKey = `label-${name}`
        scene.marks[labelKey] ??= {
            kind: "curveLabel",
            series: name,
            text: name,
            color,
            alpha: 0,
        }
        tween(scene.marks[labelKey], { alpha: 1 }, start + 900, start + 1300)
    }

    const setMark = (scene: Scene, key: string, mark: SceneMark): SceneMark =>
        (scene.marks[key] ??= mark)

    return [
        {
            beat: 0,
            text: (
                <>
                    The main source of data we have for understanding incomes
                    around the world is{" "}
                    <strong>national household surveys</strong>.
                </>
            ),
            duration: 5100,
            apply: (scene, ms) => {
                const { tween, after } = timeline(ms)
                // From the chart's own view, the regional mountain, to single countries
                for (const s of Object.values(scene.series))
                    tween(s, { alpha: 0 }, 0, 700)
                tween(scene, { legendAlpha: 0 }, 0, 500)
                after(750, () => {
                    scene.series = {}
                    scene.stack = 0
                    scene.yMax = countryYMax
                })
                addCountry(scene, "Nigeria", NIGERIA_COLOR, ms, 800)
                addCountry(
                    scene,
                    "United States",
                    UNITED_STATES_COLOR,
                    ms,
                    2600
                )
            },
        },
        {
            beat: 0,
            text: "These give us a picture of the distribution for most individual countries in the world.",
            // The last faint curve finishes 60ms after the count fades in
            duration: 300 + faint.length * 40 + 600,
            apply: (scene, ms) => {
                const { tween, after } = timeline(ms)
                faint.forEach((c, i) => {
                    const start = 300 + i * 40
                    after(start, () => {
                        scene.series[c.name] ??= makeSeries(curve(c.name), {
                            color: FAINT_COLOR,
                            fill: 0,
                            stroke: 0.28,
                            strokeWidth: 1,
                        })
                        tween(
                            scene.series[c.name],
                            { reveal: 1 },
                            start,
                            start + 600,
                            easeOut
                        )
                    })
                })
                const countStart = 300 + faint.length * 40
                after(countStart, () => {
                    setMark(scene, "count", {
                        kind: "corner",
                        text: `${data.countries.length} countries`,
                        alpha: 0,
                    })
                    tween(
                        scene.marks.count,
                        { alpha: 1 },
                        countStart,
                        countStart + 500
                    )
                })
            },
        },
        {
            beat: 1,
            text: (
                <>
                    There are differences across countries in{" "}
                    <strong>what the surveys ask</strong>, and{" "}
                    <strong>how often</strong> they are conducted.
                </>
            ),
            duration: 5900,
            apply: (scene, ms) => {
                const { tween, after } = timeline(ms)
                fadeOut(
                    scene,
                    ["count", "label-Nigeria", "label-United States"],
                    tween
                )
                after(1, () => {
                    for (const [name] of SURVEYED) {
                        scene.series[name] ??= makeSeries(curve(name), {
                            color: SURVEY_COLOR,
                            fill: 0,
                            stroke: 0,
                            strokeWidth: 1,
                            reveal: 1,
                        })
                        const s = scene.series[name]
                        if (s.color === FAINT_COLOR) s.color = SURVEY_COLOR
                        if (name !== "Nigeria" && name !== "United States")
                            tween(
                                s,
                                { stroke: 0.9, strokeWidth: 1.6 },
                                400,
                                900
                            )
                    }
                })
                SURVEYED.forEach(([name, title, method, year], i) => {
                    const start = 900 + i * 900
                    after(start, () => {
                        setMark(scene, `survey-${name}`, {
                            kind: "survey",
                            series: name,
                            title,
                            method,
                            year,
                            color: scene.series[name]?.color ?? SURVEY_COLOR,
                            nowcast: 0,
                            alpha: 0,
                        })
                        tween(
                            scene.marks[`survey-${name}`],
                            { alpha: 1 },
                            start,
                            start + 450
                        )
                    })
                })
                const noteStart = 900 + SURVEYED.length * 900
                after(noteStart, () => {
                    setMark(scene, "illustrative", {
                        kind: "corner",
                        text: "Survey types and years shown are illustrative placeholders",
                        alpha: 0,
                    })
                    tween(
                        scene.marks.illustrative,
                        { alpha: 1 },
                        noteStart,
                        noteStart + 500
                    )
                })
            },
        },
        {
            beat: 2,
            text: (
                <>
                    To provide a global picture, the World Bank takes steps to
                    make this data <strong>as comparable as possible</strong>{" "}
                    and ‘nowcasts’ updated figures from older surveys.
                </>
            ),
            duration: 2200,
            apply: (scene, ms) => {
                const { tween } = timeline(ms)
                // The survey years roll forward to the year the chart shows
                for (const [name] of SURVEYED)
                    tween(
                        scene.marks[`survey-${name}`],
                        { nowcast: 1 },
                        1800,
                        2200
                    )
                fadeOut(scene, ["illustrative"], tween, 1200)
            },
        },
        {
            beat: 2,
            text: "You can read more about this in the notes on the data, linked below the chart.",
            pointsAtNotes: true,
            duration: 0,
        },
        {
            beat: 3,
            text: (
                <>
                    This allows us to see the{" "}
                    <strong>huge level of global inequality</strong> that exists
                    today.
                </>
            ),
            duration: 2600,
            apply: (scene, ms) => {
                const { tween, after } = timeline(ms)
                fadeOut(scene, Object.keys(scene.marks), tween)
                for (const s of Object.values(scene.series))
                    tween(s, { alpha: 0 }, 0, 900)
                after(1000, () => {
                    scene.series = {}
                    scene.marks = {}
                    scene.yMax =
                        peakOf(
                            data.regionCurves.get("Sub-Saharan Africa") ?? []
                        ) * 1.5
                    // The poorest region comes in, so the plot isn't left empty
                    scene.series["Sub-Saharan Africa"] = regionSeries(
                        data,
                        "Sub-Saharan Africa"
                    )
                })
                tween(
                    scene.series["Sub-Saharan Africa"],
                    { reveal: 1 },
                    1000,
                    2600,
                    easeOut
                )
            },
        },
        {
            beat: 3,
            text: (
                <>
                    In <RegionName name="Sub-Saharan Africa" />, half the
                    population — {formatPeople(ssaHalf)} people — live on less
                    than <strong>$100 a month</strong>.
                </>
            ),
            duration: 2700,
            apply: (scene, ms) => {
                const { tween, after } = timeline(ms)
                const s = scene.series["Sub-Saharan Africa"]
                after(600, () => {
                    s.focusLo = AXIS_MIN
                    s.focusHi = AXIS_MIN
                })
                tween(s, { focusMix: 1 }, 600, 1100)
                tween(s, { focusHi: Math.log2(ssaMedian) }, 700, 2700)
                after(700, () => {
                    setMark(scene, "ssa-line", {
                        kind: "readout",
                        x: AXIS_MIN,
                        stats: "subSaharanAfrica",
                        unit: "month",
                        color: REGION_TEXT_COLORS["Sub-Saharan Africa"],
                        caption: "of Sub-Saharan Africa",
                        alpha: 0,
                    })
                })
                tween(scene.marks["ssa-line"], { alpha: 1 }, 700, 1000)
                tween(
                    scene.marks["ssa-line"],
                    { x: Math.log2(ssaMedian) },
                    700,
                    2700
                )
            },
        },
        {
            beat: 3,
            text: (
                <>
                    In <RegionName name="North America" />, incomes are roughly{" "}
                    <strong>{medianRatio} times higher</strong>.
                </>
            ),
            duration: 3800,
            apply: (scene, ms) => {
                const { tween, after } = timeline(ms)
                tween(
                    scene.series["Sub-Saharan Africa"],
                    { focusMix: 0 },
                    0,
                    600
                )
                fadeOut(scene, ["ssa-line"], tween)
                after(500, () => {
                    scene.series["North America"] ??= regionSeries(
                        data,
                        "North America"
                    )
                })
                tween(
                    scene.series["North America"],
                    { reveal: 1 },
                    500,
                    2100,
                    easeOut
                )
                after(2400, () => {
                    setMark(scene, "hop", {
                        kind: "hop",
                        from: Math.log2(ssaMedian),
                        to: Math.log2(naMedian),
                        text: `×${medianRatio}`,
                        sub: "median income",
                        draw: 0,
                        alpha: 0,
                    })
                })
                tween(scene.marks.hop, { alpha: 1, draw: 1 }, 2400, 3800)
            },
        },
        {
            beat: 3,
            text: (
                <>
                    And there’s almost no overlap: Even the “rich” in{" "}
                    <RegionName name="Sub-Saharan Africa" /> are very poor when
                    compared to the incomes in high-income countries.
                </>
            ),
            duration: 2800,
            apply: (scene, ms) => {
                const { tween, after } = timeline(ms)
                fadeOut(scene, ["hop"], tween)
                const ssa = scene.series["Sub-Saharan Africa"]
                const na = scene.series["North America"]
                after(500, () => {
                    ssa.focusLo = Math.log2(ssaP90)
                    ssa.focusHi = AXIS_MAX
                    na.focusLo = AXIS_MIN
                    na.focusHi = Math.log2(naP10)
                })
                tween(ssa, { focusMix: 1 }, 500, 1200)
                tween(na, { focusMix: 1 }, 500, 1200)
                after(1300, () => {
                    setMark(scene, "rich-ssa", {
                        kind: "tag",
                        x: Math.log2(ssaP90),
                        side: "left",
                        lines: [
                            "Richest 10% in Sub-Saharan Africa",
                            `more than ${formatPerMonth(ssaP90)} a month`,
                        ],
                        color: REGION_TEXT_COLORS["Sub-Saharan Africa"],
                        alpha: 0,
                    })
                })
                tween(scene.marks["rich-ssa"], { alpha: 1 }, 1300, 1800)
                after(2300, () => {
                    setMark(scene, "poor-na", {
                        kind: "tag",
                        x: Math.log2(naP10),
                        side: "right",
                        lines: [
                            "Poorest 10% in North America",
                            `less than ${formatPerMonth(naP10)} a month`,
                        ],
                        color: REGION_TEXT_COLORS["North America"],
                        alpha: 0,
                    })
                })
                tween(scene.marks["poor-na"], { alpha: 1 }, 2300, 2800)
            },
        },
        {
            beat: 4,
            text: (
                <>
                    The World Bank’s income data is crucial because of the{" "}
                    <strong>global perspective</strong> it gives us.
                </>
            ),
            duration: 900 + (otherRegions.length - 1) * 900 + 1300,
            apply: (scene, ms) => {
                const { tween, after } = timeline(ms)
                fadeOut(scene, ["rich-ssa", "poor-na"], tween)
                for (const s of Object.values(scene.series))
                    tween(s, { focusMix: 0 }, 0, 600)
                tween(
                    scene,
                    {
                        yMax:
                            Math.max(
                                ...REGION_STACK.map((r) =>
                                    peakOf(data.regionCurves.get(r) ?? [])
                                )
                            ) * 1.15,
                    },
                    400,
                    1600
                )
                after(1, () => {
                    scene.legend = ["North America", "Sub-Saharan Africa"]
                })
                tween(scene, { legendAlpha: 1 }, 300, 800)
                otherRegions.forEach((region, i) => {
                    const start = 900 + i * 900
                    after(start, () => {
                        scene.series[region] ??= regionSeries(data, region)
                        // In stack order, top first, so stacking needn't reorder it
                        scene.legend = REGION_STACK.filter(
                            (r) => r in scene.series
                        ).reverse()
                    })
                    tween(
                        scene.series[region],
                        { reveal: 1 },
                        start,
                        start + 1300,
                        easeOut
                    )
                })
            },
        },
        {
            beat: 4,
            text: (
                <>
                    Stacking the data for each world region gives us the{" "}
                    <strong>global distribution</strong>.
                </>
            ),
            duration: 4900,
            apply: (scene, ms) => {
                const { tween, after } = timeline(ms)
                tween(
                    scene,
                    { stack: 1, yMax: stackedMax(data, REGION_STACK) * 1.12 },
                    500,
                    2700
                )
                for (const s of Object.values(scene.series))
                    tween(s, { fill: 1, strokeWidth: 0.8 }, 900, 2500)
                tween(scene.outline, { alpha: 1 }, 3000, 3200)
                tween(scene.outline, { draw: 1 }, 3000, 4800)
                after(4400, () => {
                    setMark(scene, "global", {
                        kind: "peakLabel",
                        text: "The global distribution",
                        sub: "every region, added up",
                        alpha: 0,
                    })
                })
                tween(scene.marks.global, { alpha: 1 }, 4400, 4900)
            },
        },
        {
            beat: 4,
            text: (
                <>
                    And this shows us <strong>how many people</strong> around
                    the world live at different income levels.
                </>
            ),
            duration: 900 + 3 * 2600,
            apply: (scene, ms) => {
                const { tween, after } = timeline(ms)
                fadeOut(scene, ["global"], tween)
                tween(scene.outline, { alpha: 0.35 }, 0, 500)
                tween(scene, { legendAlpha: 0 }, 0, 500)
                const series = Object.values(scene.series)
                bands.forEach(([lo, hi], i) => {
                    const start = 900 + i * 2600
                    // The first band's window is set while nothing is
                    // focused yet; later ones glide over from the last
                    if (i === 0)
                        after(start, () => {
                            for (const s of series) {
                                s.focusLo = Math.log2(lo)
                                s.focusHi = Math.log2(hi)
                            }
                        })
                    for (const s of series)
                        tween(
                            s,
                            {
                                focusLo: Math.log2(lo),
                                focusHi: Math.log2(hi),
                                focusMix: 1,
                            },
                            start,
                            start + 400
                        )
                    after(start, () => {
                        setMark(scene, `band-${i}`, {
                            kind: "band",
                            lo: Math.log2(lo),
                            hi: Math.log2(hi),
                            lines: [
                                `${formatPeople(stats.world.between(lo, hi))} people`,
                                `on ${formatPerMonth(lo)}–${formatPerMonth(hi)} a month`,
                            ],
                            alpha: 0,
                        })
                    })
                    tween(
                        scene.marks[`band-${i}`],
                        { alpha: 1 },
                        start,
                        start + 400
                    )
                    // Gone before the next band's label comes in
                    fadeOut(scene, [`band-${i}`], tween, start + 2100)
                })
                const end = 900 + 3 * 2600
                for (const s of series)
                    tween(s, { focusMix: 0 }, end - 300, end)
            },
        },
        {
            beat: 4,
            isPlaceholder: true,
            text: (
                <>
                    The International Poverty Line is <strong>$3 a day</strong>.
                    By this measure, around 1 in 10 people in the world live in
                    extreme poverty.
                </>
            ),
            duration: 3300,
            apply: (scene, ms) => {
                const { tween, after } = timeline(ms)
                tween(scene, { unit: 1 }, 0, 900)
                tween(scene.outline, { alpha: 0 }, 0, 500)
                const series = Object.values(scene.series)
                after(1000, () => {
                    for (const s of series) {
                        s.focusLo = AXIS_MIN
                        s.focusHi = AXIS_MIN
                    }
                })
                for (const s of series) {
                    tween(s, { focusMix: 1 }, 1000, 1400)
                    tween(s, { focusHi: Math.log2(3) }, 1100, 3300)
                }
                after(1100, () => {
                    setMark(scene, "poverty-line", {
                        kind: "readout",
                        x: AXIS_MIN,
                        stats: "world",
                        unit: "day",
                        color: DARK,
                        caption: "of the world",
                        title: "International Poverty Line",
                        alpha: 0,
                    })
                })
                tween(scene.marks["poverty-line"], { alpha: 1 }, 1100, 1400)
                tween(
                    scene.marks["poverty-line"],
                    { x: Math.log2(3) },
                    1100,
                    3300
                )
            },
        },
        {
            beat: 4,
            isPlaceholder: true,
            text: "It’s an extremely low line, based on the national poverty lines of the world’s poorest countries.",
            duration: 0,
        },
        {
            beat: 4,
            isPlaceholder: true,
            text: (
                <>
                    High-income countries set much higher poverty lines —{" "}
                    <strong>$30 a day</strong> or more. By that standard, 8 in
                    10 people in the world are poor.
                </>
            ),
            duration: 3500,
            apply: (scene, ms) => {
                const { tween, after } = timeline(ms)
                const line = scene.marks["poverty-line"]
                after(800, () => {
                    if (line?.kind === "readout")
                        line.title = "Poverty line in high-income countries"
                })
                tween(line, { x: Math.log2(30) }, 900, 3500)
                for (const s of Object.values(scene.series))
                    tween(s, { focusHi: Math.log2(30) }, 900, 3500)
            },
        },
    ]
}

/**
 * The state at `ms` into step `index` of every step's end state, computed
 * once per step. `ends[i]` is the scene after step i; before the first step
 * the walkthrough shows `initial`.
 */
export class StepScenes {
    private ends: Scene[] = []

    constructor(
        private readonly initial: Scene,
        readonly steps: WalkthroughStep[]
    ) {}

    /** The scene a step starts from: the one before it ends in */
    startOf(index: number): Scene {
        return index <= 0 ? this.initial : this.endOf(index - 1)
    }

    endOf(index: number): Scene {
        if (index < 0) return this.initial
        for (let i = this.ends.length; i <= index; i++)
            this.ends[i] = pruneScene(this.compute(i, this.steps[i].duration))
        return this.ends[index]
    }

    at(index: number, ms: number): Scene {
        if (index < 0) return this.initial
        if (ms >= this.steps[index].duration) return this.endOf(index)
        return this.compute(index, ms)
    }

    private compute(index: number, ms: number): Scene {
        const scene = cloneScene(this.startOf(index))
        this.steps[index].apply?.(scene, ms)
        return scene
    }
}
