import * as R from "remeda"

import { getModels } from "./data.js"
import {
    COMPUTER_SYSTEMS,
    SHOWN_COMPUTERS,
    getMonthOfComputation,
} from "./computers.js"
import { getLargestRunInDeviceMonths } from "./hardwareComparison.js"
import { FRONTIER_SEGMENTS, FRONTIER_TIME_RANGE } from "./frontier.js"
import { formatFlopInWords } from "./formatFlop.js"
import { LAST_YEAR } from "./constants.js"
import { DEFAULT_VIEW_STATE, ViewState } from "./viewState.js"

/**
 * Placeholder prose: the infrastructure is what's settled here, the
 * wording is still to be written. Figures are computed from the data, so
 * they stay right when it's updated.
 */

export interface WalkthroughSlide {
    /** The slide's headline, with `**bold**` markers */
    text: string
    /** A lighter line under the headline */
    secondLine?: string
    /** What the chart shows; anything left out is the default view */
    view: Partial<ViewState>
}

export interface Walkthrough {
    id: string
    title: string
    /** One line for the walkthrough's card */
    description: string
    slides: WalkthroughSlide[]
}

// Figures the slides quote

// The figures quote the models the slides show: the default set
const SHOWN_MODELS = getModels(DEFAULT_VIEW_STATE.modelFilter)

const astra = SHOWN_MODELS.find((m) => m.model === "GPT-6 Astra")
const h100 = COMPUTER_SYSTEMS.find((c) => c.id === "h100")
const h100MonthsForAstra =
    astra && h100
        ? astra.trainingComputeFlop / getMonthOfComputation(h100)
        : undefined

const statusCounts = R.countBy(SHOWN_MODELS, (m) => m.groups.computeStatus)

const frontierMissing = FRONTIER_SEGMENTS.filter(
    (s) => s.computeStatus === "No estimate"
)
const plottedModelNames = new Set(SHOWN_MODELS.map((m) => m.model))
const frontierPlotted = FRONTIER_SEGMENTS.filter((s) =>
    plottedModelNames.has(s.score.model)
).map((s) => s.score.displayName)

const aboveEuThreshold = R.sortBy(
    SHOWN_MODELS.filter((m) => m.trainingComputeFlop > 1e25),
    (m) => m.year
)
const aboveCaliforniaThreshold = SHOWN_MODELS.filter(
    (m) => m.trainingComputeFlop > 1e26
)

const speculativeCount = SHOWN_MODELS.filter(
    (m) => m.confidence === "Speculative"
).length

