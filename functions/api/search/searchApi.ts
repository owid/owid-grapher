import {
    SearchIndexName,
    FilterType,
    Filter,
    ChartRecordType,
    SearchChartHit,
    OwidGdocType,
    TagGraphRoot,
    TopicPageHit,
} from "@ourworldindata/types"
import { getCanonicalUrl } from "@ourworldindata/components"
import {
    getFilterNamesOfType,
    runSearchRequest,
    MAX_FACET_VALUES,
    DEFAULT_PAGE_TYPES,
    type SearchRequest,
    type SectionSearchResponse,
    type SectionSearchState,
} from "@ourworldindata/utils"
import {
    getIndexName,
    getSearchIndexNames,
    createSearchClient,
    AlgoliaConfig,
} from "./algoliaClient.js"

/**
 * Error thrown when the client provides invalid search parameters (e.g. a
 * non-existent topic name).  The API handler uses this to distinguish
 * user-facing validation errors (→ 400, no Sentry) from unexpected failures
 * (→ 500, report to Sentry).
 */
export class SearchValidationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "SearchValidationError"
    }
}

/**
 * Enriched search result with URL added
 * This is what we return from the API after processing Algolia results
 */
export type EnrichedSearchChartHit = Omit<
    SearchChartHit,
    "objectID" | "_highlightResult" | "_snippetResult"
> & {
    url: string
}

/**
 * Page search hit from Algolia
 */
export interface SearchPageHit {
    title: string
    slug: string
    type: string
    thumbnailUrl?: string
    date?: string
    content?: string
    authors?: string[]
    objectID: string
}

/**
 * Enriched page search result with URL added
 */
export type EnrichedSearchPageHit = Omit<
    SearchPageHit,
    "objectID" | "_highlightResult" | "_snippetResult"
> & {
    url: string
}

export interface SearchApiResponse {
    query: string
    results: EnrichedSearchChartHit[]
    nbHits: number
    page: number
    nbPages: number
    hitsPerPage: number
    // True when the exact query returned nothing and these are relaxed
    // "closest matches" instead (see searchSingleForHitsWithClosestMatches).
    closestMatches?: boolean
}

/**
 * A type=topics or type=profiles response: page results that are never
 * closest matches.
 */
export type SearchTopicsApiResponse = Omit<
    SearchPagesApiResponse,
    "closestMatches"
> & { closestMatches?: never }

export type SearchProfilesApiResponse = SearchTopicsApiResponse

export interface SearchPagesApiResponse {
    query: string
    results: EnrichedSearchPageHit[]
    nbHits: number
    offset: number
    length: number
    // True when the exact query returned nothing and these are relaxed
    // "closest matches" instead (see searchSingleForHitsWithClosestMatches).
    closestMatches?: boolean
}

export interface SearchApiOptions {
    /**
     * Keep Algolia's objectID and highlight and snippet fields on each result,
     * as the search page renders them (highlights=true)
     */
    highlights?: boolean
}

/** Runs one search through the search page's own code (runSearchRequest). */
async function runSearch<THit extends { slug: string }>(
    config: AlgoliaConfig,
    request: SearchRequest,
    loadTagGraph?: () => Promise<TagGraphRoot>
): Promise<SectionSearchResponse<THit>> {
    const result = await runSearchRequest<THit>(
        createSearchClient(config),
        request,
        { indexNames: getSearchIndexNames(config.indexPrefix), loadTagGraph }
    )
    // If we got zero results and user is filtering by topic, check if the topic exists
    if (!result.nbHits) await assertTopicsExist(config, request.state.filters)
    return result
}

/**
 * A hit as the API returns it: without Algolia's internal fields (objectID,
 * _highlightResult, _snippetResult, _rankingInfo) unless asked for
 * highlights, and with its URL.
 */
function presentHit<THit extends object>(
    hit: THit,
    url: string,
    options: SearchApiOptions
): THit & { url: string } {
    if (options.highlights) return { ...hit, url }
    const cleanHit = Object.fromEntries(
        Object.entries(hit).filter(
            ([key]) => key !== "objectID" && !key.startsWith("_")
        )
    ) as THit
    return { ...cleanHit, url }
}

/**
 * Fetches available topics from Algolia
 */
async function getAvailableTopics(config: AlgoliaConfig): Promise<string[]> {
    const indexName = getIndexName(
        SearchIndexName.ExplorerViewsMdimViewsAndCharts,
        config.indexPrefix
    )
    const client = createSearchClient(config)

    const response = await client.searchForHits<SearchChartHit>({
        requests: [
            {
                indexName,
                query: "",
                hitsPerPage: 0,
                facets: ["tags"],
                // Algolia returns at most 100 values per facet unless asked for
                // more, and the index carries appreciably more topic tags than
                // that. Left at the default, this listed the 100 commonest and
                // silently dropped the rest, so a perfectly valid but less-used
                // topic — Books, Gender Ratio, Nuclear Energy, Tetanus — was
                // reported to callers as a topic that does not exist (see
                // searchCharts, which only consults this list when a search
                // comes back empty). The cap is Algolia's documented maximum.
                maxValuesPerFacet: MAX_FACET_VALUES,
            },
        ],
    })

    return Object.keys(response.results[0].facets?.tags ?? {}).sort()
}

