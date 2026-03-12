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
    DataInsightHit,
    SearchStackedArticleResponse,
    SearchTopicPageResponse,
    SearchWritingTopicsResponse,
    StackedArticleHit,
    TopicPageHit,
    FilterType,
    SearchFlatArticleResponse,
    FlatArticleHit,
    SearchProfileResponse,
    ProfileHit,
} from "@ourworldindata/types"
import {
    getFilterNamesOfType,
    getSelectableTopics,
    CHARTS_INDEX,
    PAGES_INDEX,
    formatTopicFacetFiltersTypesense,
    formatCountryFacetFiltersTypesense,
    formatFeaturedMetricFilterTypesense,
    formatIncomeGroupFMFilterTypesense,
    HYBRID_SEARCH_ALPHA,
} from "./searchUtils.js"
import { RichDataComponentVariant } from "./SearchChartHitRichDataTypes.js"
import { ChartDocument, PageDocument } from "./typesenseCollections.js"
import { Client } from "typesense"
import {
    SearchResponse as TypesenseSearchResponse,
    SearchResponseHit,
} from "typesense/lib/Typesense/Documents.js"
import { SearchResponse as AlgoliaSearchResponse } from "instantsearch.js"

function makeStateForKey(state: SearchState) {
    return R.pick(state, ["query", "filters", "requireAllCountries"])
}

/**
 * Maps a Typesense search response to the Algolia SearchResponse shape
 * that consuming components expect.
 *
 * Handles both regular and grouped responses (when using `group_by`).
 * Grouped responses return results under `grouped_hits` instead of `hits`.
 */
function mapTypesenseResponse<
    TDoc extends { id?: string; slug?: string },
    THit,
>(
    response: TypesenseSearchResponse<TDoc>,
    query: string,
    page: number,
    perPage: number
): AlgoliaSearchResponse<THit> {
    // When group_by is used, results come back in grouped_hits.
    // Extract the first hit from each group (group_limit: 1).
    const rawHits: SearchResponseHit<TDoc>[] =
        response.hits ??
        response.grouped_hits?.flatMap((group) => group.hits ?? []) ??
        []

    const hits = rawHits.map((hit, index) => ({
        ...hit.document,
        objectID: hit.document?.id ?? hit.document?.slug ?? "",
        __position: page * perPage + index,
    })) as THit[]

    return {
        hits,
        nbHits: response.found,
        page,
        nbPages: Math.ceil(response.found / perPage),
        hitsPerPage: perPage,
        exhaustiveNbHits: true,
        exhaustiveTypo: true,
        query,
        params: "",
        processingTimeMS: response.search_time_ms || 0,
    } as AlgoliaSearchResponse<THit>
}

/** Build a Typesense filter_by string combining type filter and optional extra filters. */
function buildFilterBy(
    typeFilter: string,
    ...extraFilters: (string | undefined)[]
): string {
    return [typeFilter, ...extraFilters].filter(Boolean).join(" && ")
}

