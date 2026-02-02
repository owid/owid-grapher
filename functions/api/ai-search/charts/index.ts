import { Env } from "../../../_common/env.js"
import {
    getBaseUrl,
    validateQueryParams,
    COMMON_SEARCH_PARAMS,
    AISearchResult,
    AISearchResponse,
} from "../utils.js"

// Name of the AI Search instance in Cloudflare dashboard
const AI_SEARCH_INSTANCE_NAME = "search-charts"

const DEFAULT_HITS_PER_PAGE = 20
const MAX_HITS_PER_PAGE = 100
const MAX_PAGE = 1000

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
    fmRank?: number // Featured metric rank (1 = top, only set for FMs)
}

/**
 * API response format matching the existing /api/search endpoint
 */
interface SearchApiResponse {
    query: string
    hits: EnrichedSearchChartHit[]
    nbHits: number
    page: number
    nbPages: number
    hitsPerPage: number
    timing?: {
        total_ms: number
        search_ms: number
        llmRerank_ms?: number
    }
}

/**
 * Enriched search hit matching the existing search API format
 */
interface EnrichedSearchChartHit {
    objectID: string
    title: string
    slug: string
    subtitle?: string
    variantName?: string
    type: string
    queryParams?: string
    availableTabs?: string[]
    availableEntities: string[]
    publishedAt?: string
    updatedAt?: string
    url: string
    __position: number
    // AI Search specific fields
    aiSearchScore: number
    score: number
    views_7d?: number
    views_14d?: number
    views_365d?: number
    fmRank?: number
}

/**
 * Extract objectID from filename.
 * Handles different prefixes: charts/, explorers/, mdim/
 * Examples:
 *   "charts/population.md" -> "population"
 *   "explorers/migration-flows-0.md" -> "migration-flows-0"
 *   "mdim/mdim-view-123.md" -> "mdim-view-123"
 */
