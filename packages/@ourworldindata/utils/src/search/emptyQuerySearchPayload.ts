/**
 * Helper for deciding whether an Algolia multi-query request payload (the
 * body POSTed to Algolia's multi-query "queries" endpoint) consists
 * exclusively of searches with an empty query string. These are the "browse"
 * requests issued by default states — the search landing page, the empty
 * autocomplete panel, featured metrics — and are highly cacheable since they
 * don't depend on user input.
 *
 * Used on both sides of our caching proxy: the site's search client routes
 * such payloads to the proxy (`site/search/searchClients.ts`), and the
 * Cloudflare function only accepts payloads that pass this check
 * (`functions/api/search/cached-queries.ts`).
 */

// Attributes that make a request depend on user input. Depending on the
// client, these live at the top level of each request (algoliasearch v5), in
// a `params` object (autocomplete), or in a URL-encoded `params` string
// (algoliasearch v4 legacy format).
const QUERY_ATTRIBUTES = ["query", "similarQuery", "facetQuery"] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const hasOnlyEmptyQueryAttributes = (
    params: Record<string, unknown>
): boolean =>
    QUERY_ATTRIBUTES.every((attribute) => {
        const value = params[attribute]
        return value === undefined || value === ""
    })

const isEmptyQuerySearchRequest = (request: unknown): boolean => {
    if (!isRecord(request)) return false
    if (!hasOnlyEmptyQueryAttributes(request)) return false

    const params = request.params
    if (params === undefined) return true
    if (typeof params === "string") {
        const parsedParams = Object.fromEntries(new URLSearchParams(params))
        return hasOnlyEmptyQueryAttributes(parsedParams)
    }
    if (isRecord(params)) return hasOnlyEmptyQueryAttributes(params)
    return false
}

/**
 * Returns true if `payload` looks like an Algolia multi-query request body
 * (`{ requests: [...] }`) where every request has an empty query string.
 */
export function isEmptyQuerySearchPayload(payload: unknown): boolean {
    if (!isRecord(payload)) return false
    const requests = payload.requests
    if (!Array.isArray(requests) || requests.length === 0) return false
    return requests.every(isEmptyQuerySearchRequest)
}
