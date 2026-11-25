import * as R from "remeda"

import type { AnnotationPlacement } from "./annotations.js"
import type { ChartPresentation, FrameLegendMode } from "./presentation.js"
import {
    INT_POVERTY_LINE,
    INTERNATIONAL_DOLLAR,
    TIME_INTERVAL_FACTORS,
    WORLD_ENTITY_NAME,
} from "./constants.js"
import { formatPeople, formatShare } from "./currency.js"
import {
    peopleBelowLineForEntities,
    shareBelowLineForEntities,
} from "./density.js"
import type {
    Currency,
    IncomeDistributionYear,
    TimeInterval,
    View,
    WalkthroughId,
} from "./types.js"
import type { ChartState } from "./useIncomeDistributionState.js"

/** $1,000 a month, the poverty line of a rich country such as Sweden, in int-$/day */
export const RICH_COUNTRY_POVERTY_LINE = 1000 / TIME_INTERVAL_FACTORS.monthly

/** $300 a month, the line the "how to use" walkthrough draws, in int-$/day */
const EXAMPLE_POVERTY_LINE = 300 / TIME_INTERVAL_FACTORS.monthly

/** What a slide sets on the chart; whatever it leaves out stays as the reader had it */
export interface SlideChartState {
    view?: View
    /** Country names, in the order their colours are assigned */
    countries?: string[]
    /** Int-$/day; null removes the line */
    povertyLine?: number | null
    timeInterval?: TimeInterval
    currency?: Currency
}
export type SlideChartField = keyof SlideChartState

/**
 * A control a slide puts in front of the reader. Using it changes the
 * reader's own chart, not only the slide: the fields it sets are released
 * from the slide (see resolveSlideChartState).
 */
export type SlideControl = "view" | "measuredIn" | "editCountries"

/**
 * Text with `**bold**`, `*italic*` and `[[Entity]]` markers (see
 * parseRichText); a function when it quotes figures from the data
 */
export type SlideText = string | ((data: IncomeDistributionYear) => string)

export interface SlideAnnotation extends AnnotationPlacement {
    text: SlideText
}

export interface WalkthroughSlide {
    /** The slide's headline */
    text: SlideText
    /** A lighter line below the headline */
    secondLine?: SlideText
    /** A smaller aside over the plot's top-left corner */
    aside?: SlideText
    chart: SlideChartState
    control?: SlideControl
    /** Which legend the chart shows */
    legend: FrameLegendMode
    /** What the chart emphasises; the rest of its presentation is the slide frame's */
    emphasis?: Pick<
        ChartPresentation,
        | "ghostSeries"
        | "outlineTotal"
        | "fillBelowLine"
        | "showSeriesLabels"
        | "axisEndLabels"
        | "povertyLineHint"
    >
    annotations?: SlideAnnotation[]
}

/** What the walkthrough's thumbnail draws: a miniature of the chart */
export interface WalkthroughThumbnail {
    view: View
    countries?: string[]
    povertyLine?: number
    /** Mark the stack's peak with a dotted line */
    peakMarker?: boolean
}

export interface Walkthrough {
    id: WalkthroughId
    category: "tip" | "insight"
    title: string
    thumbnail: WalkthroughThumbnail
    slides: WalkthroughSlide[]
    /**
     * Show every slide in the units its text quotes (its `chart` says which),
     * even when the reader has picked others; otherwise a pick on one slide
     * carries on to the next
     */
    fixedUnits?: boolean
    /** The poverty line is the slides' to set: the reader can't drag it */
    fixedPovertyLine?: boolean
}

/** The share of `entity`'s population living below `line` (int-$/day) */
export function shareBelow(
    data: IncomeDistributionYear,
    entity: string,
    line: number
): number {
    return shareBelowLineForEntities(data, line, [entity]).get(entity) ?? 0
}

/** "8 in 10", rounding the share to tenths; "fewer than 1 in 10" below 5% */
export function formatOneInTen(share: number): string {
    const tenths = Math.round(share * 10)
    return tenths === 0 ? "fewer than 1 in 10" : `${tenths} in 10`
}

/** Every slide shows incomes per month in international-$ */
const MONTHLY_INT_DOLLARS = {
    timeInterval: "monthly",
    currency: INTERNATIONAL_DOLLAR,
} as const

const SWEDEN_AND_US = ["Sweden", "United States"]

