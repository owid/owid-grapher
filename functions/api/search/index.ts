import * as Sentry from "@sentry/cloudflare"
import { Env } from "../../_common/env.js"
import { getTypesenseConfig } from "./typesenseClient.js"
import {
    searchCharts,
    searchPages,
    SearchState,
    DEFAULT_ALPHA,
    DedupStrategy,
} from "./searchApi.js"
import { FilterType, Filter, SearchUrlParam } from "@ourworldindata/types"

const DEFAULT_HITS_PER_PAGE = 20
const MAX_HITS_PER_PAGE = 100
const MAX_PAGE = 1000

type SearchType = "charts" | "pages"

const hasSearchEnvVars = (env: Env): boolean => {
    return !!env.TYPESENSE_HOST && !!env.TYPESENSE_SEARCH_KEY
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { request, env } = context
    const url = new URL(request.url)

    try {
        if (!hasSearchEnvVars(env)) {
            throw new Error(
                "Missing environment variables. Please check that both TYPESENSE_HOST and TYPESENSE_SEARCH_KEY are set."
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

        // Parse alpha parameter for hybrid search
        const alphaParam = url.searchParams.get("alpha")
        let alpha = DEFAULT_ALPHA
        if (alphaParam !== null) {
            alpha = parseFloat(alphaParam)
            if (isNaN(alpha) || alpha < 0 || alpha > 1) {
                return new Response(
                    JSON.stringify({
                        error: "Invalid alpha parameter",
                        details:
                            "alpha must be a number between 0.0 (pure keyword) and 1.0 (pure semantic)",
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
        }

        // Parse dedup strategy parameter
        const dedupParam = url.searchParams.get("dedup") || "api"
        if (dedupParam !== "api" && dedupParam !== "typesense") {
            return new Response(
                JSON.stringify({
                    error: "Invalid dedup parameter",
                    details:
                        'dedup must be either "api" (application-side deduplication) or "typesense" (server-side group_by)',
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
        const dedup: DedupStrategy = dedupParam

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

        // Get Typesense config
        const typesenseConfig = getTypesenseConfig(env)

        // Extract base URL from request (for staging/preview deployments)
        const baseUrl = `${url.protocol}//${url.host}`

        // Perform search based on type
        const results =
            searchType === "pages"
                ? await searchPages(
                      typesenseConfig,
                      query,
                      page * hitsPerPage, // Convert page to offset
                      hitsPerPage,
                      undefined, // Use default page types
                      baseUrl,
                      alpha,
                      dedup
                  )
                : await searchCharts(
                      typesenseConfig,
                      searchState,
                      page,
                      hitsPerPage,
                      baseUrl,
                      alpha,
                      dedup
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
