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
    getSelectableTopics,
    CHARTS_INDEX,
    PAGES_INDEX,
    PAGES_CHRONOLOGICAL_INDEX,
    DATA_CATALOG_ATTRIBUTES,
} from "./searchUtils.js"
import {
    getFilterNamesOfType,
    formatDisjunctiveFacetFilters,
    buildChartsFilterBy,
    formatCountryFilterBy,
    formatTopicFilterBy,
    formatDisjunctiveFilterBy,
    formatTypeFilterBy,
    joinFilterBy,
    typesenseSearch,
    typesenseMultiSearch,
    typesenseSearchWithClosestMatches,
    extractTypesenseHits,
    getTypesenseFoundCount,
    type TypesenseConfig,
    type TypesenseSearchParams,
    type TypesenseSearchResponse,
    CHARTS_QUERY_BY,
    CHARTS_QUERY_BY_WEIGHTS,
    CHARTS_SORT_BY,
    PAGES_QUERY_BY,
    PAGES_QUERY_BY_WEIGHTS,
    PAGES_QUERY_BY_RESTRICTED,
    PAGES_QUERY_BY_RESTRICTED_WEIGHTS,
    PAGES_SORT_BY,
    TYPESENSE_RELEVANCE_PARAMS,
    TYPESENSE_STOPWORDS_SET,
    TYPESENSE_SYNONYM_SET,
} from "@ourworldindata/utils"
import { RichDataComponentVariant } from "./SearchChartHitRichDataTypes.js"

function makeStateForKey(state: SearchState) {
    return R.pick(state, ["query", "filters", "requireAllCountries"])
}

// ── Typesense → Algolia response shape ──────────────────────────────────
//
// The hooks and hit components are written against Algolia's SearchResponse,
// so the query functions below keep returning that shape. Only `hits`,
// `nbHits`, `page`, `nbPages`, `hitsPerPage` and `closestMatches` are actually
// read by consumers; `_highlightResult`/`_snippetResult` are declared on the
// hit types but never rendered, so Typesense's highlights aren't mapped over.

/**
 * Dates are indexed as Unix seconds (Typesense has no date type) while the hit
 * types expose them as ISO strings and renderers call `new Date(hit.date)` —
 * which would read the seconds as milliseconds and render January 1970.
 */
function normalizeDateFields(document: Record<string, unknown>): {
    date?: string
    modifiedDate?: string
} {
    const overrides: { date?: string; modifiedDate?: string } = {}
    if (typeof document.date === "number")
        overrides.date = new Date(document.date * 1000).toISOString()
    if (typeof document.modifiedDate === "number")
        overrides.modifiedDate = new Date(
            document.modifiedDate * 1000
        ).toISOString()
    return overrides
}

function mapTypesenseResponse<THit>(
    response: TypesenseSearchResponse<Record<string, unknown>> & {
        closestMatches?: boolean
    },
    query: string,
    page: number,
    perPage: number
): SearchResponse<THit> & { closestMatches?: boolean } {
    const hits = extractTypesenseHits(response).map((hit, index) => ({
        ...hit.document,
        ...normalizeDateFields(hit.document),
        objectID: hit.document.id ?? hit.document.slug ?? "",
        __position: page * perPage + index,
    })) as THit[]

    const nbHits = getTypesenseFoundCount(response)

    return {
        hits,
        nbHits,
        page,
        nbPages: perPage > 0 ? Math.ceil(nbHits / perPage) : 0,
        hitsPerPage: perPage,
        exhaustiveNbHits: true,
        exhaustiveTypo: true,
        query,
        params: "",
        processingTimeMS: response.search_time_ms || 0,
        ...(response.closestMatches && { closestMatches: true as const }),
    } as SearchResponse<THit> & { closestMatches?: boolean }
}

/** Typesense has no empty-query mode; `*` matches everything. */
function toTypesenseQuery(query: string): string {
    return query.trim() || "*"
}

/** Parameters every collection search shares. */
const COMMON_PARAMS = {
    ...TYPESENSE_RELEVANCE_PARAMS,
    stopwords: TYPESENSE_STOPWORDS_SET,
    synonym_sets: TYPESENSE_SYNONYM_SET,
    highlight_start_tag: "<mark>",
    highlight_end_tag: "</mark>",
} as const

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

