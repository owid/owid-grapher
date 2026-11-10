import {
    SearchIndexName,
    SearchChartHit,
    OwidGdocType,
} from "@ourworldindata/types"
import { getCanonicalUrl } from "@ourworldindata/components"
import {
    buildChartsFilterBy,
    formatTypeFilterBy,
    joinFilterBy,
    typesenseSearch,
    typesenseSearchWithClosestMatches,
    extractTypesenseHits,
    getTypesenseFoundCount,
    type TypesenseConfig,
    type TypesenseSearchParams,
    type TypesenseSearchResponse,
    CHARTS_QUERY_BY,
    CHARTS_QUERY_BY_WEIGHTS,
    CHARTS_NUM_TYPOS,
    CHARTS_SORT_BY,
    PAGES_QUERY_BY,
    PAGES_QUERY_BY_WEIGHTS,
    PAGES_SORT_BY,
    TYPESENSE_RELEVANCE_PARAMS,
    TYPESENSE_STOPWORDS_SET,
    TYPESENSE_SYNONYM_SET,
} from "@ourworldindata/utils"
import {
    DATA_CATALOG_ATTRIBUTES,
    PAGE_ATTRIBUTES,
    getChartHitUrl,
    type EnrichedSearchChartHit,
    type EnrichedSearchPageHit,
    type SearchApiResponse,
    type SearchPagesApiResponse,
    type SearchState,
} from "./searchApi.js"

// Experimental: /api/search?engine=typesense answers charts and pages searches
// from Typesense instead of Algolia, in the same response shapes, so the
// rerank (rerank.ts) can read either engine's pool.
//
// `alpha` is Typesense's hybrid weight: the share of the vector (semantic)
// rank in the fused ranking. 0 is a keyword-only search, tuned to mirror the
// Algolia ranking (typesenseSearchParams.ts); anything above adds the nearest
// records by embedding and ranks by rank fusion.

type Doc = Record<string, unknown>

/** The auto-embedding field of both collections (typesenseCollectionSchemas.ts). */
const EMBEDDING_FIELD = "embedding"

/** How many nearest records the vector half of a hybrid search contributes. */
const VECTOR_K = 100

/**
 * A hybrid search can't be deduplicated by Typesense: `group_by` with
 * vector-only matches collapses the result set (typesense/typesense#2723,
 * fixed in v31). So it fetches one window of raw hits, the most Typesense
 * returns per page, and deduplicates and paginates that here.
 */
const HYBRID_WINDOW = 250

/**
 * Typesense has no empty-query mode: `q: "*"` is the documented way to match
 * everything, and it is what a blank Algolia query does.
 */
const toTypesenseQuery = (query: string): string => query.trim() || "*"

/**
 * Timestamp fields are indexed as Unix seconds (Typesense has no date type) but
 * the API returns ISO strings, so convert them back on the way out.
 */
function toIsoDate(value: unknown): string | undefined {
    if (typeof value !== "number") return value as string | undefined
    return new Date(value * 1000).toISOString()
}

/** A hybrid search needs words to embed, and a non-zero vector weight. */
const isHybrid = (query: string, alpha: number): boolean =>
    alpha > 0 && query.trim() !== ""

/**
 * Turns a keyword search's parameters into a hybrid one: the embedding field
 * joins `query_by` (with a weight and a typo setting, since those lists must
 * stay as long as `query_by`), and the ranking is Typesense's rank fusion in
 * place of our keyword `sort_by`.
 */
function toHybridParams(
    params: TypesenseSearchParams,
    alpha: number,
    dedupField: string
): TypesenseSearchParams {
    const append = (
        list: unknown,
        value: string | number
    ): string | undefined =>
        list === undefined ? undefined : `${String(list)},${value}`
    return {
        ...params,
        query_by: append(params.query_by, EMBEDDING_FIELD),
        query_by_weights: append(params.query_by_weights, 1),
        num_typos: append(params.num_typos, 0),
        vector_query: `${EMBEDDING_FIELD}:([], alpha: ${alpha}, k: ${VECTOR_K})`,
        // score every hit on both halves, also one that only one half found
        rerank_hybrid_matches: true,
        sort_by: undefined,
        group_by: undefined,
        group_limit: undefined,
        include_fields: append(params.include_fields, dedupField),
        page: 1,
        per_page: HYBRID_WINDOW,
        offset: undefined,
        limit: undefined,
    }
}