function extractObjectIDFromFilename(filename: string): string {
    return filename
        .replace(/^(charts|explorers|mdim)\//, "")
        .replace(/\.md$/, "")
}

/**
 * Extract title from markdown content (first H1 heading)
 */
function extractTitleFromContent(text: string): string {
    const match = text.match(/^#\s+(.+)$/m)
    return match?.[1] ?? ""
}

/**
 * Extract subtitle from markdown content (first paragraph after title)
 */
function extractSubtitleFromContent(text: string): string | undefined {
    // Split by double newlines and find first non-heading, non-section paragraph
    const lines = text.split("\n")
    for (const rawLine of lines) {
        const line = rawLine.trim()
        // Skip empty lines, headings, and metadata lines
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

/**
 * Parse chart metadata from R2 object metadata (stored as JSON in chartdata field)
 */
function parseChartData(result: AISearchResult): Partial<ChartData> {
    // R2 metadata is stored in attributes.file as a nested object
    // but Cloudflare types it as Record<string, string | number | boolean | null>
    const fileAttr = result.attributes.file as
        | {
              chartdata?: string
              type?: string
              slug?: string
          }
        | undefined

    // Try R2 metadata (stored as Base64-encoded JSON in chartdata field)
    const chartdataStr = fileAttr?.chartdata
    if (chartdataStr && typeof chartdataStr === "string") {
        try {
            const decoded = atob(chartdataStr)
            return JSON.parse(decoded) as ChartData
        } catch {
            // Fall through to legacy handling
        }
    }

    // Legacy fallback
    return {
        type: (fileAttr?.type as string) ?? "chart",
        slug: fileAttr?.slug as string | undefined,
    }
}

/**
 * Calculate a combined score from AI search relevance, FM rank, and pageviews.
 *
 * Scoring strategy:
 * - AI Search score (0-1): Primary signal for semantic relevance
 * - FM boost: rank 1 = +0.3, rank 2 = +0.27, ..., rank 10 = +0.03, rank 11+ = 0
 *   (Strong boost to ensure hand-curated featured metrics rank near the top)
 * - Pageviews boost: 0.01 * log10(views + 1)
 *   (e.g., 1000 views = 0.03, 10000 = 0.04, 100000 = 0.05)
 */
function calculateCombinedScore(
    aiSearchScore: number,
    fmRank: number | undefined,
    views7d: number | undefined
): number {
    // AI search score is already 0-1
    const relevanceScore = aiSearchScore

    // FM boost: rank 1 = +0.3, rank 2 = +0.27, ..., rank 10 = +0.03, rank 11+ = 0
    const fmBoost = fmRank ? Math.max(0, 0.33 - fmRank * 0.03) : 0

    // Pageviews boost: scaled log
    const viewsBoost = views7d ? 0.01 * Math.log10(views7d + 1) : 0

    return relevanceScore + fmBoost + viewsBoost
}

/**
 * Transform AI Search results to match the existing search API format
 */
function transformToSearchApiFormat(
    query: string,
    results: AISearchResponse,
    page: number,
    hitsPerPage: number,
    baseUrl: string
): SearchApiResponse {
    const hits: EnrichedSearchChartHit[] = results.data.map((result, index) => {
        const objectID = extractObjectIDFromFilename(result.filename)
        const text = result.content[0]?.text ?? ""
        const title = extractTitleFromContent(text)
        const subtitle = extractSubtitleFromContent(text)
        const chartData = parseChartData(result)

        // Use slug from metadata (more reliable than extracting from filename)
        const slug = chartData.slug || objectID

        // Build URL based on type
        const isExplorer = chartData.type === "explorerView"
        const urlPath = isExplorer ? "explorers" : "grapher"
        const queryParams = chartData.queryParams || ""
        const url = `${baseUrl}/${urlPath}/${slug}${queryParams}`

        const aiSearchScore = result.score
        const views_7d = chartData.views_7d
        const views_14d = chartData.views_14d
        const views_365d = chartData.views_365d
        const fmRank = chartData.fmRank
        const score = calculateCombinedScore(aiSearchScore, fmRank, views_7d)

        return {
            objectID,
            title,
            slug,
            subtitle,
            variantName: chartData.variantName,
            type: chartData.type ?? "chart",
            queryParams: chartData.queryParams,
            availableTabs: chartData.availableTabs,
            availableEntities: [], // AI Search doesn't have entity data yet
            publishedAt: chartData.publishedAt,
            updatedAt: chartData.updatedAt,
            url,
            __position: index + 1,
            aiSearchScore,
            score,
            views_7d,
            views_14d,
            views_365d,
            fmRank,
        }
    })

    // Sort by combined score (descending) and trim to requested size
    hits.sort((a, b) => b.score - a.score)
    const trimmedHits = hits.slice(0, hitsPerPage)

    // Re-assign positions after sorting
    trimmedHits.forEach((hit, index) => {
        hit.__position = index + 1
    })

    return {
        query,
        hits: trimmedHits,
        nbHits: trimmedHits.length,
        page,
        nbPages: 1, // AI Search doesn't support pagination yet
        hitsPerPage,
    }
}

/**
 * Strip verbose fields from results to reduce response size
 */
function stripVerboseFields(results: SearchApiResponse): SearchApiResponse {
    return {
        ...results,
        hits: results.hits.map((hit) => {
            const { availableEntities: _ae, ...rest } = hit
            return rest as EnrichedSearchChartHit
        }),
    }
}

// Valid query parameter names for this endpoint
const VALID_PARAMS = new Set([
    COMMON_SEARCH_PARAMS.QUERY, // "q"
    COMMON_SEARCH_PARAMS.COUNTRY, // "countries"
    COMMON_SEARCH_PARAMS.TOPIC, // "topics"
    COMMON_SEARCH_PARAMS.REQUIRE_ALL_COUNTRIES, // "requireAllCountries"
    "page",
    "hitsPerPage",
    "verbose",
    "type", // Filter by record type: chart, explorer, mdim
    "rerank", // Enable reranking with BGE reranker model
    "rewrite", // Enable query rewriting for better retrieval
    "llmRerank", // Enable LLM-based reranking and filtering
    "llmModel", // LLM model for reranking: "small" (8B) or "large" (70B)
])

// LLM models for reranking
// small is about 2-3x faster and 6x cheaper
type LLMModel = "small" | "large"
const LLM_MODELS: Record<LLMModel, string> = {
    small: "@cf/meta/llama-3.1-8b-instruct-fast",
    large: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
}

// Default reranking model
const RERANKING_MODEL = "@cf/baai/bge-reranker-base"

// Map type parameter values to folder prefixes used in R2
const TYPE_TO_FOLDER: Record<string, string> = {
    chart: "charts/",
    explorer: "explorers/",
    mdim: "mdim/",
}

// All valid type values
const VALID_TYPES = Object.keys(TYPE_TO_FOLDER)

/**
 * Build AI Search filters for folder-based type filtering.
 */
function buildTypeFilters(types: string[]): {
    type: "or"
    filters: Array<{ type: "eq"; key: string; value: string }>
} {
    return {
        type: "or",
        filters: types.map((t) => ({
            type: "eq" as const,
            key: "folder",
            value: TYPE_TO_FOLDER[t],
        })),
    }
}

/**
 * Use LLM to rerank and filter search results based on semantic relevance.
 * Returns only charts that are directly relevant to the query.
 *
 * @param model - "small" uses Llama 3.1 8B (fast), "large" uses Llama 3.3 70B (better reasoning)
 */
async function rerankWithLLM(
    env: Env,
    query: string,
    hits: EnrichedSearchChartHit[],
    model: LLMModel = "small"
): Promise<EnrichedSearchChartHit[]> {
    if (hits.length === 0) return hits

    // Build a numbered list of charts for the LLM (0-indexed for tool calling)
    const chartList = hits
        .map((hit, i) => {
            const subtitle = hit.subtitle ? ` (${hit.subtitle})` : ""
            return `${i}. ${hit.title}${subtitle}`
        })
        .join("\n")

    const modelId = LLM_MODELS[model]

    // Use different strategies for small vs large models
    if (model === "large") {
        return rerankWithLLMLarge(env, query, hits, chartList, modelId)
    } else {
        return rerankWithLLMSmall(env, query, hits, chartList, modelId)
    }
}

/**
 * Rerank using small model (8B) with simple JSON output
 */
async function rerankWithLLMSmall(
    env: Env,
    query: string,
    hits: EnrichedSearchChartHit[],
    chartList: string,
    modelId: string
): Promise<EnrichedSearchChartHit[]> {
    const userMessage = `Return chart numbers relevant to the search query, ordered by relevance.
- Include semantically related charts (e.g., democracy charts for "populism")
- Put phonetic-only matches like "population" at the end
- Return ONLY a JSON array of numbers, e.g. [0, 3, 6, 1, 2]

Search query: "${query}"

Charts:
${chartList}`

    const response = (await (
        env.AI.run as (
            model: string,
            options: object
        ) => Promise<{ response?: string } | string>
    )(modelId, {
        messages: [{ role: "user", content: userMessage }],
        temperature: 0,
        max_tokens: 200,
    })) as { response?: string } | string

    const text =
        typeof response === "string" ? response : response.response || ""
    if (!text) {
        throw new Error("LLM rerank (small): empty response from model")
    }

    console.log("LLM rerank (small) response:", text)

    const jsonMatch = text.match(/\[[\s\S]*?\]/)
    if (!jsonMatch) {
        throw new Error(
            `LLM rerank (small): no JSON array found in response: ${text}`
        )
    }

    const indices = JSON.parse(jsonMatch[0]) as number[]
    if (!Array.isArray(indices)) {
        throw new Error(
            `LLM rerank (small): invalid array in response: ${jsonMatch[0]}`
        )
    }

    // Map indices back to hits (0-indexed)
    const rerankedHits = indices
        .map((i) => hits[i])
        .filter((hit): hit is EnrichedSearchChartHit => hit !== undefined)

    rerankedHits.forEach((hit, index) => {
        hit.__position = index + 1
    })

    return rerankedHits
}

/**
 * Rerank using large model (70B) with tool calling for structured output
 */
async function rerankWithLLMLarge(
    env: Env,
    query: string,
    hits: EnrichedSearchChartHit[],
    chartList: string,
    modelId: string
): Promise<EnrichedSearchChartHit[]> {
    const systemPrompt = `You are a search relevance expert.
Analyze the list of charts against the user's query.
1. Identify charts that are STRICTLY relevant.
2. DISCARD matches that are only phonetic, spelling errors, or tangentially related.
3. Charts are already ordered by popularity - preserve this order unless relevance clearly differs.
4. Call the 'submit_rankings' tool with the final sorted list of indices.`

    const response = await (
        env.AI.run as (
            model: string,
            options: object
        ) => Promise<{
            response?: string
            tool_calls?: Array<{
                name: string
                arguments: string | { relevant_indices?: number[] }
            }>
        }>
    )(modelId, {
        messages: [
            { role: "system", content: systemPrompt },
            {
                role: "user",
                content: `Query: "${query}"\n\nCharts:\n${chartList}`,
            },
        ],
        tools: [
            {
                type: "function",
                function: {
                    name: "submit_rankings",
                    description:
                        "Submit the final ranked list of relevant chart indices.",
                    parameters: {
                        type: "object",
                        properties: {
                            relevant_indices: {
                                type: "array",
                                items: { type: "number" },
                                description:
                                    "List of 0-based indices of relevant charts, sorted by relevance.",
                            },
                        },
                        required: ["relevant_indices"],
                    },
                },
            },
        ],
    })

    if (!response.tool_calls || response.tool_calls.length === 0) {
        throw new Error(
            `LLM rerank (large): no tool call in response: ${JSON.stringify(response)}`
        )
    }

    const args = response.tool_calls[0].arguments
    console.log("LLM rerank (large) raw args:", JSON.stringify(args))
    const cleanArgs = typeof args === "string" ? JSON.parse(args) : args
    // Handle various formats: array, string of array, or single number
    let rawIndices = cleanArgs.relevant_indices
    if (rawIndices === undefined || rawIndices === null) {
        rawIndices = []
    } else if (typeof rawIndices === "string") {
        rawIndices = JSON.parse(rawIndices)
    } else if (typeof rawIndices === "number") {
        rawIndices = [rawIndices]
    }
    const indices: number[] = Array.isArray(rawIndices)
        ? rawIndices
        : [rawIndices]
    console.log("LLM rerank (large) indices:", indices)

    // Map indices back to hits (0-indexed)
    const rerankedHits: EnrichedSearchChartHit[] = indices
        .map((i: number) => hits[i])
        .filter(
            (
                hit: EnrichedSearchChartHit | undefined
            ): hit is EnrichedSearchChartHit => hit !== undefined
        )

    rerankedHits.forEach((hit: EnrichedSearchChartHit, index: number) => {
        hit.__position = index + 1
    })

    return rerankedHits
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, request } = context
    const url = new URL(request.url)
    const baseUrl = getBaseUrl(request)
    const startTime = Date.now()

    try {
        // Validate query parameters - reject unknown params to catch typos like "query" instead of "q"
        const validationError = validateQueryParams(url, VALID_PARAMS)
        if (validationError) return validationError

        // Parse query parameter (matching existing API)
        const query = url.searchParams.get(COMMON_SEARCH_PARAMS.QUERY) || ""

        // Parse pagination parameters
        const page = parseInt(url.searchParams.get("page") || "0")
        const hitsPerPage = parseInt(
            url.searchParams.get("hitsPerPage") ||
                DEFAULT_HITS_PER_PAGE.toString()
        )

        // Parse output options
        const verbose = url.searchParams.get("verbose") === "true"

        // Parse AI Search enhancement options
        const rerank = url.searchParams.get("rerank") === "true"
        const rewrite = url.searchParams.get("rewrite") === "true"
        const llmRerank = url.searchParams.get("llmRerank") === "true"
        const llmModelParam = url.searchParams.get("llmModel") || "small"
        const llmModel: LLMModel = llmModelParam === "large" ? "large" : "small"

        // Parse type filter (chart, explorer, mdim - comma-separated for multiple)
        const typeParam = url.searchParams.get("type")
        const types = typeParam
            ? typeParam.split(",").map((t) => t.trim().toLowerCase())
            : null

        // Validate type values
        if (types) {
            const invalidTypes = types.filter((t) => !VALID_TYPES.includes(t))
            if (invalidTypes.length > 0) {
                return new Response(
                    JSON.stringify({
                        error: "Invalid type parameter",
                        details: `Invalid type(s): ${invalidTypes.join(", ")}. Valid values: ${VALID_TYPES.join(", ")}`,
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
        }

        // Parse filter parameters (not yet implemented in AI Search, but accept them)
        const countriesParam = url.searchParams.get(
            COMMON_SEARCH_PARAMS.COUNTRY
        )
        const topicParam = url.searchParams.get(COMMON_SEARCH_PARAMS.TOPIC)
        const requireAllCountries =
            url.searchParams.get(COMMON_SEARCH_PARAMS.REQUIRE_ALL_COUNTRIES) ===
            "true"

        // Log filter usage for debugging (AI Search doesn't support these yet)
        if (countriesParam || topicParam) {
            console.log(
                `AI Search: Filters not yet supported (countries=${countriesParam}, topics=${topicParam}, requireAll=${requireAllCountries})`
            )
        }

        // Validate pagination parameters
        if (page < 0 || page > MAX_PAGE) {
            return new Response(
                JSON.stringify({
                    error: "Invalid page parameter",
                    details: `Page must be between 0 and ${MAX_PAGE}`,
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

        if (hitsPerPage < 1 || hitsPerPage > MAX_HITS_PER_PAGE) {
            return new Response(
                JSON.stringify({
                    error: "Invalid hitsPerPage parameter",
                    details: `hitsPerPage must be between 1 and ${MAX_HITS_PER_PAGE}`,
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

        // Only page 0 is supported for now
        if (page > 0) {
            return new Response(
                JSON.stringify({
                    error: "Pagination not yet supported",
                    details:
                        "AI Search currently only supports page=0. Full pagination coming soon.",
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

        // Fetch more results than requested so we can re-rank effectively
        // Then trim to hitsPerPage after applying our scoring
        const fetchSize = Math.max(hitsPerPage, Math.min(hitsPerPage + 10, 50))

        const preSearchTime = Date.now()

        // Call AI Search via the AI binding
        // See: https://developers.cloudflare.com/ai-search/usage/workers-binding/
        // TODO: cache it before deploying to production
        const results = (await env.AI.autorag(AI_SEARCH_INSTANCE_NAME).search({
            query,
            max_num_results: fetchSize,
            ...(types && { filters: buildTypeFilters(types) }),
            ...(rewrite && { rewrite_query: true }),
            ...(rerank && {
                reranking: {
                    enabled: true,
                    model: RERANKING_MODEL,
                },
            }),
            ranking_options: {
                score_threshold: 0.1,
            },
        })) as AISearchResponse

        const postSearchTime = Date.now()

        let response = transformToSearchApiFormat(
            query,
            results,
            page,
            hitsPerPage,
            baseUrl
        )

        // Apply LLM-based reranking and filtering if requested
        let llmRerankTime = 0
        if (llmRerank) {
            const preLLMTime = Date.now()
            const rerankedHits = await rerankWithLLM(
                env,
                query,
                response.hits,
                llmModel
            )
            llmRerankTime = Date.now() - preLLMTime
            response = {
                ...response,
                hits: rerankedHits,
                nbHits: rerankedHits.length,
            }
        }

        // Strip verbose fields by default to reduce response size
        if (!verbose) {
            response = stripVerboseFields(response)
        }

        const endTime = Date.now()
        const opts = [
            types ? `type=${types.join(",")}` : null,
            rerank ? "rerank" : null,
            rewrite ? "rewrite" : null,
            llmRerank ? `llmRerank(${llmModel})` : null,
        ]
            .filter(Boolean)
            .join(" ")
        console.log(
            `[AI Search charts] query="${query}"${opts ? ` ${opts}` : ""} | total=${endTime - startTime}ms | search=${postSearchTime - preSearchTime}ms${llmRerank ? ` | llmRerank=${llmRerankTime}ms` : ""} | hits=${results.data.length}`
        )

        // Add timing info to response
        response.timing = {
            total_ms: endTime - startTime,
            search_ms: postSearchTime - preSearchTime,
            ...(llmRerank && { llmRerank_ms: llmRerankTime }),
        }

        return new Response(JSON.stringify(response, null, 2), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=60",
                "Access-Control-Allow-Origin": "*",
            },
        })
    } catch (error) {
        console.error("AI Search error:", error)

        // Return error details for debugging
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
