import * as R from "remeda"
import {
    EntityName,
    LATEST_FEED_TYPE_VALUES,
    OwidGdocType,
    TagGraphRoot,
    SearchState,
    SearchChartHit,
    SearchChartsResponse,
    SearchDataTopicsResponse,
    SearchDataInsightResponse,
    DataInsightHit,
    SearchStackedArticleResponse,
    SearchTopicPageResponse,
    SearchWritingTopicsResponse,
    StackedArticleHit,
    TopicPageHit,
    FilterType,
    LatestType,
    SearchFlatArticleResponse,
    FlatArticleHit,
    SearchProfileResponse,
    ProfileHit,
    PageChronologicalRecord,
} from "@ourworldindata/types"
import { type SearchResponse } from "algoliasearch"
import { type LiteClient } from "algoliasearch/lite"
import {
    getFilterNamesOfType,
    getSelectableTopics,
    CHARTS_INDEX,
    PAGES_INDEX,
    PAGES_CHRONOLOGICAL_INDEX,
    formatTopicFacetFiltersTypesense,
    formatCountryFacetFiltersTypesense,
    formatFeaturedMetricFilterTypesense,
    formatIncomeGroupFMFilterTypesense,
    formatDisjunctiveFacetFilters,
    HYBRID_SEARCH_ALPHA,
} from "./searchUtils.js"
import { RichDataComponentVariant } from "./SearchChartHitRichDataTypes.js"
import { ChartDocument, PageDocument } from "./typesenseCollections.js"
import { Client } from "typesense"
import {
    SearchResponse as TypesenseSearchResponse,
    SearchResponseHit,
} from "typesense/lib/Typesense/Documents.js"

function makeStateForKey(state: SearchState) {
    return R.pick(state, ["query", "filters", "requireAllCountries"])
}

/**
 * Maps a Typesense search response to the Algolia SearchResponse shape
 * that consuming components expect.
 *
 * Handles both regular and grouped responses (when using `group_by`).
 * Grouped responses return results under `grouped_hits` instead of `hits`.
 *
 * NOTE: the page-search callers below (queryDataInsights/queryArticles/
 * queryTopicPages/queryProfiles) still pass `group_by: "slug"` together with a
 * hybrid `vector_query`, so they share the Typesense bug worked around in
 * `dedupHitsByDeduplicationId` (group_by + vector-only matches collapses
 * results). They're lower-risk than the chart searches because they query full
 * `content`, so the keyword arm rarely matches nothing — but for purely
 * semantic queries they can still under-return. Apply the same over-fetch +
 * client-side dedup (by `slug`, which is load-bearing here: pages are indexed
 * as multiple content chunks sharing one slug) if/when this surfaces, or revert
 * all of these to native `group_by` once we're on Typesense v31+.
 */
function mapTypesenseResponse<
    TDoc extends { id?: string; slug?: string },
    THit,
>(
    response: TypesenseSearchResponse<TDoc>,
    query: string,
    page: number,
    perPage: number
): SearchResponse<THit> {
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
    } as SearchResponse<THit>
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
 * Deduplicate Typesense chart hits by `deduplicationId` (falling back to
 * `slug`), keeping the highest-ranked hit per chart and preserving relevance
 * order.
 *
 * We do this in application code instead of using Typesense's native
 * `group_by` because `group_by` combined with hybrid/vector search collapses
 * the result set for natural-language queries — e.g. "tax on personal income"
 * returns 101 results without `group_by` but only 1 with it, so the UI showed
 * "no results" (or a single chart) for queries the keyword arm couldn't match.
 * See typesense/typesense#2723; fixed by typesense/typesense#2738, but that fix
 * only landed on the (still unreleased) `v31` branch — no released version
 * contains it (we run v30.x). This mirrors the `/api/search` endpoint's default
 * `dedup=api` strategy. Once we're on Typesense v31+ this can be replaced by
 * `group_by: "deduplicationId", group_limit: 1`.
 */
