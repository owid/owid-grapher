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
 * `?rerank=<model>` (e.g. /search?q=malaria&rerank=jev), plus `&vocab=1` to
 * add the query's topic-vocabulary hits to the pool. Read once at load,
 * because the search page drops URL params it doesn't know.
 */
const PAGE_PARAMS =
    SEARCH_RERANK_URL && typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : undefined
const RERANK_MODEL: string | null = PAGE_PARAMS?.get("rerank") ?? null
const RERANK_VOCAB = PAGE_PARAMS?.get("vocab") === "1"

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
    const url = `${SEARCH_RERANK_URL}?model=${encodeURIComponent(RERANK_MODEL ?? "")}${RERANK_VOCAB ? "&vocab=1" : ""}`
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
