import { Env } from "../../../_common/env.js"
import { validateQueryParams, COMMON_SEARCH_PARAMS } from "../utils.js"

// LLM model for query rewriting
const LLM_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast"
const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5"

// Valid query parameter names for this endpoint
const VALID_PARAMS = new Set([
    COMMON_SEARCH_PARAMS.QUERY,
    "limit",
    "use_vocabulary",
    "vocabulary_limit",
    "vocabulary_filter",
])

const DEFAULT_LIMIT = 3
const MAX_LIMIT = 10
const DEFAULT_VOCABULARY_LIMIT = 20
const MAX_VOCABULARY_LIMIT = 50

interface VocabularyCandidate {
    keyword: string
    topic_slug: string
    topic_name: string
    score: number
}

interface RewriteResponse {
    query: string
    keywords: string[]
    timing: {
        total_ms: number
        vocabulary_search_ms?: number
        llm_ms?: number
    }
    vocabulary?: {
        mode: "semantic" | "llm" | "both"
        candidates?: VocabularyCandidate[]
        matched: number
    }
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
 * Search vocabulary using semantic similarity
 */
async function searchVocabulary(
    env: Env,
    query: string,
    limit: number
): Promise<VocabularyCandidate[]> {
    // Generate embedding for the query
    const queryEmbedding = await generateQueryEmbedding(env.AI, query)

    // Query Vectorize with the embedding
    const results = await env.VECTORIZE_VOCABULARY.query(queryEmbedding, {
        topK: limit,
        returnMetadata: "all",
    })

    // Transform results to VocabularyCandidate format
    return results.matches.map((match) => {
        const metadata = match.metadata as unknown as {
            keyword: string
            topic_slug: string
            topic_name: string
        }

        return {
            keyword: metadata.keyword,
            topic_slug: metadata.topic_slug,
            topic_name: metadata.topic_name,
            score: match.score,
        }
    })
}

/**
 * Filter keywords using LLM with vocabulary constraints
 */
async function filterWithLLM(
    env: Env,
    query: string,
    vocabularyCandidates: VocabularyCandidate[],
    limit: number
): Promise<string[]> {
    const vocabularyList = vocabularyCandidates
        .map((c) => `- ${c.keyword}`)
        .join("\n")

    const userMessage = `Rewrite this query into 1-${limit} keywords for searching Our World in Data charts.

AVAILABLE VOCABULARY (you MUST choose from these terms ONLY):
${vocabularyList}

Rules:
- Use ONLY terms from the vocabulary list above
- Select 1-${limit} most relevant terms
- Translate user's intent to exact vocabulary matches
- Do NOT return the original query "${query}" itself as a keyword
- Return ONLY a JSON array of strings

Query: "${query}"`

    const response = (await (
        env.AI.run as (
            model: string,
            options: object
        ) => Promise<{ response?: string } | string>
    )(LLM_MODEL, {
        messages: [{ role: "user", content: userMessage }],
        temperature: 0,
        max_tokens: 200,
    })) as { response?: string } | string

    const text =
        typeof response === "string" ? response : response.response || ""
    if (!text) {
        throw new Error("LLM filtering: empty response from model")
    }

    console.log("LLM filtering response:", text)

    // Extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*?\]/)
    if (!jsonMatch) {
        throw new Error(
            `LLM filtering: no JSON array found in response: ${text}`
        )
    }

    const keywords = JSON.parse(jsonMatch[0]) as string[]
    if (!Array.isArray(keywords)) {
        throw new Error(
            `LLM filtering: invalid array in response: ${jsonMatch[0]}`
        )
    }

    return keywords
}

/**
 * Use LLM to convert a natural language query into keywords for Algolia search.
 */
async function rewriteQuery(env: Env, query: string): Promise<string[]> {
    const userMessage = `Rewrite this query into 1-5 keywords for searching Our World in Data charts.

Rules:
- Use terms from OWID chart titles (e.g., "GDP per capita", "CO2 emissions", "fish supply")
- For vague terms, translate to metrics (e.g., "richer" → "GDP per capita")
- Do NOT add "rate", "level", "index" unless in original query
- NEVER include geographic names (countries, continents, regions)
- Do NOT return the original query "${query}" itself as a keyword

Return ONLY a JSON array of strings.

Query: "${query}"
`

    const response = (await (
        env.AI.run as (
            model: string,
            options: object
        ) => Promise<{ response?: string } | string>
    )(LLM_MODEL, {
        messages: [{ role: "user", content: userMessage }],
        temperature: 0,
        max_tokens: 200,
    })) as { response?: string } | string

    const text =
        typeof response === "string" ? response : response.response || ""
    if (!text) {
        throw new Error("Query rewrite: empty response from model")
    }

    console.log("Query rewrite response:", text)

    // Extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*?\]/)
    if (!jsonMatch) {
        throw new Error(
            `Query rewrite: no JSON array found in response: ${text}`
        )
    }

    const keywords = JSON.parse(jsonMatch[0]) as string[]
    if (!Array.isArray(keywords)) {
        throw new Error(
            `Query rewrite: invalid array in response: ${jsonMatch[0]}`
        )
    }

    return keywords
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, request } = context
    const url = new URL(request.url)
    const startTime = Date.now()

