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
    SearchFlatArticleResponse,
    SearchProfileResponse,
    ProfileHit,
    PageChronologicalRecord,
} from "@ourworldindata/types"
import { type SearchResponse } from "algoliasearch"
import { type LiteClient } from "algoliasearch/lite"
import {
    getFilterNamesOfType,
    formatCountryFacetFilters,
    formatTopicFacetFilters,
    formatFeaturedMetricFacetFilter,
    getSelectableTopics,
    CHARTS_INDEX,
    PAGES_INDEX,
    PAGES_CHRONOLOGICAL_INDEX,
    DATA_CATALOG_ATTRIBUTES,
    formatDisjunctiveFacetFilters,
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
        [CHARTS_INDEX, "charts", makeStateForKey(state)] as const,
    dataTopics: (state: SearchState) =>
        [CHARTS_INDEX, "topics", makeStateForKey(state)] as const,
    dataInsights: (state: SearchState) =>
        [PAGES_INDEX, "data-insights", makeStateForKey(state)] as const,
    articles: (state: SearchState) =>
        [PAGES_INDEX, "articles", makeStateForKey(state)] as const,
    topicPages: (state: SearchState) =>
        [PAGES_INDEX, "topic-pages", makeStateForKey(state)] as const,
    writingTopics: (state: SearchState) =>
        [PAGES_INDEX, "topics", makeStateForKey(state)] as const,
    profiles: (state: SearchState) =>
        [PAGES_INDEX, "profiles", makeStateForKey(state)] as const,
} as const

