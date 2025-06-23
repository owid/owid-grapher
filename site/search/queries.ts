import { OwidGdocType, TagGraphRoot } from "@ourworldindata/types"
import { flattenNonTopicNodes } from "@ourworldindata/utils"
import { SearchClient } from "algoliasearch"
import {
    SearchState,
    SearchChartsResponse,
    SearchChartHit,
    SearchDataTopicsResponse,
    SearchDataInsightResponse,
    SearchArticleResponse,
    SearchTopicPageResponse,
    FilterType,
    SearchIndexName,
} from "./searchTypes.js"
import {
    getFilterNamesOfType,
    formatCountryFacetFilters,
    setToFacetFilters,
    getSelectableTopics,
    CHARTS_INDEX,
    DATA_CATALOG_ATTRIBUTES,
    formatTopicFacetFilters,
} from "./searchUtils.js"

/**
 * Query Key factory for search
 * Provides hierarchical query keys for better cache management and invalidation
 */
export const searchQueryKeys = {
    topicTagGraph: ["topicTagGraph"] as const,
    // Base key for all data catalog queries
    data: [SearchIndexName.ExplorerViewsMdimViewsAndCharts] as const,
    charts: (state: SearchState) =>
        [...searchQueryKeys.data, "charts", state] as const,
    topics: (state: SearchState) =>
        [...searchQueryKeys.data, "topics", state] as const,
    writing: [SearchIndexName.Pages] as const,
    dataInsights: (state: SearchState) =>
        [...searchQueryKeys.writing, "data-insights", state] as const,
    articles: (state: SearchState) =>
        [...searchQueryKeys.writing, "articles", state] as const,
    topicPages: (state: SearchState) =>
        [...searchQueryKeys.writing, "topic-pages", state] as const,
} as const

export async function queryDataTopics(
    searchClient: SearchClient,
    state: SearchState,
    tagGraph: TagGraphRoot,
    selectedTopic: string | undefined
): Promise<SearchDataTopicsResponse[]> {
    const dataTopics = [...getSelectableTopics(tagGraph, selectedTopic)]

    const countryFacetFilters = formatCountryFacetFilters(
        getFilterNamesOfType(state.filters, FilterType.COUNTRY),
        state.requireAllCountries
    )
    const searchParams = dataTopics.map((topic) => {
        const facetFilters = [[`tags:${topic}`], ...countryFacetFilters]
        return {
            indexName: CHARTS_INDEX,
            attributesToRetrieve: DATA_CATALOG_ATTRIBUTES,
            query: state.query,
            facetFilters: facetFilters,
            highlightPreTag: "<mark>",
            highlightPostTag: "</mark>",
            hitsPerPage: 4,
            page: state.page < 0 ? 0 : state.page,
        }
    })

    return searchClient.search<SearchChartHit>(searchParams).then((response) =>
        response.results.map((res, i: number) => ({
            ...(res as SearchChartsResponse),
            title: dataTopics[i],
        }))
    )
}

export async function queryCharts(
    searchClient: SearchClient,
    state: SearchState
): Promise<SearchChartsResponse> {
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
            highlightPreTag: "<mark>",
            highlightPostTag: "</mark>",
            hitsPerPage: 8,
            page: state.page < 0 ? 0 : state.page,
        },
    ]

    return searchClient
        .search<SearchChartHit>(searchParams)
        .then((response) => response.results[0] as SearchChartsResponse)
}

