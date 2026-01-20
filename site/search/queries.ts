import * as R from "remeda"
import {
    EntityName,
    OwidGdocType,
    TagGraphRoot,
    SearchState,
    SearchChartsResponse,
    SearchChartHit,
    SearchDataTopicsResponse,
    SearchDataInsightResponse,
    SearchStackedArticleResponse,
    SearchTopicPageResponse,
    SearchWritingTopicsResponse,
    StackedArticleHit,
    TopicPageHit,
    FilterType,
    SearchIndexName,
    SearchFlatArticleResponse,
} from "@ourworldindata/types"
import { type LiteClient } from "algoliasearch/lite"
import {
    getFilterNamesOfType,
    formatCountryFacetFilters,
    getSelectableTopics,
    CHARTS_INDEX,
    DATA_CATALOG_ATTRIBUTES,
    formatTopicFacetFilters,
    formatDatasetFacetFilters,
    formatDatasetNamespaceFacetFilters,
    formatDatasetVersionFacetFilters,
} from "./searchUtils.js"
import { RichDataComponentVariant } from "./SearchChartHitRichDataTypes.js"

function makeStateForKey(state: SearchState) {
    return R.pick(state, ["query", "filters", "requireAllCountries"])
}

/**
 * Query Key factory for search
 * Provides hierarchical query keys for better cache management and invalidation
 */
export const searchQueryKeys = {
    topicTagGraph: ["topicTagGraph"] as const,
    charts: (state: SearchState) =>
        [
            SearchIndexName.ExplorerViewsMdimViewsAndCharts,
            "charts",
            makeStateForKey(state),
        ] as const,
    dataTopics: (state: SearchState) =>
        [
            SearchIndexName.ExplorerViewsMdimViewsAndCharts,
            "topics",
            makeStateForKey(state),
        ] as const,
    dataInsights: (state: SearchState) =>
        [
            SearchIndexName.Pages,
            "data-insights",
            makeStateForKey(state),
        ] as const,
    articles: (state: SearchState) =>
        [SearchIndexName.Pages, "articles", makeStateForKey(state)] as const,
    topicPages: (state: SearchState) =>
        [SearchIndexName.Pages, "topic-pages", makeStateForKey(state)] as const,
    writingTopics: (state: SearchState) =>
        [SearchIndexName.Pages, "topics", makeStateForKey(state)] as const,
} as const

export const chartHitQueryKeys = {
    chartInfo: (slug: string, entities: string[], queryParams?: string) =>
        ["chart-info", slug, entities, queryParams] as const,
    searchResultData: (
        slug: string,
        queryParams: string | undefined,
        version: number,
        variant: RichDataComponentVariant,
        entities: EntityName[] | undefined,
        numDataTableRowsPerColumn: number
    ) =>
        [
            "chart-hit-data",
            slug,
            queryParams,
            version,
            variant,
            entities,
            numDataTableRowsPerColumn,
        ] as const,
} as const

export async function queryDataTopics(
    liteSearchClient: LiteClient,
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
        const topicFacetFilters = formatTopicFacetFilters(new Set([topic]))
        const facetFilters = [...countryFacetFilters, ...topicFacetFilters]
        return {
            indexName: CHARTS_INDEX,
            attributesToRetrieve: DATA_CATALOG_ATTRIBUTES,
            query: state.query,
            facetFilters: facetFilters,
            highlightPreTag: "<mark>",
            highlightPostTag: "</mark>",
            hitsPerPage: 4,
        }
    })

    return liteSearchClient
        .search<SearchChartHit>(searchParams)
        .then((response) =>
            response.results.map((res, i: number) => ({
                title: dataTopics[i],
                charts: res as SearchChartsResponse,
            }))
        )
}

export async function queryCharts(
    liteSearchClient: LiteClient,
    state: SearchState,
    page: number = 0
): Promise<SearchChartsResponse> {
    const countryFacetFilters = formatCountryFacetFilters(
        getFilterNamesOfType(state.filters, FilterType.COUNTRY),
        state.requireAllCountries
    )
    const topicFacetFilters = formatTopicFacetFilters(
        getFilterNamesOfType(state.filters, FilterType.TOPIC)
    )
    const datasetFacetFilters = formatDatasetFacetFilters(
        getFilterNamesOfType(state.filters, FilterType.DATASET_PRODUCT)
    )
    const namespaceFacetFilters = formatDatasetNamespaceFacetFilters(
        getFilterNamesOfType(state.filters, FilterType.DATASET_NAMESPACE)
    )
    const versionFacetFilters = formatDatasetVersionFacetFilters(
        getFilterNamesOfType(state.filters, FilterType.DATASET_VERSION)
    )
    const facetFilters = [
        ...countryFacetFilters,
        ...topicFacetFilters,
        ...datasetFacetFilters,
        ...namespaceFacetFilters,
        ...versionFacetFilters,
    ]

    const searchParams = [
        {
            indexName: CHARTS_INDEX,
            attributesToRetrieve: DATA_CATALOG_ATTRIBUTES,
            query: state.query,
            facetFilters: facetFilters,
            highlightPreTag: "<mark>",
            highlightPostTag: "</mark>",
            hitsPerPage: 9,
            page,
        },
    ]

    return liteSearchClient
        .search<SearchChartHit>(searchParams)
        .then((response) => response.results[0] as SearchChartsResponse)
}