export const WALKTHROUGHS: Walkthrough[] = [
    {
        id: "how-to-use",
        category: "tip",
        title: "How to use this chart",
        thumbnail: { view: "global", peakMarker: true },
        slides: [
            {
                text: "The chart shows the **global distribution of income**, from poorest to richest.",
                aside: "The height of the curve indicates how common a given level of income is across the world’s population.",
                chart: {
                    view: "global",
                    povertyLine: null,
                    ...MONTHLY_INT_DOLLARS,
                },
                legend: "hidden",
                emphasis: {
                    ghostSeries: true,
                    outlineTotal: { label: "Global distribution of income" },
                    axisEndLabels: { left: "Poorest", right: "Richest" },
                },
            },
            {
                text: "The data is broken down by **world region**.",
                aside: "The regions are stacked one above the other. Together, they add up to the world total.",
                chart: {
                    view: "global",
                    povertyLine: null,
                    ...MONTHLY_INT_DOLLARS,
                },
                legend: "auto",
                emphasis: {
                    outlineTotal: { label: "Global distribution of income" },
                    axisEndLabels: { left: "Poorest", right: "Richest" },
                },
            },
            {
                text: "The controls allow you to draw a line at a particular income level — we can think of this like setting a *poverty line*.",
                chart: {
                    view: "global",
                    povertyLine: EXAMPLE_POVERTY_LINE,
                    ...MONTHLY_INT_DOLLARS,
                },
                legend: "auto",
                // Under the line's label, so it moves with the line
                emphasis: {
                    povertyLineHint: "Drag to try your own poverty line",
                },
            },
            {
                text: "To compare countries with different costs of living, incomes are measured in **international dollars — this tells us what incomes could buy at US prices.**",
                aside: "You can switch to the currency and prices of your own country, to make the numbers more relatable.",
                chart: {
                    view: "global",
                    povertyLine: null,
                    ...MONTHLY_INT_DOLLARS,
                },
                control: "measuredIn",
                legend: "hidden",
            },
            {
                text: "You can also switch to see how incomes are spread within individual countries.",
                chart: {
                    view: "global",
                    povertyLine: null,
                    ...MONTHLY_INT_DOLLARS,
                },
                control: "view",
                legend: "hidden",
            },
        ],
    },
    {
        id: "poverty-in-richer-and-poorer-countries",
        category: "insight",
        title: "Poverty in richer and poorer countries",
        // The slides quote dollar amounts and shares below their own lines
        fixedUnits: true,
        fixedPovertyLine: true,
        thumbnail: {
            view: "countries",
            countries: ["Burundi", "India", "China", ...SWEDEN_AND_US],
            povertyLine: RICH_COUNTRY_POVERTY_LINE,
        },
        slides: [
            {
                text: "There are people living in poverty in every country.",
                secondLine:
                    "In [[Sweden]], poverty is defined as living on around $1,000 a month or less.",
                chart: {
                    view: "countries",
                    countries: ["Sweden"],
                    povertyLine: RICH_COUNTRY_POVERTY_LINE,
                    ...MONTHLY_INT_DOLLARS,
                },
                legend: "hidden",
                emphasis: { showSeriesLabels: false },
                annotations: [
                    {
                        text: (data) =>
                            `${formatShare(shareBelow(data, "Sweden", RICH_COUNTRY_POVERTY_LINE))} of the population live in poverty by this measure.`,
                        target: {
                            income: RICH_COUNTRY_POVERTY_LINE * 0.8,
                            y: { curve: "Sweden", fraction: 0.6 },
                        },
                        textOffset: { dx: -60, dy: 8 },
                        textAnchor: "bottom-right",
                        width: 200,
                        arrow: {
                            from: { dx: -56, dy: -30 },
                            startHandle: { dx: 20, dy: -14 },
                            gap: 6,
                        },
                    },
                ],
            },
            {
                text: "There are people living in poverty in every country.",
                secondLine: (data) =>
                    `In the [[United States]], a similar share, ${formatShare(shareBelow(data, "United States", RICH_COUNTRY_POVERTY_LINE))}, live on less than $1,000 a month.`,
                chart: {
                    view: "countries",
                    countries: SWEDEN_AND_US,
                    povertyLine: RICH_COUNTRY_POVERTY_LINE,
                    ...MONTHLY_INT_DOLLARS,
                },
                legend: "hidden",
                emphasis: { showSeriesLabels: false },
                annotations: [
                    {
                        text: "The [[United States]] is richer than [[Sweden]] on average, but it is also more unequal – the distribution is more spread out.",
                        target: {
                            income: RICH_COUNTRY_POVERTY_LINE,
                            y: { plot: 0.6 },
                        },
                        textOffset: { dx: -32, dy: 0 },
                        textAnchor: "top-right",
                        width: 290,
                    },
                ],
            },
            {
                text: "Using the definitions of poverty in Sweden or other rich countries, in most countries around the world, *the vast majority* of people are poor.",
                chart: {
                    view: "countries",
                    countries: [
                        "Burundi",
                        "China",
                        "India",
                        "Nigeria",
                        ...SWEDEN_AND_US,
                    ],
                    povertyLine: RICH_COUNTRY_POVERTY_LINE,
                    ...MONTHLY_INT_DOLLARS,
                },
                control: "editCountries",
                legend: "swatches",
                emphasis: { showSeriesLabels: false },
            },
            {
                text: (data) =>
                    `Globally, ${formatOneInTen(shareBelow(data, WORLD_ENTITY_NAME, RICH_COUNTRY_POVERTY_LINE))} people in the world live in poverty by this definition.`,
                chart: {
                    view: "global",
                    povertyLine: RICH_COUNTRY_POVERTY_LINE,
                    ...MONTHLY_INT_DOLLARS,
                },
                legend: "hidden",
                emphasis: {
                    ghostSeries: true,
                    fillBelowLine: true,
                    outlineTotal: {},
                },
            },
            {
                text: "To focus attention on the extreme depth of poverty many in the world face, the World Bank sets an international poverty line more than 10 times lower, **$3 a day**.",
                chart: {
                    view: "global",
                    povertyLine: INT_POVERTY_LINE,
                    ...MONTHLY_INT_DOLLARS,
                },
                legend: "hidden",
                emphasis: {
                    ghostSeries: true,
                    fillBelowLine: true,
                    outlineTotal: {},
                },
                annotations: [
                    {
                        text: (data) => {
                            const share = shareBelow(
                                data,
                                WORLD_ENTITY_NAME,
                                INT_POVERTY_LINE
                            )
                            const people =
                                peopleBelowLineForEntities(
                                    data,
                                    INT_POVERTY_LINE,
                                    [WORLD_ENTITY_NAME]
                                ).get(WORLD_ENTITY_NAME) ?? 0
                            return `${R.capitalize(formatOneInTen(share))} people in the world, roughly ${formatPeople(people)}, live below this extremely low poverty line.`
                        },
                        target: {
                            income: INT_POVERTY_LINE * 0.62,
                            y: { curve: "total", fraction: 0.5 },
                        },
                        textOffset: { dx: -8, dy: -62 },
                        textAnchor: "bottom-right",
                        width: 230,
                        arrow: {
                            from: { dx: -70, dy: -54 },
                            startHandle: { dx: -8, dy: 34 },
                            gap: 6,
                        },
                    },
                ],
            },
        ],
    },
]

