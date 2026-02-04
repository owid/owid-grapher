import { Env } from "../../../_common/env.js"
import {
    getBaseUrl,
    validateQueryParams,
    COMMON_SEARCH_PARAMS,
    ChartInfo,
    extractTextFromCFResponse,
    extractJsonArray,
} from "../utils.js"
import { createOpenAI } from "@ai-sdk/openai"
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

const DEFAULT_MAX_RESULTS = 5
const MAX_RESULTS_LIMIT = 10

// =============================================================================
// Prompts
// =============================================================================

// Shared prompt fragments
const KEYWORD_INSTRUCTION =
    "4-6 SINGLE-WORD search keywords that might appear in chart titles"
const KEYWORD_EXAMPLE = `"Why invest in highways?" -> ["roads", "transport", "trade", "GDP", "infrastructure"]`
const SLUG_OUTPUT = "ONLY a JSON array of slugs"

const PROMPTS = {
    /** Generate search keywords from user query (used by CF two-step approach) */
    keywords: (query: string) =>
        `You help search for data charts on Our World in Data.

Given the user's question, generate ${KEYWORD_INSTRUCTION}.
Return ONLY a JSON array of keywords, nothing else.

Example: ${KEYWORD_EXAMPLE}

User question: ${query}`,

    /** Select best charts from search results (used by CF two-step approach) */
    selection: (query: string, maxResults: number, searchResults: string) =>
        `Based on these search results, select the ${maxResults} most relevant charts for: "${query}"

Search results:
${searchResults}

Return ${SLUG_OUTPUT}, ordered by relevance. Example: ["slug-1", "slug-2"]`,

    /** System prompt for OpenAI agentic approach with tool calling */
    openaiSystem: (maxResults: number) =>
        `You recommend Our World in Data charts. The search uses keyword matching against chart titles.

Instructions:
1. Call search ONCE with ${KEYWORD_INSTRUCTION}. Avoid multi-word phrases.
2. From results, select up to ${maxResults} charts that BEST answer the question.
3. ORDER by relevance, respond with ${SLUG_OUTPUT}: ["slug-1", "slug-2"]

Example: ${KEYWORD_EXAMPLE}`,
}

// =============================================================================
// Types
// =============================================================================

interface RecommendedChart {
    title: string
    url: string
    slug: string
    subtitle?: string
}

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

/**
 * Execute multi-query search and collect chart info.
 * Updates chartsBySlug map and returns formatted results.
 */
async function executeSearchAndCollect(
    searches: string[],
    algoliaConfig: AlgoliaConfig,
    baseUrl: string,
    chartsBySlug: Map<string, ChartInfo>
): Promise<{ query: string; charts: ChartInfo[] }[]> {
    const results = await searchChartsMulti(
        algoliaConfig,
        searches,
        10,
        baseUrl
    )

    return results.map((result) => {
        const charts: ChartInfo[] = result.hits.map((hit) => ({
            title: hit.title,
            slug: hit.slug,
            subtitle: hit.subtitle,
        }))
        for (const chart of charts) {
            chartsBySlug.set(chart.slug, chart)
        }
        return { query: result.query, charts }
    })
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
    baseUrl: string
): Promise<ProviderResult> {
    const chartsBySlug = new Map<string, ChartInfo>()
    const searchQueriesUsed: string[] = []
    const steps: { text: string; toolCalls: unknown[] }[] = []

    // Step 1: Generate search keywords
    const keywordResponse = await ai.run(modelId as Parameters<Ai["run"]>[0], {
        messages: [{ role: "user", content: PROMPTS.keywords(query) }],
    })
    const keywordText = extractTextFromCFResponse(keywordResponse)
    steps.push({ text: keywordText, toolCalls: [] })

    const keywords = parseKeywords(keywordText, query)
    console.log("[CF Agent] Using keywords:", keywords)
    searchQueriesUsed.push(...keywords)

    // Step 2: Execute search
    const searchResults = await executeSearchAndCollect(
        keywords,
        algoliaConfig,
        baseUrl,
        chartsBySlug
    )

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
    baseUrl: string
): Promise<ProviderResult> {
    const chartsBySlug = new Map<string, ChartInfo>()
    const searchQueriesUsed: string[] = []

    const openai = createOpenAI({ apiKey })
    const model = openai(modelId)

    const chartSearchTool = tool({
        description:
            "Search Our World in Data charts by multiple keyword sets. Returns chart titles and metadata grouped by search query.",
        inputSchema: z.object({
            searches: z
                .array(z.string())
                .min(1)
                .max(5)
                .describe("Array of search keyword strings"),
        }),
        execute: async ({ searches }) => {
            searchQueriesUsed.push(...searches)
            return executeSearchAndCollect(
                searches,
                algoliaConfig,
                baseUrl,
                chartsBySlug
            )
        },
    })

    const { text, steps } = await generateText({
        model,
        tools: { search: chartSearchTool },
        toolChoice: "auto",
        stopWhen: stepCountIs(3),
        system: PROMPTS.openaiSystem(maxResults),
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

        // Resolve model alias
        const isOpenAI = modelParam === "openai" || modelParam.startsWith("gpt")
        // Default to gpt-5-mini: faster than gpt-5-nano despite the name (10s vs 20s+ in testing)
        const resolvedModel = isOpenAI
            ? modelParam === "openai"
                ? "gpt-5-mini"
                : modelParam
            : CF_MODEL_ALIASES[modelParam] || modelParam

        if (isOpenAI && !env.OPENAI_API_KEY) {
            return new Response(
                JSON.stringify({
                    error: "Configuration error",
                    details: "OPENAI_API_KEY not configured",
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
                  baseUrl
              )
            : await runWithCFModel(
                  env.AI,
                  resolvedModel,
                  query,
                  maxResults,
                  algoliaConfig,
                  baseUrl
              )

        const agentEndTime = Date.now()
        const { text, searchQueriesUsed, chartsBySlug, steps } = result

        // Parse the LLM's JSON response to get selected slugs
        const selectedSlugs = extractJsonArray<string>(text) || []

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

        // Fallback: if no valid slugs parsed, use all charts found
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
            `[AI Search recommend] query="${query}" | model=${resolvedModel} | total=${endTime - startTime}ms | agent=${agentEndTime - agentStartTime}ms | searches=${searchQueriesUsed.length} | results=${recommendations.length}`
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
