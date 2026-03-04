import { Env } from "../../../_common/env.js"
import { OwidGdocType } from "@ourworldindata/types"
import {
    getBaseUrl,
    validateQueryParams,
    COMMON_SEARCH_PARAMS,
    AISearchResult,
    AISearchResponse,
} from "../utils.js"

// Name of the AI Search instance in Cloudflare dashboard
const AI_SEARCH_INSTANCE_NAME = "search-articles"

const DEFAULT_HITS_PER_PAGE = 10
const MAX_HITS_PER_PAGE = 100

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
    // AI Search specific fields
    aiSearchScore: number
    viewsScore: number
    importanceScore: number
    score: number
    views_7d: number
}

/**
 * Response format matching SearchFlatArticleResponse (Algolia SearchResponse shape)
 */
interface ArticlesApiResponse {
    query: string
    hits: ArticleHit[]
    nbHits: number
    page: number
    nbPages: number
    hitsPerPage: number
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
 * Build AI Search filters for folder-based filtering.
 * Uses prefix matching on filename to filter by folder.
 */
function buildFolderFilters(folders: string[]): {
    type: "or"
    filters: Array<{ type: "eq"; key: string; value: string }>
} {
    return {
        type: "or",
        filters: folders.map((folder) => ({
            type: "eq" as const,
            key: "folder",
            value: `${folder}/`,
        })),
    }
}

/**
 * Transform AI Search results to articles API format
 */
function transformToArticlesApiFormat(
    query: string,
    results: AISearchResponse,
    page: number,
    hitsPerPage: number,
    baseUrl: string
): ArticlesApiResponse {
    const hits: ArticleHit[] = results.data.map((result, index) => {
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

    // Apply page/hitsPerPage pagination
    const offset = page * hitsPerPage
    const paginatedHits = hits.slice(offset, offset + hitsPerPage)

    // Re-assign positions after sorting/pagination
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

/**
 * Transform AI Search results to topic pages API format
 */
function transformToTopicPagesApiFormat(
    query: string,
    results: AISearchResponse,
    page: number,
    hitsPerPage: number
): {
    query: string
    hits: TopicPageHit[]
    nbHits: number
    page: number
    nbPages: number
    hitsPerPage: number
} {
    const hits: TopicPageHit[] = results.data.map((result, index) => {
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

    // Apply page/hitsPerPage pagination
    const offset = page * hitsPerPage
    const paginatedHits = hits.slice(offset, offset + hitsPerPage)

    // Re-assign positions after sorting/pagination
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

/**
 * Transform AI Search results to data insights API format
 */
function transformToDataInsightsApiFormat(
    query: string,
    results: AISearchResponse,
    page: number,
    hitsPerPage: number
): {
    query: string
    hits: DataInsightHit[]
    nbHits: number
    page: number
    nbPages: number
    hitsPerPage: number
} {
    const hits: DataInsightHit[] = results.data.map((result, index) => {
        const pageData = parsePageData(result)
        const slug = pageData.slug || extractSlugFromFilename(result.filename)

        const aiSearchScore = result.score
        const { score, viewsScore, importanceScore } = calculateScore(
            aiSearchScore,
            pageData.views_7d,
            OwidGdocType.DataInsight
        )

        return {
            title: pageData.title || slug,
            thumbnailUrl: pageData.thumbnailUrl || "",
            date: pageData.date || "",
            slug,
            type: OwidGdocType.DataInsight,
            objectID: slug,
            __position: index + 1,
            aiSearchScore,
            viewsScore,
            importanceScore,
            score,
            views_7d: pageData.views_7d ?? 0,
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

// Map type parameter values to folder prefixes used in R2
const TYPE_TO_FOLDER: Record<string, string> = {
    article: "articles",
    about: "about-pages",
    topic: "topic-pages",
    "data-insight": "data-insights",
}

const VALID_TYPES = Object.keys(TYPE_TO_FOLDER)

// Default types to include when not specified
const DEFAULT_TYPES = ["article", "about"]

// Valid query parameter names for this endpoint
// NOTE: page/hitsPerPage naming chosen for consistency with /api/search (Algolia).
// We might decide to change this to offset/limit in the future.
const VALID_PARAMS = new Set([
    COMMON_SEARCH_PARAMS.QUERY, // "q"
    "type",
    "page",
    "hitsPerPage",
])

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, request } = context
    const url = new URL(request.url)
    const baseUrl = getBaseUrl(request)

    try {
        // Validate query parameters - reject unknown params to catch typos like "query" instead of "q"
        const validationError = validateQueryParams(url, VALID_PARAMS)
        if (validationError) return validationError

        // Parse query parameter
        const query = url.searchParams.get(COMMON_SEARCH_PARAMS.QUERY) || ""

        // Parse type filter (comma-separated list)
        const typeParam = url.searchParams.get("type")
        const types = typeParam
            ? typeParam.split(",").map((t) => t.trim())
            : DEFAULT_TYPES

        // Validate type values
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

        // Determine request type for response format
        const isTopicPagesRequest = types.includes("topic")
        const isDataInsightsRequest = types.includes("data-insight")

        // Parse pagination parameters
        const page = parseInt(url.searchParams.get("page") || "0")
        const hitsPerPage = parseInt(
            url.searchParams.get("hitsPerPage") ||
                DEFAULT_HITS_PER_PAGE.toString()
        )

        // Validate pagination parameters
        if (page < 0) {
            return new Response(
                JSON.stringify({
                    error: "Invalid page parameter",
                    details: "page must be >= 0",
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

        // Calculate fetch size based on pagination
        const fetchSize = Math.min((page + 1) * hitsPerPage + 20, 50)

        // Map type values to folder names for AI Search filtering
        const folders = types.map((t) => TYPE_TO_FOLDER[t])
        const folderFilters = buildFolderFilters(folders)

        // Call AI Search with folder filtering
        const results = (await env.AI.autorag(AI_SEARCH_INSTANCE_NAME).search({
            query,
            max_num_results: fetchSize,
            filters: folderFilters,
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
                hitsPerPage
            )
        } else if (isTopicPagesRequest) {
            response = transformToTopicPagesApiFormat(
                query,
                results,
                page,
                hitsPerPage
            )
        } else {
            response = transformToArticlesApiFormat(
                query,
                results,
                page,
                hitsPerPage,
                baseUrl
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
