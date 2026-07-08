import * as R from "remeda"
import {
    EntityName,
    LATEST_FEED_TYPE_VALUES,
    OwidGdocType,
    TagGraphRoot,
    SearchState,
    SearchChartHit,
    StackedArticleHit,
    TopicPageHit,
    FilterType,
    LatestType,
    ProfileHit,
    PageChronologicalRecord,
    DataInsightHit,
    FlatArticleHit,
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

async function searchSingleForHits<T>(
    liteSearchClient: LiteClient,
    searchParams: Parameters<LiteClient["searchForHits"]>[0]
) {
    const response = await liteSearchClient.searchForHits<T>(searchParams)
    return response.results[0]
}

/**
 * "Closest matches" fallback: when a query returns nothing, retry it with
 * Algolia's removeWordsIfNoResults=allOptional and show only the hits that
 * matched as many query words as the best hit did.
 *
 * - The fallback fires ONLY when the normal search comes back empty, so every
 *   search that works today is completely untouched (and pays no extra
 *   request).
 * - Algolia ranks relaxed hits by number of matched words first, so the best
 *   tier is a prefix of the hit list — we cut where match quality drops,
 *   instead of reporting hundreds of one-word matches ("182 results").
 * - If even the best hit shares only a single word with the query, that's not
 *   a "closest match", it's noise ("world cup" matching everything with
 *   "world") — keep the honest empty state.
 *
 * The returned response carries closestMatches=true so the UI can label the
 * section accordingly, and nbHits/nbPages describe the trimmed tier (the
 * result count and pagination stay truthful).
 */
type SingleSearchRequest = Record<string, unknown> & {
    query?: string
    page?: number
    offset?: number
}

type RankedHit = { _rankingInfo?: { words?: number } }

async function searchSingleForHitsWithClosestMatches<T>(
    liteSearchClient: LiteClient,
    searchParams: SingleSearchRequest[]
) {
    const primary = await searchSingleForHits<T>(
        liteSearchClient,
        searchParams as Parameters<LiteClient["searchForHits"]>[0]
    )
    const request = searchParams[0]
    const isFirstPage = !request.page && !request.offset
    const hasQuery = Boolean(request.query?.trim())
    if (primary.hits.length > 0 || !isFirstPage || !hasQuery) return primary

    const relaxedRequest: SingleSearchRequest = {
        ...request,
        removeWordsIfNoResults: "allOptional",
        getRankingInfo: true,
    }
    const relaxed = await searchSingleForHits<T>(liteSearchClient, [
        relaxedRequest,
    ] as Parameters<LiteClient["searchForHits"]>[0])

    const words = (hit: T) => (hit as RankedHit)._rankingInfo?.words ?? 0
    const topWords = relaxed.hits.length ? words(relaxed.hits[0]) : 0
    // A single shared word is usually noise ("world cup" matching everything
    // that mentions "world") — but a distinctive word is a real signal
    // ("malaria worldwide": "worldwide" matches nothing, yet the "malaria"
    // charts are exactly what the user wants). Distinctiveness proxy: how many
    // documents that one word matches — common words match hundreds.
    if (topWords === 0) return primary
    if (topWords === 1 && (relaxed.nbHits ?? 0) > 100) return primary

    // Algolia ranks relaxed hits by matched words, so the best tier is a
    // prefix. When the whole fetched page is one tier, the tier extends past
    // it — report the full count instead of the page length.
    const tier = relaxed.hits.filter((hit) => words(hit) === topWords)
    const tierExtendsPastPage = tier.length === relaxed.hits.length
    return {
        ...relaxed,
        hits: tier,
        nbHits: tierExtendsPastPage ? relaxed.nbHits : tier.length,
        nbPages: 1,
        page: 0,
        closestMatches: true,
    }
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
    latestPages: (topics: string[], latestType: LatestType | null) =>
        [
            PAGES_CHRONOLOGICAL_INDEX,
            "latest",
            topics.length > 0 ? topics.sort().join("~") : "all",
            latestType ?? "all",
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
) {
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

    const response =
        await liteSearchClient.searchForHits<SearchChartHit>(searchParams)
    return response.results.map((res, i) => ({
        title: dataTopics[i],
        charts: res,
    }))
}

export async function queryCharts(
    liteSearchClient: LiteClient,
    state: SearchState,
    page: number = 0
) {
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

    return searchSingleForHitsWithClosestMatches<SearchChartHit>(
        liteSearchClient,
        searchParams
    )
}

export async function queryDataInsights(
    liteSearchClient: LiteClient,
    state: SearchState,
    page: number = 0,
    hitsPerPage: number = 4
) {
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

    return searchSingleForHitsWithClosestMatches<DataInsightHit>(
        liteSearchClient,
        searchParams
    )
}

export async function queryArticles(
    liteSearchClient: LiteClient,
    state: SearchState,
    offset: number = 0,
    length: number
) {
    const selectedCountryNames = getFilterNamesOfType(
        state.filters,
        FilterType.COUNTRY
    )
    const hasCountry = selectedCountryNames.size > 0
    const selectedTopics = getFilterNamesOfType(state.filters, FilterType.TOPIC)
    const isFilterOnly = state.query.trim() === ""
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
                isFilterOnly ? "excerpt" : "content",
                "authors",
            ],
            highlightPreTag: "<mark>",
            highlightPostTag: "</mark>",
            offset,
            length,
        },
    ]

    return searchSingleForHitsWithClosestMatches<FlatArticleHit>(
        liteSearchClient,
        searchParams
    )
}