export const latestPagesQueryKey = {
    latestPages: (
        topics: string[],
        contentType: string | null,
        kicker: string | null
    ) =>
        [
            PAGES_CHRONOLOGICAL_INDEX,
            "latest",
            topics.length > 0 ? topics.sort().join(",") : "all",
            contentType ?? "all",
            kicker ?? "all",
        ] as const,
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
    const datasetProductFacetFilters = formatDisjunctiveFacetFilters(
        getFilterNamesOfType(state.filters, FilterType.DATASET_PRODUCT),
        "datasetProducts"
    )
    const datasetNamespaceFacetFilters = formatDisjunctiveFacetFilters(
        getFilterNamesOfType(state.filters, FilterType.DATASET_NAMESPACE),
        "datasetNamespaces"
    )
    const datasetVersionFacetFilters = formatDisjunctiveFacetFilters(
        getFilterNamesOfType(state.filters, FilterType.DATASET_VERSION),
        "datasetVersions"
    )
    const datasetProducerFacetFilters = formatDisjunctiveFacetFilters(
        getFilterNamesOfType(state.filters, FilterType.DATASET_PRODUCER),
        "datasetProducers"
    )
    const fmFacetFilter = formatFeaturedMetricFacetFilter(state.query)
    const facetFilters = [
        ...countryFacetFilters,
        ...topicFacetFilters,
        ...datasetProductFacetFilters,
        ...datasetNamespaceFacetFilters,
        ...datasetVersionFacetFilters,
        ...datasetProducerFacetFilters,
        ...fmFacetFilter,
    ]

    const searchParams = [
        {
            indexName: CHARTS_INDEX,
            attributesToRetrieve: DATA_CATALOG_ATTRIBUTES,
            query: state.query,
            facetFilters,
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
        ...selectedCountryNames.keys().map((c) => `"${c}"`),
    ]
        .filter(Boolean)
        .join(" ")

    const searchParams = [
        {
            indexName: PAGES_INDEX,
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
        ...selectedCountryNames.keys().map((c) => `"${c}"`),
    ]
        .filter(Boolean)
        .join(" ")

    const searchParams = [
        {
            indexName: PAGES_INDEX,
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
            indexName: PAGES_INDEX,
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

export async function queryProfiles(
    liteSearchClient: LiteClient,
    state: SearchState,
    offset: number = 0,
    length: number
): Promise<SearchProfileResponse> {
    const selectedCountryNames = getFilterNamesOfType(
        state.filters,
        FilterType.COUNTRY
    )
    const selectedTopics = getFilterNamesOfType(state.filters, FilterType.TOPIC)

    const facetFilters = [
        ...formatCountryFacetFilters(
            selectedCountryNames,
            state.requireAllCountries
        ),
        ...formatTopicFacetFilters(selectedTopics),
    ]

    const searchParams = [
        {
            indexName: PAGES_INDEX,
            query: state.query,
            filters: `type:${OwidGdocType.Profile}`,
            facetFilters,
            attributesToRetrieve: [
                "title",
                "thumbnailUrl",
                "slug",
                "excerpt",
                "type",
                "availableEntities",
            ],
            highlightPreTag: "<mark>",
            highlightPostTag: "</mark>",
            offset,
            length,
        },
    ]

    return liteSearchClient
        .search<ProfileHit>(searchParams)
        .then((response) => response.results[0] as SearchProfileResponse)
}

export interface LatestPagesResult {
    response: SearchResponse<PageChronologicalRecord>
    /** Tag facet counts filtered by the active type/kicker, disjunctive on topics.
     *  Used to determine which topics to show/disable in the dropdown. */
    tagFacetCounts: Record<string, number>
    /** Type facet counts filtered by topics only (no type/kicker filter).
     *  Used to determine which type pills to disable. */
    typeFacetCounts: Record<string, number>
    /** Kicker facet counts filtered by topics only (no type/kicker filter).
     *  Used to determine which kicker pills to disable. */
    kickerFacetCounts: Record<string, number>
}

export async function queryLatestPages(
    liteSearchClient: LiteClient,
    topics: string[],
    offset: number,
    length: number,
    contentType: string | null = null,
    kicker: string | null = null
): Promise<LatestPagesResult> {
    // Multiple topics are OR'd within a single facetFilter group
    const topicFacetFilters: string[][] =
        topics.length > 0 ? [topics.map((t) => "tags:" + t)] : []

    let filters: string
    if (kicker) {
        filters = `type:${OwidGdocType.Announcement} AND kicker:"${kicker}"`
    } else if (contentType) {
        filters = `type:${contentType}`
    } else {
        filters = `type:${OwidGdocType.Article} OR type:${OwidGdocType.DataInsight} OR type:${OwidGdocType.Announcement}`
    }

    const baseFilter = `type:${OwidGdocType.Article} OR type:${OwidGdocType.DataInsight} OR type:${OwidGdocType.Announcement}`

    const searchParams = [
        // Query 1: paginated results (filtered by the active pill and
        // selected topics)
        {
            indexName: PAGES_CHRONOLOGICAL_INDEX,
            query: "",
            filters,
            facetFilters: topicFacetFilters,
            offset,
            length,
            facets: ["tags"],
        },
        // Query 2: type/kicker facet counts filtered by topics only (no
        // type/kicker filter) for pill disabling. Pills are mutually exclusive,
        // so the active pill should not affect which other pills are enabled.
        {
            indexName: PAGES_CHRONOLOGICAL_INDEX,
            query: "",
            filters: baseFilter,
            facetFilters: topicFacetFilters,
            offset: 0,
            length: 0,
            facets: ["type", "kicker"],
        },
        // Query 3: tag facet counts filtered by the active pill only (no
        // topic filter) for topic disabling. Topics are disjunctive (OR),
        // so selected topics should not affect which other topics are enabled.
        {
            indexName: PAGES_CHRONOLOGICAL_INDEX,
            query: "",
            filters,
            offset: 0,
            length: 0,
            facets: ["tags"],
        },
    ]

    return liteSearchClient
        .search<PageChronologicalRecord>(searchParams)
        .then((response) => {
            const mainResult = response
                .results[0] as SearchResponse<PageChronologicalRecord>
            const pillResult = response
                .results[1] as SearchResponse<PageChronologicalRecord>
            const topicResult = response
                .results[2] as SearchResponse<PageChronologicalRecord>
            return {
                response: mainResult,
                tagFacetCounts: topicResult.facets?.tags ?? {},
                typeFacetCounts: pillResult.facets?.type ?? {},
                kickerFacetCounts: pillResult.facets?.kicker ?? {},
            }
        })
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
                indexName: PAGES_INDEX,
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
                indexName: PAGES_INDEX,
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
