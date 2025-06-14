import { TagGraphRoot } from "@ourworldindata/types"
import { SearchClient } from "algoliasearch"
import { SearchResponse } from "instantsearch.js"
import {
    DataCatalogRibbonResult,
    DataCatalogSearchResult,
    FilterType,
    IDataCatalogHit,
    SearchIndexName,
    SearchState,
} from "./searchTypes.js"
import {
    getTopicsForRibbons,
    getFilterNamesOfType,
    formatCountryFacetFilters,
    CHARTS_INDEX,
    DATA_CATALOG_ATTRIBUTES,
    setToFacetFilters,
} from "./searchUtils.js"

/**
 * Query Key factory for search
 * Provides hierarchical query keys for better cache management and invalidation
 */
export const searchQueryKeys = {
    // Base key for all data catalog queries
    data: [SearchIndexName.ExplorerViewsMdimViewsAndCharts] as const,
    dataSearches: (state: SearchState) =>
        [...searchQueryKeys.data, "searches", state] as const,
    dataRibbons: (state: SearchState) =>
        [...searchQueryKeys.data, "ribbons", state] as const,
    writing: [SearchIndexName.Pages] as const,
    dataInsights: (state: SearchState) =>
        [...searchQueryKeys.writing, "data-insights", state] as const,
} as const

export async function queryDataCatalogRibbons(
    searchClient: SearchClient,
    state: SearchState,
    tagGraph: TagGraphRoot
): Promise<DataCatalogRibbonResult[]> {
    const topicsForRibbons = getTopicsForRibbons(
        getFilterNamesOfType(state.filters, FilterType.TOPIC),
        tagGraph
    )

    const countryFacetFilters = formatCountryFacetFilters(
        getFilterNamesOfType(state.filters, FilterType.COUNTRY),
        state.requireAllCountries
    )
    const searchParams = topicsForRibbons.map((topic) => {
        const facetFilters = [[`tags:${topic}`], ...countryFacetFilters]
        return {
            indexName: CHARTS_INDEX,
            attributesToRetrieve: DATA_CATALOG_ATTRIBUTES,
            query: state.query,
            facetFilters: facetFilters,
            hitsPerPage: 4,
            facets: ["tags"],
            page: state.page < 0 ? 0 : state.page,
        }
    })

    return searchClient.search<IDataCatalogHit>(searchParams).then((response) =>
        response.results.map((res, i: number) => ({
            ...(res as SearchResponse<IDataCatalogHit>),
            title: topicsForRibbons[i],
        }))
    )
}

export async function queryDataCatalogSearch(
    searchClient: SearchClient,
    state: SearchState
): Promise<DataCatalogSearchResult> {
    const facetFilters = formatCountryFacetFilters(
        getFilterNamesOfType(state.filters, FilterType.COUNTRY),
        state.requireAllCountries
    )
    facetFilters.push(
        ...setToFacetFilters(
            getFilterNamesOfType(state.filters, FilterType.TOPIC),
            "tags"
        )
    )

    const searchParams = [
        {
            indexName: CHARTS_INDEX,
            attributesToRetrieve: DATA_CATALOG_ATTRIBUTES,
            query: state.query,
            facetFilters: facetFilters,
            highlightPostTag: "</mark>",
            highlightPreTag: "<mark>",
            facets: ["tags"],
            maxValuesPerFacet: 15,
            hitsPerPage: 60,
            page: state.page < 0 ? 0 : state.page,
        },
    ]

    return searchClient
        .search<IDataCatalogHit>(searchParams)
        .then(
            (response) => response.results[0] as SearchResponse<IDataCatalogHit>
        )
}

export async function queryDataInsights(
    searchClient: SearchClient,
    state: SearchState
): Promise<SearchResponse<any>> {
    const searchParams = [
        {
            indexName: SearchIndexName.Pages,
            query: state.query,
            facetFilters: [["type:data-insight"]],
            highlightPostTag: "</mark>",
            highlightPreTag: "<mark>",
            attributesToRetrieve: [
                "objectID",
                "title",
                "excerpt",
                "authors",
                "publishedAt",
                "modifiedAt",
                "slug",
                "tags",
                "type",
            ],
            hitsPerPage: 20,
            page: state.page < 0 ? 0 : state.page,
        },
    ]

    return searchClient
        .search(searchParams)
        .then((response) => response.results[0] as SearchResponse<any>)
}
