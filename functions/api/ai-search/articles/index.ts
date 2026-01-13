import { Env } from "../../../_common/env.js"
import { SearchUrlParam, OwidGdocType } from "@ourworldindata/types"

// Name of the AI Search instance in Cloudflare dashboard
const AI_SEARCH_INSTANCE_NAME = "owid-ai-search"

const DEFAULT_LENGTH = 10
const MAX_LENGTH = 100

interface PageData {
    type: OwidGdocType
    slug: string
    title: string
    excerpt: string
    authors: string[]
    tags: string[]
    date: string
    modifiedDate: string
    views_7d: number
    score: number // Algolia-computed importance score
    thumbnailUrl: string
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
 * Article hit matching the frontend FlatArticleHit type
 */
interface ArticleHit {
    title: string
    thumbnailUrl: string
    date: string
    slug: string
    type: OwidGdocType.Article | OwidGdocType.AboutPage
    content: string
    authors: string[]
    objectID: string
    __position: number
    // AI Search specific fields
    aiSearchScore: number
    score: number
    url: string
}

/**
 * Response format matching SearchFlatArticleResponse (Algolia SearchResponse shape)
 */
interface ArticlesApiResponse {
    query: string
    hits: ArticleHit[]
    nbHits: number
    offset: number
    length: number
}

/**
 * Extract slug from filename (e.g., "articles/my-article.md" -> "my-article")
 */
function extractSlugFromFilename(filename: string): string {
    return filename
        .replace(/^articles\//, "")
        .replace(/^about-pages\//, "")
        .replace(/\.md$/, "")
}

/**
 * Extract content excerpt from markdown (for search result display)
 */
function extractContentFromMarkdown(text: string): string {
    // Remove the title line and extract first meaningful paragraph
    const lines = text.split("\n")
    const contentLines: string[] = []

    for (const line of lines) {
        const trimmed = line.trim()
        // Skip empty lines, headings, metadata sections
        if (
            !trimmed ||
            trimmed.startsWith("#") ||
            trimmed.startsWith("##") ||
            trimmed.startsWith("<!--")
        ) {
            continue
        }
        contentLines.push(trimmed)
        // Get first ~200 chars of content
        if (contentLines.join(" ").length > 200) break
    }

    return contentLines.join(" ").slice(0, 300)
}

/**
 * Parse page metadata from R2 object metadata (stored as base64-encoded JSON in pagedata field)
 */
function parsePageData(result: AISearchResult): Partial<PageData> {
    const fileAttr = result.attributes.file as
        | {
              pagedata?: string
          }
        | undefined

    const pagedataStr = fileAttr?.pagedata
    if (pagedataStr && typeof pagedataStr === "string") {
        try {
            // Handle b64- prefix if present
            const base64Data = pagedataStr.startsWith("b64-")
                ? pagedataStr.slice(4)
                : pagedataStr
            const decoded = atob(base64Data)
            return JSON.parse(decoded) as PageData
        } catch {
            // Fall through to defaults
        }
    }

    return {}
}

/**
 * Calculate combined score for articles.
 * Uses AI search relevance + pageviews boost (no FM rank for articles).
 */
function calculateArticleScore(
    aiSearchScore: number,
    views7d: number | undefined,
    importanceScore: number | undefined
): number {
    // AI search score is primary signal
    const relevanceScore = aiSearchScore

    // Pageviews boost: scaled log
    const viewsBoost = views7d ? 0.01 * Math.log10(views7d + 1) : 0

    // Importance boost (from Algolia scoring: importance * 1000 + views_7d)
    // Normalize to small boost
    const importanceBoost = importanceScore ? 0.001 * importanceScore : 0

    return relevanceScore + viewsBoost + importanceBoost
}

/**
 * Check if result is an article (from articles/ folder)
 */
function isArticle(filename: string): boolean {
    return (
        filename.startsWith("articles/") ||
        filename.startsWith("about-pages/")
    )
}

/**
 * Transform AI Search results to articles API format
 */
function transformToArticlesApiFormat(
    query: string,
    results: AISearchResponse,
    offset: number,
    length: number,
    baseUrl: string
): ArticlesApiResponse {
    // Filter to only article results
    const articleResults = results.data.filter((r) => isArticle(r.filename))

    const hits: ArticleHit[] = articleResults.map((result, index) => {
        const pageData = parsePageData(result)
        const slug =
            pageData.slug || extractSlugFromFilename(result.filename)
        const text = result.content[0]?.text ?? ""
        const content = extractContentFromMarkdown(text)

        const aiSearchScore = result.score
        const score = calculateArticleScore(
            aiSearchScore,
            pageData.views_7d,
            pageData.score
        )

        // Determine type from pageData or filename
        const type = pageData.type?.includes("about")
            ? OwidGdocType.AboutPage
            : OwidGdocType.Article

        return {
            title: pageData.title || slug,
            thumbnailUrl: pageData.thumbnailUrl || "",
            date: pageData.date || "",
            slug,
            type: type as OwidGdocType.Article | OwidGdocType.AboutPage,
            content,
            authors: pageData.authors || [],
            objectID: slug,
            __position: index + 1,
            aiSearchScore,
            score,
            url: `${baseUrl}/${slug}`,
        }
    })

    // Sort by combined score (descending)
    hits.sort((a, b) => b.score - a.score)

    // Apply offset/length pagination
    const paginatedHits = hits.slice(offset, offset + length)

    // Re-assign positions after sorting/pagination
    paginatedHits.forEach((hit, index) => {
        hit.__position = offset + index + 1
    })

    return {
        query,
        hits: paginatedHits,
        nbHits: hits.length,
        offset,
        length,
    }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env } = context
    const url = new URL(context.request.url)
    const baseUrl = url.origin

    try {
        // Parse query parameter
        const query = url.searchParams.get(SearchUrlParam.QUERY) || ""

        // Parse offset/length pagination (matching Algolia style for articles)
        const offset = parseInt(url.searchParams.get("offset") || "0")
        const length = parseInt(
            url.searchParams.get("length") || DEFAULT_LENGTH.toString()
        )

        // Validate pagination parameters
        if (offset < 0) {
            return new Response(
                JSON.stringify({
                    error: "Invalid offset parameter",
                    details: "Offset must be >= 0",
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

        if (length < 1 || length > MAX_LENGTH) {
            return new Response(
                JSON.stringify({
                    error: "Invalid length parameter",
                    details: `Length must be between 1 and ${MAX_LENGTH}`,
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

        // Fetch more results to account for filtering and pagination
        const fetchSize = Math.min(offset + length + 20, 50)

        // Call AI Search
        const results = (await env.AI.autorag(AI_SEARCH_INSTANCE_NAME).search({
            query,
            max_num_results: fetchSize,
            ranking_options: {
                score_threshold: 0.1,
            },
        })) as AISearchResponse

        const response = transformToArticlesApiFormat(
            query,
            results,
            offset,
            length,
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
        console.error("AI Search articles error:", error)

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
