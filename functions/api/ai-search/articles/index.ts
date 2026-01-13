import { Env } from "../../../_common/env.js"
import { SearchUrlParam, OwidGdocType } from "@ourworldindata/types"

// Name of the AI Search instance in Cloudflare dashboard
const AI_SEARCH_INSTANCE_NAME = "search-articles"

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
 * Algolia-style snippet result format for highlighting
 */
interface SnippetValue {
    value: string
    matchLevel: "none" | "partial" | "full"
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
    // Algolia-compatible snippet result for content highlighting
    _snippetResult?: {
        content: SnippetValue
    }
    // AI Search specific fields
    aiSearchScore: number
    viewsScore: number
    importanceScore: number
    score: number
    views_7d: number
    url: string
}

/**
 * Topic page hit matching the frontend TopicPageHit type
 */
interface TopicPageHit {
    title: string
    type: OwidGdocType.TopicPage | OwidGdocType.LinearTopicPage
    slug: string
    excerpt: string
    excerptLong?: string[]
    objectID: string
    __position: number
    // AI Search specific fields
    aiSearchScore: number
    viewsScore: number
    importanceScore: number
    score: number
    views_7d: number
}

/**
 * Data insight hit matching the frontend DataInsightHit type
 */
interface DataInsightHit {
    title: string
    thumbnailUrl: string
    date: string
    slug: string
    type: OwidGdocType.DataInsight
    objectID: string
    __position: number
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
        .replace(/^topic-pages\//, "")
        .replace(/^data-insights\//, "")
        .replace(/\.md$/, "")
}

/**
 * Extract a snippet from text that contains the query terms, with surrounding context.
 *
 * Note: This is a simple implementation compared to Algolia's snippet extraction.
 * It finds the first occurrence of query terms and extracts ~300 chars around it.
 */
function extractSnippet(
    text: string,
    query: string,
    maxLength: number = 300
): string {
    if (!query.trim()) {
        return text.slice(0, maxLength)
    }

    // Normalize text for searching (remove extra whitespace, newlines)
    const normalizedText = text.replace(/\s+/g, " ").trim()

    // Split query into words and find first match
    const queryWords = query
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2)
    const lowerText = normalizedText.toLowerCase()

    let bestMatchIndex = -1

    for (const word of queryWords) {
        const index = lowerText.indexOf(word)
        if (index !== -1 && (bestMatchIndex === -1 || index < bestMatchIndex)) {
            bestMatchIndex = index
        }
    }

    if (bestMatchIndex === -1) {
        // No match found, return beginning of text
        return normalizedText.slice(0, maxLength)
    }

    // Extract context around the match
    const contextBefore = 100
    const start = Math.max(0, bestMatchIndex - contextBefore)
    const end = Math.min(normalizedText.length, start + maxLength)

    let snippet = normalizedText.slice(start, end)

    // Add ellipsis if truncated
    if (start > 0) snippet = "…" + snippet
    if (end < normalizedText.length) snippet = snippet + "…"

    return snippet
}

/**
 * Decode base64 string to UTF-8 text.
 * Unlike atob() which returns Latin-1, this properly handles UTF-8 encoded data.
 */
function base64ToUtf8(base64: string): string {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
    }
    return new TextDecoder("utf-8").decode(bytes)
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
            const decoded = base64ToUtf8(base64Data)
            return JSON.parse(decoded) as PageData
        } catch {
            // Fall through to defaults
        }
    }

    return {}
}

/**
 * Get page importance based on type.
 * Mirrors Algolia's getPostImportance() from baker/algolia/utils/pages.ts
 */
function getPageImportance(type: OwidGdocType | undefined): number {
    switch (type) {
        case OwidGdocType.TopicPage:
        case OwidGdocType.LinearTopicPage:
            return 3
        case OwidGdocType.AboutPage:
            return 1
        case OwidGdocType.Article:
        default:
            return 0
    }
}

