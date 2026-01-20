import { Env } from "../../../_common/env.js"
import {
    getBaseUrl,
    validateQueryParams,
    COMMON_SEARCH_PARAMS,
    AISearchResult,
    AISearchResponse,
} from "../utils.js"

// Name of the AI Search instance in Cloudflare dashboard
const AI_SEARCH_INSTANCE_NAME = "search-articles"

const DEFAULT_MAX_RESULTS = 5
const MAX_RESULTS_LIMIT = 20

/**
 * Source info for linking
 */
interface Source {
    title: string
    slug: string
    url: string
}

/**
 * Parse page metadata from R2 object metadata (base64-encoded JSON)
 */
function parsePageMetadata(result: AISearchResult): {
    title?: string
    slug?: string
} {
    const fileAttr = result.attributes.file as
        | { pagedata?: string }
        | undefined

    const pagedataStr = fileAttr?.pagedata
    if (pagedataStr && typeof pagedataStr === "string") {
        try {
            const base64Data = pagedataStr.startsWith("b64-")
                ? pagedataStr.slice(4)
                : pagedataStr
            const binaryString = atob(base64Data)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i)
            }
            const decoded = new TextDecoder("utf-8").decode(bytes)
            return JSON.parse(decoded)
        } catch {
            // Fall through to defaults
        }
    }
    return {}
}

/**
 * Extract slug from filename
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
 * Build a map of normalized titles to source info for fuzzy matching
 */
function buildSourceMap(
    results: AISearchResult[],
    baseUrl: string
): Map<string, Source> {
    const map = new Map<string, Source>()

    for (const result of results) {
        const metadata = parsePageMetadata(result)
        const slug = metadata.slug || extractSlugFromFilename(result.filename)
        const title = metadata.title || slug

        const source: Source = {
            title,
            slug,
            url: `${baseUrl}/${slug}`,
        }

        // Add multiple keys for fuzzy matching
        map.set(title.toLowerCase(), source)
        map.set(slug.toLowerCase(), source)

        // Add the full filename (the LLM often references files by their full path)
        map.set(result.filename.toLowerCase(), source)

        // Add filename without folder prefix
        const filenameOnly = result.filename.split("/").pop() || ""
        if (filenameOnly) {
            map.set(filenameOnly.toLowerCase(), source)
            // Also without .md extension
            const withoutMd = filenameOnly.replace(/\.md$/, "")
            map.set(withoutMd.toLowerCase(), source)
        }

        // Add variations with different common folder prefixes
        // The LLM might use topic-pages/ when the actual file is articles/
        const baseName = filenameOnly.replace(/\.md$/, "")
        for (const prefix of ["topic-pages/", "articles/", "about-pages/", "data-insights/"]) {
            map.set(`${prefix}${baseName}.md`, source)
        }

        // Also add without common suffixes/prefixes for partial matching
        const simplified = title
            .toLowerCase()
            .replace(/^the\s+/, "")
            .replace(/\s+/g, " ")
            .trim()
        if (simplified !== title.toLowerCase()) {
            map.set(simplified, source)
        }
    }

    return map
}

/**
 * Find the best matching source for a reference text
 */
function findBestSourceMatch(
    refText: string,
    sourceMap: Map<string, Source>
): Source | undefined {
    const normalized = refText.toLowerCase().trim()

    // Exact match first
    if (sourceMap.has(normalized)) {
        return sourceMap.get(normalized)
    }

    // Partial match - find source where ref is contained in title or vice versa
    for (const [key, source] of sourceMap) {
        if (key.includes(normalized) || normalized.includes(key)) {
            return source
        }
    }

    // Word overlap match - if most words match
    const refWords = new Set(normalized.split(/\s+/).filter((w) => w.length > 2))
    if (refWords.size > 0) {
        for (const [key, source] of sourceMap) {
            const keyWords = new Set(key.split(/\s+/).filter((w) => w.length > 2))
            const overlap = [...refWords].filter((w) => keyWords.has(w)).length
            if (overlap >= Math.min(refWords.size, keyWords.size) * 0.5) {
                return source
            }
        }
    }

    return undefined
}

/**
 * Process text buffer: replace [Title](slug) patterns with full URLs
 * Returns: { output: text to emit, remaining: text to keep in buffer }
 */
