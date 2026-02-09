import { Env } from "../../../_common/env.js"
import {
    getBaseUrl,
    validateQueryParams,
    COMMON_SEARCH_PARAMS,
    ChartInfo,
    extractJsonArray,
    searchChartsSemantic,
} from "../utils.js"
import { ChartRecordType } from "@ourworldindata/types"
import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
// NOTE: AI SDK's Output.array() would be ideal for forcing JSON output, but Gemini
// doesn't support structured output combined with tool calling ("Function calling
// with a response mime type: 'application/json' is unsupported"). So we use text
// output and parse JSON from the response.
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
    "verbose", // include all fields in response (default: false)
    "type", // "chart", "explorer", "multiDim", or "all" (default)
])

// Valid type filter values and their mapping to ChartRecordType
const TYPE_FILTER_MAP: Record<string, ChartRecordType | null> = {
    all: null, // No filtering
    chart: ChartRecordType.Chart,
    explorer: ChartRecordType.ExplorerView,
    multiDim: ChartRecordType.MultiDimView,
}
const VALID_TYPES = Object.keys(TYPE_FILTER_MAP)

// Short aliases for Google Gemini models
// NOTE: gemini-2.5-flash-lite is cheap but unreliable - it sometimes returns empty
// responses after tool calls. Use gemini-2.5-flash for more consistent results.
const GEMINI_MODEL_ALIASES: Record<string, string> = {
    gemini: "gemini-2.5-flash-lite",
    "gemini-lite": "gemini-2.5-flash-lite",
    "gemini-2.5-flash": "gemini-2.5-flash",
    "gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
    "gemini-3-flash": "gemini-3-flash-preview",
    "gemini-3-flash-preview": "gemini-3-flash-preview",
}

// Default model for recommendations
const DEFAULT_MODEL = "gemini"

// Gemini pricing per 1M tokens (USD) - from https://ai.google.dev/gemini-api/docs/pricing
// Format: [inputPricePerMillion, outputPricePerMillion]
const GEMINI_PRICING: Record<string, [number, number]> = {
    "gemini-2.5-flash-lite": [0.1, 0.4],
    "gemini-2.5-flash": [0.15, 0.6],
    "gemini-3-flash-preview": [0.15, 0.6], // Same as 2.5 flash until pricing announced
}

const DEFAULT_MAX_RESULTS = 5
const MAX_RESULTS_LIMIT = 10

// =============================================================================
// Prompts
// =============================================================================

/** System prompt for keyword search (Algolia) */
const SYSTEM_PROMPT_KEYWORD = (maxResults: number) =>
    `You are a chart recommendation API. You output ONLY valid JSON arrays.

SEARCH: Use 4-6 single keywords (no phrases, no country names).

SELECTION: Pick up to ${maxResults} chart indexes from search results, ordered by relevance.

CRITICAL: Your entire response must be a JSON array of index numbers. Nothing else.
Example response: [3, 0, 7, 2]
`

/** System prompt for semantic search (CF AI Search) */
const SYSTEM_PROMPT_SEMANTIC = (maxResults: number) =>
    `You are a chart recommendation API. You output ONLY valid JSON arrays.

SEARCH: Search for the data topic (no country names - charts are global).

SELECTION: Pick up to ${maxResults} chart indexes from search results, ordered by relevance.

CRITICAL: Your entire response must be a JSON array of index numbers. Nothing else.
Example response: [3, 0, 7, 2]
`

// =============================================================================
// Types
// =============================================================================

/** Recommended chart matches ChartInfo (same as EnrichedSearchChartHit from /api/search) */
type RecommendedChart = ChartInfo

interface RecommendResponse {
    query: string
    model: string
    recommendations: RecommendedChart[] | MinimalChartInfo[]
    searchQueries: string[]
    timing: {
        total_ms: number
        agent_ms: number
    }
}

/** Token usage from AI SDK */
interface TokenUsage {
    inputTokens: number
    outputTokens: number
    totalTokens: number
}

/**
 * Calculate cost in USD for Gemini models based on token usage.
 * Returns undefined if pricing is not available for the model.
 */
function calculateGeminiCost(
    modelId: string,
    usage: TokenUsage
): number | undefined {
    const pricing = GEMINI_PRICING[modelId]
    if (!pricing) return undefined

    const [inputPricePerMillion, outputPricePerMillion] = pricing
    const inputCost = (usage.inputTokens / 1_000_000) * inputPricePerMillion
    const outputCost = (usage.outputTokens / 1_000_000) * outputPricePerMillion
    return inputCost + outputCost
}

/** Result from running recommendation with any provider */
interface ProviderResult {
    text: string
    searchQueriesUsed: string[]
    /** All charts from search results, in order (index matches what LLM sees) */
    allCharts: ChartInfo[]
    steps: { text: string; toolCalls: unknown[] }[]
    usage: TokenUsage
}