interface ScoreComponents {
    score: number
    viewsScore: number
    importanceScore: number
}

/**
 * Calculate combined score for search results.
 * Combines AI search relevance with pageviews and page type importance.
 * Returns individual score components for transparency.
 */
function calculateScore(
    aiSearchScore: number,
    views7d: number | undefined,
    type: OwidGdocType | undefined
): ScoreComponents {
    // Pageviews boost: scaled log to prevent high-traffic pages from dominating
    const viewsScore = views7d ? 0.01 * Math.log10(views7d + 1) : 0

    // Type importance boost: topic pages > about pages > articles
    // Scale factor chosen to give meaningful but not overwhelming boost
    const importance = getPageImportance(type)
    const importanceScore = importance * 0.05

    // AI search score is primary signal (typically 0-1 range)
    const score = aiSearchScore + viewsScore + importanceScore

    return { score, viewsScore, importanceScore }
}

/**
 * Check if result matches any of the allowed folders
 */
function matchesFolders(filename: string, folders: string[]): boolean {
    return folders.some((folder) => filename.startsWith(`${folder}/`))
}

/**
 * Transform AI Search results to articles API format
 */
function transformToArticlesApiFormat(
    query: string,
    results: AISearchResponse,
    offset: number,
    length: number,
    baseUrl: string,
    folders: string[]
): ArticlesApiResponse {
    // Filter to only results from allowed folders
    const filteredResults = results.data.filter((r) =>
        matchesFolders(r.filename, folders)
    )

    const hits: ArticleHit[] = filteredResults.map((result, index) => {
        const pageData = parsePageData(result)
        const slug = pageData.slug || extractSlugFromFilename(result.filename)
        const text = result.content[0]?.text ?? ""
        const content = extractSnippet(text, query)

        // Determine type from pageData or filename
        const type = pageData.type?.includes("about")
            ? OwidGdocType.AboutPage
            : OwidGdocType.Article

        const aiSearchScore = result.score
        const { score, viewsScore, importanceScore } = calculateScore(
            aiSearchScore,
            pageData.views_7d,
            type
        )

        // Determine match level for snippet
        const hasQueryMatch = query.trim().length > 0 && content.includes("…")
        const matchLevel = hasQueryMatch ? "full" : "none"

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
            _snippetResult: {
                content: {
                    value: content,
                    matchLevel: matchLevel as "none" | "partial" | "full",
                },
            },
            aiSearchScore,
            viewsScore,
            importanceScore,
            score,
            views_7d: pageData.views_7d ?? 0,
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

/**
 * Transform AI Search results to topic pages API format
 */
function transformToTopicPagesApiFormat(
    query: string,
    results: AISearchResponse,
    offset: number,
    length: number,
    folders: string[]
): {
    query: string
    hits: TopicPageHit[]
    nbHits: number
    offset: number
    length: number
} {
    // Filter to only results from allowed folders
    const filteredResults = results.data.filter((r) =>
        matchesFolders(r.filename, folders)
    )

    const hits: TopicPageHit[] = filteredResults.map((result, index) => {
        const pageData = parsePageData(result)
        const slug = pageData.slug || extractSlugFromFilename(result.filename)
        const text = result.content[0]?.text ?? ""
        // Use stored excerpt if available, otherwise extract snippet from content
        const excerpt = pageData.excerpt || extractSnippet(text, query)

        // Determine type from pageData
        const type =
            pageData.type === OwidGdocType.LinearTopicPage
                ? OwidGdocType.LinearTopicPage
                : OwidGdocType.TopicPage

        const aiSearchScore = result.score
        const { score, viewsScore, importanceScore } = calculateScore(
            aiSearchScore,
            pageData.views_7d,
            type
        )

        return {
            title: pageData.title || slug,
            type: type as OwidGdocType.TopicPage | OwidGdocType.LinearTopicPage,
            slug,
            excerpt,
            excerptLong: undefined, // Not available from AI Search currently
            objectID: slug,
            __position: index + 1,
            aiSearchScore,
            viewsScore,
            importanceScore,
            score,
            views_7d: pageData.views_7d ?? 0,
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

/**
 * Transform AI Search results to data insights API format
 */
function transformToDataInsightsApiFormat(
    query: string,
    results: AISearchResponse,
    page: number,
    hitsPerPage: number,
    folders: string[]
): {
    query: string
    hits: DataInsightHit[]
    nbHits: number
    page: number
    nbPages: number
    hitsPerPage: number
} {
    // Filter to only results from allowed folders
    const filteredResults = results.data.filter((r) =>
        matchesFolders(r.filename, folders)
    )

    const hits: DataInsightHit[] = filteredResults.map((result, index) => {
        const pageData = parsePageData(result)
        const slug = pageData.slug || extractSlugFromFilename(result.filename)

        return {
            title: pageData.title || slug,
            thumbnailUrl: pageData.thumbnailUrl || "",
            date: pageData.date || "",
            slug,
            type: OwidGdocType.DataInsight,
            objectID: slug,
            __position: index + 1,
        }
    })

    // Apply page/hitsPerPage pagination (Algolia-style)
    const offset = page * hitsPerPage
    const paginatedHits = hits.slice(offset, offset + hitsPerPage)

    // Re-assign positions after pagination
    paginatedHits.forEach((hit, index) => {
        hit.__position = offset + index + 1
    })

    return {
        query,
        hits: paginatedHits,
        nbHits: hits.length,
        page,
        nbPages: Math.ceil(hits.length / hitsPerPage),
        hitsPerPage,
    }
}

// Default folders to include when not specified
const DEFAULT_FOLDERS = ["articles", "about-pages"]

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env } = context
    const url = new URL(context.request.url)
    const baseUrl = url.origin

    try {
        // Parse query parameter
        const query = url.searchParams.get(SearchUrlParam.QUERY) || ""

        // Parse folders filter (comma-separated list)
        const foldersParam = url.searchParams.get("folders")
        const folders = foldersParam
            ? foldersParam.split(",").map((f) => f.trim())
            : DEFAULT_FOLDERS

        // Determine request type based on folders
        const isTopicPagesRequest = folders.includes("topic-pages")
        const isDataInsightsRequest = folders.includes("data-insights")

        // Data insights use page/hitsPerPage pagination (Algolia-style)
        // Articles and topic pages use offset/length pagination
        const page = parseInt(url.searchParams.get("page") || "0")
        const hitsPerPage = parseInt(url.searchParams.get("hitsPerPage") || "4")
        const offset = parseInt(url.searchParams.get("offset") || "0")
        const length = parseInt(
            url.searchParams.get("length") || DEFAULT_LENGTH.toString()
        )

        // Validate pagination parameters
        if (offset < 0 || page < 0) {
            return new Response(
                JSON.stringify({
                    error: "Invalid pagination parameter",
                    details: "offset and page must be >= 0",
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
        const fetchSize = isDataInsightsRequest
            ? Math.min((page + 1) * hitsPerPage + 20, 50)
            : Math.min(offset + length + 20, 50)

        // Call AI Search
        const results = (await env.AI.autorag(AI_SEARCH_INSTANCE_NAME).search({
            query,
            max_num_results: fetchSize,
            ranking_options: {
                score_threshold: 0.1,
            },
        })) as AISearchResponse

        // Transform based on request type
        let response
        if (isDataInsightsRequest) {
            response = transformToDataInsightsApiFormat(
                query,
                results,
                page,
                hitsPerPage,
                folders
            )
        } else if (isTopicPagesRequest) {
            response = transformToTopicPagesApiFormat(
                query,
                results,
                offset,
                length,
                folders
            )
        } else {
            response = transformToArticlesApiFormat(
                query,
                results,
                offset,
                length,
                baseUrl,
                folders
            )
        }

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