function processTextBuffer(
    buffer: string,
    sourceMap: Map<string, Source>,
    usedSources: Map<string, Source>,
    baseUrl: string,
    flush: boolean
): { output: string; remaining: string } {
    // If not flushing, keep potential partial patterns in buffer
    if (!flush) {
        // Find the last '[' that could start an incomplete markdown link
        const lastBracket = buffer.lastIndexOf("[")

        if (lastBracket !== -1) {
            const possiblePartial = buffer.slice(lastBracket)

            // Check if the link is complete: [text](url) followed by non-link char or end
            // A complete link must have: [, some text, ], (, some url, )
            const isCompleteLink = possiblePartial.match(
                /^\[[^\]]+\]\([^)]+\)(?:[^(]|$)/
            )

            if (!isCompleteLink) {
                // It's incomplete - keep everything from '[' onwards in buffer
                const output = buffer.slice(0, lastBracket)
                const remaining = buffer.slice(lastBracket)
                return {
                    output: processCompletePatterns(
                        output,
                        sourceMap,
                        usedSources,
                        baseUrl
                    ),
                    remaining,
                }
            }
        }
    }

    // Process all complete patterns
    return {
        output: processCompletePatterns(buffer, sourceMap, usedSources, baseUrl),
        remaining: "",
    }
}

/**
 * Replace [Title](slug) patterns with full URLs.
 * The LLM is instructed to output links in this format.
 */
function processCompletePatterns(
    text: string,
    sourceMap: Map<string, Source>,
    usedSources: Map<string, Source>,
    baseUrl: string
): string {
    // Match markdown links: [Title](slug)
    // The slug should not already be a full URL
    return text.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        (_match, title, slugOrUrl) => {
            // If it's already a full URL, leave it alone
            if (slugOrUrl.startsWith("http://") || slugOrUrl.startsWith("https://")) {
                // Track the source if we can match it
                const source = findBestSourceMatch(slugOrUrl, sourceMap)
                if (source) {
                    usedSources.set(source.slug, source)
                }
                return _match
            }

            // It's a slug - convert to full URL
            const slug = slugOrUrl.replace(/^\//, "") // Remove leading slash if present

            // Try to find source - first with full path, then with just the basename
            let source = findBestSourceMatch(slug, sourceMap)
            if (!source) {
                // LLM might output wrong path prefix (e.g., etl/wizard/ instead of data-insights/)
                // Try matching just the last path segment
                const basename = slug.split("/").pop() || slug
                source = findBestSourceMatch(basename, sourceMap)
            }

            if (source) {
                usedSources.set(source.slug, source)
                return `[${title}](${source.url})`
            }

            // No match in source map - strip any path prefix and use just the basename
            const basename = slug.split("/").pop() || slug
            usedSources.set(basename, { title, slug: basename, url: `${baseUrl}/${basename}` })
            return `[${title}](${baseUrl}/${basename})`
        }
    )
}

/**
 * Format the sources section to append at the end
 */
function formatSourcesSection(usedSources: Map<string, Source>): string {
    if (usedSources.size === 0) return ""

    const links = [...usedSources.values()]
        .map((s) => `- [${s.title}](${s.url})`)
        .join("\n")

    return `\n\n---\n\n**Sources:**\n${links}\n`
}

/**
 * Send an SSE event
 */