/** The first hit of each `field` value, in order. */
function dedupDocs(docs: Doc[], field: string): Doc[] {
    const seen = new Set<unknown>()
    return docs.filter((doc) => {
        const key = doc[field]
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

/**
 * Runs a search either way and returns one page of documents: a keyword
 * search is deduplicated and paginated by Typesense, with the closest-matches
 * fallback; a hybrid one here (see HYBRID_WINDOW).
 */
async function searchDocs(
    config: TypesenseConfig,
    collection: SearchIndexName,
    params: TypesenseSearchParams,
    options: {
        query: string
        alpha: number
        dedupField: string
        offset: number
        length: number
    }
): Promise<{ docs: Doc[]; nbHits: number; closestMatches?: boolean }> {
    const execute = (
        searchParams: TypesenseSearchParams
    ): Promise<TypesenseSearchResponse<Doc>> =>
        typesenseSearch<Doc>(config, collection, searchParams)

    if (!isHybrid(options.query, options.alpha)) {
        const result = await typesenseSearchWithClosestMatches<Doc>(
            execute,
            params
        )
        return {
            docs: extractTypesenseHits(result).map((hit) => hit.document),
            nbHits: getTypesenseFoundCount(result),
            closestMatches: result.closestMatches,
        }
    }

    const result = await execute(
        toHybridParams(params, options.alpha, options.dedupField)
    )
    const docs = dedupDocs(
        extractTypesenseHits(result).map((hit) => hit.document),
        options.dedupField
    )
    return {
        docs: docs.slice(options.offset, options.offset + options.length),
        nbHits: docs.length,
    }
}

const pick = (doc: Doc, attributes: string[]): Doc =>
    Object.fromEntries(
        attributes
            .filter((attr) => attr in doc)
            .map((attr) => [attr, doc[attr]])
    )

export async function searchChartsTypesense(
    config: TypesenseConfig,
    state: SearchState,
    page: number,
    hitsPerPage: number,
    baseUrl: string,
    alpha: number
): Promise<SearchApiResponse> {
    const filterBy = buildChartsFilterBy({
        query: state.query,
        filters: state.filters,
        requireAllCountries: state.requireAllCountries,
    })

    const { docs, nbHits, closestMatches } = await searchDocs(
        config,
        SearchIndexName.ExplorerViewsMdimViewsAndCharts,
        {
            q: toTypesenseQuery(state.query),
            query_by: CHARTS_QUERY_BY,
            query_by_weights: CHARTS_QUERY_BY_WEIGHTS,
            num_typos: CHARTS_NUM_TYPOS,
            sort_by: CHARTS_SORT_BY,
            // Algolia's `attributeForDistinct: "id"` + `distinct: true`.
            group_by: "deduplicationId",
            group_limit: 1,
            include_fields: DATA_CATALOG_ATTRIBUTES.join(","),
            ...TYPESENSE_RELEVANCE_PARAMS,
            stopwords: TYPESENSE_STOPWORDS_SET,
            synonym_sets: TYPESENSE_SYNONYM_SET,
            filter_by: filterBy || undefined,
            per_page: hitsPerPage,
            page: page + 1, // Typesense pages are 1-indexed
        },
        {
            query: state.query,
            alpha,
            dedupField: "deduplicationId",
            offset: page * hitsPerPage,
            length: hitsPerPage,
        }
    )

    const results = docs.map((doc): EnrichedSearchChartHit => {
        const hit = {
            ...pick(doc, DATA_CATALOG_ATTRIBUTES),
            publishedAt: toIsoDate(doc.publishedAt),
            updatedAt: toIsoDate(doc.updatedAt),
        } as unknown as SearchChartHit
        return { ...hit, url: getChartHitUrl(hit, baseUrl) }
    })

    return {
        query: state.query,
        results,
        nbHits,
        page,
        nbPages: Math.ceil(nbHits / hitsPerPage),
        hitsPerPage,
        ...(closestMatches && { closestMatches: true as const }),
    }
}

export async function searchPagesTypesense(
    config: TypesenseConfig,
    query: string,
    offset: number,
    length: number,
    pageTypes: string[] = ["article", "about-page"],
    baseUrl: string,
    extraAttributes: string[],
    alpha: number
): Promise<SearchPagesApiResponse> {
    const attributes = [...PAGE_ATTRIBUTES, ...extraAttributes]

    const { docs, nbHits, closestMatches } = await searchDocs(
        config,
        SearchIndexName.Pages,
        {
            q: toTypesenseQuery(query),
            query_by: PAGES_QUERY_BY,
            query_by_weights: PAGES_QUERY_BY_WEIGHTS,
            sort_by: PAGES_SORT_BY,
            // Algolia's `attributeForDistinct: "path"`: a page is indexed as
            // several content chunks sharing one path.
            group_by: "path",
            group_limit: 1,
            include_fields: attributes.join(","),
            ...TYPESENSE_RELEVANCE_PARAMS,
            stopwords: TYPESENSE_STOPWORDS_SET,
            synonym_sets: TYPESENSE_SYNONYM_SET,
            filter_by: joinFilterBy(formatTypeFilterBy(...pageTypes)),
            offset,
            limit: length,
        },
        { query, alpha, dedupField: "path", offset, length }
    )

    const results = docs.map((doc): EnrichedSearchPageHit => {
        const hit = {
            ...pick(doc, attributes),
            date: toIsoDate(doc.date),
            modifiedDate: toIsoDate(doc.modifiedDate),
        } as unknown as Omit<EnrichedSearchPageHit, "url">
        return {
            ...hit,
            url: getCanonicalUrl(baseUrl, {
                slug: hit.slug,
                content: { type: hit.type as OwidGdocType },
            }),
        }
    })

    return {
        query,
        results,
        nbHits,
        offset,
        length,
        ...(closestMatches && { closestMatches: true as const }),
    }
}
