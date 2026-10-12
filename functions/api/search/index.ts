import * as Sentry from "@sentry/cloudflare"
import { Env } from "../../_common/env.js"
import { getAlgoliaConfig } from "./algoliaClient.js"
import {
    searchCharts,
    searchPages,
    searchTopicPages,
    SearchApiResponse,
    SearchPagesApiResponse,
    SearchState,
    SearchTopicsApiResponse,
    SearchValidationError,
} from "./searchApi.js"
import {
    FilterType,
    Filter,
    SearchUrlParam,
    ALL_GDOC_TYPES,
    TagGraphRoot,
} from "@ourworldindata/types"

const DEFAULT_HITS_PER_PAGE = 20
const MAX_HITS_PER_PAGE = 100
const MAX_PAGE = 1000

// topics recommends topic pages for a query, like the site's topic cards
const SEARCH_TYPES = ["charts", "pages", "topics"] as const
type SearchType = (typeof SEARCH_TYPES)[number]

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
    "pageTypes",
    "page",
    "hitsPerPage",
])

// The parameters only some search types read. A request that sends one to a
// type that doesn't read it gets a warning instead of a silently different
// answer (e.g. a type=pages search with `topics`, which only filters charts
// and topic recommendations).
const PARAMS_BY_TYPE = new Map<string, readonly SearchType[]>([
    [SearchUrlParam.COUNTRY, ["charts", "topics"]],
    [SearchUrlParam.TOPIC, ["charts", "topics"]],
    [SearchUrlParam.REQUIRE_ALL_COUNTRIES, ["charts", "topics"]],
    ["pageTypes", ["pages"]],
])

// type=topics filters by country only when it searches charts, which needs a
// query.
const CHART_ONLY_PARAMS = new Set<string>([
    SearchUrlParam.COUNTRY,
    SearchUrlParam.REQUIRE_ALL_COUNTRIES,
])

const isSearchType = (value: string): value is SearchType =>
    (SEARCH_TYPES as readonly string[]).includes(value)

// Hints for parameters people carry over from the search page's URL.
const PARAM_HINTS = new Map<string, string>([
    [
        SearchUrlParam.RESULT_TYPE,
        'Use "type=pages" to search writing, "type=topics" for topic pages, or "type=charts" for charts.',
    ],
])

/**
 * The topic tag graph the site bakes to /topicTagGraph.json; it maps tag
 * names to topic page slugs for topic page recommendations.
 */
async function fetchTagGraph(env: Env, baseUrl: string): Promise<TagGraphRoot> {
    const response = await env.ASSETS.fetch(
        new URL("/topicTagGraph.json", baseUrl)
    )
    if (!response.ok)
        throw new Error(
            `Failed to fetch /topicTagGraph.json: ${response.status}`
        )
    return response.json()
}

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

        const typeParam = url.searchParams.get("type") || "charts"
        if (!isSearchType(typeParam)) {
            return new Response(
                JSON.stringify({
                    error: "Invalid type parameter",
                    details: `Type must be one of: ${SEARCH_TYPES.join(", ")}`,
                }),
                {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            )
        }
        const searchType = typeParam

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
                    `Ignored parameter "${param}": it applies only to ${PARAMS_BY_TYPE.get(
                        param
                    )!
                        .map((type) => `type=${type}`)
                        .join(" and ")}.`
            ),
            ...queryOnlyParams.map(
                (param) =>
                    `Ignored parameter "${param}": type=topics filters by country only with a query.`
            ),
        ]
        const warnings = warningList.length > 0 ? warningList : undefined

        // Parse query parameter
        const query = url.searchParams.get(SearchUrlParam.QUERY) || ""

        // Parse filter parameters
        const countriesParam = url.searchParams.get(SearchUrlParam.COUNTRY)
        const topicParam = url.searchParams.get(SearchUrlParam.TOPIC)
        const requireAllCountries =
            url.searchParams.get(SearchUrlParam.REQUIRE_ALL_COUNTRIES) ===
            "true"

        // Which gdoc content types to include (type=pages only, e.g.
        // "data-insight" or "article,about-page"). Omitted -> searchPages()'s
        // own default (article + about-page). Validated upfront against the
        // full gdoc type enum (a static, compile-time list — unlike topics,
        // which are dynamic data and so are validated lazily against a live
        // lookup).
        const pageTypesParam =
            searchType === "pages" ? url.searchParams.get("pageTypes") : null
        let pageTypes: string[] | undefined
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

        // Parse pagination parameters
        const page = parseInt(url.searchParams.get("page") || "0")
        const hitsPerPage = parseInt(
            url.searchParams.get("hitsPerPage") ||
                DEFAULT_HITS_PER_PAGE.toString()
        )

        // Validate pagination parameters

        if (page < 0 || page > MAX_PAGE) {
            return new Response(
                JSON.stringify({
                    error: "Invalid page parameter",
                    details: `Page must be between 0 and ${MAX_PAGE}`,
                }),
                {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            )
        }

        if (hitsPerPage < 1 || hitsPerPage > MAX_HITS_PER_PAGE) {
            return new Response(
                JSON.stringify({
                    error: "Invalid hitsPerPage parameter",
                    details: `hitsPerPage must be between 1 and ${MAX_HITS_PER_PAGE}`,
                }),
                {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            )
        }

        // Build filters array
        const filters: Filter[] = []

        if (countriesParam) {
            // Countries are separated by tilde (~) to match Grapher URL format
            const countries = countriesParam
                .split("~")
                .map((c) => c.trim())
                .filter(Boolean)
            countries.forEach((country) => {
                filters.push({
                    type: FilterType.COUNTRY,
                    name: country,
                })
            })
        }

        // Only support single topic (UI doesn't support multiple topics)
        if (topicParam) {
            const topic = topicParam.trim()
            if (topic) {
                filters.push({
                    type: FilterType.TOPIC,
                    name: topic,
                })
            }
        }

        // Build search state
        const searchState: SearchState = {
            query,
            filters,
            requireAllCountries,
        }

        // Get Algolia config
        const algoliaConfig = getAlgoliaConfig(env)

        // Extract base URL from request (for staging/preview deployments)
        const baseUrl = `${url.protocol}//${url.host}`

        const search = (): Promise<
            SearchApiResponse | SearchPagesApiResponse | SearchTopicsApiResponse
        > => {
            switch (searchType) {
                case "charts":
                    return searchCharts(
                        algoliaConfig,
                        searchState,
                        page,
                        hitsPerPage,
                        baseUrl
                    )
                case "pages":
                    return searchPages(
                        algoliaConfig,
                        query,
                        page * hitsPerPage, // Convert page to offset
                        hitsPerPage,
                        pageTypes, // undefined -> searchPages()'s own default
                        baseUrl
                    )
                case "topics":
                    return searchTopicPages(
                        algoliaConfig,
                        searchState,
                        () => fetchTagGraph(env, baseUrl),
                        page * hitsPerPage, // Convert page to offset
                        hitsPerPage,
                        baseUrl
                    )
            }
        }
        const results = await search()

        return new Response(JSON.stringify({ ...results, warnings }, null, 2), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=600", // 10 minutes
                "Access-Control-Allow-Origin": "*", // Allow CORS for API usage
            },
        })
    } catch (error) {
        // Client validation errors (e.g. invalid topic name) are returned
        // as 400 without being reported to Sentry.
        if (error instanceof SearchValidationError) {
            return new Response(
                JSON.stringify({
                    error: error.message,
                }),
                {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            )
        }

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
