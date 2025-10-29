import { SearchIndexName, FilterType, Filter } from "./types.js"
import { getIndexName, AlgoliaConfig } from "./algoliaClient.js"
import type { SearchChartHit, EnrichedSearchChartHit } from "./types.js"

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
    "title",
    "slug",
    "subtitle",
    "variantName",
    "type",
    "queryParams",
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
    if (countries.size === 0) return []

    const filters = Array.from(countries).map(
        (country) => `availableEntities:${country}`
    )
    // If requireAll is true, charts must have ALL countries (AND logic)
    // Otherwise, any country can match (OR logic)
    return requireAll ? filters.map((f) => [f]) : [filters]
}

export function formatTopicFacetFilters(
    topics: Set<string>
): (string | string[])[] {
    if (topics.size === 0) return []

    const filters = Array.from(topics).map((topic) => `tags:${topic}`)
    // Topics use OR logic (any topic can match)
    return [filters]
}

export async function searchCharts(
    config: AlgoliaConfig,
    state: SearchState,
    page: number = 0,
    hitsPerPage: number = 20
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

    // Clean up the hits and add URL
    const cleanedHits = result.hits.map((hit): EnrichedSearchChartHit => {
        const {
            _highlightResult,
            _snippetResult,
            objectID: _objectID,
            ...cleanHit
        } = hit as any // Algolia adds internal fields not in our types

        // Construct URL based on type
        let url: string
        if (cleanHit.type === "explorerView") {
            // Explorer views: /explorers/{slug}{queryParams}
            const queryParams = cleanHit.queryParams || ""
            url = `https://ourworldindata.org/explorers/${cleanHit.slug}${queryParams}`
        } else if (cleanHit.type === "multiDimView") {
            // Multi-dimensional views: /grapher/{slug}{queryParams}
            const queryParams = cleanHit.queryParams || ""
            url = `https://ourworldindata.org/grapher/${cleanHit.slug}${queryParams}`
        } else {
            // Regular charts: /grapher/{slug}
            url = `https://ourworldindata.org/grapher/${cleanHit.slug}`
        }

        return {
            ...cleanHit,
            url,
        }
    })

    return {
        query: state.query,
        results: cleanedHits,
        nbHits: result.nbHits,
        page: result.page,
        nbPages: result.nbPages,
        hitsPerPage: result.hitsPerPage,
    }
}