function sseEvent(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

// Valid query parameter names for this endpoint
const VALID_PARAMS = new Set([
    COMMON_SEARCH_PARAMS.QUERY, // "q"
    "max_results",
    "model",
])

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, request } = context
    const url = new URL(request.url)
    const baseUrl = getBaseUrl(request)

    // Validate query parameters
    const validationError = validateQueryParams(url, VALID_PARAMS)
    if (validationError) return validationError

    // Parse parameters
    const query = url.searchParams.get(COMMON_SEARCH_PARAMS.QUERY) || ""
    const maxResults = Math.min(
        parseInt(
            url.searchParams.get("max_results") || String(DEFAULT_MAX_RESULTS)
        ),
        MAX_RESULTS_LIMIT
    )
    const model = url.searchParams.get("model") || undefined

    // Validate required query
    if (!query.trim()) {
        return new Response(
            JSON.stringify({
                error: "Query required",
                details: "The 'q' parameter is required and cannot be empty",
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

    try {
        // Start search (for sources) in parallel with aiSearch (for streaming answer)
        const searchPromise = env.AI.autorag(AI_SEARCH_INSTANCE_NAME).search({
            query,
            max_num_results: maxResults,
            ranking_options: {
                score_threshold: 0.1,
            },
        }) as Promise<AISearchResponse>

        // System prompt to get consistent source formatting
        const systemPrompt = `You are a helpful assistant answering questions using Our World in Data content.
When citing sources, use this exact format: [Source Title](slug)
For example: [Climate Change](climate-change) or [CO₂ Emissions](co2-and-greenhouse-gas-emissions)
Do NOT include file paths, folder names, or .md extensions in citations.
Always include relevant source citations inline where you reference information.`

        // Call aiSearch with streaming enabled
        const aiSearchOptions: {
            query: string
            stream: true
            max_num_results: number
            ranking_options: { score_threshold: number }
            system_prompt: string
            model?: string
        } = {
            query,
            stream: true,
            max_num_results: maxResults,
            ranking_options: {
                score_threshold: 0.1,
            },
            system_prompt: systemPrompt,
        }

        if (model) {
            aiSearchOptions.model = model
        }

        const streamResponse =
            await env.AI.autorag(AI_SEARCH_INSTANCE_NAME).aiSearch(
                aiSearchOptions
            )

        // The streaming response is a Response object with a ReadableStream body
        const streamBody = (streamResponse as Response).body
        if (!streamBody) {
            throw new Error("No response body from AI Search")
        }

        // Create a TransformStream to convert AI Search stream to SSE
        const { readable, writable } = new TransformStream()
        const writer = writable.getWriter()
        const encoder = new TextEncoder()

        // Process the stream in the background
        void (async () => {
            // Wait for sources to build the mapping
            let sourceMap = new Map<string, Source>()
            try {
                const searchResults = await searchPromise
                if (searchResults.data && searchResults.data.length > 0) {
                    sourceMap = buildSourceMap(searchResults.data, baseUrl)
                    console.log("[Source map] Keys:", [...sourceMap.keys()])
                }
            } catch (searchError) {
                console.warn("Failed to fetch sources:", searchError)
                // Continue without source linking
            }

            const usedSources = new Map<string, Source>()

            try {
                const reader = streamBody.getReader()
                const decoder = new TextDecoder()
                let sseBuffer = "" // Buffer for SSE parsing
                let textBuffer = "" // Buffer for pattern matching

                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    // Decode the chunk and add to SSE buffer
                    sseBuffer += decoder.decode(value, { stream: true })

                    // AI Search streams SSE format where each line is: "data: {...}\n"
                    let newlineIdx: number
                    while ((newlineIdx = sseBuffer.indexOf("\n")) !== -1) {
                        const line = sseBuffer.slice(0, newlineIdx)
                        sseBuffer = sseBuffer.slice(newlineIdx + 1)

                        if (!line.trim() || !line.startsWith("data:")) continue

                        // Extract JSON from "data: {...}"
                        const jsonStr = line.replace(/^data:\s*/, "")

                        try {
                            const chunk = JSON.parse(jsonStr)

                            if (chunk.response) {
                                // Add to text buffer for pattern processing
                                textBuffer += chunk.response

                                // Process buffer, keeping potential partial patterns
                                const { output, remaining } = processTextBuffer(
                                    textBuffer,
                                    sourceMap,
                                    usedSources,
                                    baseUrl,
                                    false
                                )
                                textBuffer = remaining

                                if (output) {
                                    await writer.write(
                                        encoder.encode(
                                            sseEvent("content", { text: output })
                                        )
                                    )
                                }
                            }
                        } catch {
                            console.warn(
                                "Failed to parse AI Search chunk:",
                                jsonStr
                            )
                        }
                    }
                }

                // Process any remaining SSE buffer
                if (sseBuffer.trim()) {
                    const jsonStr = sseBuffer.replace(/^data:\s*/, "").trim()
                    if (jsonStr.startsWith("{")) {
                        try {
                            const chunk = JSON.parse(jsonStr)
                            if (chunk.response) {
                                textBuffer += chunk.response
                            }
                        } catch {
                            // Ignore malformed final chunk
                        }
                    }
                }

                // Flush remaining text buffer
                if (textBuffer) {
                    const { output } = processTextBuffer(
                        textBuffer,
                        sourceMap,
                        usedSources,
                        baseUrl,
                        true
                    )
                    if (output) {
                        await writer.write(
                            encoder.encode(sseEvent("content", { text: output }))
                        )
                    }
                }

                // Append sources section
                const sourcesSection = formatSourcesSection(usedSources)
                if (sourcesSection) {
                    await writer.write(
                        encoder.encode(
                            sseEvent("content", { text: sourcesSection })
                        )
                    )
                }

                // Send done event
                await writer.write(encoder.encode(sseEvent("done", {})))
            } catch (error) {
                console.error("Stream processing error:", error)
                await writer.write(
                    encoder.encode(
                        sseEvent("error", {
                            message:
                                error instanceof Error
                                    ? error.message
                                    : "Stream processing failed",
                        })
                    )
                )
            } finally {
                await writer.close()
            }
        })()

        return new Response(readable, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
            },
        })
    } catch (error) {
        console.error("AI Search answer error:", error)

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
