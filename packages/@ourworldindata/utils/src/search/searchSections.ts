import {
    Filter,
    FilterType,
    OwidGdocType,
    SearchState,
    SearchUrlParam,
    TagGraphRoot,
} from "@ourworldindata/types"
import { type SearchResponse } from "algoliasearch"
import { type LiteClient } from "algoliasearch/lite"
import {
    buildChartsFacetFilters,
    formatCountryFacetFilters,
    formatDisjunctiveFacetFilters,
    formatTopicFacetFilters,
    getFilterNamesOfType,
} from "./searchFacetFilters.js"
import {
    searchSingleForHits,
    searchSingleForHitsWithClosestMatches,
    type SingleSearchRequest,
} from "./searchClosestMatches.js"
import { recommendTopicPages } from "./searchTopicPages.js"

// Shared by the site's search page and /api/search — see ./README.md.
//
// The searches /api/search answers, which are also the searches behind the
// search page's result sections. The page runs them either from the browser,
// against Algolia, or through /api/search, which runs these same functions in
// a Cloudflare function.

/** The parts of the search state a search depends on. */
export type SectionSearchState = Pick<
    SearchState,
    "query" | "filters" | "requireAllCountries"
>

export interface SearchIndexNames {
    charts: string
    pages: string
}

/**
 * One Algolia search, and whether an empty result falls back to closest
 * matches (see searchSingleForHitsWithClosestMatches). Built separately from
 * running it so a caller can run the same search another way, e.g. reranked.
 */
export interface SectionSearch {
    request: SingleSearchRequest
    closestMatches: boolean
}

export type SectionSearchResponse<THit> = SearchResponse<THit> & {
    closestMatches?: boolean
}

export function runSectionSearch<THit>(
    liteSearchClient: LiteClient,
    search: SectionSearch
): Promise<SectionSearchResponse<THit>> {
    return search.closestMatches
        ? searchSingleForHitsWithClosestMatches<THit>(
              liteSearchClient,
              search.request
          )
        : searchSingleForHits<THit>(liteSearchClient, search.request)
}

interface PagePagination {
    page: number
    hitsPerPage: number
}

interface OffsetPagination {
    offset: number
    length: number
}

const HIGHLIGHT_TAGS = {
    highlightPreTag: "<mark>",
    highlightPostTag: "</mark>",
}

// Each search type retrieves the attributes both the search page and API
// consumers use, so the two ask Algolia for the same thing.

/** The chart attributes of type=charts. */
export const SEARCH_CHART_ATTRIBUTES = [
    "title",
    "containerTitle",
    "slug",
    "availableEntities",
    "originalAvailableEntities",
    "variantName",
    "titleVariant",
    "type",
    "queryParams",
    "availableTabs",
    "subtitle",
    "chartConfigId",
    "explorerType",
    "publishedAt",
    "updatedAt",
]

const PAGE_ATTRIBUTES = [
    "title",
    "thumbnailUrl",
    "date",
    "slug",
    "type",
    "content",
    "authors",
    "modifiedDate",
]

const TOPIC_PAGE_ATTRIBUTES = [...PAGE_ATTRIBUTES, "excerpt", "excerptLong"]

const PROFILE_ATTRIBUTES = [
    "title",
    "thumbnailUrl",
    "slug",
    "excerpt",
    "type",
    "availableEntities",
]

const DATASET_FILTERS = [
    [FilterType.DATASET_PRODUCT, "datasetProducts"],
    [FilterType.DATASET_NAMESPACE, "datasetNamespaces"],
    [FilterType.DATASET_VERSION, "datasetVersions"],
    [FilterType.DATASET_PRODUCER, "datasetProducers"],
] as const

export function buildChartsSearch(
    state: SectionSearchState,
    params: { indexName: string } & PagePagination
): SectionSearch {
    const datasetFacetFilters = DATASET_FILTERS.flatMap(
        ([filterType, attribute]) =>
            formatDisjunctiveFacetFilters(
                getFilterNamesOfType(state.filters, filterType),
                attribute
            )
    )
    return {
        request: {
            indexName: params.indexName,
            attributesToRetrieve: SEARCH_CHART_ATTRIBUTES,
            query: state.query,
            facetFilters: buildChartsFacetFilters({
                ...state,
                datasetFacetFilters,
            }),
            ...HIGHLIGHT_TAGS,
            hitsPerPage: params.hitsPerPage,
            page: params.page,
        },
        closestMatches: true,
    }
}

