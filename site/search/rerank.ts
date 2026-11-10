import { type SearchResponse } from "algoliasearch"
import { type LiteClient } from "algoliasearch/lite"
import {
    RERANK_PAGES,
    RERANK_POOL_SIZE,
    searchSingleForHitsWithClosestMatches,
    type SingleSearchRequest,
} from "@ourworldindata/utils"
import { SEARCH_RERANK_URL } from "../../settings/clientSettings.mjs"

/**
 * Experimental: rerank the charts section with a decision model, served by
 * functions/api/search/rerank-charts.ts, adding the query's topic-vocabulary
 * hits to the pool. On by default with DEFAULT_RERANK_MODEL; the page URL
 * overrides it: `?rerank=<model>` (e.g. /search?q=malaria&rerank=jev) picks
 * another model, `?rerank=off` turns reranking off, `?vocab=0` keeps the
 * vocabulary hits out. Read once at load; withRerankParams keeps them in the
 * URL when the page rewrites it.
 */
const PAGE_PARAMS =
    SEARCH_RERANK_URL && typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : undefined
const PAGE_RERANK = PAGE_PARAMS?.get("rerank") ?? null
const PAGE_VOCAB = PAGE_PARAMS?.get("vocab") ?? null

// TODO: remove before deploying reranking to production. It's here so that
// every search on this PR's staging server is reranked without URL params,
// and SEARCH_RERANK_URL is set in production too, so merging this as is
// would turn reranking on for everyone.
const DEFAULT_RERANK_MODEL = "clef-flash"

// Same TODO: the random-search button's list of real queries
// (SearchRandomButton.tsx). Only a staging server has the file; elsewhere the
// fetch 404s and the button doesn't render.
export const RANDOM_SEARCHES_URL: string | undefined = PAGE_PARAMS
    ? "/random-searches.json"
    : undefined

const RERANK_MODEL: string | null = !PAGE_PARAMS
    ? null
    : PAGE_RERANK === "off"
      ? null
      : (PAGE_RERANK ?? DEFAULT_RERANK_MODEL)
const RERANK_VOCAB = PAGE_VOCAB !== null ? PAGE_VOCAB === "1" : true

/**
 * `params` plus the page's rerank params, if it has any. The search page
 * rebuilds its URL from the search state, which knows nothing of them, so
 * without this a new query, a refresh or a shared link would lose an
 * override such as rerank=off.
 */
export function withRerankParams(params: URLSearchParams): URLSearchParams {
    if (PAGE_RERANK) params.set("rerank", PAGE_RERANK)
    if (PAGE_VOCAB) params.set("vocab", PAGE_VOCAB)
    return params
}

export const shouldRerankCharts = (query: string, page: number): boolean =>
    !!RERANK_MODEL && !!query.trim() && page < RERANK_PAGES

/**
 * Whether a pages-index section (articles, data insights) asks the rerank
 * endpoint for the hits from `offset` on: only within the reranked pool.
 */
export const shouldRerankPages = (query: string, offset: number): boolean =>
    !!RERANK_MODEL && !!query.trim() && offset < RERANK_POOL_SIZE

type Search<T> = (
    liteSearchClient: LiteClient,
    searchParams: SingleSearchRequest
) => Promise<SearchResponse<T> & { closestMatches?: boolean }>

/** The charts search, through the rerank endpoint. */
export const searchChartsReranked = <T>(
    liteSearchClient: LiteClient,
    searchParams: SingleSearchRequest
): ReturnType<Search<T>> =>
    searchReranked<T>(
        RERANK_VOCAB ? "&vocab=1" : "",
        searchSingleForHitsWithClosestMatches,
        liteSearchClient,
        searchParams
    )

/**
 * A pages-index search, through the rerank endpoint. `search` is what the
 * section would otherwise call.
 */
export const searchPagesReranked = <T>(
    search: Search<T>,
    liteSearchClient: LiteClient,
    searchParams: SingleSearchRequest
): ReturnType<Search<T>> =>
    searchReranked<T>(
        `&section=pages${RERANK_VOCAB ? "&vocab=1" : ""}`,
        search,
        liteSearchClient,
        searchParams
    )

/**
 * `searchParams` through the rerank endpoint. Falls back to `search`, Algolia
 * directly, when the endpoint fails, so reranking never breaks the search.
 */
async function searchReranked<T>(
    urlParams: string,
    search: Search<T>,
    liteSearchClient: LiteClient,
    searchParams: SingleSearchRequest
): ReturnType<Search<T>> {
    const url = `${SEARCH_RERANK_URL}?model=${encodeURIComponent(RERANK_MODEL ?? "")}${urlParams}`
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
    return search(liteSearchClient, searchParams)
}
