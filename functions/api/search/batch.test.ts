// /api/search/batch runs each `r` query string exactly as /api/search would
// and returns the results in request order, so one invalid or failed section
// doesn't take down the others.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { onRequestGet } from "./batch.js"
import * as searchApi from "./searchApi.js"
import type { Env } from "../../_common/env.js"
import type { SearchApiBatchResponse } from "@ourworldindata/utils"

vi.mock(import("./searchApi.js"), async (importOriginal) => {
    const actual = await importOriginal()
    return {
        ...actual,
        searchCharts: vi.fn(),
        searchPages: vi.fn(),
    }
})

const env = {
    ALGOLIA_ID: "test-app-id",
    ALGOLIA_SEARCH_KEY: "test-api-key",
} as Env

const batchUrl = (...queryStrings: string[]): string =>
    `http://localhost/api/search/batch?${new URLSearchParams(
        queryStrings.map((queryString) => ["r", queryString])
    )}`

const callBatch = async (url: string): Promise<Response> =>
    await onRequestGet({
        request: new Request(url),
        env,
        waitUntil: vi.fn(),
    } as any)

describe("/api/search/batch", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal("caches", {
            default: {
                match: vi.fn().mockResolvedValue(undefined),
                put: vi.fn().mockResolvedValue(undefined),
            },
        })
        vi.mocked(searchApi.searchCharts).mockImplementation(
            async (_config, state) => ({
                query: state.query,
                results: [],
                nbHits: 1,
                page: 0,
                nbPages: 1,
                hitsPerPage: 9,
            })
        )
        vi.mocked(searchApi.searchPages).mockImplementation(
            async (_config, state) => ({
                query: state.query,
                results: [],
                nbHits: 2,
                offset: 0,
                length: 4,
            })
        )
    })

    it("returns each request's /api/search status and body, in order", async () => {
        const response = await callBatch(
            batchUrl("type=pages&q=gdp", "q=gdp", "type=nonsense&q=gdp")
        )
        const { results } = await response.json<SearchApiBatchResponse>()

        expect(response.status).toBe(200)
        expect(
            results.map((result) => {
                const body = result.body as Record<string, unknown>
                return [result.status, body.nbHits ?? body.error]
            })
        ).toEqual([
            [200, 2],
            [200, 1],
            [400, "Invalid type parameter"],
        ])
        // Not cached, since one of its parts failed
        expect(response.headers.get("Cache-Control")).toBe("no-store")
    })

    it("is cached as long as its shortest-lived part", async () => {
        // A queryless search is cached for a day, one with a query for 10 min
        const response = await callBatch(batchUrl("type=pages", "q=gdp"))

        expect(response.headers.get("Cache-Control")).toBe(
            "public, max-age=600"
        )
    })

    it.each([
        ["no requests", batchUrl()],
        ["more than 8 requests", batchUrl(...Array(9).fill("q=gdp"))],
    ])("rejects %s", async (_name, url) => {
        const response = await callBatch(url)

        expect(response.status).toBe(400)
        expect(searchApi.searchCharts).not.toHaveBeenCalled()
    })
})
