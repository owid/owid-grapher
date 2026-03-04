import { Env } from "../../../_common/env.js"
import {
    getBaseUrl,
    validateQueryParams,
    COMMON_SEARCH_PARAMS,
} from "../utils.js"

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50
const SEMANTIC_CANDIDATES = 10
const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5"
const LLM_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast"
const DATASETTE_URL = "https://datasette-public.owid.io/owid.json"

interface TopicData {
    id: number
    name: string
    slug: string
    excerpt: string
}

interface DatasetteResponse {
    ok: boolean
    rows: Array<[number, string, string, string | null]>
    error?: string | null
}

// NOTE: Fetching topics from Datasette on cold start adds ~200-500ms latency.
// If this becomes a performance issue, consider switching back to a static
// topics.json file (generate with: npx tsx functions/scripts/generateTopicsJson.ts).
let topicsCache: TopicData[] | null = null
let topicsListCache: string | null = null

async function getTopics(): Promise<TopicData[]> {
    if (topicsCache) return topicsCache

    const sql = `
        SELECT t.id, t.name, t.slug, p.content->>'$.excerpt' AS excerpt
        FROM tags t
        JOIN posts_gdocs p ON t.slug = p.slug
        WHERE t.slug IS NOT NULL
            AND p.published = 1
            AND p.type IN ('topic-page', 'linear-topic-page')
        ORDER BY t.name ASC
    `
    const url = `${DATASETTE_URL}?sql=${encodeURIComponent(sql)}`
    const response = await fetch(url)

    if (!response.ok) {
        throw new Error(
            `Datasette request failed: ${response.status} ${response.statusText}`
        )
    }

    const data = (await response.json()) as DatasetteResponse
    if (!data.ok || data.error) {
        throw new Error(
            `Datasette query error: ${data.error || "Unknown error"}`
        )
    }

    topicsCache = data.rows.map(([id, name, slug, excerpt]) => ({
        id,
        name,
        slug,
        excerpt: excerpt || "",
    }))
    return topicsCache
}

async function getTopicsList(): Promise<string> {
    if (topicsListCache) return topicsListCache
    const topics = await getTopics()
    topicsListCache = topics.map((t) => `- ${t.name}`).join("\n")
    return topicsListCache
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
    source: "semantic" | "llm"
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
 * Use LLM to filter semantic topic candidates to only strongly relevant ones.
 */
async function filterTopicsWithLLM(
    env: Env,
    query: string,
    candidates: TopicHit[],
    limit: number
): Promise<TopicHit[]> {
    const candidateList = candidates.map((c) => `- ${c.name}`).join("\n")

    const userMessage = `Given this search query: "${query}"

These topic candidates were found via semantic search:
${candidateList}

Select ONLY topics that are DIRECTLY and STRONGLY related to the query.
- Exclude topics that are only tangentially or loosely related
- Better to return fewer highly relevant topics than many weak ones
- If none are strongly relevant, return an empty array []
- Maximum ${limit} topics
- Return ONLY a JSON array of topic names`

    const response = (await (
        env.AI.run as (
            model: string,
            options: object
        ) => Promise<{ response?: string } | string>
    )(LLM_MODEL, {
        messages: [{ role: "user", content: userMessage }],
        temperature: 0,
        max_tokens: 300,
    })) as { response?: string } | string

    const text =
        typeof response === "string" ? response : response.response || ""
    if (!text) return candidates.slice(0, limit)

    console.log("Topics LLM filter response:", text)

    const jsonMatch = text.match(/\[[\s\S]*?\]/)
    if (!jsonMatch) return candidates.slice(0, limit)

    try {
        const selectedNames = JSON.parse(jsonMatch[0]) as string[]
        const nameSet = new Set(selectedNames)
        const filtered = candidates.filter((c) => nameSet.has(c.name))
        return filtered.slice(0, limit)
    } catch {
        return candidates.slice(0, limit)
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
    const topicsList = await getTopicsList()
    const systemMessage = `Here are all available topics:\n${topicsList}`
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
        const topics = await getTopics()
        const hits = recommendedNames
            .map((name, index) => {
                const topic = topics.find((t) => t.name === name)
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
    "source",
    "llm_filter",
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

        // source=semantic (default): use Vectorize embeddings
        // source=llm: use LLM to recommend topics
        const source = (url.searchParams.get("source") || "semantic") as
            | "semantic"
            | "llm"
        if (source !== "semantic" && source !== "llm") {
            return new Response(
                JSON.stringify({
                    error: "Invalid source parameter",
                    details: "source must be 'semantic' or 'llm'",
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

        // llm_filter (default true): use LLM to filter semantic candidates
        const llmFilter =
            url.searchParams.get("llm_filter") !== "false"

        let response: TopicsApiResponse

        if (source === "llm") {
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
                source: "llm",
                timing_ms,
            }
        } else {
            // Semantic search via Vectorize
            const candidateLimit = llmFilter
                ? SEMANTIC_CANDIDATES
                : limit
            const candidates = await searchTopicsWithVectorize(
                env,
                query,
                candidateLimit,
                baseUrl
            )

            const hits = llmFilter
                ? await filterTopicsWithLLM(env, query, candidates, limit)
                : candidates

            const timing_ms = Math.round(performance.now() - startTime)
            response = {
                query,
                hits,
                nbHits: hits.length,
                source: "semantic",
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
