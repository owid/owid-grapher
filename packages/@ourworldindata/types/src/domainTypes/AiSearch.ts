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

/**
 * The layout the results page uses, picked from what the search is after.
 * - family: a measure with several versions ("gdp", "co2", "life expectancy")
 * - place: a measure for a country ("gdp" + United States)
 * - exact: one unambiguous indicator ("crude birth rate")
 * - topic: a broad area ("education", "Energy and environment")
 * - country_topic: a country filter and a topic tag, no text
 * - country: a country filter on its own
 * - other: anything else
 */
export const AI_SEARCH_INTENTS = [
    "family",
    "place",
    "exact",
    "topic",
    "country_topic",
    "country",
    "other",
] as const
export type AiSearchIntent = (typeof AI_SEARCH_INTENTS)[number]

/**
 * The three shapes of results the reader can switch between. The model picks
 * the one that fits the search best; the others stay a click away.
 * - targeted: our best guess at the one thing they're looking for, with
 *   close alternatives
 * - explore: the range of what we have, organised to show the ways in
 * - curated: what OWID recommends looking at (featured metrics, profiles)
 */
export const AI_SEARCH_MODES = ["targeted", "explore", "curated"] as const
export type AiSearchMode = (typeof AI_SEARCH_MODES)[number]

/** What the search box held when AI search started. */
export interface AiSearchInput {
    query: string
    countries: string[]
    topics: string[]
}

export interface AiSearchLayout {
    intent: AiSearchIntent
    // The results shape to open with
    mode: AiSearchMode
    // One sentence shown above the lead chart, e.g. what "GDP" was taken to mean
    note?: string
    // The chart that answers the search, with the entities to select
    lead?: { id: number; tab?: GrapherTabName; entities: string[] }
    // Other versions of the lead measure, or indicators looked up alongside it
    versions: number[]
    // The country the layout is about (place, country_topic)
    country?: string
    // Topic pages to show first when exploring
    topicPages: number[]
}

/** OWID's own picks for the search: featured metrics and profile pages. */
export interface AiSearchCurated {
    // The topics the featured metrics come from, in order
    topics: { name: string; charts: number[] }[]
    charts: AiSearchChartCandidate[]
    // Country profiles and topic pages
    pages: AiSearchPageCandidate[]
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
            // Server-side only: used to check the entities the model picks
            | "availableEntities"
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
    | ({ type: "layout" } & AiSearchLayout)
    | ({ type: "curated" } & AiSearchCurated)
    | ({ type: "group" } & AiSearchGroup)
    | { type: "related"; queries: string[] }
    | { type: "debug"; title: string; text: string }
    | { type: "done"; model: string; timings: Record<string, number> }
    | { type: "error"; code: AiSearchErrorCode }
