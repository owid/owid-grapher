import { ScoredCandidate, RelatedContentType } from "./types.js"
import { RelatedContentConfig } from "./config.js"

const emptyCounts = (): Record<RelatedContentType, number> => ({
    article: 0,
    "topic-page": 0,
    "data-insight": 0,
    grapher: 0,
})

const countByType = (
    items: ScoredCandidate[]
): Record<RelatedContentType, number> => {
    const counts = emptyCounts()
    for (const c of items) counts[c.type]++
    return counts
}

const exceedsTopNCap = (
    type: RelatedContentType,
    counts: Record<RelatedContentType, number>,
    composition: RelatedContentConfig["topNComposition"]
): boolean => {
    if (type === "grapher" && counts.grapher >= composition.maxGrapher)
        return true
    if (
        type === "data-insight" &&
        counts["data-insight"] >= composition.maxDataInsight
    )
        return true
    const combinedArticleTopic = counts.article + counts["topic-page"]
    if (
        (type === "article" || type === "topic-page") &&
        combinedArticleTopic >= composition.maxArticleAndTopicPage
    )
        return true
    return false
}

// Reorder the already-diversified list so the leading slots match the
// editorial mix: pinned items first (their explicit order wins), then
// `leadGrapherCount` graphers, then fill the rest of the top-N slice
// under the per-type composition caps, then everything else in score
// order. Operates on the *same set* of items produced by diversify so
// list-level quotas remain satisfied.
export const composeTopAndFill = (
    diversified: ScoredCandidate[],
    config: RelatedContentConfig
): ScoredCandidate[] => {
    if (diversified.length === 0) return diversified
    const result: ScoredCandidate[] = []
    const pool = [...diversified]

    // 1) Pinned prefix (preserve order).
    while (
        pool.length > 0 &&
        pool[0].isPinned &&
        result.length < config.listSize
    ) {
        result.push(pool.shift()!)
    }

    // 2) Lead graphers. Promote the top-scored graphers from the pool to
    //    positions immediately after the pinned prefix, up to the deficit
    //    (a pinned grapher already counts toward the lead count).
    const leadDeficit = Math.max(
        0,
        config.leadGrapherCount -
            result.filter((c) => c.type === "grapher").length
    )
    for (let n = 0; n < leadDeficit; n++) {
        const idx = pool.findIndex((c) => c.type === "grapher")
        if (idx < 0) break
        result.push(...pool.splice(idx, 1))
    }

    // 3) Fill the remaining top-N slice under the composition caps. Items
    //    that would breach a cap are skipped and reconsidered in step 4.
    const counts = countByType(result)
    const stash: ScoredCandidate[] = []
    while (result.length < config.collapsedSize && pool.length > 0) {
        const idx = pool.findIndex(
            (c) => !exceedsTopNCap(c.type, counts, config.topNComposition)
        )
        if (idx < 0) {
            // No candidate satisfies the caps — accept whatever's next so
            // we don't leave the top-N slice short.
            const cand = pool.shift()!
            result.push(cand)
            counts[cand.type]++
            continue
        }
        // Anything skipped *before* the chosen candidate is parked for the
        // tail to keep score-order intact down there.
        for (let i = 0; i < idx; i++) stash.push(pool.shift()!)
        const cand = pool.shift()!
        result.push(cand)
        counts[cand.type]++
    }

    // 4) Fill the tail (positions collapsedSize..listSize). Stashed items
    //    rejoin in score order with the remaining pool.
    const tail = [...stash, ...pool].sort((a, b) => b.score - a.score)
    for (const cand of tail) {
        if (result.length >= config.listSize) break
        result.push(cand)
    }

    return result
}
