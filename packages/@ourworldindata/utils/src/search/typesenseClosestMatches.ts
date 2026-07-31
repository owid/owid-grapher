import {
    extractTypesenseHits,
    TypesenseSearchParams,
    TypesenseSearchResponse,
    TypesenseHit,
} from "./typesenseClient.js"

// Typesense counterpart of searchClosestMatches.ts. Same behaviour, same
// thresholds — see that file for the rationale behind the tiering rules.

/**
 * Never drop query tokens. Typesense defaults `drop_tokens_threshold` to 1,
 * meaning it silently retries with fewer tokens whenever a query returns no
 * results — so out of the box it is *more* forgiving than Algolia, which
 * defaults to `removeWordsIfNoResults: "none"` and requires every word. Setting
 * 0 disables the automatic relaxation, which is what makes the explicit
 * fallback below (and its "closest matches" labelling in the UI) meaningful
 * rather than something the engine already did behind our backs.
 */
export const STRICT_DROP_TOKENS_THRESHOLD = 0

/** Effectively "relax as far as needed" for the fallback query. */
const RELAXED_DROP_TOKENS_THRESHOLD = 1000

// Above this many hits, a single shared word is treated as too common to be a
// distinctive match. Same value as the Algolia path.
const DISTINCTIVE_SINGLE_WORD_MAX_HITS = 100

/** Runs one Typesense search — a collection query or a `filter_by`-scoped one. */
export type TypesenseSearchExecutor<T> = (
    params: TypesenseSearchParams
) => Promise<TypesenseSearchResponse<T>>

export type TypesenseResponseWithClosestMatches<T> =
    TypesenseSearchResponse<T> & {
        closestMatches?: boolean
    }

function getTokensMatched<T>(hit: TypesenseHit<T>): number {
    return hit.text_match_info?.tokens_matched ?? 0
}

/**
 * "Closest matches" fallback: when a query returns nothing, retry it with token
 * dropping enabled and keep only the hits that matched as many query tokens as
 * the best hit did.
 *
 * `text_match_info.tokens_matched` is the analogue of Algolia's
 * `_rankingInfo.words`, and Typesense's default relevance sort puts
 * tokens_matched first — so, as with Algolia, the best tier is a prefix of the
 * hit list and we can cut where match quality drops.
 *
 * Known difference from the Algolia path: Algolia's `allOptional` makes every
 * query word optional at once, whereas Typesense drops tokens one at a time
 * from one end (`drop_tokens_mode`, default right-to-left). For a query whose
 * only useful word is the *last* one, Typesense can therefore relax less far
 * than Algolia would. It still returns the same "no results at all" answer, so
 * the failure mode is a missing fallback rather than a wrong one.
 */
export async function typesenseSearchWithClosestMatches<T>(
    execute: TypesenseSearchExecutor<T>,
    params: TypesenseSearchParams
): Promise<TypesenseResponseWithClosestMatches<T>> {
    const primary = await execute({
        ...params,
        drop_tokens_threshold: STRICT_DROP_TOKENS_THRESHOLD,
    })

    // Typesense pages are 1-indexed; `offset` is the alternative pagination
    // mode used by the page searches.
    const isFirstPage = Number(params.page ?? 1) <= 1 && !params.offset
    const query = params.q === undefined ? "" : String(params.q)
    const hasQuery = query.trim() !== "" && query !== "*"

    if (
        extractTypesenseHits(primary).length > 0 ||
        !isFirstPage ||
        !hasQuery
    ) {
        return primary
    }

    const relaxed = await execute({
        ...params,
        drop_tokens_threshold: RELAXED_DROP_TOKENS_THRESHOLD,
        // Also drop the stopword set. A query made up entirely of stopwords
        // ("about", "how many") is reduced to nothing by Typesense and matches
        // zero documents, where Algolia keeps stop words when removing them
        // would empty the query. Retrying without them recovers those searches
        // instead of showing a bogus "no results".
        stopwords: undefined,
    })
    const relaxedHits = extractTypesenseHits(relaxed)

    const topTokens = relaxedHits.length ? getTokensMatched(relaxedHits[0]) : 0
    // A single shared word is usually noise ("world cup" matching everything
    // that mentions "world") — unless it's distinctive, proxied by how many
    // documents it matches.
    if (topTokens === 0) return primary
    if (topTokens === 1 && relaxed.found > DISTINCTIVE_SINGLE_WORD_MAX_HITS)
        return primary

    const tier = relaxedHits.filter(
        (hit) => getTokensMatched(hit) === topTokens
    )

    // Report the tier as one complete page, so pagination stays truthful and
    // the UI doesn't offer a "load more" that can never load anything.
    return {
        ...relaxed,
        hits: tier,
        grouped_hits: undefined,
        found: tier.length,
        closestMatches: true,
    }
}
