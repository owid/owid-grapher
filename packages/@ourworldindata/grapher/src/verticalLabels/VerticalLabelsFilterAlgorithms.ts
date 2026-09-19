import * as _ from "lodash-es"
import {
    computeCandidateScores,
    computeHeight,
    VerticalLabelsFilterAlgorithmContext,
    pickAsManyAsPossibleWithRetry,
    pickCandidate,
    pickCandidateWithMaxDistanceToReferenceCandidate,
    pickCandidateWithRetry,
} from "./VerticalLabelsHelpers"
import { PlacedLabelSeries } from "./VerticalLabelsTypes"
import { Emphasis } from "../interaction/Emphasis.js"

export type FilterAlgorithm = (
    series: PlacedLabelSeries[],
    availableHeight: number
) => PlacedLabelSeries[]

/**
 * Pick the series that fit, ignoring emphasis, then make room for any
 * highlighted series that were dropped by evicting their nearest neighbors.
 */
export function findSeriesThatFitWithHighlights(
    series: PlacedLabelSeries[],
    findSeriesThatFit: FilterAlgorithm,
    availableHeight: number
): PlacedLabelSeries[] {
    const visible = findSeriesThatFit(series, availableHeight)
    const highlighted = findSeriesThatFit(
        series.filter((series) => series.emphasis === Emphasis.Highlighted),
        availableHeight
    )

    const visibleNames = new Set(visible.map((series) => series.seriesName))
    const missing = highlighted.filter(
        (series) => !visibleNames.has(series.seriesName)
    )
    if (missing.length === 0) return visible

    const highlightedNames = new Set(
        highlighted.map((series) => series.seriesName)
    )
    const distanceToNearestInsertedLabel = (
        series: PlacedLabelSeries
    ): number =>
        Math.min(...missing.map((other) => Math.abs(series.midY - other.midY)))

    const evictionOrder = _.sortBy(
        visible.filter((series) => !highlightedNames.has(series.seriesName)),
        distanceToNearestInsertedLabel
    )

    const merged = _.sortBy([...visible, ...missing], (series) => series.midY)
    for (const victim of evictionOrder) {
        if (computeHeight(merged) <= availableHeight) break
        merged.splice(merged.indexOf(victim), 1)
    }

    return merged
}

/**
 * Keep a subset of series that fit within the available height, prioritizing by
 * importance.
 *
 * Note that more important (but longer) series names might be skipped if they don't fit.
 */
export function findImportantSeriesThatFitIntoTheAvailableSpace(
    seriesSortedByImportance: PlacedLabelSeries[],
    availableHeight: number
): PlacedLabelSeries[] {
    let context: VerticalLabelsFilterAlgorithmContext = {
        candidates: new Set(seriesSortedByImportance),
        availableHeight,
        sortedKeepSeries: [],
        keepSeriesHeight: 0,
    }

    const importanceScore = new Map(
        seriesSortedByImportance.map((series, index) => [
            series.seriesName,
            -index, // Higher index means lower importance
        ])
    )

    const getMostImportantCandidate = (candidates: PlacedLabelSeries[]) =>
        _.maxBy(candidates, (c) => importanceScore.get(c.seriesName))

    context = pickAsManyAsPossibleWithRetry({
        context,
        candidateSubset: seriesSortedByImportance,
        getCandidateFromSubset: getMostImportantCandidate,
    })

    return context.sortedKeepSeries
}

/**
 * Pick a subset of series that fit within the available height.
 *
 * The algorithm tries to pick labels in a 'balanced' way such that they're
 * spread out as much as possible.
 *
 * The algorithm works as follows: Given a set of placed labels and a set of
 * candidates, for each candidate, we find the two closest already placed labels,
 * one to each side, and calculate a score based on the available space between
 * the two placed labels (the bigger, the better) and the candidate's distance to
 * the midpoint (the smaller, the better). We then pick the candidate with the best
 * score that fits into the available space.
 */
export function findSeriesThatFitIntoTheAvailableSpace(
    series: PlacedLabelSeries[],
    availableHeight: number
): PlacedLabelSeries[] {
    let context: VerticalLabelsFilterAlgorithmContext = {
        candidates: new Set(series),
        availableHeight,
        sortedKeepSeries: [],
        keepSeriesHeight: 0,
    }

    // Pick two candidates with maximal distance to each other
    const maxCandidate = _.maxBy(series, (c) => c.midY)
    if (maxCandidate) {
        context = pickCandidate(context, maxCandidate)

        context = pickCandidateWithMaxDistanceToReferenceCandidate({
            context,
            candidateSubset: series,
            referenceCandidate: context.sortedKeepSeries[0],
        })
    }

    // Pick candidates based on a scoring system
    while (
        context.candidates.size > 0 &&
        context.keepSeriesHeight <= availableHeight
    ) {
        const candidates = Array.from(context.candidates)
        const scoreMap = computeCandidateScores(
            candidates,
            context.sortedKeepSeries
        )

        // Pick the candidate with the highest score
        const getBestCandidate = (candidates: PlacedLabelSeries[]) =>
            _.maxBy(candidates, (c) => scoreMap.get(c.seriesName))

        context = pickCandidateWithRetry({
            context,
            candidateSubset: candidates,
            getCandidateFromSubset: getBestCandidate,
        })
    }

    return context.sortedKeepSeries
}
