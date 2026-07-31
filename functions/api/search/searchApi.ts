import {
    SearchIndexName,
    FilterType,
    Filter,
    ChartRecordType,
    SearchChartHit,
    OwidGdocType,
} from "@ourworldindata/types"
import { getCanonicalUrl } from "@ourworldindata/components"
import {
    getFilterNamesOfType,
    buildChartsFilterBy,
    formatTypeFilterBy,
    joinFilterBy,
    typesenseSearch,
    typesenseSearchWithClosestMatches,
    extractTypesenseHits,
    getTypesenseFoundCount,
    type TypesenseConfig,
    type TypesenseSearchParams,
    CHARTS_QUERY_BY,
    CHARTS_QUERY_BY_WEIGHTS,
    CHARTS_SORT_BY,
    PAGES_QUERY_BY,
    PAGES_QUERY_BY_WEIGHTS,
    PAGES_SORT_BY,
    TYPESENSE_RELEVANCE_PARAMS,
    TYPESENSE_STOPWORDS_SET,
    TYPESENSE_SYNONYM_SET,
} from "@ourworldindata/utils"

/**
 * Error thrown when the client provides invalid search parameters (e.g. a
 * non-existent topic name).  The API handler uses this to distinguish
 * user-facing validation errors (→ 400, no Sentry) from unexpected failures
 * (→ 500, report to Sentry).
 */
export class SearchValidationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "SearchValidationError"
    }
}

/**
 * Enriched search result with URL added
 * This is what we return from the API after processing Typesense results
 */
export type EnrichedSearchChartHit = Omit<
    SearchChartHit,
    "objectID" | "_highlightResult" | "_snippetResult"
> & {
    url: string
}

/**
 * Page search hit from Typesense
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

export interface SearchState {
    query: string
    filters: Filter[]
    requireAllCountries: boolean
}

export interface SearchApiResponse {
    query: string
    results: EnrichedSearchChartHit[]
    nbHits: number
    page: number
    nbPages: number
    hitsPerPage: number
    // True when the exact query returned nothing and these are relaxed
    // "closest matches" instead (see typesenseSearchWithClosestMatches).
    closestMatches?: boolean
}

export interface SearchPagesApiResponse {
    query: string
    results: EnrichedSearchPageHit[]
    nbHits: number
    offset: number
    length: number
    // True when the exact query returned nothing and these are relaxed
    // "closest matches" instead (see typesenseSearchWithClosestMatches).
    closestMatches?: boolean
}

// Minimal set of attributes needed by the MCP server and other API consumers
const DATA_CATALOG_ATTRIBUTES = [
    "title",
    "containerTitle",
    "slug",
    "subtitle",
    "variantName",
    "type",
    "queryParams",
    "availableEntities",
    "originalAvailableEntities",
    "availableTabs",
    "publishedAt",
    "updatedAt",
]

/**
 * Typesense has no empty-query mode: `q: "*"` is the documented way to match
 * everything, and it is what a blank Algolia query does.
 */
function toTypesenseQuery(query: string): string {
    return query.trim() || "*"
}

/**
 * Timestamp fields are indexed as Unix seconds (Typesense has no date type) but
 * the API has always returned ISO strings, so convert them back on the way out.
 */
function toIsoDate(value: unknown): string | undefined {
    if (typeof value !== "number") return value as string | undefined
    return new Date(value * 1000).toISOString()
}

/**
 * Fetches available topics from Typesense
 */
async function getAvailableTopics(config: TypesenseConfig): Promise<string[]> {
    const response = await typesenseSearch<Record<string, unknown>>(
        config,
        SearchIndexName.ExplorerViewsMdimViewsAndCharts,
        {
            q: "*",
            query_by: CHARTS_QUERY_BY,
            per_page: 0,
            facet_by: "tags",
            // Typesense caps facet values at 10 by default; the tag list is
            // much longer than that and the error message enumerates it.
            max_facet_values: 1000,
        }
    )

    const tagFacet = response.facet_counts?.find(
        (facet) => facet.field_name === "tags"
    )
    return (tagFacet?.counts ?? []).map((count) => count.value).sort()
}

