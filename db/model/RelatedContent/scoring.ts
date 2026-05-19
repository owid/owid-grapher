import { Candidate, ScoredCandidate, SourcePage } from "./types.js"
import { RelatedContentConfig } from "./config.js"
import {
    embeddingScore,
    qualityScore,
    recencyScore,
    tagIdfScore,
    varOverlapScore,
} from "./signals.js"
import { EmbeddingsCache } from "./embeddings.js"

export interface ScoringContext {
    tagDocFreq: Map<number, number>
    totalDocsForIdf: number
    embeddings: EmbeddingsCache
}

export const scoreCandidate = (
    cand: Candidate,
    source: SourcePage,
    ctx: ScoringContext,
    config: RelatedContentConfig
): ScoredCandidate => {
    const signals = {
        tagIdf: tagIdfScore(cand, source, ctx.tagDocFreq, ctx.totalDocsForIdf),
        varOverlap: varOverlapScore(cand, source),
        embedding: embeddingScore(cand, source, ctx.embeddings),
        quality: qualityScore(cand),
        recency: recencyScore(cand, config.recencyHalfLifeDays),
    }
    const w = config.weights
    const weighted =
        w.tagIdf * signals.tagIdf +
        w.varOverlap * signals.varOverlap +
        w.embedding * signals.embedding +
        w.quality * signals.quality +
        w.recency * signals.recency
    const typeBonus = config.typeBonus[cand.type] ?? 0
    return { ...cand, signals, score: weighted + typeBonus }
}

export const scoreCandidates = (
    candidates: Candidate[],
    source: SourcePage,
    ctx: ScoringContext,
    config: RelatedContentConfig
): ScoredCandidate[] => {
    return candidates
        .map((c) => scoreCandidate(c, source, ctx, config))
        .sort((a, b) => b.score - a.score)
}
