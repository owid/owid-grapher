import { Env } from "../../../_common/env.js"
import {
    getBaseUrl,
    validateQueryParams,
    COMMON_SEARCH_PARAMS,
} from "../utils.js"
import topicsData from "./topics.json"

// Pre-build topics list for LLM (cacheable in system message)
const TOPICS_LIST = topicsData.map((t) => `- ${t.name}`).join("\n")

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50
const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5"

interface TopicData {
    id: number
    name: string
    slug: string
    excerpt: string
}

/**
 * Topic hit for the API response
 */
interface TopicHit {
    id: number
    name: string
    slug: string
    excerpt: string
    url: string
    __position: number
    score: number
}

/**
 * API response format
 */
interface TopicsApiResponse {
    query: string
    hits: TopicHit[]
    nbHits: number
    mode: "semantic" | "llm"
    timing_ms: number
}

/**
 * Generate embedding for a query using Workers AI
 */
async function generateQueryEmbedding(
    ai: Ai,
    query: string
): Promise<number[]> {
    interface EmbeddingResponse {
        data: number[][]
    }

    const response = (await ai.run(EMBEDDING_MODEL, {
        text: [query],
    })) as EmbeddingResponse

    return response.data[0]
}

/**
 * Search topics using Vectorize
 */
async function searchTopicsWithVectorize(
    env: Env,
    query: string,
    limit: number,
    baseUrl: string
): Promise<TopicHit[]> {
    // Generate embedding for the query
    const queryEmbedding = await generateQueryEmbedding(env.AI, query)

    // Query Vectorize with the embedding
    const results = await env.VECTORIZE_TOPICS.query(queryEmbedding, {
        topK: limit,
        returnMetadata: "all",
    })

    // Transform results to TopicHit format
    const hits: TopicHit[] = results.matches.map((match, index) => {
        const metadata = match.metadata as unknown as {
            id: number
            name: string
            slug: string
            excerpt: string
        }

        return {
            id: metadata.id,
            name: metadata.name,
            slug: metadata.slug,
            excerpt: metadata.excerpt || "",
            url: `${baseUrl}/${metadata.slug}`,
            __position: index + 1,
            score: match.score,
        }
    })

    return hits
}

/**
 * Recommend topics using LLM
 */
async function recommendTopicsWithLLM(
    env: Env,
    query: string,
    limit: number,
    baseUrl: string
): Promise<TopicHit[]> {
    const systemMessage = `Here are all available topics:\n${TOPICS_LIST}`
    const userMessage = `Given this query: "${query}"

Recommend ONLY topics that are DIRECTLY and STRONGLY related to this query.
- Only include topics where the connection is obvious and immediate
- If a topic is only tangentially or indirectly related, exclude it
- Better to return 1-3 highly relevant topics than many loosely related ones
- If no topics are strongly relevant, return an empty array []
- Maximum ${limit} topics
- Return ONLY a JSON array of topic names`

    let response: any
    try {
        // Try llama-3.1-8b-instruct-fast which is more commonly available
        response = await env.AI.run(
            "@cf/meta/llama-3.1-8b-instruct-fast" as any,
            {
                messages: [
                    { role: "system", content: systemMessage },
                    { role: "user", content: userMessage },
                ],
                temperature: 0.1,
                max_tokens: 500,
            }
        )
    } catch (error) {
        console.error("LLM API error:", error)
        return []
    }

    // Parse LLM response - extract JSON array
    const text =
        typeof response === "string" ? response : response.response || ""
    if (!text || typeof text !== "string") {
        console.log("LLM response type issue:", typeof response, response)
        return []
    }

    console.log("LLM response text:", text)

    const jsonMatch = text.match(/\[[\s\S]*?\]/)
    if (!jsonMatch) {
        console.log("No JSON array found in LLM response")
        return []
    }

    try {
        const recommendedNames = JSON.parse(jsonMatch[0]) as string[]
        console.log("Recommended names:", recommendedNames)

        // Map names back to topic objects
        const hits = recommendedNames
            .map((name, index) => {
                const topic = topicsData.find((t) => t.name === name)
                if (!topic) return null
                return {
                    id: topic.id,
                    name: topic.name,
                    slug: topic.slug,
                    excerpt: topic.excerpt,
                    url: `${baseUrl}/${topic.slug}`,
                    __position: index + 1,
                    score: 1.0 - index * 0.05, // Synthetic score
                }
            })
            .filter((hit): hit is TopicHit => hit !== null)
            .slice(0, limit)

        return hits
    } catch {
        return []
    }
}

// Valid query parameter names for this endpoint
const VALID_PARAMS = new Set([
    COMMON_SEARCH_PARAMS.QUERY, // "q"
    "limit",
    "mode",
])

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, request } = context
    const url = new URL(request.url)
    const baseUrl = getBaseUrl(request)

    const startTime = performance.now()

    try {
        // Validate query parameters - reject unknown params to catch typos
        const validationError = validateQueryParams(url, VALID_PARAMS)
        if (validationError) return validationError

        // Parse query parameter
        const query = url.searchParams.get(COMMON_SEARCH_PARAMS.QUERY) || ""

        // Parse mode parameter
        const mode = (url.searchParams.get("mode") || "semantic") as
            | "semantic"
            | "llm"
        if (mode !== "semantic" && mode !== "llm") {
            return new Response(
                JSON.stringify({
                    error: "Invalid mode parameter",
                    details: "Mode must be 'semantic' or 'llm'",
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

        // Parse limit parameter
        const limit = Math.min(
            Math.max(
                1,
                parseInt(
                    url.searchParams.get("limit") || DEFAULT_LIMIT.toString()
                )
            ),
            MAX_LIMIT
        )

        let response: TopicsApiResponse

        if (mode === "llm") {
            // LLM-based recommendations
            const hits = await recommendTopicsWithLLM(
                env,
                query,
                limit,
                baseUrl
            )
            const timing_ms = Math.round(performance.now() - startTime)
            response = {
                query,
                hits,
                nbHits: hits.length,
                mode: "llm",
                timing_ms,
            }
        } else {
            // Semantic search via Vectorize
            const hits = await searchTopicsWithVectorize(
                env,
                query,
                limit,
                baseUrl
            )

            const timing_ms = Math.round(performance.now() - startTime)
            response = {
                query,
                hits,
                nbHits: hits.length,
                mode: "semantic",
                timing_ms,
            }
        }

        return new Response(JSON.stringify(response, null, 2), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=60",
                "Access-Control-Allow-Origin": "*",
            },
        })
    } catch (error) {
        console.error("AI Search topics error:", error)

        return new Response(
            JSON.stringify({
                error: "AI Search failed",
                message:
                    error instanceof Error ? error.message : "Unknown error",
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
