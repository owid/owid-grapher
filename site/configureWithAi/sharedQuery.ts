// A link to a page with AI mode asking a question: `?ai=<question>`. Data
// pages import this module eagerly: an MDim page rewrites its query string as
// it opens, so the question has to be read before the panel's chunk loads.

const SHARED_QUERY_PARAM = "ai"

/** The longest question the panel takes */
export const MAX_QUERY_LENGTH = 100

export function sharedQueryFromUrl(): string | null {
    if (typeof window === "undefined") return null
    const query = new URLSearchParams(window.location.search)
        .get(SHARED_QUERY_PARAM)
        ?.trim()
    return query ? query.slice(0, MAX_QUERY_LENGTH) : null
}

export function sharedQueryUrl(query: string): string {
    const url = new URL(window.location.href)
    url.searchParams.set(SHARED_QUERY_PARAM, query)
    // A section's anchor would open the page scrolled away from the chart
    url.hash = ""
    return url.toString()
}