// =============================================================================
// Helpers
// =============================================================================

/** Search mode: keyword (Algolia) or semantic (CF AI Search) */
type SearchMode = "keyword" | "semantic"

/** Minimal chart info for non-verbose response */
type MinimalChartInfo = Pick<
    ChartInfo,
    "title" | "subtitle" | "slug" | "url" | "variantName"
>

/**
 * Strip verbose fields from recommendations to reduce response size.
 * Keeps only essential fields: title, subtitle, slug, url, variantName.
 */
function stripVerboseFields(charts: RecommendedChart[]): MinimalChartInfo[] {
    return charts.map((chart) => ({
        title: chart.title,
        subtitle: chart.subtitle,
        slug: chart.slug,
        url: chart.url,
        variantName: chart.variantName,
    }))
}

/** Chart info for LLM with index for reference */
interface IndexedChartForLLM {
    i: number // index
    title: string
    subtitle?: string
}

/**
 * Execute multi-query keyword search (Algolia) and collect chart info.
 * Stores full chart data in allCharts array for API response,
 * but returns minimal indexed info for LLM to keep token usage low.
 * Optionally filters by type before returning to LLM.
 * Note: searchChartsMulti already deduplicates results across queries.
 */
async function executeKeywordSearchAndCollect(
    searches: string[],
    algoliaConfig: AlgoliaConfig,
    baseUrl: string,
    allCharts: ChartInfo[],
    typeFilter: ChartRecordType | null
): Promise<{ query: string; charts: IndexedChartForLLM[] }[]> {
    const results = await searchChartsMulti(
        algoliaConfig,
        searches,
        // Fetch more results if filtering, to ensure enough after filter
        typeFilter ? 30 : 10,
        baseUrl
    )

    return results.map((result) => {
        // Filter hits by type if specified
        const filteredHits = typeFilter
            ? result.hits.filter((hit) => hit.type === typeFilter)
            : result.hits

        // Return indexed info for LLM context
        const chartsForLLM: IndexedChartForLLM[] = filteredHits.map((hit) => {
            const index = allCharts.length
            allCharts.push(hit as ChartInfo)
            return {
                i: index,
                title: hit.title,
                subtitle: hit.subtitle,
            }
        })
        return { query: result.query, charts: chartsForLLM }
    })
}

/**
 * Execute single semantic search (CF AI Search) and collect chart info.
 * Optionally filters by type before returning to LLM.
 */
async function executeSemanticSearchAndCollect(
    ai: Ai,
    searchQuery: string,
    baseUrl: string,
    allCharts: ChartInfo[],
    typeFilter: ChartRecordType | null
): Promise<{ query: string; charts: IndexedChartForLLM[] }[]> {
    // Fetch more results if filtering, to ensure enough after filter
    const result = await searchChartsSemantic(
        ai,
        searchQuery,
        typeFilter ? 50 : 20,
        baseUrl
    )

    // Filter by type if specified
    const filteredCharts = typeFilter
        ? result.charts.filter((chart) => chart.type === typeFilter)
        : result.charts

    // Return indexed info for LLM context, storing full data
    const chartsForLLM: IndexedChartForLLM[] = filteredCharts.map((chart) => {
        const index = allCharts.length
        allCharts.push(chart)
        return {
            i: index,
            title: chart.title,
            subtitle: chart.subtitle,
        }
    })

    return [{ query: searchQuery, charts: chartsForLLM }]
}

// =============================================================================
// Provider Implementations
// =============================================================================

/** AI SDK LanguageModelV1 type (simplified) */
type LanguageModel = Parameters<typeof generateText>[0]["model"]

/**
 * Create a language model instance for the given provider.
 */
function createModel(
    provider: "openai" | "gemini",
    apiKey: string,
    modelId: string
): LanguageModel {
    if (provider === "openai") {
        return createOpenAI({ apiKey })(modelId)
    }
    return createGoogleGenerativeAI({ apiKey })(modelId)
}

/**
 * Run recommendation using AI SDK with tool calling.
 * Works with both OpenAI and Gemini models.
 */
