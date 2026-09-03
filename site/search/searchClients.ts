import { liteClient, LiteClient } from "algoliasearch/lite"
import {
    createNullCache,
    type EndRequest,
    type Requester,
    type Response,
} from "@algolia/client-common"
import { createFetchRequester } from "@algolia/requester-fetch"
import { isEmptyQuerySearchPayload } from "@ourworldindata/utils"
import {
    ALGOLIA_CACHED_QUERIES_URL,
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
} from "../../settings/clientSettings.js"

// Multi-query search requests where every query string is empty (the
// "browse" requests issued by default states: the search landing page, the
// empty autocomplete panel, /latest, featured metrics, ...) don't depend on
// user input, so instead of hitting Algolia directly we send them to a
// Cloudflare function of ours that proxies Algolia and caches the results
// aggressively (functions/api/search/cached-queries.ts). Everything else
// goes to Algolia directly.
const shouldUseCachedQueriesEndpoint = (request: EndRequest): boolean => {
    if (request.method.toUpperCase() !== "POST") return false
    if (typeof request.data !== "string") return false
    // Only the multi-query search endpoint is proxied
    if (!request.url.includes("/1/indexes/*/queries")) return false
    try {
        return isEmptyQuerySearchPayload(JSON.parse(request.data))
    } catch {
        return false
    }
}

const isSuccessStatus = (status: number): boolean =>
    status >= 200 && status < 300

const createCachingRequester = (): Requester => {
    const fetchRequester = createFetchRequester()
    return {
        async send(request: EndRequest): Promise<Response> {
            if (!ALGOLIA_CACHED_QUERIES_URL) return fetchRequester.send(request)
            if (!shouldUseCachedQueriesEndpoint(request))
                return fetchRequester.send(request)

            const response = await fetchRequester
                .send({ ...request, url: ALGOLIA_CACHED_QUERIES_URL })
                .catch(() => null)
            if (response && isSuccessStatus(response.status)) return response

            // If our caching endpoint is unavailable or rejects the request,
            // fall back to querying Algolia directly
            return fetchRequester.send(request)
        },
    }
}

let liteSearchClient: LiteClient | null = null

/**
 * Disable Algolia's response cache so React Query alone decides when cached
 * results should be reused or refetched.
 */
export const getLiteSearchClient = (): LiteClient => {
    if (!liteSearchClient) {
        liteSearchClient = liteClient(ALGOLIA_ID, ALGOLIA_SEARCH_KEY, {
            requester: createCachingRequester(),
            responsesCache: createNullCache(),
        })
    }
    return liteSearchClient
}

let autocompleteSearchClient: LiteClient | null = null

/**
 * Keep Algolia's response cache for autocomplete. It already manages requests
 * through @algolia/autocomplete-js, so adding React Query solely for caching
 * would introduce another state layer. A separate client lets React Query-backed
 * searches disable Algolia's cache without making autocomplete re-request prior
 * input when users backspace or retype it.
 */
export const getAutocompleteSearchClient = (): LiteClient => {
    if (!autocompleteSearchClient) {
        autocompleteSearchClient = liteClient(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)
    }
    return autocompleteSearchClient
}