const TOPIC_CHARTS_PER_ROW = 4

export async function queryDataTopics(
    config: TypesenseConfig,
    state: SearchState,
    tagGraph: TagGraphRoot,
    selectedTopic: string | undefined
) {
    const dataTopics = [...getSelectableTopics(tagGraph, selectedTopic)]

    const countryFilterBy = formatCountryFilterBy(
        getFilterNamesOfType(state.filters, FilterType.COUNTRY),
        state.requireAllCountries
    )

    const searches = dataTopics.map((topic) => ({
        collection: CHARTS_INDEX,
        q: toTypesenseQuery(state.query),
        query_by: CHARTS_QUERY_BY,
        query_by_weights: CHARTS_QUERY_BY_WEIGHTS,
        sort_by: CHARTS_SORT_BY,
        group_by: "deduplicationId",
        group_limit: 1,
        include_fields: DATA_CATALOG_ATTRIBUTES.join(","),
        filter_by:
            joinFilterBy(
                ...countryFilterBy,
                formatTopicFilterBy(new Set([topic]))
            ) || undefined,
        per_page: TOPIC_CHARTS_PER_ROW,
        page: 1,
        ...COMMON_PARAMS,
    }))

    const results = await typesenseMultiSearch<Record<string, unknown>>(
        config,
        searches
    )

    return results.map((result, i) => ({
        title: dataTopics[i],
        charts: mapTypesenseResponse<SearchChartHit>(
            result,
            state.query,
            0,
            TOPIC_CHARTS_PER_ROW
        ),
    }))
}

const CHARTS_PER_PAGE = 9

export async function queryCharts(
    config: TypesenseConfig,
    state: SearchState,
    page: number = 0
) {
    const datasetFilterBy = [
        formatDisjunctiveFilterBy(
            getFilterNamesOfType(state.filters, FilterType.DATASET_PRODUCT),
            "datasetProducts"
        ),
        formatDisjunctiveFilterBy(
            getFilterNamesOfType(state.filters, FilterType.DATASET_NAMESPACE),
            "datasetNamespaces"
        ),
        formatDisjunctiveFilterBy(
            getFilterNamesOfType(state.filters, FilterType.DATASET_VERSION),
            "datasetVersions"
        ),
        formatDisjunctiveFilterBy(
            getFilterNamesOfType(state.filters, FilterType.DATASET_PRODUCER),
            "datasetProducers"
        ),
    ]

    const filterBy = buildChartsFilterBy({
        query: state.query,
        filters: state.filters,
        requireAllCountries: state.requireAllCountries,
        datasetFilterBy,
    })

    const params: TypesenseSearchParams = {
        q: toTypesenseQuery(state.query),
        query_by: CHARTS_QUERY_BY,
        query_by_weights: CHARTS_QUERY_BY_WEIGHTS,
        sort_by: CHARTS_SORT_BY,
        group_by: "deduplicationId",
        group_limit: 1,
        include_fields: DATA_CATALOG_ATTRIBUTES.join(","),
        filter_by: filterBy || undefined,
        per_page: CHARTS_PER_PAGE,
        page: page + 1,
        ...COMMON_PARAMS,
    }

    const response = await typesenseSearchWithClosestMatches<
        Record<string, unknown>
    >(
        (searchParams) => typesenseSearch(config, CHARTS_INDEX, searchParams),
        params
    )

    return mapTypesenseResponse<SearchChartHit>(
        response,
        state.query,
        page,
        CHARTS_PER_PAGE
    )
}

/**
 * Countries are appended to the query as exact phrases until data insights and
 * articles are tagged with countries. Typesense's equivalent of Algolia's
 * `advancedSyntax` exact-phrase quoting is the same double-quote syntax.
 */
function buildQueryWithCountries(
    query: string,
    countries: Set<string>
): string {
    return (
        [query, ...Array.from(countries).map((c) => `"${c}"`)]
            .filter(Boolean)
            .join(" ") || "*"
    )
}

