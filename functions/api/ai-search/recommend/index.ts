import { Env } from "../../../_common/env.js"
import {
    getBaseUrl,
    validateQueryParams,
    COMMON_SEARCH_PARAMS,
    ChartInfo,
    ChartInfoForLLM,
    extractJsonArray,
    searchChartsSemantic,
} from "../utils.js"
import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText, tool, stepCountIs } from "ai"
import { z } from "zod"
import { getAlgoliaConfig, AlgoliaConfig } from "../../search/algoliaClient.js"
import { searchChartsMulti } from "../../search/searchApi.js"

// =============================================================================
// Constants
// =============================================================================

const VALID_PARAMS = new Set([
    COMMON_SEARCH_PARAMS.QUERY,
    "max_results",
    "debug",
    "model",
    "search", // "keyword" (default) or "semantic"
])

// Short aliases for Google Gemini models
const GEMINI_MODEL_ALIASES: Record<string, string> = {
    gemini: "gemini-2.5-flash",
    "gemini-2.5-flash": "gemini-2.5-flash",
    "gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
    "gemini-3-flash": "gemini-3-flash-preview",
}

const DEFAULT_MAX_RESULTS = 5
const MAX_RESULTS_LIMIT = 10

// =============================================================================
// Prompts
// =============================================================================

const SLUG_OUTPUT = "ONLY a JSON array of slugs"

/** System prompt for keyword search (Algolia) */
const SYSTEM_PROMPT_KEYWORD = (maxResults: number) =>
    `You recommend Our World in Data charts. The search uses keyword matching against chart titles.

Instructions:
1. Call search ONCE with 4-6 SINGLE-WORD search keywords that might appear in chart titles. Avoid multi-word phrases.
2. From results, select up to ${maxResults} charts that BEST answer the question.
3. ORDER by relevance, respond with ${SLUG_OUTPUT}: ["slug-1", "slug-2"]

Example: "Why invest in highways?" -> ["roads", "transport", "trade", "GDP", "infrastructure"]`

/** System prompt for semantic search (CF AI Search) */
const SYSTEM_PROMPT_SEMANTIC = (maxResults: number) =>
    `You recommend Our World in Data charts. The search uses semantic matching.

Instructions:
1. Call search ONCE with a clear, concise search query that captures the data the user is looking for.
2. From results, select up to ${maxResults} charts that BEST answer the question.
3. ORDER by relevance, respond with ${SLUG_OUTPUT}: ["slug-1", "slug-2"]

Example: "Why invest in highways?" -> "economic benefits of road infrastructure investment GDP growth trade"`

// =============================================================================
// Types
// =============================================================================

/** Recommended chart matches ChartInfo (same as EnrichedSearchChartHit from /api/search) */
type RecommendedChart = ChartInfo

interface RecommendResponse {
    query: string
    model: string
    recommendations: RecommendedChart[]
    searchQueries: string[]
    timing: {
        total_ms: number
        agent_ms: number
    }
}

/** Result from running recommendation with any provider */
interface ProviderResult {
    text: string
    searchQueriesUsed: string[]
    chartsBySlug: Map<string, ChartInfo>
    steps: { text: string; toolCalls: unknown[] }[]
}

// =============================================================================
// Helpers
// =============================================================================

/** Search mode: keyword (Algolia) or semantic (CF AI Search) */
type SearchMode = "keyword" | "semantic"

/**
 * Execute multi-query keyword search (Algolia) and collect chart info.
 * Stores full chart data in chartsBySlug for API response,
 * but returns minimal info for LLM to keep token usage low.
 */
async function executeKeywordSearchAndCollect(
    searches: string[],
    algoliaConfig: AlgoliaConfig,
    baseUrl: string,
    chartsBySlug: Map<string, ChartInfo>
): Promise<{ query: string; charts: ChartInfoForLLM[] }[]> {
    const results = await searchChartsMulti(
        algoliaConfig,
        searches,
        10,
        baseUrl
    )

    return results.map((result) => {
        // Store full hit data for API response
        for (const hit of result.hits) {
            chartsBySlug.set(hit.slug, hit as ChartInfo)
        }
        // Return minimal info for LLM context
        const chartsForLLM: ChartInfoForLLM[] = result.hits.map((hit) => ({
            title: hit.title,
            slug: hit.slug,
            subtitle: hit.subtitle,
        }))
        return { query: result.query, charts: chartsForLLM }
    })
}

/**
 * Execute single semantic search (CF AI Search) and collect chart info.
 */
