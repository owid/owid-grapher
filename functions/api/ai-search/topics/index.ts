import { Env } from "../../../_common/env.js"
import {
    getBaseUrl,
    validateQueryParams,
    COMMON_SEARCH_PARAMS,
    AISearchResult,
    AISearchResponse,
} from "../utils.js"

// Name of the AI Search instance in Cloudflare dashboard
const AI_SEARCH_INSTANCE_NAME = "search-topics"

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
): TopicsApiResponse {
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

// Valid query parameter names for this endpoint
const VALID_PARAMS = new Set([
    COMMON_SEARCH_PARAMS.QUERY, // "q"
    "limit",
])

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, request } = context
    const url = new URL(request.url)
    const baseUrl = getBaseUrl(request)

    try {
        // Validate query parameters - reject unknown params to catch typos
        const validationError = validateQueryParams(url, VALID_PARAMS)
        if (validationError) return validationError

        // Parse query parameter
        const query = url.searchParams.get(COMMON_SEARCH_PARAMS.QUERY) || ""

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

        // Fetch more results than requested for better relevance sorting
        const fetchSize = Math.min(limit + 10, MAX_LIMIT)

        // Call AI Search via the AI binding
        const results = (await env.AI.autorag(AI_SEARCH_INSTANCE_NAME).search({
            query,
            max_num_results: fetchSize,
            ranking_options: {
                score_threshold: 0.1,
            },
        })) as AISearchResponse

        const response = transformToTopicsApiFormat(
            query,
            results,
            limit,
            baseUrl
        )

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