function dedupHitsByDeduplicationId(
    hits: SearchResponseHit<ChartDocument>[]
): SearchResponseHit<ChartDocument>[] {
    const seen = new Set<string>()
    const deduped: SearchResponseHit<ChartDocument>[] = []
    for (const hit of hits) {
        const dedupId = hit.document?.deduplicationId ?? hit.document?.slug
        if (!dedupId || seen.has(dedupId)) continue
        seen.add(dedupId)
        deduped.push(hit)
    }
    return deduped
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

    // Number of charts displayed per topic row.
    const TOPIC_CHARTS_LIMIT = 4
    // Over-fetch (without Typesense's buggy `group_by` — see
    // `dedupHitsByDeduplicationId`) so we have enough hits to still show
    // TOPIC_CHARTS_LIMIT distinct charts after deduplicating in app code.
    const TOPIC_DEDUP_FETCH_SIZE = 20

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
            stopwords: "english",
            filter_by: [
                countryFilter,
                topicFilter,
                fmFilter,
                incomeGroupFMFilter,
            ]
                .filter(Boolean)
                .join(" && "),
            include_fields:
                "title,slug,availableEntities,originalAvailableEntities,variantName,type,queryParams,availableTabs,subtitle,chartConfigId,explorerType,chartId,deduplicationId",
            highlight_start_tag: "<mark>",
            highlight_end_tag: "</mark>",
            per_page: TOPIC_DEDUP_FETCH_SIZE,
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
        const dedupedHits = dedupHitsByDeduplicationId(result.hits ?? []).slice(
            0,
            TOPIC_CHARTS_LIMIT
        )
        const hits = dedupedHits.map((hit, index) => ({
            ...hit.document,
            objectID: hit.document?.id ?? hit.document?.slug ?? "",
            __position: index,
        })) as SearchChartHit[]
        return {
            title: topic,
            // `result.found` is the total matching documents (slightly
            // over-counts duplicate chart views vs. the old grouped count, but
            // never collapses to a wrong tiny value the way `group_by` does).
            // It drives the "N charts" header and row visibility.
            charts: {
                hits,
                nbHits: result.found,
                page: 0,
                nbPages: 1,
                hitsPerPage: TOPIC_CHARTS_LIMIT,
                exhaustiveNbHits: true,
                exhaustiveTypo: true,
                query: state.query,
                params: "",
                processingTimeMS: result.search_time_ms || 0,
            } as SearchChartsResponse,
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

    // Over-fetch and deduplicate by `deduplicationId` in application code
    // instead of using Typesense's native `group_by`, which is buggy for
    // hybrid/vector queries — see `dedupHitsByDeduplicationId`.
    const DEDUP_FETCH_SIZE = 250 // Typesense's max per_page
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
            stopwords: "english",
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
                "title,slug,availableEntities,originalAvailableEntities,variantName,type,queryParams,availableTabs,subtitle,chartConfigId,explorerType,chartId,deduplicationId",
            highlight_start_tag: "<mark>",
            highlight_end_tag: "</mark>",
            per_page: DEDUP_FETCH_SIZE,
            page: 1,
        })

    // Deduplicate, then paginate over the unique results client-side.
    const dedupedHits = dedupHitsByDeduplicationId(response.hits ?? [])

    const pageHits = dedupedHits.slice(page * 9, page * 9 + 9)
    const hits: SearchChartHit[] = pageHits.map((hit, index) => ({
        ...hit.document,
        objectID: hit.document?.slug,
        __position: page * 9 + index,
        availableTabs: hit.document?.availableTabs || [],
        availableEntities: hit.document?.availableEntities || [],
    })) as SearchChartHit[]

    // nbHits is the count of unique charts within the fetched window (an
    // approximation of the true total, which is enough to drive pagination).
    const nbHits = dedupedHits.length
    return {
        hits,
        nbHits,
        page,
        nbPages: Math.ceil(nbHits / 9),
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
            stopwords: "english",
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
            stopwords: "english",
            filter_by: buildFilterBy(
                formatTypeFilter(OwidGdocType.Article, OwidGdocType.AboutPage),
                formatTopicFacetFiltersTypesense(selectedTopics)
            ),
            include_fields:
                "title,thumbnailUrl,date,slug,type,content,excerpt,authors",
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
            stopwords: "english",
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
            stopwords: "english",
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
                include_fields: "title,slug,thumbnailUrl,content,excerpt,type",
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
