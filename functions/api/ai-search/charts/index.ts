import { Env } from "../../../_common/env.js"
import { SearchUrlParam } from "@ourworldindata/types"

// Name of the AI Search instance in Cloudflare dashboard
const AI_SEARCH_INSTANCE_NAME = "owid-ai-search"

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

interface AISearchResult {
    file_id: string
    filename: string
    score: number
    attributes: Record<string, string | number | boolean | null>
    content: Array<{
        type: string
        text: string
    }>
}

interface AISearchResponse {
    data: AISearchResult[]
    has_more: boolean
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
 * Extract slug from filename (e.g., "charts/population.md" -> "population")
 */
function extractSlugFromFilename(filename: string): string {
    return filename.replace(/^charts\//, "").replace(/\.md$/, "")
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
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
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
        const slug = extractSlugFromFilename(result.filename)
        const text = result.content[0]?.text ?? ""
        const title = extractTitleFromContent(text)
        const subtitle = extractSubtitleFromContent(text)
        const chartData = parseChartData(result)

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
            objectID: slug,
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

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env } = context
    const url = new URL(context.request.url)
    const baseUrl = url.origin

    try {
        // Parse query parameter (matching existing API)
        const query = url.searchParams.get(SearchUrlParam.QUERY) || ""

        // Parse pagination parameters
        const page = parseInt(url.searchParams.get("page") || "0")
        const hitsPerPage = parseInt(
            url.searchParams.get("hitsPerPage") ||
                DEFAULT_HITS_PER_PAGE.toString()
        )

        // Parse output options
        const verbose = url.searchParams.get("verbose") === "true"

        // Parse filter parameters (not yet implemented in AI Search, but accept them)
        const countriesParam = url.searchParams.get(SearchUrlParam.COUNTRY)
        const topicParam = url.searchParams.get(SearchUrlParam.TOPIC)
        const requireAllCountries =
            url.searchParams.get(SearchUrlParam.REQUIRE_ALL_COUNTRIES) ===
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

        // Call AI Search via the AI binding
        // See: https://developers.cloudflare.com/ai-search/usage/workers-binding/
        const results = (await env.AI.autorag(AI_SEARCH_INSTANCE_NAME).search({
            query,
            max_num_results: fetchSize,
            ranking_options: {
                score_threshold: 0.1,
            },
        })) as AISearchResponse

        let response = transformToSearchApiFormat(
            query,
            results,
            page,
            hitsPerPage,
            baseUrl
        )

        // Strip verbose fields by default to reduce response size
        if (!verbose) {
            response = stripVerboseFields(response)
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
