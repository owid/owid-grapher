import {
    DataInsightHit,
    Filter,
    FilterType,
    FlatArticleHit,
    OwidGdocType,
    ProfileHit,
    SearchChartHit,
    SearchState,
    SearchUrlParam,
    TagGraphRoot,
    TopicPageHit,
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
// The searches behind the search page's result sections. The page runs them
// either from the browser, against Algolia, or through
// /api/search/sections, which runs these same functions in a Cloudflare
// function; /api/search builds its chart and page searches from them too.

/** The parts of the search state a section's search depends on. */
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

/** Algolia's page-based or offset-based pagination. */
type SectionPagination = PagePagination | OffsetPagination

const HIGHLIGHT_TAGS = {
    highlightPreTag: "<mark>",
    highlightPostTag: "</mark>",
}

/** The chart attributes the search page renders. */
export const SEARCH_PAGE_CHART_ATTRIBUTES = [
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
]

const SEARCH_PAGE_TOPIC_PAGE_ATTRIBUTES = [
    "title",
    "type",
    "slug",
    "excerpt",
    "excerptLong",
]

const DATASET_FILTERS = [
    [FilterType.DATASET_PRODUCT, "datasetProducts"],
    [FilterType.DATASET_NAMESPACE, "datasetNamespaces"],
    [FilterType.DATASET_VERSION, "datasetVersions"],
    [FilterType.DATASET_PRODUCER, "datasetProducers"],
] as const

export function buildChartsSearch(
    state: SectionSearchState,
    params: {
        indexName: string
        page: number
        hitsPerPage: number
        attributesToRetrieve?: string[]
    }
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
            attributesToRetrieve:
                params.attributesToRetrieve ?? SEARCH_PAGE_CHART_ATTRIBUTES,
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

/**
 * A text search over gdocs of the given types: the search page's articles and
 * data insights, and /api/search's type=pages.
 */
export function buildPagesSearch(
    state: SectionSearchState,
    params: {
        indexName: string
        types: readonly string[]
        attributesToRetrieve: string[]
        pagination: SectionPagination
    }
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
            filters: params.types.map((type) => `type:${type}`).join(" OR "),
            facetFilters: formatTopicFacetFilters(selectedTopics),
            // Do not search through the content of pages in case there is a
            // country filter present. This is to avoid returning pages that
            // might mention a country, but are not *about* that country (e.g.
            // "Unlike Germany...").
            ...(hasCountry && {
                // a subset of searchableAttributes on the Pages index
                restrictSearchableAttributes: ["title", "tags", "authors"],
            }),
            attributesToRetrieve: params.attributesToRetrieve,
            ...HIGHLIGHT_TAGS,
            ...params.pagination,
        },
        // Selected countries are part of the query, so the closest-matches
        // fallback would drop them as optional words and show results that
        // ignore the country filter. An empty section is the honest answer.
        closestMatches: !hasCountry,
    }
}

function buildArticlesSearch(
    state: SectionSearchState,
    params: { indexName: string } & OffsetPagination
): SectionSearch {
    const isFilterOnly = state.query.trim() === ""
    return buildPagesSearch(state, {
        indexName: params.indexName,
        types: [OwidGdocType.Article, OwidGdocType.AboutPage],
        attributesToRetrieve: [
            "title",
            "thumbnailUrl",
            "date",
            "slug",
            "type",
            isFilterOnly ? "excerpt" : "content",
            "authors",
        ],
        pagination: { offset: params.offset, length: params.length },
    })
}

function buildDataInsightsSearch(
    state: SectionSearchState,
    params: { indexName: string } & PagePagination
): SectionSearch {
    return buildPagesSearch(state, {
        indexName: params.indexName,
        types: [OwidGdocType.DataInsight],
        attributesToRetrieve: ["title", "thumbnailUrl", "date", "slug", "type"],
        pagination: { page: params.page, hitsPerPage: params.hitsPerPage },
    })
}

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
            attributesToRetrieve: [
                "title",
                "thumbnailUrl",
                "slug",
                "excerpt",
                "type",
                "availableEntities",
            ],
            ...HIGHLIGHT_TAGS,
            offset: params.offset,
            length: params.length,
        },
        closestMatches: false,
    }
}

