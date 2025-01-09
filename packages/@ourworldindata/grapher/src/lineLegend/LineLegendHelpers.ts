import { last, maxBy, SeriesName, sortedIndexBy } from "@ourworldindata/utils"
import { PlacedSeries } from "./LineLegendTypes"
import { LEGEND_ITEM_MIN_SPACING } from "./LineLegendConstants"

type Bracket = [number, number]

export interface LineLegendFilterAlgorithmContext {
    candidates: Set<PlacedSeries> // remaining candidates to be considered for placement
    availableHeight: number
    sortedKeepSeries: PlacedSeries[] // series that have been picked to be labelled, sorted by their y position
    keepSeriesHeight: number // total height of the picked series
}

interface PickFromCandidateSubsetParams {
    context: LineLegendFilterAlgorithmContext
    candidateSubset: PlacedSeries[]
    getCandidateFromSubset?: (
        candidateSubset: PlacedSeries[]
    ) => PlacedSeries | undefined
}

const dist = (c1: PlacedSeries, c2: PlacedSeries) => Math.abs(c1.midY - c2.midY)

function getNewHeight(currentHeight: number, candidate: PlacedSeries): number {
    // if the candidate is the first one, don't add padding
    const padding = currentHeight === 0 ? 0 : LEGEND_ITEM_MIN_SPACING
    return currentHeight + candidate.bounds.height + padding
}

/**
 * Given a sorted list of brackets, like [[0, 10], [10, 20], [20, 30]],
 * find the bracket that contains the given number n.
 */
function findBracket(
    sortedBrackets: Bracket[],
    n: number
): [number | undefined, number | undefined] {
    if (sortedBrackets.length === 0) return [undefined, undefined]

    const firstBracketValue = sortedBrackets[0][0]
    const lastBracketValue = last(sortedBrackets)![1]

    if (n < firstBracketValue) return [undefined, firstBracketValue]
    if (n >= lastBracketValue) return [lastBracketValue, undefined]

    for (const bracket of sortedBrackets) {
        if (n >= bracket[0] && n < bracket[1]) return bracket
    }

    return [undefined, undefined]
}

/**
 * Add a candidate to the list of picked series and update the context accordingly.
 */
export function pickCandidate(
    context: LineLegendFilterAlgorithmContext,
    candidate: PlacedSeries
): LineLegendFilterAlgorithmContext {
    let { candidates, sortedKeepSeries, keepSeriesHeight } = context

    // insert into sortedKeepSeries at the right position
    const insertIndex = sortedIndexBy(
        context.sortedKeepSeries,
        candidate,
        (s) => s.midY
    )
    sortedKeepSeries.splice(insertIndex, 0, candidate)

    // update keepSeriesHeight
    keepSeriesHeight = getNewHeight(keepSeriesHeight, candidate)

    // delete from candidates
    candidates.delete(candidate)

    return { ...context, candidates, sortedKeepSeries, keepSeriesHeight }
}

/**
 * Remove a candidate from the list of candidates to be considered for placement.
 */
function dismissCandidate(
    context: LineLegendFilterAlgorithmContext,
    candidate: PlacedSeries
) {
    const { candidates } = context
    candidates.delete(candidate)
    return { ...context, candidates }
}

/**
 * Pick from a subset of candidates until one of the following conditions is met:
 * - no candidates are left or the maximum number of candidates to pick is reached
 * - no more candidates fit into the available space
 *
 * The order of candidates to consider for placement is determined by the
 * `getCandidateFromSubset` function. The function should return the next candidate
 * to consider. If the function returns `undefined`, the algorithm stops.
 *
 * If no custom function is provided, the algorithm picks candidates starting from
 * the end (!) of the given list.
 */
