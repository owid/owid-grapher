import {
    DataInsightHit,
    FlatArticleHit,
    SearchChartHit,
    TopicPageHit,
} from "./Search.js"

/**
 * Types shared by the AI search prototype: the /api/ai-search Cloudflare
 * function and the AI results on the search page.
 *
 * The model lays out the results page as a list of blocks (AiSearchBlock).
 * Each block refers to content found by keyword search, and the function
 * replaces those references with the full search hits, so the page renders
 * every block with the components standard search already uses.
 *
 * The function streams newline-delimited JSON, one AiSearchEvent per line.
 */

export const AI_SEARCH_MODELS = [
    "claude-haiku-5-5",
    "claude-sonnet-5-5",
    "claude-opus-5-5",
] as const
export type AiSearchModel = (typeof AI_SEARCH_MODELS)[number]

export interface AiSearchSettings {
    model: AiSearchModel
    // Stream the prompt and raw model output as debug events
    debug: boolean
}

export const DEFAULT_AI_SEARCH_SETTINGS: AiSearchSettings = {
    model: "claude-sonnet-5-5",
    debug: false,
}

/** The chart card variants of standard search */
export type AiSearchChartSize = "large" | "medium" | "small"

export interface AiSearchChartBlock {
    type: "chart"
    hit: SearchChartHit
    size: AiSearchChartSize
    // An entity the chart has data for, shown in the card like a country
    // picked in standard search
    country?: string
}

export type AiSearchPageBlock =
    | { type: "topicPage"; hit: TopicPageHit }
    | { type: "article"; hit: FlatArticleHit }
    | { type: "dataInsight"; hit: DataInsightHit }

export type AiSearchContentBlock = AiSearchChartBlock | AiSearchPageBlock

export interface AiSearchGroupBlock {
    type: "group"
    title: string
    blurb: string
    blocks: AiSearchContentBlock[]
}

export interface AiSearchForkOption {
    label: string
    // Clicking the option runs AI search for this query
    query: string
}

export interface AiSearchForksBlock {
    type: "forks"
    question: string
    options: AiSearchForkOption[]
}

export interface AiSearchRelatedBlock {
    type: "related"
    queries: string[]
}

export type AiSearchBlock =
    | AiSearchContentBlock
    | AiSearchGroupBlock
    | AiSearchForksBlock
    | AiSearchRelatedBlock

export type AiSearchErrorCode =
    | "unavailable"
    | "no_candidates"
    | "rate_limited"
    | "refused"
    | "no_blocks"
    | "failed"

export type AiSearchEvent =
    | { type: "status"; text: string }
    | { type: "expansion"; queries: string[] }
    | { type: "block"; block: AiSearchBlock }
    | { type: "debug"; title: string; text: string }
    | { type: "done"; model: string; timings: Record<string, number> }
    | { type: "error"; code: AiSearchErrorCode }