export async function queryDataInsights(
    searchClient: SearchClient,
    state: SearchState
): Promise<SearchDataInsightResponse> {
    const selectedCountryNames = getFilterNamesOfType(
        state.filters,
        FilterType.COUNTRY
    )
    const hasCountry = selectedCountryNames.size > 0
    const selectedTopics = getFilterNamesOfType(state.filters, FilterType.TOPIC)
    // Using the selected countries as query search terms until data insights
    // are tagged with countries.
    const query = [state.query, ...selectedCountryNames]
        .filter(Boolean)
        .join(" ")

    const searchParams = [
        {
            indexName: SearchIndexName.Pages,
            query,
            filters: `type:${OwidGdocType.DataInsight}`,
            facetFilters: formatTopicFacetFilters(selectedTopics),
            // Do not search through the content of data insights in case there
            // is a country filter present. This is to avoid returning data
            // insights that might mention a country, but are not *about* that
            // country (e.g. "Unlike Germany...").
            ...(hasCountry && {
                // a subset of searchableAttributes on the Pages index
                restrictSearchableAttributes: [
                    "title",
                    "excerpt",
                    "tags",
                    "authors",
                ],
            }),
            attributesToRetrieve: [
                "title",
                "thumbnailUrl",
                "date",
                "slug",
                "type",
            ],
            highlightPreTag: "<mark>",
            highlightPostTag: "</mark>",
            hitsPerPage: 4,
            page: state.page < 0 ? 0 : state.page,
        },
    ]

    return searchClient
        .search(searchParams)
        .then((response) => response.results[0] as SearchDataInsightResponse)
}

export async function queryArticles(
    searchClient: SearchClient,
    state: SearchState
): Promise<SearchArticleResponse> {
    const selectedCountryNames = getFilterNamesOfType(
        state.filters,
        FilterType.COUNTRY
    )
    const hasCountry = selectedCountryNames.size > 0
    const selectedTopics = getFilterNamesOfType(state.filters, FilterType.TOPIC)
    // Using the selected countries as query search terms until articles
    // are tagged with countries.
    const query = [state.query, ...selectedCountryNames]
        .filter(Boolean)
        .join(" ")

    const searchParams = [
        {
            indexName: SearchIndexName.Pages,
            query,
            filters: `type:${OwidGdocType.Article} OR type:${OwidGdocType.AboutPage}`,
            facetFilters: formatTopicFacetFilters(selectedTopics),
            // Do not search through the content of articles in case there is a
            // country filter present. This is to avoid returning articles that
            // might mention a country, but are not *about* that country (e.g.
            // "Unlike Germany...").
            ...(hasCountry && {
                // a subset of searchableAttributes on the Pages index
                restrictSearchableAttributes: [
                    "title",
                    "excerpt",
                    "tags",
                    "authors",
                ],
            }),
            attributesToRetrieve: [
                "title",
                "thumbnailUrl",
                "date",
                "slug",
                "type",
                "content",
                "authors",
            ],
            highlightPreTag: "<mark>",
            highlightPostTag: "</mark>",
            hitsPerPage: 5,
            page: state.page < 0 ? 0 : state.page,
        },
    ]

    return searchClient
        .search(searchParams)
        .then((response) => response.results[0] as SearchArticleResponse)
}

export async function queryTopicPages(
    searchClient: SearchClient,
    state: SearchState
): Promise<SearchTopicPageResponse> {
    const selectedTopics = getFilterNamesOfType(state.filters, FilterType.TOPIC)

    const searchParams = [
        {
            indexName: SearchIndexName.Pages,
            query: state.query,
            filters: `type:${OwidGdocType.TopicPage} OR type:${OwidGdocType.LinearTopicPage}`,
            facetFilters: formatTopicFacetFilters(selectedTopics),
            attributesToRetrieve: ["title", "type", "slug", "excerpt"],
            hitsPerPage: 5,
            highlightPreTag: "<mark>",
            highlightPostTag: "</mark>",
            page: state.page < 0 ? 0 : state.page,
        },
    ]

    return searchClient
        .search(searchParams)
        .then((response) => response.results[0] as SearchTopicPageResponse)
}

export async function queryTopicTagGraph(): Promise<TagGraphRoot> {
    const data = await fetch("/topicTagGraph.json").then((res) => res.json())
    return flattenNonTopicNodes(data)
}
