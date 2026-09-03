import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { type LiteClient } from "algoliasearch/lite"

const { CACHED_QUERIES_URL } = vi.hoisted(() => ({
    CACHED_QUERIES_URL: "https://example.org/api/search/cached-queries",
}))

vi.mock(import("../../settings/clientSettings.js"), () => ({
    ALGOLIA_ID: "TESTAPPID",
    ALGOLIA_SEARCH_KEY: "test-search-key",
    ALGOLIA_CACHED_QUERIES_URL: CACHED_QUERIES_URL,
}))

import {
    getDirectLiteSearchClient,
    getLiteSearchClient,
} from "./searchClients.js"

const ALGOLIA_RESPONSE_BODY = JSON.stringify({
    results: [
        {
            hits: [],
            nbHits: 0,
            page: 0,
            nbPages: 0,
            hitsPerPage: 20,
            exhaustiveNbHits: true,
            query: "",
            params: "",
            processingTimeMS: 1,
        },
    ],
})

/** Every URL the client actually POSTs to, in order. */
let requestedUrls: string[] = []

const urlOf = (input: RequestInfo | URL): string => {
    if (typeof input === "string") return input
    if (input instanceof URL) return input.href
    return input.url
}

beforeEach(() => {
    requestedUrls = []
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
        requestedUrls.push(urlOf(input))
        return new Response(ALGOLIA_RESPONSE_BODY, {
            status: 200,
            headers: { "content-type": "application/json" },
        })
    })
})

afterEach(() => {
    vi.unstubAllGlobals()
})

const searchWithQuery = async (
    client: LiteClient,
    query: string
): Promise<void> => {
    await client.searchForHits({
        requests: [{ indexName: "explorer-views-and-charts", query }],
    })
}

const isAlgoliaHost = (url: string): boolean => url.includes(".algolia")

// The all-charts block's default list and its typed lists have to describe the
// same set of charts, and only the empty-query half of that pair is eligible
// for the caching proxy — which answers with the Cloudflare Pages project's
// own Algolia credentials, not necessarily the ones baked into this bundle.
// So the block asks for a client that never splits its traffic between the
// two, while every other caller keeps the proxy.
describe(getDirectLiteSearchClient, () => {
    it("sends empty-query searches straight to Algolia, not to the proxy", async () => {
        await searchWithQuery(getDirectLiteSearchClient(), "")

        expect(requestedUrls).toHaveLength(1)
        expect(requestedUrls[0]).not.toContain(CACHED_QUERIES_URL)
        expect(isAlgoliaHost(requestedUrls[0])).toBe(true)
    })

    it("sends typed searches straight to Algolia too, so both halves come from one index", async () => {
        await searchWithQuery(getDirectLiteSearchClient(), "china")

        expect(requestedUrls.every(isAlgoliaHost)).toBe(true)
    })

    it("is a distinct client from the shared, proxy-backed one", () => {
        expect(getDirectLiteSearchClient()).not.toBe(getLiteSearchClient())
    })

    it("is reused across calls rather than rebuilt", () => {
        expect(getDirectLiteSearchClient()).toBe(getDirectLiteSearchClient())
    })
})

describe(getLiteSearchClient, () => {
    it("still routes empty-query searches through the caching proxy", async () => {
        await searchWithQuery(getLiteSearchClient(), "")

        expect(requestedUrls).toContain(CACHED_QUERIES_URL)
    })

    it("still sends typed searches to Algolia", async () => {
        await searchWithQuery(getLiteSearchClient(), "china")

        expect(requestedUrls.every(isAlgoliaHost)).toBe(true)
    })
})
