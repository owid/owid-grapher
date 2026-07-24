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
    buildChartsFacetFilters,
    searchSingleForHitsWithClosestMatches,
} from "@ourworldindata/utils"
import {
    getIndexName,
    createSearchClient,
    AlgoliaConfig,
} from "./algoliaClient.js"

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
 * This is what we return from the API after processing Algolia results
 */
export type EnrichedSearchChartHit = Omit<
    SearchChartHit,
    "objectID" | "_highlightResult" | "_snippetResult"
> & {
    url: string
}

/**
 * Page search hit from Algolia
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
    // "closest matches" instead (see searchSingleForHitsWithClosestMatches).
    closestMatches?: boolean
}

export interface SearchPagesApiResponse {
    query: string
    results: EnrichedSearchPageHit[]
    nbHits: number
    offset: number
    length: number
    // True when the exact query returned nothing and these are relaxed
    // "closest matches" instead (see searchSingleForHitsWithClosestMatches).
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
 * Fetches available topics from Algolia
 */
async function getAvailableTopics(config: AlgoliaConfig): Promise<string[]> {
    const indexName = getIndexName(
        SearchIndexName.ExplorerViewsMdimViewsAndCharts,
        config.indexPrefix
    )
    const client = createSearchClient(config)

    const response = await client.searchForHits<SearchChartHit>({
        requests: [
            {
                indexName,
                query: "",
                hitsPerPage: 0,
                facets: ["tags"],
            },
        ],
    })

    return Object.keys(response.results[0].facets?.tags ?? {}).sort()
}

export async function searchCharts(
    config: AlgoliaConfig,
    state: SearchState,
    page: number = 0,
    hitsPerPage: number = 20,
    baseUrl: string = "https://ourworldindata.org"
): Promise<SearchApiResponse> {
    const facetFilters = buildChartsFacetFilters({
        query: state.query,
        filters: state.filters,
        requireAllCountries: state.requireAllCountries,
    })

    const indexName = getIndexName(
        SearchIndexName.ExplorerViewsMdimViewsAndCharts,
        config.indexPrefix
    )

    const client = createSearchClient(config)

    const result = await searchSingleForHitsWithClosestMatches<SearchChartHit>(
        client,
        [
            {
                indexName,
                query: state.query,
                attributesToRetrieve: DATA_CATALOG_ATTRIBUTES,
                highlightPreTag: "<mark>",
                highlightPostTag: "</mark>",
                hitsPerPage,
                page,
                ...(facetFilters.length > 0 && { facetFilters }),
            },
        ]
    )

    // If we got zero results and user is filtering by topic, check if the topic exists
    const requestedTopics = getFilterNamesOfType(
        state.filters,
        FilterType.TOPIC
    )
    if (result.nbHits === 0 && requestedTopics.size > 0) {
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
    const cleanedHits = result.hits.map((hit): EnrichedSearchChartHit => {
        // Pick only the attributes we want to return to avoid spurious properties
        const cleanHit: any = {}
        for (const attr of DATA_CATALOG_ATTRIBUTES) {
            if (attr in hit) {
                cleanHit[attr] = (hit as any)[attr]
            }
        }

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
        nbHits: result.nbHits ?? 0,
        page: result.page ?? page,
        nbPages: result.nbPages ?? 0,
        hitsPerPage: result.hitsPerPage ?? hitsPerPage,
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
    config: AlgoliaConfig,
    query: string,
    offset: number = 0,
    length: number = 10,
    pageTypes: string[] = ["article", "about-page"],
    baseUrl: string = "https://ourworldindata.org"
): Promise<SearchPagesApiResponse> {
    const indexName = getIndexName(SearchIndexName.Pages, config.indexPrefix)

    // Build filters string for page types
    const filters = pageTypes.map((type) => `type:${type}`).join(" OR ")

    const client = createSearchClient(config)

    const result = await searchSingleForHitsWithClosestMatches<SearchPageHit>(
        client,
        [
            {
                indexName,
                query,
                filters,
                facetFilters: [[]],
                attributesToRetrieve: PAGE_ATTRIBUTES,
                highlightPreTag: "<mark>",
                highlightPostTag: "</mark>",
                offset,
                length,
            },
        ]
    )

    // Clean up the hits and add URL
    const cleanedHits = result.hits.map((hit): EnrichedSearchPageHit => {
        const {
            _highlightResult,
            _snippetResult,
            objectID: _objectID,
            ...cleanHit
        } = hit as any

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
        nbHits: result.nbHits ?? 0,
        offset,
        length,
        ...(result.closestMatches && { closestMatches: true as const }),
    }
}