export async function queryDataInsights(
    liteSearchClient: LiteClient,
    state: SearchState,
    page: number = 0,
    hitsPerPage: number = 4
): Promise<SearchDataInsightResponse> {
    const selectedCountryNames = getFilterNamesOfType(
        state.filters,
        FilterType.COUNTRY
    )
    const hasCountry = selectedCountryNames.size > 0
    const selectedTopics = getFilterNamesOfType(state.filters, FilterType.TOPIC)
    // Using the selected countries as query search terms until data insights
    // are tagged with countries.
    const query = [
        state.query,
        // Use advanced syntax to search for countries as exact phrases
        ...Array.from(selectedCountryNames).map((c) => `"${c}"`),
    ]
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
                restrictSearchableAttributes: ["title", "tags", "authors"],
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
            hitsPerPage,
            page,
        },
    ]

    return liteSearchClient
        .search(searchParams)
        .then((response) => response.results[0] as SearchDataInsightResponse)
}

export async function queryArticles(
    liteSearchClient: LiteClient,
    state: SearchState,
    offset: number = 0,
    length: number
): Promise<SearchFlatArticleResponse> {
    const selectedCountryNames = getFilterNamesOfType(
        state.filters,
        FilterType.COUNTRY
    )
    const hasCountry = selectedCountryNames.size > 0
    const selectedTopics = getFilterNamesOfType(state.filters, FilterType.TOPIC)
    // Using the selected countries as query search terms until articles
    // are tagged with countries.
    const query = [
        state.query,
        // Use advanced syntax to search for countries as exact phrases
        ...Array.from(selectedCountryNames).map((c) => `"${c}"`),
    ]
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
                restrictSearchableAttributes: ["title", "tags", "authors"],
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
            offset,
            length,
        },
    ]

    return liteSearchClient
        .search(searchParams)
        .then((response) => response.results[0] as SearchFlatArticleResponse)
}

export async function queryTopicPages(
    liteSearchClient: LiteClient,
    state: SearchState,
    offset: number = 0,
    length: number
): Promise<SearchTopicPageResponse> {
    const selectedTopics = getFilterNamesOfType(state.filters, FilterType.TOPIC)

    const searchParams = [
        {
            indexName: SearchIndexName.Pages,
            query: state.query,
            filters: `type:${OwidGdocType.TopicPage} OR type:${OwidGdocType.LinearTopicPage}`,
            facetFilters: formatTopicFacetFilters(selectedTopics),
            attributesToRetrieve: [
                "title",
                "type",
                "slug",
                "excerpt",
                "excerptLong",
            ],
            highlightPreTag: "<mark>",
            highlightPostTag: "</mark>",
            offset,
            length,
        },
    ]

    return liteSearchClient
        .search(searchParams)
        .then((response) => response.results[0] as SearchTopicPageResponse)
}

export async function queryWritingTopics(
    liteSearchClient: LiteClient,
    tagGraph: TagGraphRoot,
    selectedTopic: string | undefined
): Promise<SearchWritingTopicsResponse[]> {
    const writingTopics = [...getSelectableTopics(tagGraph, selectedTopic)]

    // Create search parameters for both articles and topic pages for each topic
    const searchParams = writingTopics.flatMap((topic) => {
        const topicFacetFilters = formatTopicFacetFilters(new Set([topic]))

        return [
            {
                indexName: SearchIndexName.Pages,
                attributesToRetrieve: [
                    "title",
                    "slug",
                    "thumbnailUrl",
                    "content",
                    "type",
                ],
                filters: `type:${OwidGdocType.Article} OR type:${OwidGdocType.AboutPage}`,
                facetFilters: topicFacetFilters,
                highlightPreTag: "<mark>",
                highlightPostTag: "</mark>",
                hitsPerPage: 3,
            },
            {
                indexName: SearchIndexName.Pages,
                attributesToRetrieve: ["title", "slug", "type"],
                filters: `type:${OwidGdocType.TopicPage} OR type:${OwidGdocType.LinearTopicPage}`,
                facetFilters: topicFacetFilters,
                highlightPreTag: "<mark>",
                highlightPostTag: "</mark>",
                hitsPerPage: 8,
            },
        ]
    })

    return liteSearchClient
        .search<StackedArticleHit | TopicPageHit>(searchParams)
        .then((response) => {
            // Process results in pairs (articles, then topic pages for each topic)
            return writingTopics.map((topic, i) => {
                const articlesResult = response.results[
                    i * 2
                ] as SearchStackedArticleResponse
                const topicPagesResult = response.results[
                    i * 2 + 1
                ] as SearchTopicPageResponse

                const totalCount =
                    (articlesResult.nbHits ?? 0) +
                    (topicPagesResult.nbHits ?? 0)

                return {
                    title: topic,
                    articles: articlesResult,
                    topicPages: topicPagesResult,
                    totalCount,
                }
            })
        })
}