export async function searchCharts(
    config: TypesenseConfig,
    state: SearchState,
    page: number = 0,
    hitsPerPage: number = 20,
    baseUrl: string = "https://ourworldindata.org"
): Promise<SearchApiResponse> {
    const filterBy = buildChartsFilterBy({
        query: state.query,
        filters: state.filters,
        requireAllCountries: state.requireAllCountries,
    })

    const params: TypesenseSearchParams = {
        q: toTypesenseQuery(state.query),
        query_by: CHARTS_QUERY_BY,
        query_by_weights: CHARTS_QUERY_BY_WEIGHTS,
        sort_by: CHARTS_SORT_BY,
        // Algolia's `attributeForDistinct: "id"` + `distinct: true`.
        group_by: "deduplicationId",
        group_limit: 1,
        include_fields: DATA_CATALOG_ATTRIBUTES.join(","),
        highlight_start_tag: "<mark>",
        highlight_end_tag: "</mark>",
        ...TYPESENSE_RELEVANCE_PARAMS,
        stopwords: TYPESENSE_STOPWORDS_SET,
        synonym_sets: TYPESENSE_SYNONYM_SET,
        filter_by: filterBy || undefined,
        per_page: hitsPerPage,
        page: page + 1, // Typesense pages are 1-indexed
    }

    const result = await typesenseSearchWithClosestMatches<
        Record<string, unknown>
    >(
        (searchParams) =>
            typesenseSearch(
                config,
                SearchIndexName.ExplorerViewsMdimViewsAndCharts,
                searchParams
            ),
        params
    )

    const hits = extractTypesenseHits(result)
    const nbHits = getTypesenseFoundCount(result)

    // If we got zero results and user is filtering by topic, check if the topic exists
    const requestedTopics = getFilterNamesOfType(
        state.filters,
        FilterType.TOPIC
    )
    if (nbHits === 0 && requestedTopics.size > 0) {
        const availableTopics = await getAvailableTopics(config)
        const invalidTopics = Array.from(requestedTopics).filter(
            (topic) => !availableTopics.includes(topic)
        )
        if (invalidTopics.length > 0) {
            throw new SearchValidationError(
                `No results found. The topic "${invalidTopics.join('", "')}" does not exist. Available topics: ${availableTopics.join(", ")}`
            )
        }
    }

    // Clean up the hits and add URL
    const cleanedHits = hits.map((hit): EnrichedSearchChartHit => {
        const doc = hit.document
        // Pick only the attributes we want to return to avoid spurious properties
        const cleanHit: any = {}
        for (const attr of DATA_CATALOG_ATTRIBUTES) {
            if (attr in doc) {
                cleanHit[attr] = doc[attr]
            }
        }
        cleanHit.publishedAt = toIsoDate(cleanHit.publishedAt)
        cleanHit.updatedAt = toIsoDate(cleanHit.updatedAt)

        // Construct URL based on type
        let url: string
        if (cleanHit.type === ChartRecordType.ExplorerView) {
            // Explorer views: /explorers/{slug}{queryParams}
            const queryParams = cleanHit.queryParams || ""
            url = `${baseUrl}/explorers/${cleanHit.slug}${queryParams}`
        } else if (cleanHit.type === ChartRecordType.MultiDimView) {
            // Multi-dimensional views: /grapher/{slug}{queryParams}
            const queryParams = cleanHit.queryParams || ""
            url = `${baseUrl}/grapher/${cleanHit.slug}${queryParams}`
        } else {
            // Regular charts: /grapher/{slug}
            url = `${baseUrl}/grapher/${cleanHit.slug}`
        }

        return {
            ...(cleanHit as SearchChartHit),
            url,
        }
    })

    return {
        query: state.query,
        results: cleanedHits,
        nbHits,
        page,
        nbPages: Math.ceil(nbHits / hitsPerPage),
        hitsPerPage,
        ...(result.closestMatches && { closestMatches: true as const }),
    }
}

// Minimal set of attributes needed for page search
const PAGE_ATTRIBUTES = [
    "title",
    "thumbnailUrl",
    "date",
    "slug",
    "type",
    "content",
    "authors",
    "modifiedDate",
]

export async function searchPages(
    config: TypesenseConfig,
    query: string,
    offset: number = 0,
    length: number = 10,
    pageTypes: string[] = ["article", "about-page"],
    baseUrl: string = "https://ourworldindata.org"
): Promise<SearchPagesApiResponse> {
    const params: TypesenseSearchParams = {
        q: toTypesenseQuery(query),
        query_by: PAGES_QUERY_BY,
        query_by_weights: PAGES_QUERY_BY_WEIGHTS,
        sort_by: PAGES_SORT_BY,
        // Algolia's `attributeForDistinct: "path"` — pages are indexed as
        // several content chunks sharing one path, and a data insight can share
        // a bare slug with an article, so `path` (not `slug`) is the identity.
        group_by: "path",
        group_limit: 1,
        include_fields: PAGE_ATTRIBUTES.join(","),
        highlight_start_tag: "<mark>",
        highlight_end_tag: "</mark>",
        ...TYPESENSE_RELEVANCE_PARAMS,
        stopwords: TYPESENSE_STOPWORDS_SET,
        synonym_sets: TYPESENSE_SYNONYM_SET,
        filter_by: joinFilterBy(formatTypeFilterBy(...pageTypes)),
        offset,
        limit: length,
    }

    const result = await typesenseSearchWithClosestMatches<
        Record<string, unknown>
    >(
        (searchParams) =>
            typesenseSearch(config, SearchIndexName.Pages, searchParams),
        params
    )

    const hits = extractTypesenseHits(result)

    // Clean up the hits and add URL
    const cleanedHits = hits.map((hit): EnrichedSearchPageHit => {
        const doc = hit.document
        const cleanHit: any = {}
        for (const attr of PAGE_ATTRIBUTES) {
            if (attr in doc) {
                cleanHit[attr] = doc[attr]
            }
        }
        cleanHit.date = toIsoDate(cleanHit.date)
        cleanHit.modifiedDate = toIsoDate(cleanHit.modifiedDate)

        // Construct URL based on slug + type: different gdoc types bake to
        // different path prefixes (e.g. data-insights -> /data-insights/,
        // profiles -> /profile/) — getCanonicalUrl/getPrefixedGdocPath is the
        // single source of truth the baker itself uses, so newly-exposed
        // pageTypes (beyond the original article/about-page) resolve to
        // working links instead of a bare `${baseUrl}/${slug}` guess.
        const url = getCanonicalUrl(baseUrl, {
            slug: cleanHit.slug,
            content: { type: cleanHit.type as OwidGdocType },
        })

        return {
            ...cleanHit,
            url,
        }
    })

    return {
        query,
        results: cleanedHits,
        nbHits: getTypesenseFoundCount(result),
        offset,
        length,
        ...(result.closestMatches && { closestMatches: true as const }),
    }
}
