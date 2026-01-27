import { Env } from "../../../_common/env.js"
import {
    getBaseUrl,
    validateQueryParams,
    COMMON_SEARCH_PARAMS,
    AISearchResult,
    AISearchResponse,
} from "../utils.js"
import topicsData from "./topics.json"

// Name of the AI Search instance in Cloudflare dashboard
const AI_SEARCH_INSTANCE_NAME = "search-topics"

// Pre-build topics list for LLM (cacheable in system message)
const TOPICS_LIST = topicsData.map((t) => `- ${t.name}`).join("\n")

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50

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
 * Extract slug from filename (e.g., "topics/climate-change.md" -> "climate-change")
 */
function extractSlugFromFilename(filename: string): string {
    return filename.replace(/^topics\//, "").replace(/\.md$/, "")
}

/**
 * Extract title from markdown content (first H1 heading)
 */
function extractTitleFromContent(text: string): string {
    const match = text.match(/^#\s+(.+)$/m)
    return match?.[1] ?? ""
}

/**
 * Decode base64 string to UTF-8 text.
 * Unlike atob() which returns Latin-1, this properly handles UTF-8 encoded data.
 */
function base64ToUtf8(base64: string): string {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
    }
    return new TextDecoder("utf-8").decode(bytes)
}

/**
 * Parse topic metadata from R2 object metadata (stored as base64-encoded JSON in topicdata field)
 */
function parseTopicData(result: AISearchResult): Partial<TopicData> {
    const fileAttr = result.attributes.file as
        | {
              topicdata?: string
          }
        | undefined

    const topicdataStr = fileAttr?.topicdata
    if (topicdataStr && typeof topicdataStr === "string") {
        try {
            // Handle b64- prefix if present
            const base64Data = topicdataStr.startsWith("b64-")
                ? topicdataStr.slice(4)
                : topicdataStr
            const decoded = base64ToUtf8(base64Data)
            return JSON.parse(decoded) as TopicData
        } catch {
            // Fall through to defaults
        }
    }

    return {}
}

/**
 * Transform AI Search results to topics API format
 */
function transformToTopicsApiFormat(
    query: string,
    results: AISearchResponse,
    limit: number,
    baseUrl: string
): Omit<TopicsApiResponse, "mode" | "timing_ms"> {
    const hits: TopicHit[] = results.data.map((result, index) => {
        const topicData = parseTopicData(result)
        const slug = topicData.slug || extractSlugFromFilename(result.filename)
        const text = result.content[0]?.text ?? ""
        const name = topicData.name || extractTitleFromContent(text)

        return {
            id: topicData.id ?? 0,
            name,
            slug,
            excerpt: topicData.excerpt || "",
            url: `${baseUrl}/${slug}`,
            __position: index + 1,
            score: result.score,
        }
    })

    // Sort by score (descending) - AI Search already returns sorted, but be explicit
    hits.sort((a, b) => b.score - a.score)

    // Apply limit
    const limitedHits = hits.slice(0, limit)

    // Re-assign positions after sorting/limiting
    limitedHits.forEach((hit, index) => {
        hit.__position = index + 1
    })

    return {
        query,
        hits: limitedHits,
        nbHits: limitedHits.length,
    }
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
    const userMessage = `Given this query: "${query}"\n\nRecommend the most relevant topics (0-${limit}) that match this query.\nReturn ONLY a JSON array of topic names.`

    let response: any
    try {
        // Try llama-3.1-8b-instruct-fast which is more commonly available
        response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", {
            messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: userMessage },
            ],
            temperature: 0.1,
            max_tokens: 500,
        })
    } catch (error) {
        console.error("LLM API error:", error)
        return []
    }

    // Parse LLM response - extract JSON array
    const text = typeof response === "string" ? response : (response.response || "")
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
            // Semantic search via AI Search
            const fetchSize = Math.min(limit + 10, MAX_LIMIT)

            const results = (await env.AI.autorag(
                AI_SEARCH_INSTANCE_NAME
            ).search({
                query,
                max_num_results: fetchSize,
                ranking_options: {
                    score_threshold: 0.1,
                },
            })) as AISearchResponse

            const searchResponse = transformToTopicsApiFormat(
                query,
                results,
                limit,
                baseUrl
            )

            const timing_ms = Math.round(performance.now() - startTime)
            response = {
                ...searchResponse,
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
