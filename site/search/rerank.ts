import { type SearchResponse } from "algoliasearch"
import { type LiteClient } from "algoliasearch/lite"
import {
    RERANK_PAGES,
    searchSingleForHitsWithClosestMatches,
    type SingleSearchRequest,
} from "@ourworldindata/utils"
import { SEARCH_RERANK_URL } from "../../settings/clientSettings.mjs"

/**
 * Experimental: rerank the charts section with a decision model, served by
 * functions/api/search/rerank-charts.ts. Off unless the page was loaded with
 * `?rerank=<model>` (e.g. /search?q=malaria&rerank=jev). Read once at load,
 * because the search page drops URL params it doesn't know.
 */
const RERANK_MODEL: string | null =
    SEARCH_RERANK_URL && typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("rerank")
        : null

export const shouldRerankCharts = (query: string, page: number): boolean =>
    !!RERANK_MODEL && !!query.trim() && page < RERANK_PAGES

/**
 * The charts search, through the rerank endpoint. Falls back to Algolia
 * directly when the endpoint fails, so reranking never breaks the search.
 */
export async function searchChartsReranked<T>(
    liteSearchClient: LiteClient,
    searchParams: SingleSearchRequest
): Promise<SearchResponse<T> & { closestMatches?: boolean }> {
    const url = `${SEARCH_RERANK_URL}?model=${encodeURIComponent(RERANK_MODEL ?? "")}`
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(searchParams),
        })
        if (response.ok) return await response.json()
        console.warn("Search rerank failed:", await response.text())
    } catch (error) {
        console.warn("Search rerank failed:", error)
    }
    return searchSingleForHitsWithClosestMatches<T>(
        liteSearchClient,
        searchParams
    )
}
