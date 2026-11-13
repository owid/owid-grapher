import { describe, it, expect, vi } from "vitest"
import { createSearchClient } from "./algoliaClient.js"

describe(createSearchClient, () => {
    // Algolia's analytics tell readers apart by IP, so searches the function
    // runs for a reader must carry that reader's IP rather than Cloudflare's
    it("forwards the reader's IP to Algolia", async () => {
        const fetchMock = vi.fn(
            async () =>
                new Response(JSON.stringify({ results: [{ hits: [] }] }), {
                    headers: { "Content-Type": "application/json" },
                })
        )
        vi.stubGlobal("fetch", fetchMock)

        const client = createSearchClient({
            appId: "test-app-id",
            apiKey: "test-api-key",
            readerIp: "203.0.113.7",
        })
        await client.searchForHits({
            requests: [{ indexName: "pages", query: "gdp" }],
        })

        const [, init] = fetchMock.mock.calls[0] as unknown as [
            string,
            RequestInit,
        ]
        expect(new Headers(init.headers).get("X-Forwarded-For")).toBe(
            "203.0.113.7"
        )
    })
})
