import * as Sentry from "@sentry/cloudflare"
import { SearchIndexName } from "@ourworldindata/types"
import { isEmptyQuerySearchPayload } from "@ourworldindata/utils"
import { Env } from "../../_common/env.js"
import { getIndexName } from "./algoliaClient.js"

/**
 * Caching proxy for empty-query Algolia searches.
 *
 * The site routes multi-query search requests where every query string is
 * empty — the "browse" requests issued by default states like the search
 * landing page or the empty autocomplete panel — to this endpoint instead of
 * Algolia (see site/search/searchClients.ts). Since these requests don't
 * depend on user input, we forward them to Algolia's multi-query endpoint
 * and cache the response aggressively, saving a large share of our Algolia
 * search quota. Requests with a non-empty query are rejected with a 400;
 * they should go to Algolia directly.
 *
 * Expects the exact request body the algoliasearch client POSTs to Algolia's
 * multi-query endpoint and returns Algolia's response unchanged, so the
 * client can treat this endpoint as a drop-in replacement host.
 */

const CACHE_MAX_AGE_SECONDS = 60 * 60 * 24 // one day

// The chronological pages index (which backs /latest) sorts by date, so a
// newly published article ranks first the moment it's indexed. Cache it only
// briefly: long enough to absorb the bulk of its traffic, short enough that
// new content isn't held back noticeably.
const CHRONOLOGICAL_CACHE_MAX_AGE_SECONDS = 60 * 15

const MAX_BODY_BYTES = 256 * 1024
const MAX_REQUESTS_PER_BATCH = 200

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
}

const errorResponse = (status: number, error: string): Response =>
    new Response(JSON.stringify({ error }), {
        status,
        headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS,
        },
    })

const sha256Hex = async (text: string): Promise<string> => {
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(text)
    )
    return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
}

// The Cache API only caches GET requests, so we key the cache on a synthetic
// GET request whose URL contains a hash of the POST body.
const makeCacheKey = async (
    requestUrl: string,
    body: string
): Promise<Request> => {
    const url = new URL(requestUrl)
    return new Request(
        `${url.origin}${url.pathname}?payload=${await sha256Hex(body)}`,
        { method: "GET" }
    )
}

export const onRequestOptions: PagesFunction = async () =>
    new Response(null, {
        status: 204,
        headers: {
            ...CORS_HEADERS,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400",
        },
    })

export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { request, env } = context

    try {
        if (!env.ALGOLIA_ID || !env.ALGOLIA_SEARCH_KEY) {
            throw new Error(
                "Missing environment variables. Please check that both ALGOLIA_ID and ALGOLIA_SEARCH_KEY are set."
            )
        }

        const body = await request.text()
        if (body.length > MAX_BODY_BYTES)
            return errorResponse(413, "Request body too large")

        let payload: unknown
        try {
            payload = JSON.parse(body)
        } catch {
            return errorResponse(400, "Request body is not valid JSON")
        }

        if (!isEmptyQuerySearchPayload(payload)) {
            return errorResponse(
                400,
                "Only Algolia multi-query payloads where every query string is empty are served here; send other requests to Algolia directly"
            )
        }
        const { requests } = payload as { requests: { indexName?: unknown }[] }
        if (requests.length > MAX_REQUESTS_PER_BATCH) {
            return errorResponse(400, "Too many queries in one request")
        }

        const chronologicalIndexName = getIndexName(
            SearchIndexName.PagesChronological,
            env.ALGOLIA_INDEX_PREFIX
        )
        const maxAgeSeconds = requests.some(
            (searchRequest) =>
                searchRequest.indexName === chronologicalIndexName
        )
            ? CHRONOLOGICAL_CACHE_MAX_AGE_SECONDS
            : CACHE_MAX_AGE_SECONDS

        const cache = caches.default
        const cacheKey = await makeCacheKey(request.url, body)

        const cachedResponse = await cache.match(cacheKey)
        if (cachedResponse) {
            const response = new Response(cachedResponse.body, cachedResponse)
            response.headers.set("X-Cache", "HIT")
            return response
        }

        const algoliaResponse = await fetch(
            `https://${env.ALGOLIA_ID}-dsn.algolia.net/1/indexes/*/queries`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Algolia-Application-Id": env.ALGOLIA_ID,
                    "X-Algolia-API-Key": env.ALGOLIA_SEARCH_KEY,
                },
                body,
            }
        )

        // Re-create the response to make its headers mutable
        const response = new Response(algoliaResponse.body, algoliaResponse)
        // The runtime decodes a compressed subrequest body but leaves the
        // headers describing it as encoded, so they no longer match what we
        // hand on — and caches.default would store that mismatch.
        response.headers.delete("Content-Encoding")
        response.headers.delete("Content-Length")
        response.headers.set("Access-Control-Allow-Origin", "*")
        if (algoliaResponse.ok) {
            response.headers.set(
                "Cache-Control",
                `public, max-age=${maxAgeSeconds}`
            )
            response.headers.set("X-Cache", "MISS")
            context.waitUntil(
                cache.put(cacheKey, response.clone()).catch((error) => {
                    console.error("Failed to cache Algolia response:", error)
                })
            )
        } else {
            response.headers.set("Cache-Control", "no-store")
        }
        return response
    } catch (error) {
        console.error("Cached queries proxy error:", error)
        Sentry.captureException(error)

        return errorResponse(
            500,
            "An error occurred while proxying the search request"
        )
    }
}
