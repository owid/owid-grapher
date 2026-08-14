import { liteClient, LiteClient } from "algoliasearch/lite"
import type { EndRequest, Requester, Response } from "@algolia/client-common"
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

export const getLiteSearchClient = (): LiteClient => {
    if (!liteSearchClient) {
        liteSearchClient = liteClient(ALGOLIA_ID, ALGOLIA_SEARCH_KEY, {
            requester: createCachingRequester(),
        })
    }
    return liteSearchClient
}

let directLiteSearchClient: LiteClient | null = null

/**
 * A search client that always talks to Algolia directly, never to the
 * cached-queries proxy — opt-in, additive, and leaving `getLiteSearchClient`
 * (and therefore /search, the autocomplete panel, /latest and the
 * featured-metrics block) on the proxy exactly as before.
 *
 * For a caller that issues *both* empty-query and typed-query searches and
 * then compares the two result sets, the proxy is not transparent: only the
 * empty-query half is routed through it (`shouldUseCachedQueriesEndpoint`
 * above), and the proxy answers with `env.ALGOLIA_SEARCH_KEY` /
 * `env.ALGOLIA_ID` as bound to the Cloudflare Pages *project*, which on branch
 * previews is not the Algolia application whose credentials the staging build
 * baked into this bundle. The two halves then come from two different Algolia
 * applications, i.e. two separately-built indices: measured on the CO₂ topic,
 * the empty-query half returned 249 records (54 of them `explorerView`, and
 * with a different ranking of the `chart` records they share) where the typed
 * half returned 196. A block whose default list and typed list must be the
 * same list — see AllChartsBlock, which pins its search results to the order
 * of its unfiltered result set — needs both halves answered by one index, so
 * it takes this client and forgoes the caching.
 */
export const getDirectLiteSearchClient = (): LiteClient => {
    if (!directLiteSearchClient) {
        directLiteSearchClient = liteClient(ALGOLIA_ID, ALGOLIA_SEARCH_KEY, {
            requester: createFetchRequester(),
        })
    }
    return directLiteSearchClient
}
