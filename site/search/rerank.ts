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
 * add the query's topic-vocabulary hits to the pool. Read once at load;
 * withRerankParams keeps them in the URL when the page rewrites it.
 */
const PAGE_PARAMS =
    SEARCH_RERANK_URL && typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : undefined
const RERANK_MODEL: string | null = PAGE_PARAMS?.get("rerank") ?? null
const RERANK_VOCAB = PAGE_PARAMS?.get("vocab") === "1"

/**
 * `params` plus the page's rerank opt-in, if it has one. The search page
 * rebuilds its URL from the search state, which knows nothing of the opt-in,
 * so without this a new query, a refresh or a shared link would lose it.
 */
export function withRerankParams(params: URLSearchParams): URLSearchParams {
    if (RERANK_MODEL) params.set("rerank", RERANK_MODEL)
    if (RERANK_VOCAB) params.set("vocab", "1")
    return params
}

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
