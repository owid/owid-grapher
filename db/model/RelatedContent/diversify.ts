import { ScoredCandidate, RelatedContentType } from "./types.js"
import { RelatedContentConfig } from "./config.js"

const wouldExceedMax = (
    type: RelatedContentType,
    counts: Record<RelatedContentType, number>,
    config: RelatedContentConfig
): boolean => {
    if (type === "grapher" && counts.grapher >= config.quotas.maxGrapher)
        return true
    if (type === "article" && counts.article >= config.quotas.maxArticle)
        return true
    if (
        type === "data-insight" &&
        counts["data-insight"] >= config.quotas.maxDataInsight
    )
        return true
    if (
        type === "topic-page" &&
        counts["topic-page"] >= config.quotas.maxTopicPage
    )
        return true
    return false
}

export const diversify = (
    ranked: ScoredCandidate[],
    config: RelatedContentConfig
): ScoredCandidate[] => {
    const picked: ScoredCandidate[] = []
    const counts: Record<RelatedContentType, number> = {
        article: 0,
        "topic-page": 0,
        "data-insight": 0,
        grapher: 0,
    }

    const availableTypes = new Set(ranked.map((c) => c.type))
    const effectiveMinTopicPage = availableTypes.has("topic-page")
        ? config.quotas.minTopicPage
        : 0
    const effectiveMinDataInsight = availableTypes.has("data-insight")
        ? config.quotas.minDataInsight
        : 0

    const remainingMinSlots = (): number => {
        let needed = 0
        if (counts["topic-page"] < effectiveMinTopicPage)
            needed += effectiveMinTopicPage - counts["topic-page"]
        if (counts["data-insight"] < effectiveMinDataInsight)
            needed += effectiveMinDataInsight - counts["data-insight"]
        return needed
    }

    const pinned = ranked.filter((c) => c.isPinned)
    for (const p of pinned) {
        picked.push(p)
        counts[p.type]++
        if (picked.length >= config.listSize) return picked
    }
    const pool = ranked.filter((c) => !c.isPinned)

    for (const cand of pool) {
        if (picked.length >= config.listSize) break
        if (wouldExceedMax(cand.type, counts, config)) continue
        const slotsLeft = config.listSize - picked.length
        const minNeeded = remainingMinSlots()
        const isFillingMin =
            (cand.type === "topic-page" &&
                counts["topic-page"] < effectiveMinTopicPage) ||
            (cand.type === "data-insight" &&
                counts["data-insight"] < effectiveMinDataInsight)
        if (!isFillingMin && slotsLeft <= minNeeded) continue
        picked.push(cand)
        counts[cand.type]++
    }

    if (picked.length < config.listSize) {
        for (const cand of pool) {
            if (picked.length >= config.listSize) break
            if (picked.includes(cand)) continue
            if (wouldExceedMax(cand.type, counts, config)) continue
            picked.push(cand)
            counts[cand.type]++
        }
    }
    return picked
}
