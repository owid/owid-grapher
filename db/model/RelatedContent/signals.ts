import { Candidate, SourcePage } from "./types.js"
import { cosineSimilarity, EmbeddingsCache } from "./embeddings.js"

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))

// Pageviews normalization: log10(views + 1) / DIVISOR yields ~1.0 for an
// item with 10^DIVISOR views. With DIVISOR = 6, anything with ~1M annual
// views saturates the score before the key-chart boost is added.
const PAGEVIEWS_LOG_DIVISOR = 6

// Charts marked as "key" (keyChartLevel >= this threshold) get a constant
// bonus on top of the pageview-based quality term. Threshold 3 mirrors
// the "Top" level used elsewhere in the codebase.
const KEY_CHART_LEVEL_THRESHOLD = 3
const KEY_CHART_BOOST = 0.3

export const tagIdfScore = (
    cand: Candidate,
    source: SourcePage,
    docFreq: Map<number, number>,
    totalDocs: number
): number => {
    if (source.tagIds.length === 0 || cand.tagIds.length === 0) return 0
    const sourceTagSet = new Set(source.tagIds)
    let totalIdf = 0
    let overlapIdf = 0
    for (const tagId of source.tagIds) {
        const df = docFreq.get(tagId) ?? 1
        const idf = Math.log((totalDocs + 1) / (df + 1))
        totalIdf += idf
    }
    for (const tagId of cand.tagIds) {
        if (!sourceTagSet.has(tagId)) continue
        const df = docFreq.get(tagId) ?? 1
        const idf = Math.log((totalDocs + 1) / (df + 1))
        overlapIdf += idf
    }
    if (totalIdf === 0) return 0
    return clamp01(overlapIdf / totalIdf)
}

export const varOverlapScore = (
    cand: Candidate,
    source: SourcePage
): number => {
    if (source.variableIds.length === 0 || cand.variableIds.length === 0)
        return 0
    const sourceSet = new Set(source.variableIds)
    let overlap = 0
    for (const v of cand.variableIds) if (sourceSet.has(v)) overlap++
    return clamp01(overlap / source.variableIds.length)
}

export const embeddingScore = (
    cand: Candidate,
    source: SourcePage,
    embeddings: EmbeddingsCache
): number => {
    const a = embeddings.get(source.url)
    const b = embeddings.get(cand.url)
    if (!a || !b) return 0
    return clamp01(cosineSimilarity(a, b))
}

export const qualityScore = (cand: Candidate): number => {
    const pv = Math.log10(cand.pageviews + 1) / PAGEVIEWS_LOG_DIVISOR
    const keyChartBoost =
        cand.keyChartLevel >= KEY_CHART_LEVEL_THRESHOLD ? KEY_CHART_BOOST : 0
    return clamp01(pv + keyChartBoost)
}

export const recencyScore = (cand: Candidate, halfLifeDays: number): number => {
    if (!cand.publishedAt) return 0
    const ageMs = Date.now() - cand.publishedAt.getTime()
    if (ageMs < 0) return 1
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    const decay = Math.pow(0.5, ageDays / halfLifeDays)
    return clamp01(decay)
}