export function findWalkthrough(id: string): Walkthrough | undefined {
    return WALKTHROUGHS.find((walkthrough) => walkthrough.id === id)
}

/** The text of a slide field, with the data's figures filled in */
export function resolveSlideText(
    text: SlideText,
    data: IncomeDistributionYear
): string {
    return typeof text === "function" ? text(data) : text
}

/**
 * What the chart shows on a slide: the slide's state over the reader's own.
 * Fields in `released` are the reader's again: the slide's control has
 * changed them, which writes to the reader's state. Countries the data
 * doesn't have are left out.
 */
export function resolveSlideChartState(
    readerState: ChartState,
    slide: SlideChartState,
    released: ReadonlySet<SlideChartField>,
    hasCountry: (name: string) => boolean
): ChartState {
    const pick = <K extends SlideChartField>(
        field: K
    ): SlideChartState[K] | undefined =>
        released.has(field) ? undefined : slide[field]
    const countries = pick("countries")
    const povertyLine = pick("povertyLine")
    return {
        view: pick("view") ?? readerState.view,
        selectedCountries: countries
            ? countries.filter(hasCountry)
            : readerState.selectedCountries,
        povertyLine:
            povertyLine !== undefined ? povertyLine : readerState.povertyLine,
        timeInterval: pick("timeInterval") ?? readerState.timeInterval,
        currency: pick("currency") ?? readerState.currency,
    }
}

/** A slide number from the URL, clamped to the walkthrough's slides (1-based) */
export function clampSlide(slide: number, walkthrough: Walkthrough): number {
    if (!Number.isFinite(slide)) return 1
    return R.clamp(Math.round(slide), {
        min: 1,
        max: walkthrough.slides.length,
    })
}
