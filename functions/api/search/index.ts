import * as Sentry from "@sentry/cloudflare"
import { Env } from "../../_common/env.js"
import { getAlgoliaConfig, type AlgoliaAttempt } from "./algoliaClient.js"
import { fetchTagGraph } from "../../_common/search/tagGraph.js"
import {
    searchCharts,
    searchPages,
    searchProfiles,
    searchTopicPages,
    SearchApiOptions,
    SearchApiResponse,
    SearchPagesApiResponse,
    SearchProfilesApiResponse,
    SearchTopicsApiResponse,
    SearchValidationError,
} from "./searchApi.js"
import { SearchUrlParam, ALL_GDOC_TYPES } from "@ourworldindata/types"
import {
    DEFAULT_PAGE_TYPES,
    SEARCH_TYPES,
    searchUrlParamsToSectionState,
    type SearchType,
} from "@ourworldindata/utils"

// Searches without a query (the search page's browse states, featured
// charts and data insights on other pages) don't depend on reader input, so
// they are cached at the edge for a day, as in cached-queries.ts. Searches
// with a query are only cached by the browser, so Algolia's analytics still
// see each of them.
const QUERYLESS_CACHE_MAX_AGE_SECONDS = 60 * 60 * 24
const CACHE_MAX_AGE_SECONDS = 60 * 10

const DEFAULT_HITS_PER_PAGE = 20
const MAX_HITS_PER_PAGE = 100
// DIAGNOSTIC: isolate age and request count for Server-Timing
// (Date.now() at module scope is 0 in Workers, so set on first request)
let isolateStart: number | undefined
let isolateRequests = 0
const MAX_PAGE = 1000
const MAX_OFFSET = MAX_PAGE * MAX_HITS_PER_PAGE
// Algolia rejects queries longer than 512 bytes
const MAX_QUERY_BYTES = 512
const MAX_FILTERS = 50
const MAX_FILTER_NAME_LENGTH = 200

const DATASET_PARAMS = [
    SearchUrlParam.DATASET_PRODUCT,
    SearchUrlParam.DATASET_NAMESPACE,
    SearchUrlParam.DATASET_VERSION,
    SearchUrlParam.DATASET_PRODUCER,
]

// gdoc content types the `pageTypes` param (type=pages only) may request, as
// a Set for O(1) membership checks.
const VALID_PAGE_TYPES = new Set<string>(ALL_GDOC_TYPES)

// Every query parameter this endpoint reads. Anything else is ignored, since
// callers routinely append their own (utm_* tags, cache-busters), but it's
// named in a `warnings` field so a misspelled or misplaced parameter is still
// visible (e.g. the search page's `resultType=writing` returns charts, since
// `type` defaults to "charts").
const KNOWN_PARAMS = new Set<string>([
    "type",
    SearchUrlParam.QUERY,
    SearchUrlParam.COUNTRY,
    SearchUrlParam.TOPIC,
    SearchUrlParam.REQUIRE_ALL_COUNTRIES,
    ...DATASET_PARAMS,
    "pageTypes",
    "page",
    "hitsPerPage",
    "offset",
    "length",
    "highlights",
])

// The parameters only some search types read. A request that sends one to a
// type that doesn't read it gets a warning instead of a silently different
// answer (e.g. a type=pages search with `requireAllCountries`, which pages
// can't honor since they aren't tagged with countries).
const PARAMS_BY_TYPE = new Map<string, readonly SearchType[]>([
    [SearchUrlParam.REQUIRE_ALL_COUNTRIES, ["charts", "topics", "profiles"]],
    ...DATASET_PARAMS.map((param) => [param, ["charts"]] as const),
    ["pageTypes", ["pages"]],
    ["offset", ["pages", "topics", "profiles"]],
    ["length", ["pages", "topics", "profiles"]],
])

// type=topics filters by country only when charts match a query, so never
// without one.
const CHART_ONLY_PARAMS = new Set<string>([
    SearchUrlParam.COUNTRY,
    SearchUrlParam.REQUIRE_ALL_COUNTRIES,
])

const isSearchType = (value: string): value is SearchType =>
    (SEARCH_TYPES as readonly string[]).includes(value)