export async function queryDataInsights(
    config: TypesenseConfig,
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

    const params: TypesenseSearchParams = {
        q: buildQueryWithCountries(state.query, selectedCountryNames),
        // Do not search through the content of data insights in case there
        // is a country filter present. This is to avoid returning data
        // insights that might mention a country, but are not *about* that
        // country (e.g. "Unlike Germany...").
        query_by: hasCountry ? PAGES_QUERY_BY_RESTRICTED : PAGES_QUERY_BY,
        query_by_weights: hasCountry
            ? PAGES_QUERY_BY_RESTRICTED_WEIGHTS
            : PAGES_QUERY_BY_WEIGHTS,
        sort_by: PAGES_SORT_BY,
        group_by: "path",
        group_limit: 1,
        include_fields: "title,thumbnailUrl,date,slug,path,type",
        filter_by: joinFilterBy(
            formatTypeFilterBy(OwidGdocType.DataInsight),
            formatTopicFilterBy(selectedTopics)
        ),
        per_page: hitsPerPage,
        page: page + 1,
        ...COMMON_PARAMS,
    }

    const response = await typesenseSearchWithClosestMatches<
        Record<string, unknown>
    >(
        (searchParams) => typesenseSearch(config, PAGES_INDEX, searchParams),
        params
    )

    return mapTypesenseResponse<DataInsightHit>(
        response,
        state.query,
        page,
        hitsPerPage
    )
}

export async function queryArticles(
    config: TypesenseConfig,
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

    const params: TypesenseSearchParams = {
        q: buildQueryWithCountries(state.query, selectedCountryNames),
        // See the note in queryDataInsights about excluding `content` when a
        // country filter is active.
        query_by: hasCountry ? PAGES_QUERY_BY_RESTRICTED : PAGES_QUERY_BY,
        query_by_weights: hasCountry
            ? PAGES_QUERY_BY_RESTRICTED_WEIGHTS
            : PAGES_QUERY_BY_WEIGHTS,
        sort_by: PAGES_SORT_BY,
        group_by: "path",
        group_limit: 1,
        include_fields: [
            "title",
            "thumbnailUrl",
            "date",
            "slug",
            "path",
            "type",
            isFilterOnly ? "excerpt" : "content",
            "authors",
        ].join(","),
        filter_by: joinFilterBy(
            formatTypeFilterBy(OwidGdocType.Article, OwidGdocType.AboutPage),
            formatTopicFilterBy(selectedTopics)
        ),
        offset,
        limit: length,
        ...COMMON_PARAMS,
    }

    const response = await typesenseSearchWithClosestMatches<
        Record<string, unknown>
    >(
        (searchParams) => typesenseSearch(config, PAGES_INDEX, searchParams),
        params
    )

    const page = length > 0 ? Math.floor(offset / length) : 0
    return mapTypesenseResponse<FlatArticleHit>(
        response,
        state.query,
        page,
        length
    )
}

export async function queryTopicPages(
    config: TypesenseConfig,
    state: SearchState,
    offset: number = 0,
    length: number
) {
    const selectedTopics = getFilterNamesOfType(state.filters, FilterType.TOPIC)

    const response = await typesenseSearch<Record<string, unknown>>(
        config,
        PAGES_INDEX,
        {
            q: toTypesenseQuery(state.query),
            query_by: PAGES_QUERY_BY,
            query_by_weights: PAGES_QUERY_BY_WEIGHTS,
            sort_by: PAGES_SORT_BY,
            group_by: "path",
            group_limit: 1,
            include_fields: "title,type,slug,path,excerpt,excerptLong",
            filter_by: joinFilterBy(
                formatTypeFilterBy(
                    OwidGdocType.TopicPage,
                    OwidGdocType.LinearTopicPage
                ),
                formatTopicFilterBy(selectedTopics)
            ),
            offset,
            limit: length,
            ...COMMON_PARAMS,
        }
    )

    const page = length > 0 ? Math.floor(offset / length) : 0
    return mapTypesenseResponse<TopicPageHit>(
        response,
        state.query,
        page,
        length
    )
}

