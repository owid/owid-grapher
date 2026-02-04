import {
    SearchUrlParam,
    ChartRecordType,
    GrapherTabName,
} from "@ourworldindata/types"

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

/**
 * Minimal chart info for LLM context (keeps token usage low).
 */
export interface ChartInfoForLLM {
    title: string
    slug: string
    subtitle?: string
}

/**
 * Full chart info matching EnrichedSearchChartHit from /api/search.
 * Used for API responses to enable frontend reuse.
 * Note: publishedAt/updatedAt are retrieved from Algolia but not in SearchChartHit type.
 */
export interface ChartInfo {
    title: string
    slug: string
    url: string
    subtitle?: string
    variantName?: string
    type: ChartRecordType
    queryParams?: string
    availableEntities: string[]
    originalAvailableEntities?: string[]
    availableTabs: GrapherTabName[]
    publishedAt?: string
    updatedAt?: string
}

/**
 * Extract text content from Cloudflare Workers AI response.
 * Handles various response formats: string, { response }, { text }, { content },
 * and OpenAI-compatible { choices[0].message.content }.
 */
export function extractTextFromCFResponse(response: unknown): string {
    if (typeof response === "string") {
        return response
    }

    if (response && typeof response === "object") {
        const resp = response as Record<string, unknown>

        // CF models may return array directly or as response field
        if (Array.isArray(resp.response)) {
            return JSON.stringify(resp.response)
        }
        if (typeof resp.response === "string") {
            return resp.response
        }
        if (typeof resp.text === "string") {
            return resp.text
        }
        if (typeof resp.content === "string") {
            return resp.content
        }

        // OpenAI-like format
        if (resp.choices && Array.isArray(resp.choices) && resp.choices[0]) {
            const choice = resp.choices[0] as Record<string, unknown>
            if (choice.message && typeof choice.message === "object") {
                const msg = choice.message as Record<string, unknown>
                if (typeof msg.content === "string") {
                    return msg.content
                }
            }
        }
    }

    return ""
}

/**
 * Extract a JSON array from LLM text output.
 * Returns the parsed array or null if parsing fails.
 */
export function extractJsonArray<T>(text: string): T[] | null {
    try {
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            if (Array.isArray(parsed)) {
                return parsed as T[]
            }
        }
    } catch {
        // Parsing failed
    }
    return null
}

// =============================================================================
// Semantic Search
// =============================================================================

/** Name of the AI Search instance in Cloudflare dashboard */
const AI_SEARCH_INSTANCE_NAME = "search-charts"

/** Chart metadata stored in R2 */
interface ChartData {
    type: string
    slug: string
    variantName: string
    availableTabs: string[]
    queryParams: string
    publishedAt: string
    updatedAt: string
    views_7d: number
    views_14d: number
    views_365d: number
    fmRank?: number
    tag1?: string
    tag2?: string
    tag3?: string
    tag4?: string
}

function extractObjectIDFromFilename(filename: string): string {
    return filename
        .replace(/^(charts|explorers|mdim)\//, "")
        .replace(/\.md$/, "")
}

function extractTitleFromContent(text: string): string {
    const match = text.match(/^#\s+(.+)$/m)
    return match?.[1] ?? ""
}

function extractSubtitleFromContent(text: string): string | undefined {
    const lines = text.split("\n")
    for (const rawLine of lines) {
        const line = rawLine.trim()
        if (
            !line ||
            line.startsWith("#") ||
            line.startsWith("**") ||
            line.startsWith("- ")
        ) {
            continue
        }
        return line
    }
    return undefined
}

function parseChartData(result: AISearchResult): Partial<ChartData> {
    const fileAttr = result.attributes.file as
        | { chartdata?: string; type?: string; slug?: string }
        | undefined

    const chartdataStr = fileAttr?.chartdata
    if (chartdataStr && typeof chartdataStr === "string") {
        try {
            const decoded = atob(chartdataStr)
            return JSON.parse(decoded) as ChartData
        } catch {
            // Fall through to legacy handling
        }
    }

    return {
        type: (fileAttr?.type as string) ?? "chart",
        slug: fileAttr?.slug as string | undefined,
    }
}

function calculateCombinedScore(
    aiSearchScore: number,
    fmRank: number | undefined,
    views7d: number | undefined
): number {
    const relevanceScore = aiSearchScore
    const fmBoost = fmRank ? Math.max(0, 0.33 - fmRank * 0.03) : 0
    const viewsBoost = views7d ? 0.01 * Math.log10(views7d + 1) : 0
    return relevanceScore + fmBoost + viewsBoost
}

/**
 * Transform a single AI Search result to ChartInfo format.
 */
function transformAISearchResultToChartInfo(
    result: AISearchResult,
    baseUrl: string
): ChartInfo {
    const objectID = extractObjectIDFromFilename(result.filename)
    const text = result.content[0]?.text ?? ""
    const title = extractTitleFromContent(text)
    const subtitle = extractSubtitleFromContent(text)
    const chartData = parseChartData(result)

    const slug = chartData.slug || objectID
    const isExplorer = chartData.type === "explorerView"
    const urlPath = isExplorer ? "explorers" : "grapher"
    const queryParams = chartData.queryParams || ""
    const url = `${baseUrl}/${urlPath}/${slug}${queryParams}`

    const type = (chartData.type as ChartRecordType) ?? "chart"
    const availableTabs = (chartData.availableTabs as GrapherTabName[]) ?? []

    return {
        title,
        slug,
        url,
        subtitle,
        variantName: chartData.variantName,
        type,
        queryParams: chartData.queryParams,
        availableEntities: [],
        availableTabs,
        publishedAt: chartData.publishedAt,
        updatedAt: chartData.updatedAt,
    }
}

/**
 * Perform a single semantic search using Cloudflare AI Search.
 * Returns charts sorted by combined score (semantic relevance + FM rank + pageviews).
 */
export async function searchChartsSemantic(
    ai: Ai,
    query: string,
    maxResults: number,
    baseUrl: string
): Promise<{ query: string; charts: ChartInfo[] }> {
    const results = (await ai.autorag(AI_SEARCH_INSTANCE_NAME).search({
        query,
        max_num_results: Math.max(maxResults, Math.min(maxResults + 10, 50)),
        ranking_options: { score_threshold: 0.1 },
    })) as AISearchResponse

    // Transform and score results
    const scoredCharts = results.data.map((result) => {
        const chart = transformAISearchResultToChartInfo(result, baseUrl)
        const chartData = parseChartData(result)
        const score = calculateCombinedScore(
            result.score,
            chartData.fmRank,
            chartData.views_7d
        )
        return { chart, score }
    })

    // Sort by score and take top results
    scoredCharts.sort((a, b) => b.score - a.score)
    const charts = scoredCharts.slice(0, maxResults).map((sc) => sc.chart)

    return { query, charts }
}
