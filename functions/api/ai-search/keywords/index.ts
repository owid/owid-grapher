import { Env } from "../../../_common/env.js"
import { validateQueryParams, COMMON_SEARCH_PARAMS } from "../utils.js"

const LLM_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast"
const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5"

const VALID_PARAMS = new Set([
    COMMON_SEARCH_PARAMS.QUERY,
    "limit",
    "source",
    "llm_filter",
])

const DEFAULT_LIMIT = 3
const MAX_LIMIT = 10
const VOCABULARY_CANDIDATES = 20

interface VocabularyCandidate {
    keyword: string
    topic_slug: string
    topic_name: string
    score: number
}

interface KeywordsResponse {
    query: string
    keywords: string[]
    timing: {
        total_ms: number
        search_ms?: number
        llm_ms?: number
    }
    vocabulary?: {
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
    const queryEmbedding = await generateQueryEmbedding(env.AI, query)

    const results = await env.VECTORIZE_VOCABULARY.query(queryEmbedding, {
        topK: limit,
        returnMetadata: "all",
    })

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
 * Use LLM to pick the most relevant keywords from vocabulary candidates.
 */
async function selectKeywordsWithLLM(
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
        throw new Error("Keywords LLM selection: empty response from model")
    }

    console.log("Keywords LLM selection response:", text)

    const jsonMatch = text.match(/\[[\s\S]*?\]/)
    if (!jsonMatch) {
        throw new Error(
            `Keywords LLM selection: no JSON array found in response: ${text}`
        )
    }

    const keywords = JSON.parse(jsonMatch[0]) as string[]
    if (!Array.isArray(keywords)) {
        throw new Error(
            `Keywords LLM selection: invalid array in response: ${jsonMatch[0]}`
        )
    }

    return keywords
}

/**
 * Use LLM to generate keywords directly (no vocabulary constraints).
 */
async function generateKeywordsWithLLM(
    env: Env,
    query: string
): Promise<string[]> {
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
        throw new Error("Keywords LLM generation: empty response from model")
    }

    console.log("Keywords LLM generation response:", text)

    const jsonMatch = text.match(/\[[\s\S]*?\]/)
    if (!jsonMatch) {
        throw new Error(
            `Keywords LLM generation: no JSON array found in response: ${text}`
        )
    }

    const keywords = JSON.parse(jsonMatch[0]) as string[]
    if (!Array.isArray(keywords)) {
        throw new Error(
            `Keywords LLM generation: invalid array in response: ${jsonMatch[0]}`
        )
    }

    return keywords
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, request } = context
    const url = new URL(request.url)
    const startTime = Date.now()

    try {
        const validationError = validateQueryParams(url, VALID_PARAMS)
        if (validationError) return validationError

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

        const limit = Math.min(
            Math.max(
                1,
                parseInt(
                    url.searchParams.get("limit") || DEFAULT_LIMIT.toString()
                )
            ),
            MAX_LIMIT
        )

        // source=semantic (default): use pre-indexed vocabulary via Vectorize
        // source=llm: use LLM directly without vocabulary constraints
        const source = (url.searchParams.get("source") || "semantic") as
            | "semantic"
            | "llm"

        // llm_filter (default true): use LLM to pick best keywords from candidates
        const llmFilter = url.searchParams.get("llm_filter") !== "false"

        let keywords: string[]
        let searchMs: number | undefined
        let llmMs: number | undefined
        let vocabularyCandidates: VocabularyCandidate[] | undefined

        if (source === "semantic") {
            // Step 1: Semantic search to find vocabulary candidates
            const searchStart = Date.now()
            vocabularyCandidates = await searchVocabulary(
                env,
                query,
                VOCABULARY_CANDIDATES
            )
            searchMs = Date.now() - searchStart

            if (llmFilter) {
                // Step 2: LLM picks the best keywords from candidates
                const llmStart = Date.now()
                keywords = await selectKeywordsWithLLM(
                    env,
                    query,
                    vocabularyCandidates,
                    limit
                )
                llmMs = Date.now() - llmStart
            } else {
                // No LLM — return top semantic matches directly
                keywords = vocabularyCandidates
                    .map((c) => c.keyword)
                    .slice(0, limit)
            }
        } else {
            // source=llm — generate keywords directly without vocabulary
            const llmStart = Date.now()
            keywords = await generateKeywordsWithLLM(env, query)
            llmMs = Date.now() - llmStart
        }

        // Filter out keywords identical to the query
        const queryLower = query.toLowerCase().trim()
        keywords = keywords.filter(
            (kw) => kw.toLowerCase().trim() !== queryLower
        )

        const endTime = Date.now()

        console.log(
            `[AI Search keywords] query="${query}" | total=${endTime - startTime}ms | keywords=${keywords.join(", ")}`
        )

        const response: KeywordsResponse = {
            query,
            keywords,
            timing: {
                total_ms: endTime - startTime,
                search_ms: searchMs,
                llm_ms: llmMs,
            },
        }

        if (source === "semantic" && vocabularyCandidates) {
            response.vocabulary = {
                candidates: vocabularyCandidates,
                matched: vocabularyCandidates.length,
            }
        }

        return new Response(JSON.stringify(response, null, 2), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=3600",
                "Access-Control-Allow-Origin": "*",
            },
        })
    } catch (error) {
        console.error("Keywords endpoint error:", error)

        return new Response(
            JSON.stringify({
                error: "Keyword suggestion failed",
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
