import * as Sentry from "@sentry/cloudflare"
import { Env } from "../../_common/env.js"
import { getAlgoliaConfig } from "./algoliaClient.js"
import {
    searchCharts,
    searchPages,
    searchTopicPages,
    SearchState,
    SearchValidationError,
} from "./searchApi.js"
import {
    FilterType,
    Filter,
    OwidGdocType,
    SearchUrlParam,
    ALL_GDOC_TYPES,
    TagGraphRoot,
} from "@ourworldindata/types"
import { isTopicPageType } from "@ourworldindata/utils"

const DEFAULT_HITS_PER_PAGE = 20
const MAX_HITS_PER_PAGE = 100
const MAX_PAGE = 1000

type SearchType = "charts" | "pages"

// gdoc content types the `pageTypes` param (type=pages only) may request, as
// a Set for O(1) membership checks.
const VALID_PAGE_TYPES = new Set<string>(ALL_GDOC_TYPES)

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

        // Determine search type
        const searchType: SearchType =
            (url.searchParams.get("type") as SearchType) || "charts"

        if (searchType !== "charts" && searchType !== "pages") {
            return new Response(
                JSON.stringify({
                    error: "Invalid type parameter",
                    details: 'Type must be either "charts" or "pages"',
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

        // Parse query parameter
        const query = url.searchParams.get(SearchUrlParam.QUERY) || ""

        // Parse filter parameters
        const countriesParam = url.searchParams.get(SearchUrlParam.COUNTRY)
        const topicParam = url.searchParams.get(SearchUrlParam.TOPIC)
        const requireAllCountries =
            url.searchParams.get(SearchUrlParam.REQUIRE_ALL_COUNTRIES) ===
            "true"

        // Which gdoc content types to include (only applies when
        // type=pages, e.g. "data-insight" or "article,about-page"). Omitted
        // -> searchPages()'s own default (article + about-page), so existing
        // callers see no change. Validated upfront against the full gdoc
        // type enum (a static, compile-time list — unlike topics, which are
        // dynamic data and so are validated lazily against a live lookup).
        const pageTypesParam = url.searchParams.get("pageTypes")
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

        // A search for topic pages alone is a recommendation ("which topics
        // is this query about?") and is answered from the matching charts,
        // like the site's search page does. Mixed page types and empty
        // queries stay a plain text search.
        const wantsTopicPagesOnly =
            pageTypes !== undefined &&
            pageTypes.every(isTopicPageType) &&
            query.trim() !== ""

        // Perform search based on type
        const results =
            searchType === "pages"
                ? wantsTopicPagesOnly
                    ? await searchTopicPages(
                          algoliaConfig,
                          searchState,
                          await fetchTagGraph(env, baseUrl),
                          page * hitsPerPage, // Convert page to offset
                          hitsPerPage,
                          pageTypes as OwidGdocType[],
                          baseUrl
                      )
                    : await searchPages(
                          algoliaConfig,
                          query,
                          page * hitsPerPage, // Convert page to offset
                          hitsPerPage,
                          pageTypes, // undefined -> searchPages()'s own default
                          baseUrl
                      )
                : await searchCharts(
                      algoliaConfig,
                      searchState,
                      page,
                      hitsPerPage,
                      baseUrl
                  )

        return new Response(JSON.stringify(results, null, 2), {
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