async function executeSemanticSearchAndCollect(
    ai: Ai,
    searchQuery: string,
    baseUrl: string,
    chartsBySlug: Map<string, ChartInfo>
): Promise<{ query: string; charts: ChartInfoForLLM[] }[]> {
    const result = await searchChartsSemantic(ai, searchQuery, 20, baseUrl)

    // Store full chart data for API response
    for (const chart of result.charts) {
        chartsBySlug.set(chart.slug, chart)
    }

    // Return minimal info for LLM context
    const chartsForLLM: ChartInfoForLLM[] = result.charts.map((chart) => ({
        title: chart.title,
        slug: chart.slug,
        subtitle: chart.subtitle,
    }))

    return [{ query: searchQuery, charts: chartsForLLM }]
}

// =============================================================================
// Provider Implementations
// =============================================================================

/**
 * Run recommendation using OpenAI via AI SDK.
 * Uses agentic approach with tool calling.
 */
async function runWithOpenAI(
    apiKey: string,
    modelId: string,
    query: string,
    maxResults: number,
    algoliaConfig: AlgoliaConfig,
    baseUrl: string,
    searchMode: SearchMode,
    ai: Ai
): Promise<ProviderResult> {
    const chartsBySlug = new Map<string, ChartInfo>()
    const searchQueriesUsed: string[] = []

    const openai = createOpenAI({ apiKey })
    const model = openai(modelId)

    // Build tools using shared helper
    const { keywordSearchTool, semanticSearchTool } = buildSearchTools(
        algoliaConfig,
        baseUrl,
        chartsBySlug,
        searchQueriesUsed,
        ai
    )

    const systemPrompt =
        searchMode === "semantic"
            ? SYSTEM_PROMPT_SEMANTIC(maxResults)
            : SYSTEM_PROMPT_KEYWORD(maxResults)

    const { text, steps } = await generateText({
        model,
        tools: {
            search:
                searchMode === "semantic"
                    ? semanticSearchTool
                    : keywordSearchTool,
        },
        toolChoice: "auto",
        stopWhen: stepCountIs(3),
        system: systemPrompt,
        prompt: query,
    })

    return {
        text,
        searchQueriesUsed,
        chartsBySlug,
        steps: steps.map((step) => ({
            text: step.text,
            toolCalls: step.toolCalls,
        })),
    }
}

/**
 * Build search tools for use with AI SDK generateText.
 * Shared between OpenAI and Gemini implementations.
 */
function buildSearchTools(
    algoliaConfig: AlgoliaConfig,
    baseUrl: string,
    chartsBySlug: Map<string, ChartInfo>,
    searchQueriesUsed: string[],
    ai: Ai
) {
    const keywordSearchTool = tool({
        description:
            "Search Our World in Data charts by multiple keyword sets. Returns chart titles and metadata grouped by search query.",
        inputSchema: z.object({
            searches: z
                .array(z.string())
                .min(1)
                .max(8)
                .describe("Array of search keyword strings (max 8)"),
        }),
        execute: async ({ searches }) => {
            searchQueriesUsed.push(...searches)
            return executeKeywordSearchAndCollect(
                searches,
                algoliaConfig,
                baseUrl,
                chartsBySlug
            )
        },
    })

    const semanticSearchTool = tool({
        description:
            "Search Our World in Data charts using semantic search. Returns chart titles and metadata.",
        inputSchema: z.object({
            query: z
                .string()
                .describe(
                    "A natural language search query describing the data you're looking for"
                ),
        }),
        execute: async ({ query: searchQuery }) => {
            searchQueriesUsed.push(searchQuery)
            return executeSemanticSearchAndCollect(
                ai,
                searchQuery,
                baseUrl,
                chartsBySlug
            )
        },
    })

    return { keywordSearchTool, semanticSearchTool }
}

/**
 * Run recommendation using Google Gemini via AI SDK.
 * Uses agentic approach with tool calling (same as OpenAI).
 */