/** A text search over gdocs of the given types (type=pages). */
function buildPagesSearch(
    state: SectionSearchState,
    params: {
        indexName: string
        pageTypes: readonly string[]
    } & OffsetPagination
): SectionSearch {
    const selectedCountryNames = getFilterNamesOfType(
        state.filters,
        FilterType.COUNTRY
    )
    const hasCountry = selectedCountryNames.size > 0
    const selectedTopics = getFilterNamesOfType(state.filters, FilterType.TOPIC)
    // Using the selected countries as query search terms until pages are
    // tagged with countries.
    const query = [
        state.query,
        // Use advanced syntax to search for countries as exact phrases
        ...selectedCountryNames.keys().map((c) => `"${c}"`),
    ]
        .filter(Boolean)
        .join(" ")

    return {
        request: {
            indexName: params.indexName,
            query,
            filters: params.pageTypes
                .map((type) => `type:${type}`)
                .join(" OR "),
            facetFilters: formatTopicFacetFilters(selectedTopics),
            // Do not search through the content of pages in case there is a
            // country filter present. This is to avoid returning pages that
            // might mention a country, but are not *about* that country (e.g.
            // "Unlike Germany...").
            ...(hasCountry && {
                // a subset of searchableAttributes on the Pages index
                restrictSearchableAttributes: ["title", "tags", "authors"],
            }),
            attributesToRetrieve: [
                ...PAGE_ATTRIBUTES,
                // Without a query there's nothing to snippet `content` for,
                // so the search page shows the excerpt instead.
                ...(state.query.trim() === "" ? ["excerpt"] : []),
            ],
            ...HIGHLIGHT_TAGS,
            offset: params.offset,
            length: params.length,
        },
        // Selected countries are part of the query, so the closest-matches
        // fallback would drop them as optional words and show results that
        // ignore the country filter. An empty section is the honest answer.
        closestMatches: !hasCountry,
    }
}

/** Country profiles for the selected countries and topics (type=profiles). */
function buildProfilesSearch(
    state: SectionSearchState,
    params: { indexName: string } & OffsetPagination
): SectionSearch {
    return {
        request: {
            indexName: params.indexName,
            query: state.query,
            filters: `type:${OwidGdocType.Profile}`,
            facetFilters: [
                ...formatCountryFacetFilters(
                    getFilterNamesOfType(state.filters, FilterType.COUNTRY),
                    state.requireAllCountries
                ),
                ...formatTopicFacetFilters(
                    getFilterNamesOfType(state.filters, FilterType.TOPIC)
                ),
            ],
            attributesToRetrieve: PROFILE_ATTRIBUTES,
            ...HIGHLIGHT_TAGS,
            offset: params.offset,
            length: params.length,
        },
        closestMatches: false,
    }
}

/** The page types type=pages searches unless asked for others. */
export const DEFAULT_PAGE_TYPES: readonly string[] = [
    OwidGdocType.Article,
    OwidGdocType.AboutPage,
]

/**
 * One search as /api/search takes it. Charts paginate by page; the others by
 * offset, since the search page shows a different number of results first
 * than on "show more".
 */
export type SearchRequest =
    | ({ type: "charts"; state: SectionSearchState } & PagePagination)
    | ({
          type: "pages"
          state: SectionSearchState
          pageTypes: readonly string[]
      } & OffsetPagination)
    | ({ type: "topics"; state: SectionSearchState } & OffsetPagination)
    | ({ type: "profiles"; state: SectionSearchState } & OffsetPagination)

export type SearchType = SearchRequest["type"]

export const SEARCH_TYPES: readonly SearchType[] = [
    "charts",
    "pages",
    "topics",
    "profiles",
]

/**
 * Runs one search. The site calls this in the browser and /api/search calls
 * it in a function, so both send Algolia the same requests. The caller names
 * the hit type it expects.
 */
export function runSearchRequest<THit extends { slug: string }>(
    liteSearchClient: LiteClient,
    request: SearchRequest,
    params: {
        indexNames: SearchIndexNames
        /** Only called by type=topics, once a chart matches. */
        loadTagGraph: () => Promise<TagGraphRoot>
    }
): Promise<SectionSearchResponse<THit>> {
    const { indexNames } = params
    switch (request.type) {
        case "charts":
            return runSectionSearch<THit>(
                liteSearchClient,
                buildChartsSearch(request.state, {
                    indexName: indexNames.charts,
                    page: request.page,
                    hitsPerPage: request.hitsPerPage,
                })
            )
        case "pages":
            return runSectionSearch<THit>(
                liteSearchClient,
                buildPagesSearch(request.state, {
                    indexName: indexNames.pages,
                    pageTypes: request.pageTypes,
                    offset: request.offset,
                    length: request.length,
                })
            )
        case "profiles":
            return runSectionSearch<THit>(
                liteSearchClient,
                buildProfilesSearch(request.state, {
                    indexName: indexNames.pages,
                    offset: request.offset,
                    length: request.length,
                })
            )
        case "topics":
            return recommendTopicPages<THit>(liteSearchClient, {
                chartsIndexName: indexNames.charts,
                pagesIndexName: indexNames.pages,
                state: request.state,
                loadTagGraph: params.loadTagGraph,
                attributesToRetrieve: TOPIC_PAGE_ATTRIBUTES,
                offset: request.offset,
                length: request.length,
            })
    }
}

