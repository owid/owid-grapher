import { describe, it, expect, vi, beforeEach } from "vitest"
import { onRequestGet } from "./index.js"
import * as searchApi from "./searchApi.js"
import type { Env } from "../../_common/env.js"

// Mock the searchApi module
vi.mock("./searchApi.js", () => ({
    searchCharts: vi.fn(),
    searchPages: vi.fn(),
}))

describe("Search API endpoint", () => {
    const mockEnv: Env = {
        ALGOLIA_ID: "test-app-id",
        ALGOLIA_SEARCH_KEY: "test-api-key",
    } as Env

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe("type parameter validation", () => {
        it("defaults to charts when type is not specified", async () => {
            const mockSearchCharts = vi
                .spyOn(searchApi, "searchCharts")
                .mockResolvedValue({
                    query: "test",
                    results: [],
                    nbHits: 0,
                    page: 0,
                    nbPages: 0,
                    hitsPerPage: 20,
                })

            const request = new Request("http://localhost/api/search?q=test")
            await onRequestGet({ request, env: mockEnv } as any)

            expect(mockSearchCharts).toHaveBeenCalled()
        })

        it("accepts type=charts", async () => {
            const mockSearchCharts = vi
                .spyOn(searchApi, "searchCharts")
                .mockResolvedValue({
                    query: "test",
                    results: [],
                    nbHits: 0,
                    page: 0,
                    nbPages: 0,
                    hitsPerPage: 20,
                })

            const request = new Request(
                "http://localhost/api/search?q=test&type=charts"
            )
            await onRequestGet({ request, env: mockEnv } as any)

            expect(mockSearchCharts).toHaveBeenCalled()
        })

        it("accepts type=pages", async () => {
            const mockSearchPages = vi
                .spyOn(searchApi, "searchPages")
                .mockResolvedValue({
                    query: "test",
                    results: [],
                    nbHits: 0,
                    offset: 0,
                    length: 20,
                })

            const request = new Request(
                "http://localhost/api/search?q=test&type=pages"
            )
            await onRequestGet({ request, env: mockEnv } as any)

            expect(mockSearchPages).toHaveBeenCalled()
        })

        it("rejects invalid type parameter", async () => {
            const request = new Request(
                "http://localhost/api/search?q=test&type=invalid"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(400)
            const body = (await response.json()) as any
            expect(body.error).toBe("Invalid type parameter")
        })
    })

    describe("pages search", () => {
        it("converts page/hitsPerPage to offset/length for pages", async () => {
            const mockSearchPages = vi
                .spyOn(searchApi, "searchPages")
                .mockResolvedValue({
                    query: "test",
                    results: [],
                    nbHits: 0,
                    offset: 0,
                    length: 10,
                })

            const request = new Request(
                "http://localhost/api/search?q=test&type=pages&page=2&hitsPerPage=10"
            )
            await onRequestGet({ request, env: mockEnv } as any)

            expect(mockSearchPages).toHaveBeenCalledWith(
                expect.anything(),
                "test",
                20, // page 2 * hitsPerPage 10 = offset 20
                10,
                undefined,
                "http://localhost"
            )
        })

        it("uses default pagination for pages", async () => {
            const mockSearchPages = vi
                .spyOn(searchApi, "searchPages")
                .mockResolvedValue({
                    query: "climate",
                    results: [],
                    nbHits: 0,
                    offset: 0,
                    length: 20,
                })

            const request = new Request(
                "http://localhost/api/search?q=climate&type=pages"
            )
            await onRequestGet({ request, env: mockEnv } as any)

            expect(mockSearchPages).toHaveBeenCalledWith(
                expect.anything(),
                "climate",
                0, // default page 0
                20, // default hitsPerPage 20
                undefined,
                "http://localhost"
            )
        })
    })

    describe("pagination validation", () => {
        it("rejects negative page", async () => {
            const request = new Request(
                "http://localhost/api/search?q=test&page=-1"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(400)
            const body = (await response.json()) as any
            expect(body.error).toBe("Invalid page parameter")
        })

        it("rejects page > MAX_PAGE", async () => {
            const request = new Request(
                "http://localhost/api/search?q=test&page=1001"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(400)
            const body = (await response.json()) as any
            expect(body.error).toBe("Invalid page parameter")
        })

        it("rejects hitsPerPage < 1", async () => {
            const request = new Request(
                "http://localhost/api/search?q=test&hitsPerPage=0"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(400)
            const body = (await response.json()) as any
            expect(body.error).toBe("Invalid hitsPerPage parameter")
        })

        it("rejects hitsPerPage > MAX_HITS_PER_PAGE", async () => {
            const request = new Request(
                "http://localhost/api/search?q=test&hitsPerPage=101"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(400)
            const body = (await response.json()) as any
            expect(body.error).toBe("Invalid hitsPerPage parameter")
        })
    })

    describe("environment variables", () => {
        it("returns error when ALGOLIA_ID is missing", async () => {
            const envWithoutId = {
                ...mockEnv,
                ALGOLIA_ID: undefined,
            } as unknown as Env
            const request = new Request("http://localhost/api/search?q=test")
            const response = await onRequestGet({
                request,
                env: envWithoutId,
            } as any)

            expect(response.status).toBe(500)
            const body = (await response.json()) as any
            expect(body.error).toBe(
                "An error occurred while processing the search request"
            )
        })

        it("returns error when ALGOLIA_SEARCH_KEY is missing", async () => {
            const envWithoutKey = {
                ...mockEnv,
                ALGOLIA_SEARCH_KEY: undefined,
            } as unknown as Env
            const request = new Request("http://localhost/api/search?q=test")
            const response = await onRequestGet({
                request,
                env: envWithoutKey,
            } as any)

            expect(response.status).toBe(500)
        })
    })

    describe("response format", () => {
        it("returns successful response with correct headers", async () => {
            vi.spyOn(searchApi, "searchCharts").mockResolvedValue({
                query: "test",
                results: [],
                nbHits: 0,
                page: 0,
                nbPages: 0,
                hitsPerPage: 20,
            })

            const request = new Request("http://localhost/api/search?q=test")
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(200)
            expect(response.headers.get("Content-Type")).toBe(
                "application/json"
            )
            expect(response.headers.get("Cache-Control")).toBe(
                "public, max-age=600"
            )
            expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
                "*"
            )
        })

        it("returns error response with CORS headers", async () => {
            const request = new Request(
                "http://localhost/api/search?q=test&type=invalid"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(400)
            expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
                "*"
            )
        })
    })
})