/** The hit type each search page section returns. */
export interface SearchPageSectionHits {
    charts: SearchChartHit
    "data-insights": DataInsightHit
    articles: FlatArticleHit
    "topic-pages": TopicPageHit
    profiles: ProfileHit
}

export type SearchPageSection = keyof SearchPageSectionHits

export const SEARCH_PAGE_SECTIONS: readonly SearchPageSection[] = [
    "charts",
    "data-insights",
    "articles",
    "topic-pages",
    "profiles",
]

/** How many charts the search page's Data section shows per page. */
const SEARCH_PAGE_CHARTS_PER_PAGE = 9

/** The pagination each section's search takes. */
interface SearchPageSectionPagination {
    charts: Pick<PagePagination, "page">
    "data-insights": PagePagination
    articles: OffsetPagination
    "topic-pages": OffsetPagination
    profiles: OffsetPagination
}

/** One section's search, as the search page asks for it. */
export type SearchPageSectionRequest<
    S extends SearchPageSection = SearchPageSection,
> = {
    [K in S]: {
        section: K
        state: SectionSearchState
    } & SearchPageSectionPagination[K]
}[S]

/**
 * Runs one section of the search page. The site calls this in the browser and
 * /api/search/sections calls it in a function, so both answer a section with
 * the same Algolia requests.
 */
export async function searchPageSection<S extends SearchPageSection>(
    liteSearchClient: LiteClient,
    request: SearchPageSectionRequest<S>,
    params: {
        indexNames: SearchIndexNames
        /** Only called by the topic pages section, once a chart matches. */
        loadTagGraph: () => Promise<TagGraphRoot>
    }
): Promise<SectionSearchResponse<SearchPageSectionHits[S]>> {
    // Narrowing `request` doesn't narrow S, so the hit type is asserted here
    // once; SearchPageSectionHits says which hits each section's search
    // returns.
    type Hit = SearchPageSectionHits[S]
    const { indexNames } = params
    const req = request as SearchPageSectionRequest
    switch (req.section) {
        case "charts":
            return runSectionSearch<Hit>(
                liteSearchClient,
                buildChartsSearch(req.state, {
                    indexName: indexNames.charts,
                    page: req.page,
                    hitsPerPage: SEARCH_PAGE_CHARTS_PER_PAGE,
                })
            )
        case "data-insights":
            return runSectionSearch<Hit>(
                liteSearchClient,
                buildDataInsightsSearch(req.state, {
                    indexName: indexNames.pages,
                    page: req.page,
                    hitsPerPage: req.hitsPerPage,
                })
            )
        case "articles":
            return runSectionSearch<Hit>(
                liteSearchClient,
                buildArticlesSearch(req.state, {
                    indexName: indexNames.pages,
                    offset: req.offset,
                    length: req.length,
                })
            )
        case "profiles":
            return runSectionSearch<Hit>(
                liteSearchClient,
                buildProfilesSearch(req.state, {
                    indexName: indexNames.pages,
                    offset: req.offset,
                    length: req.length,
                })
            )
        case "topic-pages":
            return recommendTopicPages<Hit>(liteSearchClient, {
                chartsIndexName: indexNames.charts,
                pagesIndexName: indexNames.pages,
                state: req.state,
                loadTagGraph: params.loadTagGraph,
                attributesToRetrieve: SEARCH_PAGE_TOPIC_PAGE_ATTRIBUTES,
                offset: req.offset,
                length: req.length,
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
 * The search page's own URL and /api/search/sections both use them.
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
                    (params.get(param) ?? "").split(SEARCH_URL_LIST_SEPARATOR)
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
 * The URL parameters of /api/search/sections for one section's search: the
 * section, its search state as on the search page's URL, and its pagination.
 * The function parses them back in functions/api/search/sections.ts.
 */
export function searchPageSectionToUrlParams<S extends SearchPageSection>(
    request: SearchPageSectionRequest<S>
): URLSearchParams {
    const params = searchStateToUrlParams(request.state)
    params.set("section", request.section)
    if ("page" in request) params.set("page", String(request.page))
    if ("hitsPerPage" in request)
        params.set("hitsPerPage", String(request.hitsPerPage))
    if ("offset" in request) {
        params.set("offset", String(request.offset))
        params.set("length", String(request.length))
    }
    return params
}
