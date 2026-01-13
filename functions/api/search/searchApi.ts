import {
    SearchIndexName,
    FilterType,
    Filter,
    ChartRecordType,
    SearchChartHit,
} from "@ourworldindata/types"
import { getIndexName, AlgoliaConfig } from "./algoliaClient.js"

/**
 * Enriched search result with URL added
 * This is what we return from the API after processing Algolia results
 */
export type EnrichedSearchChartHit = Omit<
    SearchChartHit,
    "objectID" | "_snippetResult"
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
    __position: number
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
    hits: EnrichedSearchChartHit[]
    nbHits: number
    page: number
    nbPages: number
    hitsPerPage: number
}

export interface SearchPagesApiResponse {
    query: string
    results: EnrichedSearchPageHit[]
    nbHits: number
    offset: number
    length: number
}

interface AlgoliaSearchResponse {
    hits: SearchChartHit[]
    nbHits: number
    page: number
    nbPages: number
    hitsPerPage: number
}

// Minimal set of attributes needed by the MCP server and other API consumers
const DATA_CATALOG_ATTRIBUTES = [
    "objectID",
    "title",
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

function getFilterNamesOfType(
    filters: Filter[],
    type: FilterType
): Set<string> {
    return new Set(filters.filter((f) => f.type === type).map((f) => f.name))
}

export function formatCountryFacetFilters(
    countries: Set<string>,
    requireAll: boolean
): (string | string[])[] {
    // Always filter out income-group-specific featured metrics
    // These are designed for specific use cases and shouldn't appear in general searches
    const excludeIncomeGroupFM = ["isIncomeGroupSpecificFM:false"]

    if (countries.size === 0) return [excludeIncomeGroupFM]

    const filters = Array.from(countries).map(
        (country) => `availableEntities:${country}`
    )
    // If requireAll is true, charts must have ALL countries (AND logic)
    // Otherwise, any country can match (OR logic)
    return requireAll
        ? [...filters.map((f) => [f]), excludeIncomeGroupFM]
        : [filters, excludeIncomeGroupFM]
}

export function formatTopicFacetFilters(
    topics: Set<string>
): (string | string[])[] {
    if (topics.size === 0) return []

    const filters = Array.from(topics).map((topic) => `tags:${topic}`)
    // Topics use OR logic (any topic can match)
    return [filters]
}

/**
 * Fetches available topics from Algolia
 */
async function getAvailableTopics(config: AlgoliaConfig): Promise<string[]> {
    const indexName = getIndexName(
        SearchIndexName.ExplorerViewsMdimViewsAndCharts,
        config.indexPrefix
    )

    const searchParams = {
        requests: [
            {
                indexName,
                params: new URLSearchParams({
                    query: "",
                    hitsPerPage: "0",
                    facets: JSON.stringify(["tags"]),
                }).toString(),
            },
        ],
    }

    const url = `https://${config.appId}-dsn.algolia.net/1/indexes/*/queries`

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "X-Algolia-Application-Id": config.appId,
            "X-Algolia-API-Key": config.apiKey,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(searchParams),
    })

    if (!response.ok) {
        throw new Error(`Algolia search failed: ${response.statusText}`)
    }

    const data = (await response.json()) as {
        results: [{ facets?: { tags?: Record<string, number> } }]
    }

    return Object.keys(data.results[0].facets?.tags || {}).sort()
}

export async function searchCharts(
    config: AlgoliaConfig,
    state: SearchState,
    page: number = 0,
    hitsPerPage: number = 20,
    baseUrl: string = "https://ourworldindata.org"
): Promise<SearchApiResponse> {
    const countryFacetFilters = formatCountryFacetFilters(
        getFilterNamesOfType(state.filters, FilterType.COUNTRY),
        state.requireAllCountries
    )
    const topicFacetFilters = formatTopicFacetFilters(
        getFilterNamesOfType(state.filters, FilterType.TOPIC)
    )
    const facetFilters = [...countryFacetFilters, ...topicFacetFilters]

    const indexName = getIndexName(
        SearchIndexName.ExplorerViewsMdimViewsAndCharts,
        config.indexPrefix
    )

    const searchParams = {
        requests: [
            {
                indexName,
                params: new URLSearchParams({
                    query: state.query,
                    attributesToRetrieve: DATA_CATALOG_ATTRIBUTES.join(","),
                    highlightPreTag: "<mark>",
                    highlightPostTag: "</mark>",
                    hitsPerPage: hitsPerPage.toString(),
                    page: page.toString(),
                    ...(facetFilters.length > 0 && {
                        facetFilters: JSON.stringify(facetFilters),
                    }),
                }).toString(),
            },
        ],
    }

    // Use Algolia's REST API directly with fetch()
    // Note: We can't use the algoliasearch npm package because it requires
    // XMLHttpRequest which is not available in CloudFlare Workers
    const url = `https://${config.appId}-dsn.algolia.net/1/indexes/*/queries`

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "X-Algolia-Application-Id": config.appId,
            "X-Algolia-API-Key": config.apiKey,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(searchParams),
    })

    if (!response.ok) {
        throw new Error(`Algolia search failed: ${response.statusText}`)
    }

    const data = (await response.json()) as {
        results: AlgoliaSearchResponse[]
    }
    const result = data.results[0]

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
            throw new Error(
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

        // Preserve highlight results for frontend rendering
        if ((hit as any)._highlightResult) {
            cleanHit._highlightResult = (hit as any)._highlightResult
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

        // Remove internal Algolia fields that shouldn't be exposed in API
        delete cleanHit.objectID

        return {
            ...(cleanHit as SearchChartHit),
            url,
        }
    })

    return {
        query: state.query,
        hits: cleanedHits,
        nbHits: result.nbHits,
        page: result.page,
        nbPages: result.nbPages,
        hitsPerPage: result.hitsPerPage,
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

    const searchParams = {
        requests: [
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
        ],
    }

    const url = `https://${config.appId}-dsn.algolia.net/1/indexes/*/queries`

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "X-Algolia-Application-Id": config.appId,
            "X-Algolia-API-Key": config.apiKey,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(searchParams),
    })

    if (!response.ok) {
        throw new Error(`Algolia search failed: ${response.statusText}`)
    }

    const data = (await response.json()) as {
        results: [{ hits: SearchPageHit[]; nbHits: number }]
    }
    const result = data.results[0]

    // Clean up the hits and add URL
    const cleanedHits = result.hits.map((hit): EnrichedSearchPageHit => {
        const {
            _highlightResult,
            _snippetResult,
            objectID: _objectID,
            ...cleanHit
        } = hit as any

        // Construct URL based on slug
        const url = `${baseUrl}/${cleanHit.slug}`

        return {
            ...cleanHit,
            url,
        }
    })

    return {
        query,
        results: cleanedHits,
        nbHits: result.nbHits,
        offset,
        length,
    }
}