    try {
        // Validate query parameters
        const validationError = validateQueryParams(url, VALID_PARAMS)
        if (validationError) return validationError

        // Parse query parameter
        const query = url.searchParams.get(COMMON_SEARCH_PARAMS.QUERY) || ""

        if (!query) {
            return new Response(
                JSON.stringify({
                    error: "Missing query parameter",
                    details: 'Please provide a "q" parameter',
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

        // Parse result limit (how many keywords to return)
        const limit = Math.min(
            Math.max(
                1,
                parseInt(
                    url.searchParams.get("limit") || DEFAULT_LIMIT.toString()
                )
            ),
            MAX_LIMIT
        )

        // Parse vocabulary parameters
        // Default to using vocabulary search with LLM filtering
        const useVocabulary = url.searchParams.get("use_vocabulary") !== "false"
        const vocabularyLimit = Math.min(
            Math.max(
                1,
                parseInt(
                    url.searchParams.get("vocabulary_limit") ||
                        DEFAULT_VOCABULARY_LIMIT.toString()
                )
            ),
            MAX_VOCABULARY_LIMIT
        )
        const vocabularyFilter = (url.searchParams.get("vocabulary_filter") ||
            "both") as "semantic" | "llm" | "both"

        // Validate vocabulary_filter parameter
        if (
            useVocabulary &&
            vocabularyFilter !== "semantic" &&
            vocabularyFilter !== "llm" &&
            vocabularyFilter !== "both"
        ) {
            return new Response(
                JSON.stringify({
                    error: "Invalid vocabulary_filter parameter",
                    details:
                        "vocabulary_filter must be 'semantic', 'llm', or 'both'",
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

        let keywords: string[]
        let vocabularySearchMs: number | undefined
        let llmMs: number | undefined
        let vocabularyCandidates: VocabularyCandidate[] | undefined

        if (useVocabulary) {
            // Vocabulary-based search
            if (vocabularyFilter === "semantic") {
                // Mode 1: Semantic search only
                const vocabStart = Date.now()
                vocabularyCandidates = await searchVocabulary(
                    env,
                    query,
                    vocabularyLimit
                )
                vocabularySearchMs = Date.now() - vocabStart

                keywords = vocabularyCandidates
                    .map((c) => c.keyword)
                    .slice(0, limit)
            } else if (vocabularyFilter === "llm") {
                // Mode 2: LLM with all vocabulary
                // For simplicity, we'll still use semantic search to get candidates
                // In a real scenario, you might want to fetch all vocabulary
                const vocabStart = Date.now()
                vocabularyCandidates = await searchVocabulary(
                    env,
                    query,
                    vocabularyLimit
                )
                vocabularySearchMs = Date.now() - vocabStart

                const llmStart = Date.now()
                keywords = await filterWithLLM(
                    env,
                    query,
                    vocabularyCandidates,
                    limit
                )
                llmMs = Date.now() - llmStart
            } else {
                // Mode 3: Both (semantic + LLM filtering)
                const vocabStart = Date.now()
                vocabularyCandidates = await searchVocabulary(
                    env,
                    query,
                    vocabularyLimit
                )
                vocabularySearchMs = Date.now() - vocabStart

                const llmStart = Date.now()
                keywords = await filterWithLLM(
                    env,
                    query,
                    vocabularyCandidates,
                    limit
                )
                llmMs = Date.now() - llmStart
            }
        } else {
            // Original LLM-only behavior
            const llmStart = Date.now()
            keywords = await rewriteQuery(env, query)
            llmMs = Date.now() - llmStart
        }

        // Filter out keywords that are the same as the query
        const queryLower = query.toLowerCase().trim()
        keywords = keywords.filter(
            (kw) => kw.toLowerCase().trim() !== queryLower
        )

        const endTime = Date.now()

        console.log(
            `[AI Search rewrite] query="${query}" | total=${endTime - startTime}ms | keywords=${keywords.join(", ")}`
        )

        const response: RewriteResponse = {
            query,
            keywords,
            timing: {
                total_ms: endTime - startTime,
                vocabulary_search_ms: vocabularySearchMs,
                llm_ms: llmMs,
            },
        }

        if (useVocabulary && vocabularyCandidates) {
            response.vocabulary = {
                mode: vocabularyFilter,
                candidates: vocabularyCandidates,
                matched: vocabularyCandidates.length,
            }
        }

        return new Response(JSON.stringify(response, null, 2), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=3600", // Cache for 1 hour
                "Access-Control-Allow-Origin": "*",
            },
        })
    } catch (error) {
        console.error("Query rewrite error:", error)

        return new Response(
            JSON.stringify({
                error: "Query rewrite failed",
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
