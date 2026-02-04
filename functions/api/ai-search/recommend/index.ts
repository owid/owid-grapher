import { Env } from "../../../_common/env.js"
import {
    getBaseUrl,
    validateQueryParams,
    COMMON_SEARCH_PARAMS,
} from "../utils.js"
import { createOpenAI } from "@ai-sdk/openai"
import { generateText, tool, stepCountIs } from "ai"
import { z } from "zod"
import { getAlgoliaConfig, AlgoliaConfig } from "../../search/algoliaClient.js"
import { searchChartsMulti } from "../../search/searchApi.js"

const VALID_PARAMS = new Set([
    COMMON_SEARCH_PARAMS.QUERY,
    "max_results",
    "debug",
    "model",
])

// Short aliases for CF Workers AI models with tool calling support (pinned models)
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

// CF Workers AI response types
interface CFToolCall {
    name: string
    arguments: { searches: string[] }
}

/**
 * Execute search and return results for CF agent loop
 */
async function executeSearch(
    searches: string[],
    algoliaConfig: AlgoliaConfig,
    baseUrl: string,
    chartsBySlug: Map<string, { title: string; slug: string; subtitle?: string }>
): Promise<string> {
    const results = await searchChartsMulti(algoliaConfig, searches, 10, baseUrl)

    // Store charts and build response
    const searchResults = results.map((result) => {
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

    return JSON.stringify(searchResults)
}

/**
 * Run recommendation using CF Workers AI
 * Uses a two-step approach: first get search keywords, then get final selection
 */
async function runWithCFModel(
    ai: Ai,
    modelId: string,
    query: string,
    maxResults: number,
    algoliaConfig: AlgoliaConfig,
    baseUrl: string
): Promise<{
    text: string
    searchQueriesUsed: string[]
    chartsBySlug: Map<string, { title: string; slug: string; subtitle?: string }>
    steps: { text: string; toolCalls: CFToolCall[] }[]
}> {
    const chartsBySlug = new Map<
        string,
        { title: string; slug: string; subtitle?: string }
    >()
    const searchQueriesUsed: string[] = []
    const steps: { text: string; toolCalls: CFToolCall[] }[] = []

    // Step 1: Ask the model to generate search keywords
    const keywordPrompt = `You help search for data charts on Our World in Data.

Given the user's question, generate 4-6 SINGLE-WORD search keywords that might appear in chart titles.
Return ONLY a JSON array of keywords, nothing else.

Example: "Why invest in highways?" -> ["roads", "transport", "trade", "GDP", "infrastructure"]

User question: ${query}`

    let keywordText = ""
    try {
        const keywordResponse = await ai.run(
            modelId as Parameters<Ai["run"]>[0],
            {
                messages: [{ role: "user", content: keywordPrompt }],
            }
        )

        // Handle different response formats from CF models
        if (typeof keywordResponse === "string") {
            keywordText = keywordResponse
        } else if (keywordResponse && typeof keywordResponse === "object") {
            const resp = keywordResponse as Record<string, unknown>
            // CF models may return array directly or as response field
            if (Array.isArray(resp.response)) {
                keywordText = JSON.stringify(resp.response)
            } else if (typeof resp.response === "string") {
                keywordText = resp.response
            } else if (typeof resp.text === "string") {
                keywordText = resp.text
            } else if (typeof resp.content === "string") {
                keywordText = resp.content
            } else if (
                resp.choices &&
                Array.isArray(resp.choices) &&
                resp.choices[0]
            ) {
                // OpenAI-like format
                const choice = resp.choices[0] as Record<string, unknown>
                if (choice.message && typeof choice.message === "object") {
                    const msg = choice.message as Record<string, unknown>
                    if (typeof msg.content === "string") {
                        keywordText = msg.content
                    }
                }
            }
        }
    } catch (e) {
        console.error("[CF Agent] Error getting keywords:", e)
        throw e
    }
    steps.push({ text: keywordText, toolCalls: [] })

    // Parse keywords from response
    let keywords: string[] = []
    try {
        const jsonMatch = keywordText.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
            keywords = JSON.parse(jsonMatch[0])
        }
    } catch {
        // Fallback: split by common delimiters
        keywords = keywordText
            .replace(/[[\]"']/g, "")
            .split(/[,\s]+/)
            .filter((k) => k.length > 2)
            .slice(0, 6)
    }

    if (keywords.length === 0) {
        // Use the query words as fallback
        keywords = query
            .split(/\s+/)
            .filter((w) => w.length > 3)
            .slice(0, 5)
    }

    // Ensure we have at least one keyword
    if (keywords.length === 0) {
        keywords = [query.split(/\s+/)[0] || query]
    }

    console.log("[CF Agent] Using keywords:", keywords)

    searchQueriesUsed.push(...keywords)

    // Execute the search
    const searchResults = await executeSearch(
        keywords,
        algoliaConfig,
        baseUrl,
        chartsBySlug
    )

    // Step 2: Ask the model to select the best charts
    const selectionPrompt = `Based on these search results, select the ${maxResults} most relevant charts for the question: "${query}"

Search results:
${searchResults}

Return ONLY a JSON array of slugs for the most relevant charts, ordered by relevance.
Example: ["chart-slug-1", "chart-slug-2"]`

    const selectionResponse = await ai.run(
        modelId as Parameters<Ai["run"]>[0],
        {
            messages: [{ role: "user", content: selectionPrompt }],
        }
    )

    console.log(
        "[CF Agent] selectionResponse:",
        JSON.stringify(selectionResponse, null, 2)
    )

    // Handle different response formats from CF models
    let finalText = ""
    if (typeof selectionResponse === "string") {
        finalText = selectionResponse
    } else if (selectionResponse && typeof selectionResponse === "object") {
        const resp = selectionResponse as Record<string, unknown>
        if (typeof resp.response === "string") {
            finalText = resp.response
        } else if (typeof resp.text === "string") {
            finalText = resp.text
        } else if (typeof resp.content === "string") {
            finalText = resp.content
        } else if (
            resp.choices &&
            Array.isArray(resp.choices) &&
            resp.choices[0]
        ) {
            const choice = resp.choices[0] as Record<string, unknown>
            if (choice.message && typeof choice.message === "object") {
                const msg = choice.message as Record<string, unknown>
                if (typeof msg.content === "string") {
                    finalText = msg.content
                }
            }
        }
    }
    steps.push({ text: finalText, toolCalls: [] })

    return {
        text: finalText,
        searchQueriesUsed,
        chartsBySlug,
        steps,
    }
}

/**
 * Run recommendation using OpenAI via AI SDK
 */
async function runWithOpenAI(
    apiKey: string,
    modelId: string,
    query: string,
    maxResults: number,
    algoliaConfig: AlgoliaConfig,
    baseUrl: string
): Promise<{
    text: string
    searchQueriesUsed: string[]
    chartsBySlug: Map<string, { title: string; slug: string; subtitle?: string }>
    steps: { text: string; toolCalls: unknown[] }[]
}> {
    const chartsBySlug = new Map<
        string,
        { title: string; slug: string; subtitle?: string }
    >()
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
            const results = await searchChartsMulti(
                algoliaConfig,
                searches,
                10,
                baseUrl
            )

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

    const { text, steps } = await generateText({
        model,
        tools: { search: chartSearchTool },
        toolChoice: "auto",
        stopWhen: stepCountIs(3),
        system: `You recommend Our World in Data charts based on user queries.

The search uses simple keyword matching against chart titles. Use SINGLE WORDS or very common 2-word phrases.

Instructions:
1. Call search ONCE with 4-6 SINGLE-WORD keywords that might appear in chart titles. Avoid multi-word phrases - they often return zero results.
2. The tool will return chart metadata including titles and slugs.
3. From the results, select up to ${maxResults} charts that BEST answer the user's question.
4. ORDER by relevance - put the most directly relevant charts first.
5. Respond with ONLY a JSON array of slugs: ["slug-1", "slug-2"]

Example: "Why invest in highways?" -> search ["roads", "transport", "trade", "GDP"] -> pick charts -> ["road-accidents", "transport-gdp"]`,
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
        const isOpenAI =
            modelParam === "openai" || modelParam.startsWith("gpt")
        const resolvedModel = isOpenAI
            ? modelParam === "openai"
                ? "gpt-4o-mini"
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
        let selectedSlugs: string[] = []
        try {
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
