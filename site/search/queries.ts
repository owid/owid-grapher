import { OwidGdocType, TagGraphRoot } from "@ourworldindata/types"
import { flattenNonTopicNodes } from "@ourworldindata/utils"
import { SearchClient } from "algoliasearch"
import {
    SearchState,
    DataCatalogSearchResult,
    IDataCatalogHit,
    DataCatalogRibbonResult,
    DataInsightSearchResponse,
    ArticleSearchResponse,
    TopicPageSearchResponse,
    FilterType,
    SearchParamsConfig,
    SearchIndexName,
} from "./searchTypes.js"
import {
    getFilterNamesOfType,
    formatCountryFacetFilters,
    setToFacetFilters,
    getSelectableTopics,
    createSearchParamsFromConfig,
    CHARTS_INDEX,
    DATA_CATALOG_ATTRIBUTES,
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
    articles: (state: SearchState) =>
        [...searchQueryKeys.writing, "articles", state] as const,
    topicPages: (state: SearchState) =>
        [...searchQueryKeys.writing, "topic-pages", state] as const,
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
            hitsPerPage: 10,
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
): Promise<DataInsightSearchResponse> {
    const selectedCountryNames = getFilterNamesOfType(
        state.filters,
        FilterType.COUNTRY
    )
    // Using the selected countries as query search terms until data insights
    // are tagged with countries
    const query = [state.query, ...selectedCountryNames]
        .filter(Boolean)
        .join(" ")
    const searchParams = [
        {
            indexName: SearchIndexName.Pages,
            query,
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
        .then((response) => response.results[0] as DataInsightSearchResponse)
}

export async function queryArticles(
    searchClient: SearchClient,
    state: SearchState,
    searchParamsConfig: SearchParamsConfig
): Promise<ArticleSearchResponse> {
    const searchParams = [
        {
            indexName: SearchIndexName.Pages,
            filters: `type:${OwidGdocType.Article} OR type:${OwidGdocType.AboutPage}`,
            highlightPostTag: "</mark>",
            highlightPreTag: "<mark>",
            attributesToRetrieve: [
                "title",
                "thumbnailUrl",
                "date",
                "slug",
                "type",
                "content",
                "authors",
            ],
            hitsPerPage: 5,
            page: state.page < 0 ? 0 : state.page,
            ...createSearchParamsFromConfig(searchParamsConfig, state),
        },
    ]

    return searchClient
        .search(searchParams)
        .then((response) => response.results[0] as ArticleSearchResponse)
}

export async function queryTopicPages(
    searchClient: SearchClient,
    state: SearchState,
    searchParamsConfig: SearchParamsConfig
): Promise<TopicPageSearchResponse> {
    const searchParams = [
        {
            indexName: SearchIndexName.Pages,
            filters: `type:${OwidGdocType.TopicPage} OR type:${OwidGdocType.LinearTopicPage}`,
            highlightPostTag: "</mark>",
            highlightPreTag: "<mark>",
            attributesToRetrieve: ["title", "type", "slug", "excerpt"],
            hitsPerPage: 5,
            page: state.page < 0 ? 0 : state.page,
            ...createSearchParamsFromConfig(searchParamsConfig, state),
        },
    ]

    return searchClient
        .search(searchParams)
        .then((response) => response.results[0] as TopicPageSearchResponse)
}

export async function queryTopicTagGraph(): Promise<TagGraphRoot> {
    const data = await fetch("/topicTagGraph.json").then((res) => res.json())
    return flattenNonTopicNodes(data)
}
