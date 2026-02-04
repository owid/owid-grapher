import { Env } from "../../../_common/env.js"
import {
    getBaseUrl,
    validateQueryParams,
    COMMON_SEARCH_PARAMS,
} from "../utils.js"
import { createOpenAI } from "@ai-sdk/openai"
import { generateText, tool, stepCountIs } from "ai"
import { z } from "zod"
import { getAlgoliaConfig } from "../../search/algoliaClient.js"
import { searchCharts, SearchState } from "../../search/searchApi.js"

const VALID_PARAMS = new Set([COMMON_SEARCH_PARAMS.QUERY, "max_results"])

const DEFAULT_MAX_RESULTS = 5
const MAX_RESULTS_LIMIT = 10

interface RecommendedChart {
    title: string
    url: string
    slug: string
    subtitle?: string
}

interface RecommendResponse {
    query: string
    recommendations: RecommendedChart[]
    searchQueries: string[]
    timing: {
        total_ms: number
        agent_ms: number
    }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, request } = context
    const url = new URL(request.url)
    const baseUrl = getBaseUrl(request)
    const startTime = Date.now()

    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
    }

    try {
        const validationError = validateQueryParams(url, VALID_PARAMS)
        if (validationError) return validationError

        const query = url.searchParams.get(COMMON_SEARCH_PARAMS.QUERY) || ""
        const maxResults = Math.min(
            parseInt(
                url.searchParams.get("max_results") ||
                    String(DEFAULT_MAX_RESULTS)
            ),
            MAX_RESULTS_LIMIT
        )

        if (!query.trim()) {
            return new Response(
                JSON.stringify({
                    error: "Query required",
                    details:
                        "The 'q' parameter is required and cannot be empty",
                }),
                { status: 400, headers }
            )
        }

        if (!env.OPENAI_API_KEY) {
            return new Response(
                JSON.stringify({
                    error: "Configuration error",
                    details: "OPENAI_API_KEY not configured",
                }),
                { status: 500, headers }
            )
        }

        const openai = createOpenAI({
            apiKey: env.OPENAI_API_KEY,
            compatibility: "strict", // Use chat completions API
        })

        const algoliaConfig = getAlgoliaConfig(env)
        const searchQueriesUsed: string[] = []
        // Track all charts found during search, indexed by slug
        const chartsBySlug = new Map<
            string,
            { title: string; slug: string; subtitle?: string }
        >()

        const chartSearchTool = tool({
            description:
                "Search Our World in Data charts by keywords. Returns chart titles and metadata. Use specific data-related keywords like 'GDP per capita', 'CO2 emissions', 'life expectancy', etc.",
            inputSchema: z.object({
                keywords: z
                    .string()
                    .describe(
                        "Search keywords for finding charts (e.g., 'population growth', 'renewable energy')"
                    ),
            }),
            execute: async ({ keywords }) => {
                searchQueriesUsed.push(keywords)

                const searchState: SearchState = {
                    query: keywords,
                    filters: [],
                    requireAllCountries: false,
                }

                try {
                    const results = await searchCharts(
                        algoliaConfig,
                        searchState,
                        0,
                        10,
                        baseUrl
                    )

                    // Return only essential fields for the LLM to minimize tokens
                    const charts = results.hits.slice(0, 10).map((hit) => ({
                        title: hit.title,
                        subtitle: hit.subtitle,
                        slug: hit.slug,
                    }))
                    // Store charts for later lookup
                    for (const chart of charts) {
                        chartsBySlug.set(chart.slug, chart)
                    }
                    return charts
                } catch (error) {
                    return []
                }
            },
        })


        const agentStartTime = Date.now()

        const { text } = await generateText({
            model: openai("gpt-5-mini"),
            tools: {
                search: chartSearchTool,
            },
            stopWhen: stepCountIs(5),
            system: `You recommend Our World in Data charts based on user queries.

Instructions:
1. Search using SHORT keywords (2-4 words max), like "life expectancy", "poverty rate", "child mortality"
2. Do 1-3 searches with different keywords to cover the user's question
3. Review ALL search results and select the ${maxResults} MOST RELEVANT charts that directly answer the user's question
4. Filter out charts that are tangential, too specific, or don't clearly help answer the question
5. After searching, respond with ONLY a JSON array of the selected chart slugs, ordered by relevance. Example: ["life-expectancy", "share-in-extreme-poverty"]

Example: For "Is the world getting better?" search: "life expectancy", "extreme poverty", "child mortality" - then respond with slugs of charts showing global trends, filtering out country-specific comparisons.`,
            prompt: query,
        })

        const agentEndTime = Date.now()

        // Parse the LLM's JSON response to get selected slugs
        let selectedSlugs: string[] = []
        try {
            // Extract JSON array from response (may have markdown code blocks)
            const jsonMatch = text.match(/\[[\s\S]*\]/)
            if (jsonMatch) {
                selectedSlugs = JSON.parse(jsonMatch[0])
            }
        } catch {
            // If parsing fails, fall back to all charts
        }

        // Build recommendations from selected slugs
        const recommendations: RecommendedChart[] = []
        for (const slug of selectedSlugs.slice(0, maxResults)) {
            const chart = chartsBySlug.get(slug)
            if (chart) {
                recommendations.push({
                    title: chart.title,
                    url: `${baseUrl}/grapher/${slug}`,
                    slug: slug,
                    subtitle: chart.subtitle,
                })
            }
        }

        // Fallback: if no submit was called, use all charts found
        if (recommendations.length === 0) {
            for (const [slug, chart] of chartsBySlug) {
                if (recommendations.length >= maxResults) break
                recommendations.push({
                    title: chart.title,
                    url: `${baseUrl}/grapher/${slug}`,
                    slug: slug,
                    subtitle: chart.subtitle,
                })
            }
        }

        const endTime = Date.now()

        console.log(
            `[AI Search recommend] query="${query}" | total=${endTime - startTime}ms | agent=${agentEndTime - agentStartTime}ms | searches=${searchQueriesUsed.length} | results=${recommendations.length}`
        )

        const response: RecommendResponse = {
            query,
            recommendations,
            searchQueries: searchQueriesUsed,
            timing: {
                total_ms: endTime - startTime,
                agent_ms: agentEndTime - agentStartTime,
            },
        }

        return new Response(JSON.stringify(response, null, 2), {
            headers: {
                ...headers,
                "Cache-Control": "public, max-age=300",
            },
        })
    } catch (error) {
        console.error("AI Search recommend error:", error)

        return new Response(
            JSON.stringify({
                error: "Recommendation failed",
                message:
                    error instanceof Error ? error.message : "Unknown error",
            }),
            { status: 500, headers }
        )
    }
}
