import * as R from "remeda"
import {
    DiscreteBarChart,
    DiscreteBarChartState,
    GrapherState,
    LineChartState,
    LineChartThumbnail,
} from "@ourworldindata/grapher"
import { EntityName, GRAPHER_TAB_NAMES } from "@ourworldindata/types"
import { Bounds } from "@ourworldindata/utils"
import {
    LatestValueWindow,
    findCandidateValues,
    findLatestValueWindow,
    findValuesAtEnd,
    loadPopulation,
} from "./thumbnailEntityStrategies.js"

export interface ThumbnailMetrics {
    /** Bar labels' font size as a share of their size before shrinking to fit (bar charts only) */
    barLabelSizeRatio?: number
    /** Share of bar labels that fit on one line (bar charts only) */
    singleLineLabelShare?: number
    /** Share of lines that keep their end label (line charts only) */
    labelCoverage?: number
    /** Largest distance in pixels a label moved from its line's end (line charts only) */
    worstLabelShiftPx?: number
    /** Share of the plot's height that the line ends span (line charts only) */
    endSpan?: number
    /** Share of the candidates' rank range between the lowest and highest pick */
    rankRange?: number
    /** Share of the candidates' value range between the lowest and highest pick */
    valueRange?: number
    /** Mean distance from each candidate to the nearest pick, as a share of all ranks */
    rankError?: number
    /** Mean distance from each candidate to the nearest pick, as a share of the value range */
    valueError?: number
    /** Median population of the picks that have population data */
    medianPopulation?: number
    legibility?: number
    representativeness?: number
    familiarity?: number
    /** Mean of the group scores that apply, from 0 to 1 */
    score?: number
    /** How old, in latestValueWindowUnit, a latest value may be */
    latestValueWindow?: number
    latestValueWindowUnit?: LatestValueWindow["unit"]
    latestValueWindowSource?: LatestValueWindow["source"]
    /** Share of countries with data in the chart that have a value within the window */
    latestValueCoverage?: number
}

/** Shift at which a label counts as fully detached from its line, in font sizes */
const DETACHED_SHIFT_IN_FONT_SIZES = 3

/** Bar label size, as a share of the unshrunk size, that counts as unreadable */
const UNREADABLE_LABEL_SIZE_RATIO = 0.5

/** Mean distance to the nearest pick that counts as no better than random */
const WORST_ERROR = 0.25

export async function measureThumbnail({
    grapherState,
    bounds,
    budget,
}: {
    grapherState: GrapherState
    bounds: Bounds
    budget: number
}): Promise<ThumbnailMetrics> {
    const shownEntities = grapherState.selection.selectedEntityNames
    const metrics: ThumbnailMetrics = {
        ...measureLegibility(grapherState, bounds),
        ...measureRepresentativeness(grapherState, shownEntities, budget),
        medianPopulation: await findMedianPopulation(shownEntities),
    }
    const window = findLatestValueWindow(grapherState)
    metrics.latestValueWindow = window.window
    metrics.latestValueWindowUnit = window.unit
    metrics.latestValueWindowSource = window.source
    metrics.latestValueCoverage = window.coverage

    if (metrics.barLabelSizeRatio !== undefined)
        metrics.legibility = R.mean([
            R.clamp(
                (metrics.barLabelSizeRatio - UNREADABLE_LABEL_SIZE_RATIO) /
                    (1 - UNREADABLE_LABEL_SIZE_RATIO),
                { min: 0, max: 1 }
            ),
            metrics.singleLineLabelShare ?? 0,
        ])
    if (metrics.labelCoverage !== undefined)
        metrics.legibility = R.mean([
            metrics.labelCoverage,
            metrics.endSpan ?? 0,
            1 -
                Math.min(
                    (metrics.worstLabelShiftPx ?? 0) /
                        (DETACHED_SHIFT_IN_FONT_SIZES * grapherState.fontSize),
                    1
                ),
        ])
    if (metrics.rankRange !== undefined)
        metrics.representativeness = R.mean([
            metrics.rankRange,
            metrics.valueRange ?? 0,
            1 - Math.min((metrics.rankError ?? 0) / WORST_ERROR, 1),
            1 - Math.min((metrics.valueError ?? 0) / WORST_ERROR, 1),
        ])
    if (metrics.medianPopulation !== undefined)
        metrics.familiarity = R.clamp(
            (Math.log10(metrics.medianPopulation) - 6) / 3,
            { min: 0, max: 1 }
        )

    const groupScores = [
        metrics.legibility,
        metrics.representativeness,
        metrics.familiarity,
    ].filter((score) => score !== undefined)
    if (groupScores.length > 0) metrics.score = R.mean(groupScores)
    return metrics
}

