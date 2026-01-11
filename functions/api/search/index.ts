import * as Sentry from "@sentry/cloudflare"
import { Env } from "../../_common/env.js"
import { getAlgoliaConfig } from "./algoliaClient.js"
import { searchCharts, searchPages, SearchState } from "./searchApi.js"
import { FilterType, Filter, SearchUrlParam } from "@ourworldindata/types"

const DEFAULT_HITS_PER_PAGE = 20
const MAX_HITS_PER_PAGE = 100
const MAX_PAGE = 1000

type SearchType = "charts" | "pages"

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

        // Parse pagination parameters
        const page = parseInt(url.searchParams.get("page") || "0")
        const hitsPerPage = parseInt(
            url.searchParams.get("hitsPerPage") ||
                DEFAULT_HITS_PER_PAGE.toString()
        )

        // Parse output options
        const includeEntities =
            url.searchParams.get("includeEntities") !== "false"
        const rerank = url.searchParams.get("rerank") === "true"

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

        if (rerank && page > 0) {
            return new Response(
                JSON.stringify({
                    error: "Invalid parameter combination",
                    details:
                        "Reranking is only supported for the first page (page=0). Remove the rerank parameter or set page=0.",
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

        // When reranking, fetch max results to get a good pool for reranking
        const fetchHitsPerPage = rerank ? MAX_HITS_PER_PAGE : hitsPerPage

        // Perform search based on type
        if (searchType === "pages") {
            const results = await searchPages(
                algoliaConfig,
                query,
                page * hitsPerPage, // Convert page to offset
                fetchHitsPerPage,
                undefined, // Use default page types
                baseUrl
            )

            return new Response(JSON.stringify(results, null, 2), {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "public, max-age=600",
                    "Access-Control-Allow-Origin": "*",
                },
            })
        }

        // Chart search
        let chartResults = await searchCharts(
            algoliaConfig,
            searchState,
            page,
            fetchHitsPerPage,
            baseUrl
        )

        // Rerank chart results using Cloudflare Workers AI
        if (rerank && query && chartResults.hits.length > 1) {
            const contexts = chartResults.hits.map((hit) => ({
                text: `${hit.title}${hit.subtitle ? `: ${hit.subtitle}` : ""}`,
            }))

            // Note: The Cloudflare types are incomplete - they're missing the required 'query' field
            // See: https://developers.cloudflare.com/workers-ai/models/bge-reranker-base/
            const reranked = (await env.AI.run("@cf/baai/bge-reranker-base", {
                query,
                contexts,
            } as any)) as { response?: { id?: number; score?: number }[] }

            // Reorder results based on reranker scores, then limit to requested hitsPerPage
            if (reranked.response) {
                const reorderedHits = reranked.response
                    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                    .slice(0, hitsPerPage)
                    .map((item) => ({
                        ...chartResults.hits[item.id ?? 0],
                        rerankScore: item.score,
                    }))

                chartResults = {
                    ...chartResults,
                    hits: reorderedHits,
                    hitsPerPage, // Restore the requested hitsPerPage
                }
            }
        }

        // Strip entity fields if not requested (reduces response size significantly)
        if (!includeEntities) {
            chartResults = {
                ...chartResults,
                hits: chartResults.hits.map((hit) => {
                    const {
                        availableEntities: _ae,
                        originalAvailableEntities: _oae,
                        ...rest
                    } = hit as any
                    return rest
                }),
            }
        }

        return new Response(JSON.stringify(chartResults, null, 2), {
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
