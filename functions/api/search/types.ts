// Re-export types from the types package
export {
    ChartRecordType,
    ExplorerType,
    SearchIndexName,
    FilterType,
    SearchUrlParam,
    type Filter,
    type SearchChartHit,
} from "@ourworldindata/types"

// Import SearchChartHit again for use in this file
import type { SearchChartHit } from "@ourworldindata/types"

/**
 * Enriched search result with URL added
 * This is what we return from the API after processing Algolia results
 */
export type EnrichedSearchChartHit = Omit<
    SearchChartHit,
    "objectID" | "_highlightResult" | "_snippetResult"
> & {
    url: string
}

/**
 * Page search hit from Algolia
 */
export interface SearchPageHit {
    title: string
    slug: string
    type: string
    thumbnailUrl?: string
    date?: string
    content?: string
    authors?: string[]
    objectID: string
    __position: number
}

/**
 * Enriched page search result with URL added
 */
export type EnrichedSearchPageHit = Omit<
    SearchPageHit,
    "objectID" | "_highlightResult" | "_snippetResult"
> & {
    url: string
}
