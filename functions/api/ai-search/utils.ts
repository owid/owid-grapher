import { SearchUrlParam } from "@ourworldindata/types"

/**
 * Determine base URL from forwarded headers (when behind proxy) or fall back to request URL origin.
 * Checks X-Forwarded-Host and X-Forwarded-Proto headers that reverse proxies typically set.
 */
export function getBaseUrl(request: Request): string {
    const forwardedHost = request.headers.get("X-Forwarded-Host")
    const forwardedProto = request.headers.get("X-Forwarded-Proto") || "https"
    if (forwardedHost) {
        return `${forwardedProto}://${forwardedHost}`
    }
    return new URL(request.url).origin
}

/**
 * Validate query parameters against a set of valid parameter names.
 * Returns an error Response if invalid parameters are found, otherwise null.
 */
export function validateQueryParams(
    url: URL,
    validParams: Set<string>
): Response | null {
    const invalidParams = [...url.searchParams.keys()].filter(
        (key) => !validParams.has(key)
    )

    if (invalidParams.length > 0) {
        return new Response(
            JSON.stringify({
                error: "Invalid query parameters",
                details: `Unknown parameters: ${invalidParams.join(", ")}. Valid parameters are: ${[...validParams].join(", ")}`,
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

    return null
}

/**
 * Common valid query parameters shared across AI search endpoints
 */
export const COMMON_SEARCH_PARAMS = {
    QUERY: SearchUrlParam.QUERY, // "q"
    COUNTRY: SearchUrlParam.COUNTRY, // "countries"
    TOPIC: SearchUrlParam.TOPIC, // "topics"
    REQUIRE_ALL_COUNTRIES: SearchUrlParam.REQUIRE_ALL_COUNTRIES, // "requireAllCountries"
} as const

/**
 * AI Search response shape from Cloudflare
 */
export interface AISearchResult {
    file_id: string
    filename: string
    score: number
    attributes: Record<string, string | number | boolean | null>
    content: Array<{
        type: string
        text: string
    }>
}

export interface AISearchResponse {
    data: AISearchResult[]
    has_more: boolean
}

/**
 * AI Search aiSearch() response shape (includes generated response)
 */
export interface AISearchAnswerResponse extends AISearchResponse {
    response: string
    search_query: string
}

/**
 * Streaming chunk from aiSearch() with stream: true
 * The stream is NDJSON format with partial response and source data
 */
export interface AISearchStreamChunk {
    response?: string // Partial generated text
    data?: AISearchResult[] // Source documents (typically in first chunk)
    search_query?: string
    has_more?: boolean
}