/** The URL parameter of each filter type, as on the search page's URL. */
const SEARCH_FILTER_URL_PARAMS = [
    [FilterType.TOPIC, SearchUrlParam.TOPIC],
    [FilterType.COUNTRY, SearchUrlParam.COUNTRY],
    [FilterType.DATASET_PRODUCT, SearchUrlParam.DATASET_PRODUCT],
    [FilterType.DATASET_NAMESPACE, SearchUrlParam.DATASET_NAMESPACE],
    [FilterType.DATASET_VERSION, SearchUrlParam.DATASET_VERSION],
    [FilterType.DATASET_PRODUCER, SearchUrlParam.DATASET_PRODUCER],
] as const

/** Separates the values of a multi-valued filter parameter. */
const SEARCH_URL_LIST_SEPARATOR = "~"

/**
 * The search page's URL parameters for a search state, leaving out defaults.
 * The search page's own URL and /api/search both use them.
 */
export function searchStateToUrlParams(
    state: SectionSearchState
): URLSearchParams {
    const params = new URLSearchParams()
    if (state.query) params.set(SearchUrlParam.QUERY, state.query)
    for (const [filterType, param] of SEARCH_FILTER_URL_PARAMS) {
        const names = getFilterNamesOfType(state.filters, filterType)
        if (names.size)
            params.set(param, [...names].join(SEARCH_URL_LIST_SEPARATOR))
    }
    if (state.requireAllCountries)
        params.set(SearchUrlParam.REQUIRE_ALL_COUNTRIES, "true")
    return params
}

/**
 * The search state behind the search page's URL parameters. Filter values
 * aren't checked against the topics and countries that exist.
 */
export function searchUrlParamsToSectionState(
    params: URLSearchParams
): SectionSearchState {
    const filters: Filter[] = SEARCH_FILTER_URL_PARAMS.flatMap(
        ([filterType, param]) =>
            [
                ...new Set(
                    (params.get(param) ?? "")
                        .split(SEARCH_URL_LIST_SEPARATOR)
                        .map((name) => name.trim())
                ),
            ]
                .filter(Boolean)
                .map((name) => ({ type: filterType, name }))
    )
    return {
        query: params.get(SearchUrlParam.QUERY) ?? "",
        filters,
        requireAllCountries:
            params.get(SearchUrlParam.REQUIRE_ALL_COUNTRIES) === "true",
    }
}

/**
 * The /api/search parameters for a search; functions/api/search/index.ts
 * parses them back.
 */
export function searchRequestToUrlParams(
    request: SearchRequest
): URLSearchParams {
    const params = searchStateToUrlParams(request.state)
    params.set("type", request.type)
    if (request.type === "pages")
        params.set("pageTypes", request.pageTypes.join(","))
    if (request.type === "charts") {
        params.set("page", String(request.page))
        params.set("hitsPerPage", String(request.hitsPerPage))
    } else {
        params.set("offset", String(request.offset))
        params.set("length", String(request.length))
    }
    return params
}

/** The parts of an /api/search response (with highlights=true) the search page reads. */
export interface SearchApiHitsResponse<THit> {
    results: THit[]
    nbHits: number
    page?: number
    nbPages?: number
    hitsPerPage?: number
    closestMatches?: boolean
}

/**
 * An /api/search response in the shape of the Algolia response the search
 * page reads: its hits, nbHits, page, nbPages and closestMatches.
 */
export function fromSearchApiResponse<THit>(
    response: SearchApiHitsResponse<THit>
): SectionSearchResponse<THit> {
    return {
        hits: response.results,
        nbHits: response.nbHits,
        page: response.page,
        nbPages: response.nbPages,
        hitsPerPage: response.hitsPerPage,
        closestMatches: response.closestMatches,
    } as SectionSearchResponse<THit>
}
