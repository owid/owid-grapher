import { RelatedContentType, RelatedItem } from "@ourworldindata/types"

export type { RelatedContentType, RelatedItem }

export interface Candidate extends RelatedItem {
    tagIds: number[]
    variableIds: number[]
    publishedAt: Date | null
    pageviews: number
    keyChartLevel: number
    isPinned?: boolean
}

export interface ScoredCandidate extends Candidate {
    score: number
    signals: Record<string, number>
}

export interface SourcePage {
    chartId: number
    slug: string
    url: string
    title: string
    tagIds: number[]
    // tagIds expanded with every other tag that shares a topic-area
    // ancestor — used to widen the candidate pool. Direct `tagIds` is still
    // used for scoring so specific overlap remains rewarded.
    expandedTagIds: number[]
    variableIds: number[]
}

export interface PipelineContext {
    tagDocFreq: Map<number, number>
    totalDocsForIdf: number
    embeddings: Map<string, number[]>
    overrides: OverridesFile
}

export interface OverrideEntry {
    pins?: string[]
    excludes?: string[]
}

export type OverridesFile = Record<string, OverrideEntry>