/** Format a Typesense type filter for one or more types using exact match. */
function formatTypeFilter(...types: string[]): string {
    if (types.length === 1) return `type:=${types[0]}`
    return `type:=[${types.join(", ")}]`
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

const CHARTS_QUERY_BY =
    "embedding,title,slug,subtitle,variantName,tags,availableEntities,originalAvailableEntities"
const PAGES_QUERY_BY = "embedding,title,excerpt,tags,authors,content"
const PAGES_QUERY_BY_RESTRICTED = "embedding,title,excerpt,tags,authors"

export async function queryDataTopics(
    client: Client,
    state: SearchState,
    tagGraph: TagGraphRoot,
    selectedTopic: string | undefined
): Promise<SearchDataTopicsResponse[]> {
    const dataTopics = [...getSelectableTopics(tagGraph, selectedTopic)]

    const selectedCountryNames = getFilterNamesOfType(
        state.filters,
        FilterType.COUNTRY
    )
    const countryFilter = formatCountryFacetFiltersTypesense(
        selectedCountryNames,
        state.requireAllCountries
    )

    const query = state.query || "*"

    const fmFilter = formatFeaturedMetricFilterTypesense(state.query)
    const incomeGroupFMFilter =
        formatIncomeGroupFMFilterTypesense(selectedCountryNames)

    const searches = dataTopics.map((topic) => {
        const topicFilter = formatTopicFacetFiltersTypesense(new Set([topic]))
        return {
            collection: CHARTS_INDEX,
            q: query,
            query_by: CHARTS_QUERY_BY,
            vector_query:
                query !== "*"
                    ? `embedding:([], k:100, alpha:${HYBRID_SEARCH_ALPHA})`
                    : undefined,
            prefix: false,
            filter_by: [
                countryFilter,
                topicFilter,
                fmFilter,
                incomeGroupFMFilter,
            ]
                .filter(Boolean)
                .join(" && "),
            include_fields:
                "title,slug,availableEntities,originalAvailableEntities,variantName,type,queryParams,availableTabs,subtitle,chartConfigId,explorerType,chartId",
            highlight_start_tag: "<mark>",
            highlight_end_tag: "</mark>",
            group_by: "deduplicationId",
            group_limit: 1,
            per_page: 4,
            page: 1,
        }
    })

    const response = await client.multiSearch.perform<ChartDocument[]>(
        { searches },
        {}
    )

    return dataTopics.map((topic, i) => {
        const result = (
            response.results as TypesenseSearchResponse<ChartDocument>[]
        )[i]
        return {
            title: topic,
            charts: mapTypesenseResponse<ChartDocument, SearchChartHit>(
                result,
                state.query,
                0,
                4
            ),
        }
    })
}

export async function queryCharts(
    client: Client,
    state: SearchState,
    page: number = 0
): Promise<SearchChartsResponse> {
    const selectedCountryNames = getFilterNamesOfType(
        state.filters,
        FilterType.COUNTRY
    )
    const selectedTopics = getFilterNamesOfType(state.filters, FilterType.TOPIC)

    const query = state.query || "*"
    const fmFilter = formatFeaturedMetricFilterTypesense(state.query)
    const incomeGroupFMFilter =
        formatIncomeGroupFMFilterTypesense(selectedCountryNames)
    const response = await client
        .collections<ChartDocument>(CHARTS_INDEX)
        .documents()
        .search({
            q: query,
            query_by: CHARTS_QUERY_BY,
            vector_query:
                query !== "*"
                    ? `embedding:([], k:100, alpha:${HYBRID_SEARCH_ALPHA})`
                    : undefined,
            prefix: false,
            filter_by: [
                formatCountryFacetFiltersTypesense(
                    selectedCountryNames,
                    state.requireAllCountries
                ),
                formatTopicFacetFiltersTypesense(selectedTopics),
                fmFilter,
                incomeGroupFMFilter,
            ]
                .filter(Boolean)
                .join(" && "),
            include_fields:
                "title,slug,availableEntities,originalAvailableEntities,variantName,type,queryParams,availableTabs,subtitle,chartConfigId,explorerType,chartId",
            highlight_start_tag: "<mark>",
            highlight_end_tag: "</mark>",
            group_by: "deduplicationId",
            group_limit: 1,
            per_page: 9,
            page: page + 1, // Typesense pages are 1-indexed
        })

    // Map hits to match SearchChartHit structure.
    // Handle both regular and grouped responses (when using group_by).
    const rawHits: SearchResponseHit<ChartDocument>[] =
        response.hits ??
        response.grouped_hits?.flatMap((group) => group.hits ?? []) ??
        []
    const hits: SearchChartHit[] = rawHits.map((hit, index) => ({
        ...hit.document,
        objectID: hit.document?.slug,
        __position: page * 9 + index,
        availableTabs: hit.document?.availableTabs || [],
        availableEntities: hit.document?.availableEntities || [],
    })) as SearchChartHit[]

    // Return structure matching SearchChartsResponse
    return {
        hits,
        nbHits: response.found,
        page,
        nbPages: Math.ceil(response.found / 9),
        hitsPerPage: 9,
        exhaustiveNbHits: true,
        exhaustiveTypo: true,
        query: state.query,
        params: "",
        processingTimeMS: response.search_time_ms || 0,
    } as SearchChartsResponse
}

export async function queryDataInsights(
    client: Client,
    state: SearchState,
    page: number = 0,
    _hitsPerPage: number = 4
): Promise<SearchDataInsightResponse> {
    const selectedCountryNames = getFilterNamesOfType(
        state.filters,
        FilterType.COUNTRY
    )
    const hasCountry = selectedCountryNames.size > 0
    const selectedTopics = getFilterNamesOfType(state.filters, FilterType.TOPIC)
    // Using the selected countries as query search terms until data insights
    // are tagged with countries.
    const query =
        [
            state.query,
            // Use advanced syntax to search for countries as exact phrases
            // TODO: handle "Indonesia's", which gets filtered out
            ...Array.from(selectedCountryNames).map((c) => `"${c}"`),
        ]
            .filter(Boolean)
            .join(" ") || "*"

    const perPage = 4

    const response = await client
        .collections<PageDocument>(PAGES_INDEX)
        .documents()
        .search({
            q: query,
            // Do not search through the content of data insights in case there
            // is a country filter present. This is to avoid returning data
            // insights that might mention a country, but are not *about* that
            // country (e.g. "Unlike Germany...").
            query_by: hasCountry ? PAGES_QUERY_BY_RESTRICTED : PAGES_QUERY_BY,
            vector_query:
                query !== "*"
                    ? `embedding:([], k:100, alpha:${HYBRID_SEARCH_ALPHA})`
                    : undefined,
            prefix: false,
            filter_by: buildFilterBy(
                formatTypeFilter(OwidGdocType.DataInsight),
                formatTopicFacetFiltersTypesense(selectedTopics)
            ),
            include_fields: "title,thumbnailUrl,date,slug,type",
            highlight_start_tag: "<mark>",
            highlight_end_tag: "</mark>",
            group_by: "slug",
            group_limit: 1,
            per_page: perPage,
            page: page + 1,
        })

    return mapTypesenseResponse<PageDocument, DataInsightHit>(
        response,
        state.query,
        page,
        perPage
    )
}

export async function queryArticles(
    client: Client,
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
    const query =
        [
            state.query,
            // Use advanced syntax to search for countries as exact phrases
            ...Array.from(selectedCountryNames).map((c) => `"${c}"`),
        ]
            .filter(Boolean)
            .join(" ") || "*"

    const response = await client
        .collections<PageDocument>(PAGES_INDEX)
        .documents()
        .search({
            q: query,
            // Do not search through the content of articles in case there is a
            // country filter present. This is to avoid returning articles that
            // might mention a country, but are not *about* that country (e.g.
            // "Unlike Germany...").
            query_by: hasCountry ? PAGES_QUERY_BY_RESTRICTED : PAGES_QUERY_BY,
            vector_query:
                query !== "*"
                    ? `embedding:([], k:100, alpha:${HYBRID_SEARCH_ALPHA})`
                    : undefined,
            prefix: false,
            filter_by: buildFilterBy(
                formatTypeFilter(OwidGdocType.Article, OwidGdocType.AboutPage),
                formatTopicFacetFiltersTypesense(selectedTopics)
            ),
            include_fields: "title,thumbnailUrl,date,slug,type,content,authors",
            highlight_start_tag: "<mark>",
            highlight_end_tag: "</mark>",
            group_by: "slug",
            group_limit: 1,
            offset,
            limit: length,
        })

    // For offset-based queries, compute page/nbPages for compatibility
    const page = length > 0 ? Math.floor(offset / length) : 0
    return mapTypesenseResponse<PageDocument, FlatArticleHit>(
        response,
        state.query,
        page,
        length
    )
}

export async function queryTopicPages(
    client: Client,
    state: SearchState,
    offset: number = 0,
    length: number
): Promise<SearchTopicPageResponse> {
    const selectedTopics = getFilterNamesOfType(state.filters, FilterType.TOPIC)
    const query = state.query || "*"

    const response = await client
        .collections<PageDocument>(PAGES_INDEX)
        .documents()
        .search({
            q: query,
            query_by: PAGES_QUERY_BY,
            vector_query:
                query !== "*"
                    ? `embedding:([], k:100, alpha:${HYBRID_SEARCH_ALPHA})`
                    : undefined,
            prefix: false,
            filter_by: buildFilterBy(
                formatTypeFilter(
                    OwidGdocType.TopicPage,
                    OwidGdocType.LinearTopicPage
                ),
                formatTopicFacetFiltersTypesense(selectedTopics)
            ),
            include_fields: "title,type,slug,excerpt,excerptLong",
            highlight_start_tag: "<mark>",
            highlight_end_tag: "</mark>",
            group_by: "slug",
            group_limit: 1,
            offset,
            limit: length,
        })

    const page = length > 0 ? Math.floor(offset / length) : 0
    return mapTypesenseResponse<PageDocument, TopicPageHit>(
        response,
        state.query,
        page,
        length
    )
}

export async function queryProfiles(
    client: Client,
    state: SearchState,
    offset: number = 0,
    length: number
): Promise<SearchProfileResponse> {
    const selectedCountryNames = getFilterNamesOfType(
        state.filters,
        FilterType.COUNTRY
    )
    const selectedTopics = getFilterNamesOfType(state.filters, FilterType.TOPIC)
    const query = state.query || "*"

    const response = await client
        .collections<PageDocument>(PAGES_INDEX)
        .documents()
        .search({
            q: query,
            query_by: PAGES_QUERY_BY,
            vector_query:
                query !== "*"
                    ? `embedding:([], k:100, alpha:${HYBRID_SEARCH_ALPHA})`
                    : undefined,
            prefix: false,
            filter_by: buildFilterBy(
                formatTypeFilter(OwidGdocType.Profile),
                formatCountryFacetFiltersTypesense(
                    selectedCountryNames,
                    state.requireAllCountries
                ),
                formatTopicFacetFiltersTypesense(selectedTopics)
            ),
            include_fields:
                "title,thumbnailUrl,slug,excerpt,type,availableEntities",
            highlight_start_tag: "<mark>",
            highlight_end_tag: "</mark>",
            group_by: "slug",
            group_limit: 1,
            offset,
            limit: length,
        })

    const page = length > 0 ? Math.floor(offset / length) : 0
    return mapTypesenseResponse<PageDocument, ProfileHit>(
        response,
        state.query,
        page,
        length
    )
}

export async function queryWritingTopics(
    client: Client,
    tagGraph: TagGraphRoot,
    selectedTopic: string | undefined
): Promise<SearchWritingTopicsResponse[]> {
    const writingTopics = [...getSelectableTopics(tagGraph, selectedTopic)]

    // Create search parameters for both articles and topic pages for each topic
    const searches = writingTopics.flatMap((topic) => {
        const topicFilter = formatTopicFacetFiltersTypesense(new Set([topic]))

        return [
            {
                collection: PAGES_INDEX,
                q: "*" as const,
                query_by: PAGES_QUERY_BY,
                filter_by: buildFilterBy(
                    formatTypeFilter(
                        OwidGdocType.Article,
                        OwidGdocType.AboutPage
                    ),
                    topicFilter
                ),
                include_fields: "title,slug,thumbnailUrl,content,type",
                highlight_start_tag: "<mark>",
                highlight_end_tag: "</mark>",
                group_by: "slug",
                group_limit: 1,
                per_page: 3,
                page: 1,
            },
            {
                collection: PAGES_INDEX,
                q: "*" as const,
                query_by: PAGES_QUERY_BY,
                filter_by: buildFilterBy(
                    formatTypeFilter(
                        OwidGdocType.TopicPage,
                        OwidGdocType.LinearTopicPage
                    ),
                    topicFilter
                ),
                include_fields: "title,slug,type",
                highlight_start_tag: "<mark>",
                highlight_end_tag: "</mark>",
                group_by: "slug",
                group_limit: 1,
                per_page: 8,
                page: 1,
            },
        ]
    })

    const response = await client.multiSearch.perform<PageDocument[]>(
        { searches },
        {}
    )

    const results = response.results as TypesenseSearchResponse<PageDocument>[]

    // Process results in pairs (articles, then topic pages for each topic)
    return writingTopics.map((topic, i) => {
        const articlesResult = mapTypesenseResponse<
            PageDocument,
            StackedArticleHit
        >(results[i * 2], "", 0, 3)

        const topicPagesResult = mapTypesenseResponse<
            PageDocument,
            TopicPageHit
        >(results[i * 2 + 1], "", 0, 8)

        const totalCount =
            (articlesResult.nbHits ?? 0) + (topicPagesResult.nbHits ?? 0)

        return {
            title: topic,
            articles: articlesResult as SearchStackedArticleResponse,
            topicPages: topicPagesResult,
            totalCount,
        }
    })
}
