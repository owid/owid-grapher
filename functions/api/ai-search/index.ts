import { Env } from "../../_common/env.js"

// Name of the AI Search instance in Cloudflare dashboard
const AI_SEARCH_INSTANCE_NAME = "owid-ai-search"

interface ChartData {
    type: string
    slug: string
    variantName: string
    availableTabs: string[]
    queryParams: string
    publishedAt: string
    updatedAt: string
    views_7d: number
    fmRank?: number // Featured metric rank (1 = top, only set for FMs)
}

interface AISearchResult {
    file_id: string
    filename: string
    score: number
    attributes: {
        folder: string
        filename: string
        file?: {
            chartdata?: string // JSON string containing ChartData
            // Legacy fields from old indexing
            type?: string
            tags?: string
            slug?: string
        }
    }
    content: Array<{
        text: string
    }>
}

interface AISearchResponse {
    data: AISearchResult[]
    has_more: boolean
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
    // Try R2 metadata (stored as JSON in chartdata field)
    const chartdataStr = result.attributes.file?.chartdata
    if (chartdataStr) {
        try {
            return JSON.parse(chartdataStr) as ChartData
        } catch {
            // Fall through to legacy handling
        }
    }

    // Legacy fallback
    return {
        type: result.attributes.file?.type ?? "chart",
        slug: result.attributes.file?.slug,
    }
}

/**
 * Calculate a combined score from AI search relevance, FM rank, and pageviews.
 * All components are normalized to 0-1 range.
 *
 * Scoring strategy:
 * - AI Search score (0-1): Primary signal for semantic relevance
 * - FM boost (0-0.5): Featured metrics get a boost. Rank 1 = +0.5, rank 2 = +0.45, etc.
 * - Pageviews boost: log10(views + 1) gives a popularity signal
 *   (e.g., 1000 views = 3, 10000 = 4, 100000 = 5)
 *
 * Final score combines these with weights favoring relevance.
 */
function calculateCombinedScore(
    aiSearchScore: number,
    fmRank: number | undefined,
    views7d: number | undefined
): number {
    // AI search score is already 0-1
    const relevanceScore = aiSearchScore

    // FM boost: rank 1 = +0.5, rank 2 = +0.45, ..., rank 10 = +0.05, rank 11+ = 0
    const fmBoost = fmRank ? Math.max(0, 0.55 - fmRank * 0.05) : 0

    // Pageviews boost: log scale
    const viewsBoost = views7d ? Math.log10(views7d + 1) : 0

    return relevanceScore + fmBoost + viewsBoost
}

/**
 * Transform AI Search results to match the Algolia search API format
 */
function transformToSearchApiFormat(
    query: string,
    results: AISearchResponse,
    hitsPerPage: number,
    baseUrl: string
): object {
    const hits = results.data.map((result) => {
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
            publishedAt: chartData.publishedAt,
            updatedAt: chartData.updatedAt,
            views_7d,
            fmRank,
            url,
            aiSearchScore,
            score,
        }
    })

    // Sort by combined score (descending)
    hits.sort((a, b) => b.score - a.score)

    return {
        query,
        hits,
        nbHits: hits.length,
        page: 0,
        nbPages: 1,
        hitsPerPage,
    }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env } = context
    const url = new URL(context.request.url)
    const baseUrl = url.origin

    // Get query parameter, default to "population" for testing
    const query = url.searchParams.get("q") || "population"
    const hitsPerPage = Math.min(
        parseInt(url.searchParams.get("hitsPerPage") || "10", 10),
        50
    )
    const verbose = url.searchParams.get("verbose") === "1"

    try {
        // Call AI Search via the AI binding
        // See: https://developers.cloudflare.com/ai-search/usage/workers-binding/
        const results = (await env.AI.autorag(AI_SEARCH_INSTANCE_NAME).search({
            query,
            max_num_results: hitsPerPage,
        })) as AISearchResponse

        const response = transformToSearchApiFormat(
            query,
            results,
            hitsPerPage,
            baseUrl
        )

        // In verbose mode, include raw AI Search response for debugging
        const finalResponse = verbose
            ? { ...response, _raw: results }
            : response

        return new Response(JSON.stringify(finalResponse, null, 2), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=60",
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
                query,
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        )
    }
}
