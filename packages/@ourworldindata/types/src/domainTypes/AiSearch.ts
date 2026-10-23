import { GrapherTabName } from "../grapherTypes/GrapherTypes.js"
import { ChartRecord, PageRecord } from "./Search.js"

/**
 * Types shared by the AI-assisted search prototype: the /api/ai-search
 * Cloudflare function and the AI panel on the search page.
 *
 * The function streams newline-delimited JSON, one AiSearchEvent per line.
 */

export const AI_SEARCH_MODELS = [
    "claude-haiku-5-5",
    "claude-sonnet-5-5",
    "claude-opus-5-5",
] as const
export type AiSearchModel = (typeof AI_SEARCH_MODELS)[number]

export const AI_SEARCH_EFFORTS = ["low", "medium", "high"] as const
export type AiSearchEffort = (typeof AI_SEARCH_EFFORTS)[number]

// Number of charts sent to the model; articles are added in proportion.
export const AI_SEARCH_POOL_SIZES = [80, 140, 220] as const
export type AiSearchPoolSize = (typeof AI_SEARCH_POOL_SIZES)[number]

/** Articles are sent to the model in proportion to charts. */
export const getAiSearchPagePoolSize = (chartPoolSize: number): number =>
    Math.round(chartPoolSize * 0.28)

export interface AiSearchSettings {
    model: AiSearchModel
    effort: AiSearchEffort
    // Ask Haiku for extra keyword searches before grouping
    expand: boolean
    pool: AiSearchPoolSize
    // Stream the prompt and raw model output as debug events
    debug: boolean
}

export const DEFAULT_AI_SEARCH_SETTINGS: AiSearchSettings = {
    model: "claude-sonnet-5-5",
    effort: "low",
    expand: true,
    pool: 140,
    debug: false,
}

export type AiSearchAngle =
    | "today"
    | "history"
    | "breakdown"
    | "correlates"
    | "other"

/** A chart the model may pick, as the client needs it to render a card. */
export type AiSearchChartCandidate = Pick<
    ChartRecord,
    "type" | "slug" | "title" | "availableTabs"
> &
    Partial<
        Pick<
            ChartRecord,
            | "queryParams"
            | "variantName"
            | "subtitle"
            // Ranking hints for the model
            | "keyChartForTags"
            | "numRelatedArticles"
        >
    > & { id: number }

export type AiSearchPageCandidate = Pick<
    PageRecord,
    "title" | "slug" | "type"
> &
    Partial<Pick<PageRecord, "thumbnailUrl" | "authors" | "date">> & {
        id: number
    }

export interface AiSearchGroup {
    angle: AiSearchAngle
    title: string
    blurb: string
    // The tab each chart opens on, picked by the model to suit the group
    charts: { id: number; tab?: GrapherTabName }[]
    articles: number[]
    insights: number[]
}

export type AiSearchErrorCode =
    | "unavailable"
    | "no_candidates"
    | "rate_limited"
    | "refused"
    | "no_groups"
    | "failed"

export type AiSearchEvent =
    | { type: "status"; text: string }
    | { type: "expansion"; queries: string[] }
    | {
          type: "candidates"
          charts: AiSearchChartCandidate[]
          pages: AiSearchPageCandidate[]
      }
    | ({ type: "group" } & AiSearchGroup)
    | { type: "related"; queries: string[] }
    | { type: "debug"; title: string; text: string }
    | { type: "done"; model: string; timings: Record<string, number> }
    | { type: "error"; code: AiSearchErrorCode }
