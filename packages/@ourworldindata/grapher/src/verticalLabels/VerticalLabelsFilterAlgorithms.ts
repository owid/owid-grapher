import * as _ from "lodash-es"
import {
    computeCandidateScores,
    VerticalLabelsFilterAlgorithmContext,
    pickAsManyAsPossibleWithRetry,
    pickCandidate,
    pickCandidateWithMaxDistanceToReferenceCandidate,
    pickCandidateWithRetry,
} from "./VerticalLabelsHelpers"
import { PlacedLabelSeries } from "./VerticalLabelsTypes"
import { Emphasis } from "../interaction/Emphasis.js"

/**
 * Keep a subset of series that fit within the available height, prioritizing by
 * importance. Focused series have priority, even if they're less important.
 *
 * Note that more important (but longer) series names might be skipped if they don't fit.
 */
export function findImportantSeriesThatFitIntoTheAvailableSpace(
    seriesSortedByImportance: PlacedLabelSeries[],
    availableHeight: number
) {
    let context: VerticalLabelsFilterAlgorithmContext = {
        candidates: new Set(seriesSortedByImportance),
        availableHeight,
        sortedKeepSeries: [],
        keepSeriesHeight: 0,
    }

    const [highlightedCandidates, nonHighlightedCandidates] = _.partition(
        seriesSortedByImportance,
        (series) => series.emphasis === Emphasis.Highlighted
    )

    const importanceScore = new Map(
        seriesSortedByImportance.map((series, index) => [
            series.seriesName,
            -index, // Higher index means lower importance
        ])
    )

    const getMostImportantCandidate = (candidates: PlacedLabelSeries[]) =>
        _.maxBy(candidates, (c) => importanceScore.get(c.seriesName))

    // Highlighted series have priority
    context = pickAsManyAsPossibleWithRetry({
        context,
        candidateSubset: highlightedCandidates,
        getCandidateFromSubset: getMostImportantCandidate,
    })

    context = pickAsManyAsPossibleWithRetry({
        context,
        candidateSubset: nonHighlightedCandidates,
        getCandidateFromSubset: getMostImportantCandidate,
    })

    return context.sortedKeepSeries
}

/**
 * Pick a subset of series that fit within the available height.
 *
 * The algorithm tries to pick labels in a 'balanced' way such that they're
 * spread out as much as possible. Focused series have priority.
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

    const [highlightedCandidates, nonHighlightedCandidates] = _.partition(
        series,
        (series) => series.emphasis === Emphasis.Highlighted
    )

    // highlighted series have priority
    context = pickAsManyAsPossibleWithRetry({
        context,
        candidateSubset: highlightedCandidates,
    })

    // We initially need to pick at least two candidates
    const numPickedCandidates = context.sortedKeepSeries.length
    if (numPickedCandidates === 0) {
        // Pick two candidates with maximal distance to each other.
        // by convention we pick the max candidate first, but we could also
        // start by picking the min candidate
        const maxCandidate = _.maxBy(nonHighlightedCandidates, (c) => c.midY)
        if (maxCandidate) {
            context = pickCandidate(context, maxCandidate)

            context = pickCandidateWithMaxDistanceToReferenceCandidate({
                context,
                candidateSubset: nonHighlightedCandidates,
                referenceCandidate: context.sortedKeepSeries[0],
            })
        }
    } else if (numPickedCandidates === 1) {
        // Pick the candidate that is furthest away from the focused label
        context = pickCandidateWithMaxDistanceToReferenceCandidate({
            context,
            candidateSubset: nonHighlightedCandidates,
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
