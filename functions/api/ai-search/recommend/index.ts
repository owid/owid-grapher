import { Env } from "../../../_common/env.js"
import {
    getBaseUrl,
    validateQueryParams,
    COMMON_SEARCH_PARAMS,
    ChartInfo,
    ChartInfoForLLM,
    extractTextFromCFResponse,
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

// Short aliases for CF Workers AI models
const CF_MODEL_ALIASES: Record<string, string> = {
    llama4: "@cf/meta/llama-4-scout-17b-16e-instruct",
    "llama3.3": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "llama3.1": "@cf/meta/llama-3.1-8b-instruct-fast",
    qwen: "@cf/qwen/qwen3-30b-a3b-fp8",
    mistral: "@cf/mistralai/mistral-small-3.1-24b-instruct",
    granite: "@cf/ibm/granite-4.0-h-micro",
}

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

// Shared prompt fragments
const KEYWORD_INSTRUCTION =
    "4-6 SINGLE-WORD search keywords that might appear in chart titles"
const KEYWORD_EXAMPLE = `"Why invest in highways?" -> ["roads", "transport", "trade", "GDP", "infrastructure"]`
const SEMANTIC_QUERY_INSTRUCTION =
    "a clear, concise search query (1-2 sentences) that captures the data the user is looking for"
const SEMANTIC_QUERY_EXAMPLE = `"Why invest in highways?" -> "economic benefits of road infrastructure investment GDP growth trade"`
const SLUG_OUTPUT = "ONLY a JSON array of slugs"

const PROMPTS = {
    /** Generate search keywords from user query (used by keyword search) */
    keywords: (query: string) =>
        `You help search for data charts on Our World in Data.

Given the user's question, generate ${KEYWORD_INSTRUCTION}.
Return ONLY a JSON array of keywords, nothing else.

Example: ${KEYWORD_EXAMPLE}

User question: ${query}`,

    /** Generate a semantic search query from user query */
    semanticQuery: (query: string) =>
        `You help search for data charts on Our World in Data using semantic search.

Given the user's question, generate ${SEMANTIC_QUERY_INSTRUCTION}.
Focus on the core data/metrics the user wants. Return ONLY the search query text, nothing else.

Example: ${SEMANTIC_QUERY_EXAMPLE}

User question: ${query}`,

    /** Select best charts from search results (used by CF two-step approach) */
    selection: (query: string, maxResults: number, searchResults: string) =>
        `Based on these search results, select the ${maxResults} most relevant charts for: "${query}"

Search results:
${searchResults}

Return ${SLUG_OUTPUT}, ordered by relevance. Example: ["slug-1", "slug-2"]`,

    /** System prompt for OpenAI agentic approach with tool calling (keyword search) */
    openaiSystem: (maxResults: number) =>
        `You recommend Our World in Data charts. The search uses keyword matching against chart titles.

Instructions:
1. Call search ONCE with ${KEYWORD_INSTRUCTION}. Avoid multi-word phrases.
2. From results, select up to ${maxResults} charts that BEST answer the question.
3. ORDER by relevance, respond with ${SLUG_OUTPUT}: ["slug-1", "slug-2"]

Example: ${KEYWORD_EXAMPLE}`,

    /** System prompt for OpenAI agentic approach with semantic search */
    openaiSystemSemantic: (maxResults: number) =>
        `You recommend Our World in Data charts. The search uses semantic matching.

Instructions:
1. Call search ONCE with ${SEMANTIC_QUERY_INSTRUCTION}.
2. From results, select up to ${maxResults} charts that BEST answer the question.
3. ORDER by relevance, respond with ${SLUG_OUTPUT}: ["slug-1", "slug-2"]

Example: ${SEMANTIC_QUERY_EXAMPLE}`,
}

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

/**
 * Parse keywords from LLM response with fallback strategies.
 */
function parseKeywords(text: string, fallbackQuery: string): string[] {
    // Try JSON parsing first
    const parsed = extractJsonArray<string>(text)
    if (parsed && parsed.length > 0) {
        return parsed
    }

    // Fallback: split by common delimiters
    const fromText = text
        .replace(/[[\]"']/g, "")
        .split(/[,\s]+/)
        .filter((k) => k.length > 2)
        .slice(0, 6)
    if (fromText.length > 0) {
        return fromText
    }

    // Last resort: use query words
    const fromQuery = fallbackQuery
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 5)
    if (fromQuery.length > 0) {
        return fromQuery
    }

    // Absolute fallback
    return [fallbackQuery.split(/\s+/)[0] || fallbackQuery]
}

// =============================================================================
// Provider Implementations
// =============================================================================

/**
 * Run recommendation using CF Workers AI.
 * Uses a two-step approach: first get search keywords, then get final selection.
 */
async function runWithCFModel(
    ai: Ai,
    modelId: string,
    query: string,
    maxResults: number,
    algoliaConfig: AlgoliaConfig,
    baseUrl: string,
    searchMode: SearchMode
): Promise<ProviderResult> {
    const chartsBySlug = new Map<string, ChartInfo>()
    const searchQueriesUsed: string[] = []
    const steps: { text: string; toolCalls: unknown[] }[] = []

    // Step 1: Generate search query (keywords for keyword search, natural language for semantic)
    const prompt =
        searchMode === "semantic"
            ? PROMPTS.semanticQuery(query)
            : PROMPTS.keywords(query)
    const queryResponse = await ai.run(modelId as Parameters<Ai["run"]>[0], {
        messages: [{ role: "user", content: prompt }],
    })
    const queryText = extractTextFromCFResponse(queryResponse)
    steps.push({ text: queryText, toolCalls: [] })

    // Step 2: Execute search (keyword or semantic)
    let searchResults: { query: string; charts: ChartInfoForLLM[] }[]
    if (searchMode === "semantic") {
        // For semantic: use the LLM-generated query directly (trim quotes/whitespace)
        const semanticQuery = queryText.replace(/^["']|["']$/g, "").trim()
        console.log("[CF Agent] Using semantic query:", semanticQuery)
        searchQueriesUsed.push(semanticQuery)
        searchResults = await executeSemanticSearchAndCollect(
            ai,
            semanticQuery,
            baseUrl,
            chartsBySlug
        )
    } else {
        // For keyword: parse into array of keywords
        const keywords = parseKeywords(queryText, query)
        console.log("[CF Agent] Using keywords:", keywords)
        searchQueriesUsed.push(...keywords)
        searchResults = await executeKeywordSearchAndCollect(
            keywords,
            algoliaConfig,
            baseUrl,
            chartsBySlug
        )
    }

    // Step 3: Select best charts
    const selectionResponse = await ai.run(
        modelId as Parameters<Ai["run"]>[0],
        {
            messages: [
                {
                    role: "user",
                    content: PROMPTS.selection(
                        query,
                        maxResults,
                        JSON.stringify(searchResults)
                    ),
                },
            ],
        }
    )
    const finalText = extractTextFromCFResponse(selectionResponse)
    steps.push({ text: finalText, toolCalls: [] })

    return { text: finalText, searchQueriesUsed, chartsBySlug, steps }
}

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
            ? PROMPTS.openaiSystemSemantic(maxResults)
            : PROMPTS.openaiSystem(maxResults)

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
            ? PROMPTS.openaiSystemSemantic(maxResults)
            : PROMPTS.openaiSystem(maxResults)

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

        // Resolve model alias based on provider
        let resolvedModel: string
        if (isOpenAI) {
            // Default to gpt-5-mini: faster than gpt-5-nano despite the name (10s vs 20s+ in testing)
            resolvedModel = modelParam === "openai" ? "gpt-5-mini" : modelParam
        } else if (isGemini) {
            resolvedModel =
                GEMINI_MODEL_ALIASES[modelParam] ||
                modelParam.replace("gemini-", "gemini-")
        } else {
            resolvedModel = CF_MODEL_ALIASES[modelParam] || modelParam
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
        let result: ProviderResult
        if (isOpenAI) {
            result = await runWithOpenAI(
                env.OPENAI_API_KEY!,
                resolvedModel,
                query,
                maxResults,
                algoliaConfig,
                baseUrl,
                searchMode,
                env.AI
            )
        } else if (isGemini) {
            result = await runWithGemini(
                env.GOOGLE_API_KEY!,
                resolvedModel,
                query,
                maxResults,
                algoliaConfig,
                baseUrl,
                searchMode,
                env.AI
            )
        } else {
            result = await runWithCFModel(
                env.AI,
                resolvedModel,
                query,
                maxResults,
                algoliaConfig,
                baseUrl,
                searchMode
            )
        }

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