export async function queryTopicPages(
    liteSearchClient: LiteClient,
    state: SearchState,
    offset: number = 0,
    length: number
) {
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

    return searchSingleForHits<TopicPageHit>(liteSearchClient, searchParams)
}

export async function queryProfiles(
    liteSearchClient: LiteClient,
    state: SearchState,
    offset: number = 0,
    length: number
) {
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

    return searchSingleForHits<ProfileHit>(liteSearchClient, searchParams)
}

export interface LatestPagesResult {
    response: SearchResponse<PageChronologicalRecord>
    /** Tag facet counts filtered by the active type, disjunctive on topics.
     *  Used to determine which topic pills to disable. */
    tagFacetCounts: Record<string, number>
    /** latestType facet counts filtered by topics only (no type filter).
     *  Used to determine which type options in the "Filter by type"
     *  dropdown to disable. */
    latestTypeFacetCounts: Record<string, number>
}

// The gdoc-type guard that excludes topic pages and linear topic pages
// (indexed for the atom feed but hidden from /latest).
const LATEST_BASE_FILTER = LATEST_FEED_TYPE_VALUES.map((t) => `type:${t}`).join(
    " OR "
)

// Issues three searches in a single batched `liteSearchClient.searchForHits([...])`
// call (one network round-trip): the paginated card list plus per-axis facet
// counts used to disable filter options that would yield zero results. Each
// facet-count query drops its own axis so the returned counts reflect "what
// would happen if the user picked a different value here?" rather than being
// self-narrowed to the current selection.
//
// `facetFilters` uses Algolia's array-of-arrays form: outer array is AND,
// inner array is OR (cf. `formatDisjunctiveFacetFilters` in searchUtils.tsx).
export async function queryLatestPages(
    liteSearchClient: LiteClient,
    topics: string[],
    offset: number,
    length: number,
    latestType: LatestType | null = null
) {
    // Each axis lives in its own `facetFilters` group so queries can include
    // or omit it independently. Multiple topics are OR'd within their group.
    const topicFacetFilters =
        topics.length > 0
            ? formatDisjunctiveFacetFilters(new Set(topics), "tags")
            : []
    const latestTypeFacetFilter = latestType
        ? formatDisjunctiveFacetFilters(new Set([latestType]), "latestType")
        : []

    const searchParams = [
        // Query 1: paginated cards (apply both user filters)
        {
            indexName: PAGES_CHRONOLOGICAL_INDEX,
            query: "",
            filters: LATEST_BASE_FILTER,
            facetFilters: [...topicFacetFilters, ...latestTypeFacetFilter],
            offset,
            length,
        },
        // Query 2: latestType counts under topic selection (drop type
        // filter) — drives disabling of type options in the "Filter by
        // type" dropdown.
        {
            indexName: PAGES_CHRONOLOGICAL_INDEX,
            query: "",
            filters: LATEST_BASE_FILTER,
            facetFilters: topicFacetFilters,
            offset: 0,
            length: 0,
            facets: ["latestType"],
        },
        // Query 3: tag counts under type selection (drop topic filter) —
        // drives disabling of topic pills.
        {
            indexName: PAGES_CHRONOLOGICAL_INDEX,
            query: "",
            filters: LATEST_BASE_FILTER,
            facetFilters: latestTypeFacetFilter,
            offset: 0,
            length: 0,
            facets: ["tags"],
        },
    ]

    const response =
        await liteSearchClient.searchForHits<PageChronologicalRecord>(
            searchParams
        )
    const [mainResult, typeResult, topicResult] = response.results
    return {
        response: mainResult,
        tagFacetCounts: topicResult.facets?.tags ?? {},
        latestTypeFacetCounts: typeResult.facets?.latestType ?? {},
    }
}

export async function queryWritingTopics(
    liteSearchClient: LiteClient,
    tagGraph: TagGraphRoot,
    selectedTopic: string | undefined
) {
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
                    "excerpt",
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

    const response = await liteSearchClient.searchForHits<
        StackedArticleHit | TopicPageHit
    >(searchParams)
    // Process results in pairs (articles, then topic pages for each topic).
    return writingTopics.map((topic, i) => {
        const articles = response.results[
            i * 2
        ] as SearchResponse<StackedArticleHit>
        const topicPages = response.results[
            i * 2 + 1
        ] as SearchResponse<TopicPageHit>

        return {
            title: topic,
            articles,
            topicPages,
            totalCount: (articles.nbHits ?? 0) + (topicPages.nbHits ?? 0),
        }
    })
}