/**
 * Throws a SearchValidationError when the filters name a topic that doesn't
 * exist. Only worth calling after an empty result, since it costs a request.
 */
async function assertTopicsExist(
    config: AlgoliaConfig,
    filters: Filter[]
): Promise<void> {
    const requestedTopics = getFilterNamesOfType(filters, FilterType.TOPIC)
    if (requestedTopics.size === 0) return
    const availableTopics = await getAvailableTopics(config)
    const invalidTopics = Array.from(requestedTopics).filter(
        (topic) => !availableTopics.includes(topic)
    )
    if (invalidTopics.length > 0) {
        throw new SearchValidationError(
            `No results found. The topic "${invalidTopics.join('", "')}" does not exist. Available topics: ${availableTopics.join(", ")}`
        )
    }
}

export async function searchCharts(
    config: AlgoliaConfig,
    state: SectionSearchState,
    page: number = 0,
    hitsPerPage: number = 20,
    baseUrl: string = "https://ourworldindata.org",
    options: SearchApiOptions = {}
): Promise<SearchApiResponse> {
    const result = await runSearch<SearchChartHit>(config, {
        type: "charts",
        state,
        page,
        hitsPerPage,
    })

    const results = result.hits.map((hit): EnrichedSearchChartHit => {
        const queryParams = ("queryParams" in hit && hit.queryParams) || ""
        // Explorer views: /explorers/{slug}{queryParams}; multi-dimensional
        // views: /grapher/{slug}{queryParams}; charts: /grapher/{slug}
        const url =
            hit.type === ChartRecordType.ExplorerView
                ? `${baseUrl}/explorers/${hit.slug}${queryParams}`
                : hit.type === ChartRecordType.MultiDimView
                  ? `${baseUrl}/grapher/${hit.slug}${queryParams}`
                  : `${baseUrl}/grapher/${hit.slug}`
        return presentHit(hit, url, options)
    })

    return {
        query: state.query,
        results,
        nbHits: result.nbHits ?? 0,
        page: result.page ?? page,
        nbPages: result.nbPages ?? 0,
        hitsPerPage: result.hitsPerPage ?? hitsPerPage,
        ...(result.closestMatches && { closestMatches: true as const }),
    }
}

export async function searchPages(
    config: AlgoliaConfig,
    state: SectionSearchState,
    offset: number = 0,
    length: number = 10,
    pageTypes: readonly string[] = DEFAULT_PAGE_TYPES,
    baseUrl: string = "https://ourworldindata.org",
    options: SearchApiOptions = {}
): Promise<SearchPagesApiResponse> {
    const result = await runSearch<SearchPageHit>(config, {
        type: "pages",
        state,
        pageTypes,
        offset,
        length,
    })

    return {
        query: state.query,
        results: presentPageHits(result.hits, baseUrl, options),
        nbHits: result.nbHits ?? 0,
        offset,
        length,
        ...(result.closestMatches && { closestMatches: true as const }),
    }
}

/** Topic pages to recommend for a query, as on the site (see recommendTopicPages). */
export async function searchTopicPages(
    config: AlgoliaConfig,
    state: SectionSearchState,
    loadTagGraph: () => Promise<TagGraphRoot>,
    offset: number = 0,
    length: number = 10,
    baseUrl: string = "https://ourworldindata.org",
    options: SearchApiOptions = {}
): Promise<SearchTopicsApiResponse> {
    const result = await runSearch<TopicPageHit>(
        config,
        { type: "topics", state, offset, length },
        loadTagGraph
    )

    return {
        query: state.query,
        results: presentPageHits(result.hits, baseUrl, options),
        nbHits: result.nbHits ?? 0,
        offset,
        length,
    }
}

/** Country profiles for the selected countries, as on the site. */
export async function searchProfiles(
    config: AlgoliaConfig,
    state: SectionSearchState,
    offset: number = 0,
    length: number = 10,
    baseUrl: string = "https://ourworldindata.org",
    options: SearchApiOptions = {}
): Promise<SearchProfilesApiResponse> {
    const result = await runSearch<SearchPageHit>(config, {
        type: "profiles",
        state,
        offset,
        length,
    })

    return {
        query: state.query,
        results: presentPageHits(result.hits, baseUrl, options),
        nbHits: result.nbHits ?? 0,
        offset,
        length,
    }
}

/** Adds each page hit's URL (see presentHit). */
function presentPageHits(
    hits: { slug: string; type: string }[],
    baseUrl: string,
    options: SearchApiOptions
): EnrichedSearchPageHit[] {
    return hits.map(
        (hit) =>
            // Different gdoc types bake to different path prefixes (e.g.
            // data-insights -> /data-insights/, profiles -> /profile/), and
            // getCanonicalUrl is what the baker itself uses
            presentHit(
                hit,
                getCanonicalUrl(baseUrl, {
                    slug: hit.slug,
                    content: { type: hit.type as OwidGdocType },
                }),
                options
            ) as EnrichedSearchPageHit
    )
}
