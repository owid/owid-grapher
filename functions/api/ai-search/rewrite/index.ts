import { Env } from "../../../_common/env.js"
import { validateQueryParams, COMMON_SEARCH_PARAMS } from "../utils.js"

// LLM model for query rewriting
const LLM_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast"

// Valid query parameter names for this endpoint
const VALID_PARAMS = new Set([COMMON_SEARCH_PARAMS.QUERY])

interface RewriteResponse {
    query: string
    keywords: string[]
    timing: {
        total_ms: number
    }
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
- Ignore country names

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

        const keywords = await rewriteQuery(env, query)
        const endTime = Date.now()

        console.log(
            `[AI Search rewrite] query="${query}" | total=${endTime - startTime}ms | keywords=${keywords.join(", ")}`
        )

        const response: RewriteResponse = {
            query,
            keywords,
            timing: {
                total_ms: endTime - startTime,
            },
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
