import { type SearchResponse } from "algoliasearch"
import { type LiteClient } from "algoliasearch/lite"

// Shared between the site's client-side Algolia queries (site/search/queries.ts)
// and the public /api/search Cloudflare function (functions/api/search/searchApi.ts)
// so the "closest matches" fallback behaves identically in both places.

export async function searchSingleForHits<T>(
    liteSearchClient: LiteClient,
    searchParams: Parameters<LiteClient["searchForHits"]>[0]
): Promise<SearchResponse<T>> {
    const response = await liteSearchClient.searchForHits<T>(searchParams)
    return response.results[0]
}

// Above this many index-wide hits, a single shared word is treated as too
// common to be a distinctive match (see rationale below).
const DISTINCTIVE_SINGLE_WORD_MAX_HITS = 100

type SingleSearchRequest = Record<string, unknown> & {
    query?: string
    page?: number
    offset?: number
}

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
    searchParams: SingleSearchRequest[]
): Promise<SearchResponse<T> & { closestMatches?: boolean }> {
    const primary = await searchSingleForHits<T>(
        liteSearchClient,
        searchParams as Parameters<LiteClient["searchForHits"]>[0]
    )
    const request = searchParams[0]
    const isFirstPage = !request.page && !request.offset
    const hasQuery = Boolean(request.query?.trim())
    if (primary.hits.length > 0 || !isFirstPage || !hasQuery) return primary

    const relaxedRequest: SingleSearchRequest = {
        ...request,
        removeWordsIfNoResults: "allOptional",
        getRankingInfo: true,
    }
    const relaxed = await searchSingleForHits<T>(liteSearchClient, [
        relaxedRequest,
    ] as Parameters<LiteClient["searchForHits"]>[0])

    const words = (hit: T): number =>
        (hit as RankedHit)._rankingInfo?.words ?? 0
    const topWords = relaxed.hits.length ? words(relaxed.hits[0]) : 0
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

    // Algolia ranks relaxed hits by matched words, so the best tier is a
    // prefix. For a one-word tier, EVERY match shares that word, so the full
    // count is the tier size; multi-word tiers may extend past the fetched
    // page, where the page length is a (honest) undercount.
    const tier = relaxed.hits.filter((hit) => words(hit) === topWords)
    return {
        ...relaxed,
        hits: tier,
        nbHits: topWords === 1 ? relaxed.nbHits : tier.length,
        nbPages: 1,
        page: 0,
        closestMatches: true,
    }
}
