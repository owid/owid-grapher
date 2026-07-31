// A minimal Typesense search client built on `fetch`.
//
// Shared between the site's client-side search (site/search/queries.ts) and the
// public /api/search Cloudflare function (functions/api/search/searchApi.ts).
// We deliberately do not use the `typesense` npm package here: it pulls in
// Node-oriented dependencies that don't run on Cloudflare Workers, and it costs
// ~25kB in the site bundle for functionality we don't need (the search API is
// two REST endpoints). The indexers in baker/typesense/ do use the npm client —
// they run in Node and need collection management and bulk import.

export interface TypesenseConfig {
    host: string
    port: number
    protocol: string
    apiKey: string
}

/** Search parameters as Typesense's REST API takes them. */
export type TypesenseSearchParams = Record<
    string,
    string | number | boolean | undefined
>

/** One search in a multi_search request. */
export type TypesenseMultiSearchRequest = TypesenseSearchParams & {
    collection: string
}

/**
 * Per-hit match metadata. `tokens_matched` is how many of the query's tokens
 * the hit matched — the analogue of Algolia's `_rankingInfo.words`, and what
 * the "closest matches" fallback tiers hits by.
 */
export interface TypesenseTextMatchInfo {
    tokens_matched?: number
    fields_matched?: number
    num_tokens_dropped?: number
    score?: string
}

export interface TypesenseHit<T> {
    document: T
    highlights?: Array<{
        field: string
        snippet?: string
        matched_tokens?: string[]
    }>
    text_match?: number
    text_match_info?: TypesenseTextMatchInfo
}

/** A group of hits, returned when `group_by` is set. */
export interface TypesenseGroupedHit<T> {
    group_key: string[]
    hits: TypesenseHit<T>[]
    found?: number
}

export interface TypesenseFacetCounts {
    field_name: string
    counts: Array<{ value: string; count: number }>
}

export interface TypesenseSearchResponse<T> {
    /** Total matching documents. With `group_by`, see `found_docs`. */
    found: number
    /**
     * With `group_by` set, Typesense reports the number of matching *groups* in
     * `found` and the number of matching *documents* in `found_docs`. Without
     * `group_by` only `found` is present. Callers that group want `found` (it
     * is the deduplicated count, matching Algolia's `distinct` nbHits).
     */
    found_docs?: number
    out_of: number
    page: number
    search_time_ms: number
    hits?: TypesenseHit<T>[]
    grouped_hits?: TypesenseGroupedHit<T>[]
    facet_counts?: TypesenseFacetCounts[]
}

/**
 * The result count to report as Algolia's `nbHits`.
 *
 * With `group_by` set, Typesense's `found` counts *groups*, which is what
 * Algolia's `distinct` reports too — so the deduplicated searches and the plain
 * ones both want `found`.
 */
export function getTypesenseFoundCount<T>(
    response: TypesenseSearchResponse<T>
): number {
    return response.found ?? 0
}

function buildSearchUrl(config: TypesenseConfig, path: string): URL {
    return new URL(
        `${config.protocol}://${config.host}:${config.port}${path}`
    )
}

async function parseResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const body = await response.text()
        throw new Error(`Typesense search failed (${response.status}): ${body}`)
    }
    return (await response.json()) as T
}

/** Search a single collection. */
export async function typesenseSearch<T>(
    config: TypesenseConfig,
    collection: string,
    params: TypesenseSearchParams
): Promise<TypesenseSearchResponse<T>> {
    const url = buildSearchUrl(
        config,
        `/collections/${collection}/documents/search`
    )
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, String(value))
    }

    const response = await fetch(url.toString(), {
        method: "GET",
        headers: { "X-TYPESENSE-API-KEY": config.apiKey },
    })
    return parseResponse<TypesenseSearchResponse<T>>(response)
}

/**
 * Run several searches in one round-trip. Mirrors Algolia's batched
 * `searchForHits([...])`, which the topic-row queries rely on to avoid issuing
 * one request per topic.
 */
export async function typesenseMultiSearch<T>(
    config: TypesenseConfig,
    searches: TypesenseMultiSearchRequest[]
): Promise<TypesenseSearchResponse<T>[]> {
    const url = buildSearchUrl(config, "/multi_search")

    const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
            "X-TYPESENSE-API-KEY": config.apiKey,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            searches: searches.map((search) =>
                Object.fromEntries(
                    Object.entries(search).filter(
                        ([, value]) => value !== undefined
                    )
                )
            ),
        }),
    })
    const body = await parseResponse<{
        results: TypesenseSearchResponse<T>[]
    }>(response)
    return body.results
}

/**
 * Hits from a response, flattening the grouped form. With `group_by` +
 * `group_limit: 1` this yields one hit per group, in relevance order — the
 * equivalent of Algolia's `distinct: 1` on `attributeForDistinct`.
 */
export function extractTypesenseHits<T>(
    response: TypesenseSearchResponse<T>
): TypesenseHit<T>[] {
    return (
        response.hits ??
        response.grouped_hits?.flatMap((group) => group.hits ?? []) ??
        []
    )
}
