import { OwidGdocType, TagGraphRoot } from "@ourworldindata/types"
import { flattenNonTopicNodes } from "@ourworldindata/utils"
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
    getSelectableTopics,
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
    topicTagGraph: ["topicTagGraph"] as const,
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
    tagGraph: TagGraphRoot,
    selectedTopic: string | undefined
): Promise<DataCatalogRibbonResult[]> {
    const topicsForRibbons = getSelectableTopics(tagGraph, selectedTopic)

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
            ...(res as DataCatalogSearchResult),
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
        .then((response) => response.results[0] as DataCatalogSearchResult)
}

export async function queryDataInsights(
    searchClient: SearchClient,
    state: SearchState
): Promise<SearchResponse<any>> {
    const searchParams = [
        {
            indexName: SearchIndexName.Pages,
            query: state.query,
            filters: `type:${OwidGdocType.DataInsight}`,
            highlightPostTag: "</mark>",
            highlightPreTag: "<mark>",
            attributesToRetrieve: [
                "title",
                "thumbnailUrl",
                "date",
                "slug",
                "type",
            ],
            hitsPerPage: 4,
            page: state.page < 0 ? 0 : state.page,
        },
    ]

    return searchClient
        .search(searchParams)
        .then((response) => response.results[0] as SearchResponse<any>)
}

export async function queryTopicTagGraph(): Promise<TagGraphRoot> {
    const data = await fetch("/topicTagGraph.json").then((res) => res.json())
    return flattenNonTopicNodes(data)
}
