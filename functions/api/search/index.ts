import * as Sentry from "@sentry/cloudflare"
import { Env } from "../../_common/env.js"
import { getAlgoliaConfig } from "./algoliaClient.js"
import {
    searchCharts,
    searchPages,
    SearchState,
    SearchApiResponse,
    EnrichedSearchChartHit,
} from "./searchApi.js"
import { FilterType, Filter, SearchUrlParam } from "@ourworldindata/types"

const DEFAULT_HITS_PER_PAGE = 20
const MAX_HITS_PER_PAGE = 100
const MAX_PAGE = 1000

type SearchType = "charts" | "pages"

const hasSearchEnvVars = (env: Env): boolean => {
    return !!env.ALGOLIA_ID && !!env.ALGOLIA_SEARCH_KEY
}

// Boost added to featured metrics' rerank scores to keep them near the top
// This ensures hand-curated featured metrics remain prominent after AI reranking
const FEATURED_METRIC_BOOST = 0.1

/**
 * Check if a hit is a featured metric by looking at its objectID.
 * Featured metrics have objectIDs like "123-fm-default-population"
 *
 * TODO: Ideally, we'd have an `isFeaturedMetric` boolean field in Algolia
 * that we could retrieve directly, rather than inferring from the objectID.
 */
function isFeaturedMetric(hit: EnrichedSearchChartHit): boolean {
    return (hit as any).objectID?.includes("-fm-") ?? false
}

/**
 * Rerank search results using Cloudflare Workers AI.
 *
 * Featured metrics get a score boost to ensure hand-curated content
 * remains prominent even after AI reranking.
 *
 * NOTE: The BGE reranker model doesn't work as well as hoped - it doesn't
 * strongly distinguish between different contexts (e.g., "Venezuela oil"
 * still ranks "Maize oil production" highly).
 */
async function rerankResults(
    env: Env,
    results: SearchApiResponse,
    query: string,
    countriesParam: string | null,
    hitsPerPage: number
): Promise<SearchApiResponse> {
    if (!query || results.hits.length <= 1) {
        return results
    }
    try {
        const contexts = results.hits.map((hit) => ({
            text: `${hit.title}${hit.subtitle ? `: ${hit.subtitle}` : ""}`,
        }))

        // Build the full reranking query including country context
        // e.g., "Venezuela oil" becomes query="oil" + countries="Venezuela"
        // We reconstruct "Venezuela oil" for reranking so it ranks
        // "Oil production in Venezuela" higher than "Maize oil production"
        const rerankQuery = countriesParam
            ? `${countriesParam.replace(/~/g, ", ")} ${query}`
            : query

        console.log("Reranking query:", rerankQuery)

        // Note: The Cloudflare types are incomplete - they're missing the required 'query' field
        // See: https://developers.cloudflare.com/workers-ai/models/bge-reranker-base/
        const reranked = (await env.AI.run("@cf/baai/bge-reranker-base", {
            query: rerankQuery,
            contexts,
        } as any)) as { response?: { id?: number; score?: number }[] }

        if (!reranked.response) {
            return results
        }

        // Combine rerank scores with featured metric boost
        const scoredHits = reranked.response.map((item) => {
            const hit = results.hits[item.id ?? 0]
            const baseScore = item.score ?? 0
            const boost = isFeaturedMetric(hit) ? FEATURED_METRIC_BOOST : 0
            return {
                hit,
                rerankScore: baseScore,
                combinedScore: baseScore + boost,
            }
        })

        const reorderedHits = scoredHits
            .sort((a, b) => b.combinedScore - a.combinedScore)
            .slice(0, hitsPerPage)
            .map(({ hit, rerankScore, combinedScore }) => ({
                ...hit,
                rerankScore,
                finalScore: combinedScore,
            }))

        return {
            ...results,
            hits: reorderedHits,
            hitsPerPage,
        }
    } catch (error) {
        // Log the error but don't fail the search - just return unranked results
        console.error("Reranking failed, returning original results:", error)
        return results
    }
}

/**
 * Strip verbose fields (entities, highlights) from results to reduce response size.
 */
function stripVerboseFields(results: SearchApiResponse): SearchApiResponse {
    return {
        ...results,
        hits: results.hits.map((hit) => {
            const {
                availableEntities: _ae,
                originalAvailableEntities: _oae,
                _highlightResult: _hr,
                ...rest
            } = hit as EnrichedSearchChartHit & {
                _highlightResult?: unknown
            }
            return rest as EnrichedSearchChartHit
        }),
    }
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
        // verbose=true includes all fields (entities, highlights, etc.) - useful for debugging
        const verbose = url.searchParams.get("verbose") === "true"
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

        console.log(`Search request: ${query}`)

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

        // Rerank results using AI if requested
        if (rerank) {
            chartResults = await rerankResults(
                env,
                chartResults,
                query,
                countriesParam,
                hitsPerPage
            )
        }

        // Strip verbose fields by default to reduce response size
        if (!verbose) {
            chartResults = stripVerboseFields(chartResults)
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