async function runWithGemini(
    apiKey: string,
    modelId: string,
    query: string,
    maxResults: number,
    algoliaConfig: AlgoliaConfig,
    baseUrl: string,
    searchMode: SearchMode,
    ai: Ai
): Promise<ProviderResult> {
    const chartsBySlug = new Map<string, ChartInfo>()
    const searchQueriesUsed: string[] = []

    const google = createGoogleGenerativeAI({ apiKey })
    const model = google(modelId)

    // Build tools using shared helper
    const { keywordSearchTool, semanticSearchTool } = buildSearchTools(
        algoliaConfig,
        baseUrl,
        chartsBySlug,
        searchQueriesUsed,
        ai
    )

    const systemPrompt =
        searchMode === "semantic"
            ? SYSTEM_PROMPT_SEMANTIC(maxResults)
            : SYSTEM_PROMPT_KEYWORD(maxResults)

    const { text, steps } = await generateText({
        model,
        tools: {
            search:
                searchMode === "semantic"
                    ? semanticSearchTool
                    : keywordSearchTool,
        },
        toolChoice: "auto",
        stopWhen: stepCountIs(3),
        system: systemPrompt,
        prompt: query,
    })

    return {
        text,
        searchQueriesUsed,
        chartsBySlug,
        steps: steps.map((step) => ({
            text: step.text,
            toolCalls: step.toolCalls,
        })),
    }
}

// =============================================================================
// Request Handler
// =============================================================================

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
        const modelParam = url.searchParams.get("model") || "openai"
        const searchParam = url.searchParams.get("search") || "keyword"
        const searchMode: SearchMode =
            searchParam === "semantic" ? "semantic" : "keyword"

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

        // Detect provider from model param
        const isOpenAI = modelParam === "openai" || modelParam.startsWith("gpt")
        const isGemini =
            modelParam === "gemini" || modelParam.startsWith("gemini")

        if (!isOpenAI && !isGemini) {
            return new Response(
                JSON.stringify({
                    error: "Invalid model",
                    details: `Unknown model: ${modelParam}. Supported: openai, gpt-*, gemini, gemini-*`,
                }),
                { status: 400, headers }
            )
        }

        // Resolve model alias based on provider
        let resolvedModel: string
        if (isOpenAI) {
            // Default to gpt-5-mini: faster than gpt-5-nano despite the name (10s vs 20s+ in testing)
            resolvedModel = modelParam === "openai" ? "gpt-5-mini" : modelParam
        } else {
            resolvedModel =
                GEMINI_MODEL_ALIASES[modelParam] ||
                modelParam.replace("gemini-", "gemini-")
        }

        // Validate API keys
        if (isOpenAI && !env.OPENAI_API_KEY) {
            return new Response(
                JSON.stringify({
                    error: "Configuration error",
                    details: "OPENAI_API_KEY not configured",
                }),
                { status: 500, headers }
            )
        }
        if (isGemini && !env.GOOGLE_API_KEY) {
            return new Response(
                JSON.stringify({
                    error: "Configuration error",
                    details: "GOOGLE_API_KEY not configured",
                }),
                { status: 500, headers }
            )
        }

        const algoliaConfig = getAlgoliaConfig(env)
        const agentStartTime = Date.now()

        // Run with appropriate provider
        const result = isOpenAI
            ? await runWithOpenAI(
                  env.OPENAI_API_KEY!,
                  resolvedModel,
                  query,
                  maxResults,
                  algoliaConfig,
                  baseUrl,
                  searchMode,
                  env.AI
              )
            : await runWithGemini(
                  env.GOOGLE_API_KEY!,
                  resolvedModel,
                  query,
                  maxResults,
                  algoliaConfig,
                  baseUrl,
                  searchMode,
                  env.AI
              )

        const agentEndTime = Date.now()
        const { text, searchQueriesUsed, chartsBySlug, steps } = result

        // Parse the LLM's JSON response to get selected slugs
        const selectedSlugs = extractJsonArray<string>(text) || []

        // Build recommendations from selected slugs (chart already has full data including URL)
        const recommendations: RecommendedChart[] = []
        for (const slug of selectedSlugs.slice(0, maxResults)) {
            const chart = chartsBySlug.get(slug)
            if (chart) {
                recommendations.push(chart)
            }
        }

        // Fallback: if no valid slugs parsed, use all charts found
        if (recommendations.length === 0) {
            for (const [, chart] of chartsBySlug) {
                if (recommendations.length >= maxResults) break
                recommendations.push(chart)
            }
        }

        const endTime = Date.now()

        console.log(
            `[AI Search recommend] query="${query}" | model=${resolvedModel} | search=${searchMode} | total=${endTime - startTime}ms | agent=${agentEndTime - agentStartTime}ms | searches=${searchQueriesUsed.length} | results=${recommendations.length}`
        )

        const response: RecommendResponse = {
            query,
            model: resolvedModel,
            recommendations,
            searchQueries: searchQueriesUsed,
            timing: {
                total_ms: endTime - startTime,
                agent_ms: agentEndTime - agentStartTime,
            },
            ...(debug && {
                debug: {
                    steps,
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