function pickFromCandidateSubsetWithRetry(
    params: PickFromCandidateSubsetParams & { maxCandidatesToPick?: number }
): LineLegendFilterAlgorithmContext {
    let {
        context,
        candidateSubset,
        getCandidateFromSubset,
        maxCandidatesToPick,
    } = params

    if (candidateSubset.length === 0 || maxCandidatesToPick === 0)
        return context

    const remainingCandidates = [...candidateSubset]
    let numPicked = 0

    // if a custom function to get a candidate is provided, use it
    // otherwise, pop the last candidate
    const getCandidate = (): PlacedSeries | undefined => {
        if (getCandidateFromSubset) {
            const candidate = getCandidateFromSubset(remainingCandidates)
            if (candidate) {
                const index = remainingCandidates.indexOf(candidate)
                remainingCandidates.splice(index, 1)
            }
            return candidate
        }

        return remainingCandidates.pop()
    }

    while (remainingCandidates.length > 0) {
        const candidate = getCandidate()
        if (!candidate) break

        // sanity check if this is a valid candidate
        if (!context.candidates.has(candidate)) continue

        // either pick or dismiss the candidate
        const newHeight = getNewHeight(context.keepSeriesHeight, candidate)
        if (newHeight <= context.availableHeight) {
            context = pickCandidate(context, candidate)
            numPicked++
        } else {
            context = dismissCandidate(context, candidate)
        }

        // stop if we picked enough candidates
        if (numPicked === maxCandidatesToPick) break
    }

    return context
}

/**
 * Pick as many candidates as possible from a given subset.
 *
 * The order of candidates to consider for placement is determined by the
 * `getCandidateFromSubset` function. The function should return the next candidate
 * to consider. If the function returns `undefined`, the algorithm stops.
 *
 * If no custom function is provided, the algorithm picks candidates starting from
 * the end (!) of the given list.
 */
export function pickAsManyAsPossibleWithRetry(
    params: PickFromCandidateSubsetParams
): LineLegendFilterAlgorithmContext {
    return pickFromCandidateSubsetWithRetry(params)
}

/**
 * Pick a fixed number of candidates from a give subset.
 *
 * The order of candidates to consider for placement is determined by the
 * `getCandidateFromSubset` function. The function should return the next candidate
 * to consider. If the function returns `undefined`, the algorithm stops.
 *
 * If no custom function is provided, the algorithm picks candidates starting from
 * the end (!) of the given list.
 */
export function pickCandidateWithRetry(
    params: PickFromCandidateSubsetParams
): LineLegendFilterAlgorithmContext {
    return pickFromCandidateSubsetWithRetry({
        ...params,
        maxCandidatesToPick: 1,
    })
}

export function pickCandidateWithMaxDistanceToReferenceCandidate(params: {
    context: LineLegendFilterAlgorithmContext
    candidateSubset: PlacedSeries[]
    referenceCandidate: PlacedSeries
}): LineLegendFilterAlgorithmContext {
    const { context, candidateSubset, referenceCandidate } = params

    const getMaxDistCandidate = (candidates: PlacedSeries[]) =>
        maxBy(candidates, (c) => dist(c, referenceCandidate))

    return pickCandidateWithRetry({
        context,
        candidateSubset,
        getCandidateFromSubset: getMaxDistCandidate,
    })
}

/**
 * Compute a score for each candidate based on how large the space between the
 * neighboring labels is and how far it is from the mid point of the neighboring
 * labels.
 */
export function computeCandidateScores(
    candidates: PlacedSeries[],
    sortedKeepSeries: PlacedSeries[]
): Map<SeriesName, number> {
    const scoreMap = new Map<SeriesName, number>()

    const sortedBrackets = sortedKeepSeries
        .slice(0, -1)
        .map((s, i) => [s.midY, sortedKeepSeries[i + 1].midY])
        .filter((bracket) => bracket[0] !== bracket[1]) as Bracket[]

    // score each candidate based on how well it fits into the available space
    for (const candidate of candidates) {
        // find the bracket that the candidate is contained in
        const [start, end] = findBracket(sortedBrackets, candidate.midY)

        // if no bracket is found, return the worst possible score
        if (end === undefined || start === undefined) {
            scoreMap.set(candidate.seriesName, 0)
            continue
        }

        // score the candidate based on how far it is from the
        // middle of the bracket and how large the bracket is
        const length = end - start
        const midPoint = start + length / 2
        const distanceFromMidPoint = Math.abs(candidate.midY - midPoint)
        const score = length - distanceFromMidPoint

        scoreMap.set(candidate.seriesName, score)
    }

    return scoreMap
}

export function getSeriesKey(series: PlacedSeries, index: number): string {
    return `${series.seriesName}-${index}`
}