/** "a", "a and b", "a, b and c" */
const formatList = (items: readonly string[]): string =>
    items.length > 1
        ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`
        : items.join("")

const badRequest = (error: string, details?: string): Response =>
    new Response(JSON.stringify({ error, details }), {
        status: 400,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
    })

/** An integer parameter, or its default when not sent; null when invalid. */
function parseIntegerParam(
    params: URLSearchParams,
    name: string,
    defaultValue: number,
    min: number,
    max: number
): number | null {
    const value = params.get(name)
    if (!value) return defaultValue
    if (!/^-?\d+$/.test(value)) return null
    const number = Number(value)
    return number >= min && number <= max ? number : null
}

// Algolia's client throws an ApiError with the HTTP status. A 400 means
// Algolia refused this request (e.g. too many query words), not that
// something is broken. Other 4xx (a revoked key, rate limiting) are outages,
// so they go to Sentry.
const isAlgoliaBadRequest = (error: unknown): boolean =>
    error instanceof Error && "status" in error && error.status === 400

// Hints for parameters people carry over from the search page's URL.
const PARAM_HINTS = new Map<string, string>([
    [
        SearchUrlParam.RESULT_TYPE,
        'Use "type=pages" to search writing, "type=topics" for topic pages, "type=profiles" for country profiles, or "type=charts" for charts.',
    ],
])

const hasSearchEnvVars = (env: Env): boolean => {
    return !!env.ALGOLIA_ID && !!env.ALGOLIA_SEARCH_KEY
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { request, env } = context
    const url = new URL(request.url)

    try {
        if (!hasSearchEnvVars(env)) {
            throw new Error(
                "Missing environment variables. Please check that both ALGOLIA_ID and ALGOLIA_SEARCH_KEY are set."
            )
        }

        const searchType = url.searchParams.get("type") || "charts"
        if (!isSearchType(searchType))
            return badRequest(
                "Invalid type parameter",
                `Type must be one of: ${SEARCH_TYPES.join(", ")}`
            )

        // utm_* tags are expected noise, not mistakes worth a warning
        const sentParams = [...new Set(url.searchParams.keys())]
        const unknownParams = sentParams.filter(
            (param) => !KNOWN_PARAMS.has(param) && !param.startsWith("utm_")
        )
        // An empty value is as good as not sending the parameter
        const unusedParams = sentParams.filter(
            (param) =>
                url.searchParams.get(param) &&
                PARAMS_BY_TYPE.get(param)?.includes(searchType) === false
        )
        const queryless = !(
            url.searchParams.get(SearchUrlParam.QUERY) ?? ""
        ).trim()
        const queryOnlyParams =
            searchType === "topics" && queryless
                ? sentParams.filter(
                      (param) =>
                          url.searchParams.get(param) &&
                          CHART_ONLY_PARAMS.has(param)
                  )
                : []
        const warningList = [
            ...(unknownParams.length > 0
                ? [
                      [
                          `Ignored unknown parameter(s): "${unknownParams.join('", "')}". Valid parameters: ${Array.from(KNOWN_PARAMS).join(", ")}.`,
                          ...unknownParams
                              .map((param) => PARAM_HINTS.get(param))
                              .filter(Boolean),
                      ].join(" "),
                  ]
                : []),
            ...unusedParams.map(
                (param) =>
                    `Ignored parameter "${param}": it applies only to ${formatList(
                        PARAMS_BY_TYPE.get(param)!.map((type) => `type=${type}`)
                    )}.`
            ),
            ...queryOnlyParams.map(
                (param) =>
                    `Ignored parameter "${param}": type=topics filters by country only when charts match a query.`
            ),
        ]
        const warnings = warningList.length > 0 ? warningList : undefined

        // Query and filters, as on the search page's URL
        const searchState = searchUrlParamsToSectionState(url.searchParams)
        if (
            new TextEncoder().encode(searchState.query).length > MAX_QUERY_BYTES
        )
            return badRequest(
                "Query too long",
                `The query must be at most ${MAX_QUERY_BYTES} bytes`
            )
        if (
            searchState.filters.length > MAX_FILTERS ||
            searchState.filters.some(
                (filter) => filter.name.length > MAX_FILTER_NAME_LENGTH
            )
        )
            return badRequest(
                "Too many or too long filters",
                `At most ${MAX_FILTERS} filter values of up to ${MAX_FILTER_NAME_LENGTH} characters`
            )

        // Which gdoc content types to include (type=pages only, e.g.
        // "data-insight" or "article,about-page"). Omitted -> articles and
        // about pages. Validated upfront against the full gdoc type enum (a
        // static, compile-time list — unlike topics, which are dynamic data
        // and so are validated lazily against a live lookup).
        const pageTypesParam =
            searchType === "pages" ? url.searchParams.get("pageTypes") : null
        let pageTypes: readonly string[] = DEFAULT_PAGE_TYPES
        if (pageTypesParam) {
            pageTypes = pageTypesParam
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
            const invalidTypes = pageTypes.filter(
                (t) => !VALID_PAGE_TYPES.has(t)
            )
            if (invalidTypes.length > 0) {
                throw new SearchValidationError(
                    `Invalid pageTypes value(s): "${invalidTypes.join('", "')}". Valid types: ${Array.from(VALID_PAGE_TYPES).join(", ")}`
                )
            }
        }

        // Pagination: page and hitsPerPage for every type; offset and length
        // (which take precedence) for all but charts
        const page = parseIntegerParam(url.searchParams, "page", 0, 0, MAX_PAGE)
        if (page === null)
            return badRequest(
                "Invalid page parameter",
                `Page must be between 0 and ${MAX_PAGE}`
            )
        const hitsPerPage = parseIntegerParam(
            url.searchParams,
            "hitsPerPage",
            DEFAULT_HITS_PER_PAGE,
            1,
            MAX_HITS_PER_PAGE
        )
        if (hitsPerPage === null)
            return badRequest(
                "Invalid hitsPerPage parameter",
                `hitsPerPage must be between 1 and ${MAX_HITS_PER_PAGE}`
            )
        const offset = parseIntegerParam(
            url.searchParams,
            "offset",
            page * hitsPerPage,
            0,
            MAX_OFFSET
        )
        if (offset === null)
            return badRequest(
                "Invalid offset parameter",
                `offset must be between 0 and ${MAX_OFFSET}`
            )
        const length = parseIntegerParam(
            url.searchParams,
            "length",
            hitsPerPage,
            1,
            MAX_HITS_PER_PAGE
        )
        if (length === null)
            return badRequest(
                "Invalid length parameter",
                `length must be between 1 and ${MAX_HITS_PER_PAGE}`
            )

        const options: SearchApiOptions = {
            highlights: url.searchParams.get("highlights") === "true",
        }

        // Get Algolia config
        const algoliaConfig = getAlgoliaConfig(env, request)
        // DIAGNOSTIC: report Algolia attempts and isolate age via Server-Timing
        const attempts: AlgoliaAttempt[] = []
        algoliaConfig.attempts = attempts
        isolateRequests++
        isolateStart ??= Date.now()
        const requestStart = Date.now()

        // Extract base URL from request (for staging/preview deployments)
        const baseUrl = `${url.protocol}//${url.host}`

        const search = (): Promise<
            | SearchApiResponse
            | SearchPagesApiResponse
            | SearchTopicsApiResponse
            | SearchProfilesApiResponse
        > => {
            switch (searchType) {
                case "charts":
                    return searchCharts(
                        algoliaConfig,
                        searchState,
                        page,
                        hitsPerPage,
                        baseUrl,
                        options
                    )
                case "pages":
                    return searchPages(
                        algoliaConfig,
                        searchState,
                        offset,
                        length,
                        pageTypes,
                        baseUrl,
                        options
                    )
                case "topics":
                    return searchTopicPages(
                        algoliaConfig,
                        searchState,
                        () => fetchTagGraph(env, baseUrl),
                        offset,
                        length,
                        baseUrl,
                        options
                    )
                case "profiles":
                    return searchProfiles(
                        algoliaConfig,
                        searchState,
                        offset,
                        length,
                        baseUrl,
                        options
                    )
            }
        }
        const cache = caches.default
        const cachedResponse = queryless
            ? await cache.match(request.url)
            : undefined
        if (cachedResponse) return cachedResponse

        const results = await search()
        const totalMs = Date.now() - requestStart

        const response = new Response(
            JSON.stringify({ ...results, warnings }, null, 2),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": `public, max-age=${queryless ? QUERYLESS_CACHE_MAX_AGE_SECONDS : CACHE_MAX_AGE_SECONDS}`,
                    "Access-Control-Allow-Origin": "*", // Allow CORS for API usage
                    "Server-Timing": [
                        `handler;dur=${totalMs}`,
                        ...attempts.map(
                            (a, i) =>
                                `algolia${i};dur=${a.ms};desc="${a.host} status=${a.status} timedOut=${a.timedOut} server=${a.serverMs ?? ""} processing=${a.processingMs ?? ""}"`
                        ),
                        `isolate;desc="age=${Math.round((Date.now() - (isolateStart ?? 0)) / 1000)}s req=${isolateRequests} colo=${(request as { cf?: { colo?: string } }).cf?.colo ?? ""}"`,
                    ].join(", "),
                },
            }
        )
        if (queryless)
            context.waitUntil(
                cache.put(request.url, response.clone()).catch((error) => {
                    console.error("Failed to cache search response:", error)
                })
            )
        return response
    } catch (error) {
        // Client validation errors (e.g. invalid topic name) are returned
        // as 400 without being reported to Sentry.
        if (
            error instanceof SearchValidationError ||
            isAlgoliaBadRequest(error)
        )
            return badRequest((error as Error).message)

        console.error("Search API error:", error)
        Sentry.captureException(error)

        return new Response(
            JSON.stringify({
                error: "An error occurred while processing the search request",
            }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        )
    }
}
