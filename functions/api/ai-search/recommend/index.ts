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
import { searchChartsMulti } from "../../search/searchApi.js"

const VALID_PARAMS = new Set([COMMON_SEARCH_PARAMS.QUERY, "max_results", "debug"])

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
        const debug = url.searchParams.get("debug") === "true"

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
                "Search Our World in Data charts by multiple keyword sets IN PARALLEL. Returns chart titles and metadata grouped by search query. Use specific data-related keywords like 'GDP per capita', 'CO2 emissions', 'life expectancy', etc.",
            inputSchema: z.object({
                searches: z
                    .array(z.string())
                    .min(1)
                    .max(5)
                    .describe(
                        "Array of search keyword strings to run in parallel (e.g., ['life expectancy', 'child mortality', 'poverty rate'])"
                    ),
            }),
            execute: async ({ searches }) => {
                searchQueriesUsed.push(...searches)

                // Single Algolia API call with all queries
                const results = await searchChartsMulti(
                    algoliaConfig,
                    searches,
                    10,
                    baseUrl
                )

                // Store all charts for later lookup and return simplified results
                return results.map((result) => {
                    const charts = result.hits.map((hit) => ({
                        title: hit.title,
                        subtitle: hit.subtitle,
                        slug: hit.slug,
                    }))
                    for (const chart of charts) {
                        chartsBySlug.set(chart.slug, chart)
                    }
                    return { query: result.query, charts }
                })
            },
        })


        const agentStartTime = Date.now()

        const { text, steps } = await generateText({
            model: openai("gpt-5-mini"),
            tools: {
                search: chartSearchTool,
            },
            stopWhen: stepCountIs(2),
            system: `You recommend Our World in Data charts based on user queries.

The search uses simple keyword matching against chart titles. Use SINGLE WORDS or very common 2-word phrases.

Instructions:
1. Call search ONCE with 4-6 SINGLE-WORD keywords that might appear in chart titles. Avoid multi-word phrases - they often return zero results.
2. From the results, select up to ${maxResults} charts that BEST answer the user's question
3. ORDER by relevance - put the most directly relevant charts first
4. Respond with ONLY a JSON array of slugs: ["slug-1", "slug-2"]

Example: "Why invest in highways?" → search ["roads", "transport", "trade", "GDP", "infrastructure"] → pick charts showing economic/transport data.`,
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
            ...(debug && {
                debug: {
                    steps: steps.map((step) => ({
                        text: step.text,
                        toolCalls: step.toolCalls,
                    })),
                    finalText: text,
                },
            }),
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