/** Bar label size at a base font size of 16, before shrinking to fit */
const BAR_LABEL_SIZE_AT_BASE_16 = 12

function measureLegibility(
    grapherState: GrapherState,
    bounds: Bounds
): Pick<
    ThumbnailMetrics,
    | "barLabelSizeRatio"
    | "singleLineLabelShare"
    | "labelCoverage"
    | "worstLabelShiftPx"
    | "endSpan"
> {
    if (grapherState.activeTab === GRAPHER_TAB_NAMES.DiscreteBar)
        return measureBarLegibility(grapherState, bounds)
    if (grapherState.activeTab !== GRAPHER_TAB_NAMES.LineChart) return {}
    const chart = new LineChartThumbnail({
        chartState: grapherState.chartState as LineChartState,
        bounds,
    })
    const endYs = chart.placedSeries
        .map((series) => series.placedPoints.at(-1)?.y)
        .filter((y) => y !== undefined)
    if (endYs.length === 0) return {}

    const labels = chart.placedEndLabels
    const shifts = labels.map((label) =>
        Math.abs(label.bounds.centerY - label.position.y)
    )
    const plotHeight = chart.dualAxis.innerBounds.height
    return {
        labelCoverage: labels.length / endYs.length,
        worstLabelShiftPx: shifts.length > 0 ? Math.max(...shifts) : 0,
        endSpan:
            plotHeight > 0
                ? (Math.max(...endYs) - Math.min(...endYs)) / plotHeight
                : 0,
    }
}

function measureBarLegibility(
    grapherState: GrapherState,
    bounds: Bounds
): Pick<ThumbnailMetrics, "barLabelSizeRatio" | "singleLineLabelShare"> {
    const chart = new DiscreteBarChart({
        chartState: grapherState.chartState as DiscreteBarChartState,
        bounds,
    })
    const labels = chart.sizedSeries.map((series) => series.label)
    if (labels.length === 0) return {}
    const unshrunkFontSize =
        (BAR_LABEL_SIZE_AT_BASE_16 / 16) * grapherState.fontSize
    const fontSize = labels[0].fontSettings.fontSize
    return {
        barLabelSizeRatio: Math.min(fontSize / unshrunkFontSize, 1),
        singleLineLabelShare:
            labels.filter((label) => label.height <= label.singleLineHeight)
                .length / labels.length,
    }
}

function measureRepresentativeness(
    grapherState: GrapherState,
    shownEntities: EntityName[],
    budget: number
): Pick<
    ThumbnailMetrics,
    "rankRange" | "valueRange" | "rankError" | "valueError"
> {
    const endValues = findValuesAtEnd(grapherState)
    const values = R.sortBy(
        Array.from(findCandidateValues(endValues, budget).values()),
        (value) => value
    )
    if (values.length < 2) return {}
    const pickedValues = shownEntities
        .map((entityName) => endValues.get(entityName))
        .filter((value) => value !== undefined)
    if (pickedValues.length === 0) return {}

    const lastRank = values.length - 1
    // A pick that isn't a candidate itself, such as a continent, ranks
    // where its value would fall among the candidates
    const pickedRanks = pickedValues.map((value) => {
        const rank = values.findIndex((candidate) => candidate >= value)
        return rank === -1 ? lastRank : rank
    })
    const valueSpan = values[lastRank] - values[0] || 1
    const meanDistanceToNearest = (points: number[], picks: number[]): number =>
        R.mean(
            points.map((point) =>
                Math.min(...picks.map((pick) => Math.abs(point - pick)))
            )
        ) ?? 0

    return {
        rankRange:
            (Math.max(...pickedRanks) - Math.min(...pickedRanks)) / lastRank,
        valueRange: Math.min(
            (Math.max(...pickedValues) - Math.min(...pickedValues)) / valueSpan,
            1
        ),
        rankError:
            meanDistanceToNearest(R.range(0, values.length), pickedRanks) /
            lastRank,
        valueError: meanDistanceToNearest(values, pickedValues) / valueSpan,
    }
}

async function findMedianPopulation(
    entityNames: EntityName[]
): Promise<number | undefined> {
    const population = await loadPopulation()
    const populations = entityNames
        .map((entityName) => population.get(entityName))
        .filter((value) => value !== undefined)
    return R.median(populations)
}