export async function queryProfiles(
    config: TypesenseConfig,
    state: SearchState,
    offset: number = 0,
    length: number
) {
    const selectedCountryNames = getFilterNamesOfType(
        state.filters,
        FilterType.COUNTRY
    )
    const selectedTopics = getFilterNamesOfType(state.filters, FilterType.TOPIC)

    const response = await typesenseSearch<Record<string, unknown>>(
        config,
        PAGES_INDEX,
        {
            q: toTypesenseQuery(state.query),
            query_by: PAGES_QUERY_BY,
            query_by_weights: PAGES_QUERY_BY_WEIGHTS,
            sort_by: PAGES_SORT_BY,
            group_by: "path",
            group_limit: 1,
            include_fields:
                "title,thumbnailUrl,slug,path,excerpt,type,availableEntities",
            filter_by: joinFilterBy(
                formatTypeFilterBy(OwidGdocType.Profile),
                ...formatCountryFilterBy(
                    selectedCountryNames,
                    state.requireAllCountries
                ),
                formatTopicFilterBy(selectedTopics)
            ),
            offset,
            limit: length,
            ...COMMON_PARAMS,
        }
    )

    const page = length > 0 ? Math.floor(offset / length) : 0
    return mapTypesenseResponse<ProfileHit>(response, state.query, page, length)
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

// NOTE: /latest still reads the chronological index from Algolia — it is a
// separate index that isn't part of this migration (the Atom feed in
// functions/atom.xml.ts reads the same one). Hence the LiteClient here while
// every other query in this file takes a TypesenseConfig.
//
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

const WRITING_TOPIC_ARTICLES_PER_ROW = 3
const WRITING_TOPIC_PAGES_PER_ROW = 8

export async function queryWritingTopics(
    config: TypesenseConfig,
    tagGraph: TagGraphRoot,
    selectedTopic: string | undefined
) {
    const writingTopics = [...getSelectableTopics(tagGraph, selectedTopic)]

    // Create search parameters for both articles and topic pages for each topic
    const searches = writingTopics.flatMap((topic) => {
        const topicFilterBy = formatTopicFilterBy(new Set([topic]))

        return [
            {
                collection: PAGES_INDEX,
                q: "*",
                query_by: PAGES_QUERY_BY,
                query_by_weights: PAGES_QUERY_BY_WEIGHTS,
                sort_by: PAGES_SORT_BY,
                group_by: "path",
                group_limit: 1,
                include_fields: "title,slug,path,thumbnailUrl,excerpt,type",
                filter_by: joinFilterBy(
                    formatTypeFilterBy(
                        OwidGdocType.Article,
                        OwidGdocType.AboutPage
                    ),
                    topicFilterBy
                ),
                per_page: WRITING_TOPIC_ARTICLES_PER_ROW,
                page: 1,
                ...COMMON_PARAMS,
            },
            {
                collection: PAGES_INDEX,
                q: "*",
                query_by: PAGES_QUERY_BY,
                query_by_weights: PAGES_QUERY_BY_WEIGHTS,
                sort_by: PAGES_SORT_BY,
                group_by: "path",
                group_limit: 1,
                include_fields: "title,slug,path,type",
                filter_by: joinFilterBy(
                    formatTypeFilterBy(
                        OwidGdocType.TopicPage,
                        OwidGdocType.LinearTopicPage
                    ),
                    topicFilterBy
                ),
                per_page: WRITING_TOPIC_PAGES_PER_ROW,
                page: 1,
                ...COMMON_PARAMS,
            },
        ]
    })

    const results = await typesenseMultiSearch<Record<string, unknown>>(
        config,
        searches
    )

    // Process results in pairs (articles, then topic pages for each topic).
    return writingTopics.map((topic, i) => {
        const articles = mapTypesenseResponse<StackedArticleHit>(
            results[i * 2],
            "",
            0,
            WRITING_TOPIC_ARTICLES_PER_ROW
        )
        const topicPages = mapTypesenseResponse<TopicPageHit>(
            results[i * 2 + 1],
            "",
            0,
            WRITING_TOPIC_PAGES_PER_ROW
        )

        return {
            title: topic,
            articles,
            topicPages,
            totalCount: (articles.nbHits ?? 0) + (topicPages.nbHits ?? 0),
        }
    })
}
