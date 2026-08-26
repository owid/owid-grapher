import { describe, it, expect, vi, beforeEach, assert, Mock } from "vitest"
import { onRequestPost } from "./cached-queries.js"
import type { Env } from "../../_common/env.js"

const mockEnv: Env = {
    ALGOLIA_ID: "test-app-id",
    ALGOLIA_SEARCH_KEY: "test-api-key",
} as Env

const EMPTY_QUERY_BODY = JSON.stringify({
    requests: [{ indexName: "charts", query: "", hitsPerPage: 4 }],
})

const makeContext = (body: string, env: Env = mockEnv) => {
    const request = new Request(
        "http://localhost/api/search/cached-queries",
        // Algolia clients send text/plain to avoid CORS preflights
        { method: "POST", headers: { "Content-Type": "text/plain" }, body }
    )
    return {
        request,
        env,
        waitUntil: vi.fn((promise: Promise<unknown>) => promise),
    } as any
}

describe("cached queries proxy endpoint", () => {
    let mockCache: { match: Mock; put: Mock }
    let mockFetch: Mock

    beforeEach(() => {
        vi.clearAllMocks()
        mockCache = {
            match: vi.fn().mockResolvedValue(undefined),
            put: vi.fn().mockResolvedValue(undefined),
        }
        vi.stubGlobal("caches", { default: mockCache })
        mockFetch = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ results: [] }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        )
        vi.stubGlobal("fetch", mockFetch)
    })

    it("proxies an all-empty-query payload to Algolia and caches the response", async () => {
        const response = await onRequestPost(makeContext(EMPTY_QUERY_BODY))

        expect(mockFetch).toHaveBeenCalledWith(
            "https://test-app-id-dsn.algolia.net/1/indexes/*/queries",
            expect.objectContaining({ method: "POST", body: EMPTY_QUERY_BODY })
        )
        expect(response.status).toBe(200)
        expect(response.headers.get("Cache-Control")).toBe(
            "public, max-age=86400"
        )
        expect(response.headers.get("X-Cache")).toBe("MISS")
        expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
        expect(mockCache.put).toHaveBeenCalledOnce()
    })

    it("caches payloads touching the chronological pages index for only 15 minutes", async () => {
        const body = JSON.stringify({
            requests: [
                { indexName: "pages-chronological", query: "" },
                { indexName: "charts", query: "" },
            ],
        })
        const response = await onRequestPost(makeContext(body))

        expect(response.status).toBe(200)
        expect(response.headers.get("Cache-Control")).toBe(
            "public, max-age=900"
        )
    })

    it("identifies the chronological pages index behind an index prefix", async () => {
        const envWithPrefix = {
            ...mockEnv,
            ALGOLIA_INDEX_PREFIX: "test",
        } as Env
        const body = JSON.stringify({
            requests: [{ indexName: "test-pages-chronological", query: "" }],
        })
        const response = await onRequestPost(makeContext(body, envWithPrefix))

        expect(response.headers.get("Cache-Control")).toBe(
            "public, max-age=900"
        )
    })

    it("serves a cached response without contacting Algolia", async () => {
        mockCache.match.mockResolvedValue(
            new Response(JSON.stringify({ results: [] }), { status: 200 })
        )

        const response = await onRequestPost(makeContext(EMPTY_QUERY_BODY))

        expect(response.status).toBe(200)
        expect(response.headers.get("X-Cache")).toBe("HIT")
        expect(mockFetch).not.toHaveBeenCalled()
        expect(mockCache.put).not.toHaveBeenCalled()
    })

    it("does not cache Algolia error responses", async () => {
        mockFetch.mockResolvedValue(
            new Response(JSON.stringify({ message: "Index does not exist" }), {
                status: 404,
            })
        )

        const response = await onRequestPost(makeContext(EMPTY_QUERY_BODY))

        expect(response.status).toBe(404)
        expect(response.headers.get("Cache-Control")).toBe("no-store")
        expect(mockCache.put).not.toHaveBeenCalled()
    })

    it("rejects payloads containing a non-empty query", async () => {
        const body = JSON.stringify({
            requests: [
                { indexName: "charts", query: "" },
                { indexName: "pages", query: "co2" },
            ],
        })
        const response = await onRequestPost(makeContext(body))

        expect(response.status).toBe(400)
        const responseBody = await response.json()
        assert(
            typeof responseBody === "object" &&
                responseBody !== null &&
                "error" in responseBody
        )
        expect(responseBody.error).toContain("empty")
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it("rejects invalid JSON", async () => {
        const response = await onRequestPost(makeContext("not json"))

        expect(response.status).toBe(400)
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it("rejects oversized request bodies", async () => {
        const body = JSON.stringify({
            requests: [
                { indexName: "charts", query: "", filler: "x".repeat(300000) },
            ],
        })
        const response = await onRequestPost(makeContext(body))

        expect(response.status).toBe(413)
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it("rejects batches with too many queries", async () => {
        const body = JSON.stringify({
            requests: Array.from({ length: 201 }, () => ({
                indexName: "charts",
                query: "",
            })),
        })
        const response = await onRequestPost(makeContext(body))

        expect(response.status).toBe(400)
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it("returns a 500 when Algolia credentials are missing", async () => {
        const envWithoutId = {
            ...mockEnv,
            ALGOLIA_ID: undefined,
        } as unknown as Env
        const response = await onRequestPost(
            makeContext(EMPTY_QUERY_BODY, envWithoutId)
        )

        expect(response.status).toBe(500)
        expect(mockFetch).not.toHaveBeenCalled()
    })
})
