import { type SearchResponse } from "algoliasearch"
import {
    type LiteClient,
    type SearchForHitsOptions,
    type SearchParamsObject,
} from "algoliasearch/lite"

// Shared between the site's client-side Algolia queries (site/search/queries.ts)
// and the public /api/search Cloudflare function (functions/api/search/searchApi.ts)
// so the "closest matches" fallback behaves identically in both places.

/** A single search request, as the underlying batch API describes one. */
export type SingleSearchRequest = SearchParamsObject & SearchForHitsOptions

export async function searchSingleForHits<T>(
    liteSearchClient: LiteClient,
    searchParams: SingleSearchRequest
): Promise<SearchResponse<T>> {
    const response = await liteSearchClient.searchForHits<T>([searchParams])
    return response.results[0]
}

// Above this many index-wide hits, a single shared word is treated as too
// common to be a distinctive match (see rationale below).
const DISTINCTIVE_SINGLE_WORD_MAX_HITS = 100

type RankedHit = { _rankingInfo?: { words?: number } }

/**
 * "Closest matches" fallback: when a query returns nothing, retry it with
 * Algolia's removeWordsIfNoResults=allOptional and show only the hits that
 * matched as many query words as the best hit did.
 *
 * - The fallback fires ONLY when the normal search comes back empty, so every
 *   search that works today is completely untouched (and pays no extra
 *   request).
 * - Algolia ranks relaxed hits by number of matched words first, so the best
 *   tier is a prefix of the hit list — we cut where match quality drops,
 *   instead of reporting hundreds of one-word matches ("182 results").
 * - If even the best hit shares only a single word with the query, that's not
 *   a "closest match", it's noise ("world cup" matching everything with
 *   "world") — keep the honest empty state.
 *
 * The returned response carries closestMatches=true so callers can label the
 * result accordingly, and nbHits/nbPages describe the trimmed tier (the
 * result count and pagination stay truthful).
 */
export async function searchSingleForHitsWithClosestMatches<T>(
    liteSearchClient: LiteClient,
    searchParams: SingleSearchRequest
): Promise<SearchResponse<T> & { closestMatches?: boolean }> {
    const primary = await searchSingleForHits<T>(liteSearchClient, searchParams)
    const isFirstPage = !searchParams.page && !searchParams.offset
    const hasQuery = Boolean(searchParams.query?.trim())
    if (primary.hits.length > 0 || !isFirstPage || !hasQuery) return primary

    const relaxed = await searchSingleForHits<T>(liteSearchClient, {
        ...searchParams,
        removeWordsIfNoResults: "allOptional",
        getRankingInfo: true,
    })

    const getWords = (hit: T): number =>
        (hit as RankedHit)._rankingInfo?.words ?? 0
    const topWords = relaxed.hits.length ? getWords(relaxed.hits[0]) : 0
    // A single shared word is usually noise ("world cup" matching everything
    // that mentions "world") — but a distinctive word is a real signal
    // ("malaria worldwide": "worldwide" matches nothing, yet the "malaria"
    // charts are exactly what the user wants). Distinctiveness proxy: how many
    // documents that one word matches — common words match hundreds.
    if (topWords === 0) return primary
    if (
        topWords === 1 &&
        (relaxed.nbHits ?? 0) > DISTINCTIVE_SINGLE_WORD_MAX_HITS
    )
        return primary

    // Algolia ranks relaxed hits by how many query words they matched, so the
    // best-matching hits come first. Keep that leading run and drop everything
    // after it, which is where match quality falls off.
    //
    // Example — "child mortality forecast" has no exact results. The relaxed
    // search reports 180 hits; of the 9 on the page we fetched, the first 5
    // matched 2 of the 3 words ("child mortality") and the rest matched only 1.
    // So topWords = 2 and tier = those 5 hits.
    const tier = relaxed.hits.filter((hit) => getWords(hit) === topWords)

    // Report the tier as one complete page — in the example above: nbHits: 5,
    // nbPages: 1, page: 0, i.e. "5 results, nothing after them".
    //
    // Passing Algolia's 180 through as nbHits instead would give the user a
    // "load more" button that can never load anything: the pagination hooks
    // would keep asking for the next page (5 of 180 loaded), but every
    // follow-up request has page/offset > 0, which the early return at the top
    // of this function treats as "not the first page" — so it would re-run the
    // exact search that already came back empty.
    return {
        ...relaxed,
        hits: tier,
        nbHits: tier.length,
        nbPages: 1,
        page: 0,
        closestMatches: true,
    }
}
