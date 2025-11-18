import * as Sentry from "@sentry/cloudflare"
import { Env } from "../../_common/env.js"
import { getAlgoliaConfig } from "./algoliaClient.js"
import { searchCharts, SearchState } from "./searchApi.js"
import { FilterType, Filter } from "./types.js"

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
        // Parse query parameter
        const query = url.searchParams.get("q") || ""

        // Parse filter parameters
        const countriesParam = url.searchParams.get("countries")
        const topicsParam = url.searchParams.get("topics")
        const requireAllCountries =
            url.searchParams.get("requireAllCountries") === "true"

        // Parse pagination parameters
        const page = parseInt(url.searchParams.get("page") || "0")
        const hitsPerPage = parseInt(
            url.searchParams.get("hitsPerPage") || "20"
        )

        // Validate pagination parameters
        const MAX_HITS_PER_PAGE = 100
        const MAX_PAGE = 1000

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
            const countries = countriesParam
                .split(",")
                .map((c) => c.trim())
                .filter(Boolean)
            countries.forEach((country) => {
                filters.push({
                    type: FilterType.COUNTRY,
                    name: country,
                })
            })
        }

        if (topicsParam) {
            const topics = topicsParam
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
            topics.forEach((topic) => {
                filters.push({
                    type: FilterType.TOPIC,
                    name: topic,
                })
            })
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

        // Perform search
        const results = await searchCharts(
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