function formatList(items: string[]): string {
    if (items.length <= 1) return items.join("")
    return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`
}

const RECENT_RANGE: [number, number] = [2015, LAST_YEAR]

// The largest run each year, in months of the best consumer machine
const deviceMonths2010 = getLargestRunInDeviceMonths(
    2010,
    SHOWN_MODELS,
    SHOWN_COMPUTERS
)
const deviceMonthsNow = getLargestRunInDeviceMonths(
    LAST_YEAR - 1,
    SHOWN_MODELS,
    SHOWN_COMPUTERS
)

function formatMonths(months: number): string {
    if (months < 1.5) return "about a month"
    return `${Number(months.toPrecision(2)).toLocaleString("en-US")} months`
}

export const WALKTHROUGHS: Walkthrough[] = [
    {
        id: "missing-frontier-models",
        title: "Why the newest models are missing",
        description: "Most of today's leading models have no compute estimate",
        slides: [
            {
                text: `Training computation has grown from 40 calculations in 1950 to **${astra ? formatFlopInWords(astra.trainingComputeFlop) : "nearly an octillion"}** for GPT-6 Astra.`,
                view: {},
            },
            {
                text: `Only **${statusCounts["Reported by developer"] ?? 0}** of the ${SHOWN_MODELS.length} figures come from the developers themselves; Epoch AI estimated the rest.`,
                view: { colorScheme: "computeStatus" },
            },
            {
                text: `Since 2024, **${frontierMissing.length} of the ${FRONTIER_SEGMENTS.length}** models that led on capabilities have no estimate at all.`,
                secondLine:
                    "The row above the chart shows which model led on the Epoch Capabilities Index, and for how long.",
                view: {
                    colorScheme: "computeStatus",
                    timeRange: FRONTIER_TIME_RANGE,
                    showFrontier: true,
                },
            },
            {
                text: `Only ${formatList(frontierPlotted)} can be placed on the chart.`,
                secondLine:
                    "Their developers disclosed enough for Epoch AI to estimate how much computation was used.",
                view: {
                    colorScheme: "computeStatus",
                    timeRange: FRONTIER_TIME_RANGE,
                    showFrontier: true,
                },
            },
        ],
    },
    {
        id: "uncertainty",
        title: "How certain are these figures?",
        description: "Each estimate comes with a range",
        slides: [
            {
                text: "Most of these figures are **estimates**, and each comes with a range in which the true value likely lies.",
                secondLine:
                    "Epoch AI rates each estimate as confident (within 3× either way), likely (10×) or speculative (31×).",
                view: { showUncertainty: true },
            },
            {
                text: `**${speculativeCount}** estimates are rated speculative: the true figure could be 31 times smaller or larger.`,
                view: {
                    showUncertainty: true,
                    colorScheme: "computeStatus",
                    timeRange: RECENT_RANGE,
                },
            },
        ],
    },
    {
        id: "computers",
        title: "AI training vs. familiar computers",
        description: "How training outgrew home computers after 2010",
        slides: [
            {
                text: "Each square is a **PC processor** and each downward triangle a **graphics card**, placed at the computation it does running flat out for a month.",
                secondLine:
                    "The lines join the machines that were the fastest of their kind so far.",
                view: { showComputers: true },
            },
            {
                text: deviceMonths2010
                    ? `Until about 2010, even the largest training run took no more than **${formatMonths(deviceMonths2010.months)}** of the fastest home computer hardware.`
                    : "Until about 2010, even the largest training runs fit within a month of the fastest home computer hardware.",
                secondLine:
                    "Training computation grew about as fast as the hardware did.",
                view: { showComputers: true, timeRange: [1980, 2012] },
            },
            {
                text: deviceMonthsNow
                    ? `Since then, training has pulled away: the largest run so far took as much as **${formatMonths(deviceMonthsNow.months)}** of an ${deviceMonthsNow.device.name}, the fastest home graphics card.`
                    : "Since then, training has pulled away from any single machine.",
                secondLine:
                    "Training computation now doubles about every six months; the hardware takes two to three years.",
                view: { showComputers: true, timeRange: [2005, LAST_YEAR] },
            },
            {
                text: h100MonthsForAstra
                    ? `Training GPT-6 Astra took as much computation as **${Math.round(h100MonthsForAstra / 12).toLocaleString("en-US")} years** of an Nvidia H100 AI chip running at full speed.`
                    : "The largest training runs took as much computation as thousands of years of a single AI chip.",
                secondLine:
                    "In practice, that work is spread over tens of thousands of chips running for months.",
                view: { showComputers: true, timeRange: RECENT_RANGE },
            },
        ],
    },
    {
        id: "legal-thresholds",
        title: "Where regulation draws the line",
        description: "Compute thresholds in EU and Californian law",
        slides: [
            {
                text: "Some laws use training computation to decide which AI models they apply to.",
                secondLine:
                    "The EU AI Act presumes models above 10²⁵ FLOP pose “systemic risk”; California’s SB 53 covers “frontier models” above 10²⁶.",
                view: { showThresholds: true },
            },
            {
                text: `**${aboveEuThreshold.length}** models on this chart are above the EU threshold, the first being ${aboveEuThreshold[0]?.model ?? "–"} in ${aboveEuThreshold[0]?.date.getUTCFullYear() ?? "–"}. **${aboveCaliforniaThreshold.length}** are above California’s.`,
                view: { showThresholds: true, timeRange: RECENT_RANGE },
            },
        ],
    },
]

export function findWalkthrough(id: string): Walkthrough | undefined {
    return WALKTHROUGHS.find((walkthrough) => walkthrough.id === id)
}

/** What the chart shows on a slide: its view over the default one */
export function resolveSlideView(slide: WalkthroughSlide): ViewState {
    return { ...DEFAULT_VIEW_STATE, ...slide.view }
}

/** A 1-based slide number, clamped to the walkthrough's slides */
export function clampSlide(slide: number, walkthrough: Walkthrough): number {
    return R.clamp(Math.round(slide), {
        min: 1,
        max: walkthrough.slides.length,
    })
}