async function runRecommendation(
    model: LanguageModel,
    query: string,
    maxResults: number,
    algoliaConfig: AlgoliaConfig,
    baseUrl: string,
    searchMode: SearchMode,
    ai: Ai,
    typeFilter: ChartRecordType | null
): Promise<ProviderResult> {
    const allCharts: ChartInfo[] = []
    const searchQueriesUsed: string[] = []

    const keywordSearchTool = tool({
        description:
            "Search Our World in Data charts by multiple keyword sets. Returns indexed chart titles and metadata grouped by search query.",
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
                allCharts,
                typeFilter
            )
        },
    })

    const semanticSearchTool = tool({
        description:
            "Search Our World in Data charts using semantic search. Returns indexed chart titles and metadata.",
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
                allCharts,
                typeFilter
            )
        },
    })

    const systemPrompt =
        searchMode === "semantic"
            ? SYSTEM_PROMPT_SEMANTIC(maxResults)
            : SYSTEM_PROMPT_KEYWORD(maxResults)

    const { text, steps, totalUsage } = await generateText({
        model,
        tools: {
            search:
                searchMode === "semantic"
                    ? semanticSearchTool
                    : keywordSearchTool,
        },
        toolChoice: "auto",
        stopWhen: stepCountIs(2),
        system: systemPrompt,
        prompt: query,
    })

    return {
        text,
        searchQueriesUsed,
        allCharts,
        steps: steps.map((step) => ({
            text: step.text,
            toolCalls: step.toolCalls,
        })),
        usage: {
            inputTokens: totalUsage.inputTokens ?? 0,
            outputTokens: totalUsage.outputTokens ?? 0,
            totalTokens: totalUsage.totalTokens ?? 0,
        },
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
        const verbose = url.searchParams.get("verbose") === "true"
        const modelParam = url.searchParams.get("model") || DEFAULT_MODEL
        const searchParam = url.searchParams.get("search") || "keyword"
        const searchMode: SearchMode =
            searchParam === "semantic" ? "semantic" : "keyword"
        const typeParam = url.searchParams.get("type") || "all"
        const typeFilter = TYPE_FILTER_MAP[typeParam]

        if (!(typeParam in TYPE_FILTER_MAP)) {
            return new Response(
                JSON.stringify({
                    error: "Invalid type parameter",
                    details: `Unknown type: ${typeParam}. Valid types: ${VALID_TYPES.join(", ")}`,
                }),
                { status: 400, headers }
            )
        }

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

        // Create model and run recommendation
        const model = createModel(
            isOpenAI ? "openai" : "gemini",
            isOpenAI ? env.OPENAI_API_KEY! : env.GOOGLE_API_KEY!,
            resolvedModel
        )
        const result = await runRecommendation(
            model,
            query,
            maxResults,
            algoliaConfig,
            baseUrl,
            searchMode,
            env.AI,
            typeFilter
        )

        const agentEndTime = Date.now()
        const { text, searchQueriesUsed, allCharts, steps, usage } = result

        // Parse the LLM's JSON response to get selected indexes
        const selectedIndexes = extractJsonArray<number>(text)
        if (selectedIndexes === null) {
            return new Response(
                JSON.stringify({
                    error: "Failed to parse LLM response",
                    details:
                        "The model did not return valid JSON. Try again or use a different model.",
                    ...(debug && {
                        rawResponse: text,
                        debug: {
                            steps,
                            searchResults: allCharts.map((c) => c.title),
                        },
                    }),
                }),
                { status: 500, headers }
            )
        }

        // Build recommendations from selected indexes
        const recommendations: RecommendedChart[] = []
        const invalidIndexes: number[] = []
        for (const index of selectedIndexes) {
            if (recommendations.length >= maxResults) break
            const chart = allCharts[index]
            if (chart) {
                recommendations.push(chart)
            } else {
                invalidIndexes.push(index)
            }
        }

        // Collect warnings for debug mode
        const warnings: string[] = []
        if (allCharts.length === 0) {
            warnings.push("Search returned no charts")
        }
        if (invalidIndexes.length > 0) {
            warnings.push(
                `Invalid indexes returned by model: ${invalidIndexes.join(", ")}`
            )
        }
        if (selectedIndexes.length > maxResults) {
            warnings.push(
                `Model returned ${selectedIndexes.length} indexes, truncated to ${maxResults}`
            )
        }
        if (recommendations.length === 0 && allCharts.length > 0) {
            warnings.push(
                "No valid recommendations: model returned empty or all-invalid indexes"
            )
        }

        const endTime = Date.now()

        console.log(
            `[AI Search recommend] query="${query}" | model=${resolvedModel} | search=${searchMode} | total=${endTime - startTime}ms | agent=${agentEndTime - agentStartTime}ms | searches=${searchQueriesUsed.length} | results=${recommendations.length}`
        )

        // Strip verbose fields by default to reduce response size
        const finalRecommendations = verbose
            ? recommendations
            : stripVerboseFields(recommendations)

        const response: RecommendResponse = {
            query,
            model: resolvedModel,
            recommendations: finalRecommendations,
            searchQueries: searchQueriesUsed,
            timing: {
                total_ms: endTime - startTime,
                agent_ms: agentEndTime - agentStartTime,
            },
            ...(debug && {
                debug: {
                    steps,
                    finalText: text,
                    searchResults: allCharts.map((c) => c.title),
                    ...(warnings.length > 0 && { warnings }),
                    usage,
                    cost_usd: calculateGeminiCost(resolvedModel, usage),
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
