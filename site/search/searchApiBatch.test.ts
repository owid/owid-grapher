// The fetcher sends the sections a search page requests together as one
// /api/search/batch request and hands each caller its own section back, so
// combining them must neither mix up sections nor let one section's failure
// fail the others.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createSearchApiFetcher } from "./searchApiBatch.js"

const API_URL = "https://example.org/api/search"

const jsonResponse = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status })

const params = (query: string): URLSearchParams =>
    new URLSearchParams({ q: query })

describe(createSearchApiFetcher, () => {
    const fetchMock = vi.fn<typeof fetch>()

    beforeEach(() => {
        fetchMock.mockReset()
        vi.stubGlobal("fetch", fetchMock)
    })
    afterEach(() => vi.unstubAllGlobals())

    it("sends requests made together as one batch and resolves each with its own body", async () => {
        fetchMock.mockResolvedValue(
            jsonResponse({
                results: [
                    { status: 200, body: { section: "a" } },
                    { status: 200, body: { section: "b" } },
                ],
            })
        )
        const fetchSearchApi = createSearchApiFetcher(API_URL)

        const a = fetchSearchApi(params("a"))
        // A sibling section whose query function runs a few promise ticks later
        await Promise.resolve()
        const b = fetchSearchApi(params("b"))

        expect(await Promise.all([a, b])).toEqual([
            { section: "a" },
            { section: "b" },
        ])
        expect(fetchMock).toHaveBeenCalledOnce()
        const url = new URL(fetchMock.mock.calls[0][0] as string)
        expect(url.pathname).toBe("/api/search/batch")
        expect(url.searchParams.getAll("r")).toEqual(["q=a", "q=b"])
    })

    it("sends a lone request to /api/search itself", async () => {
        fetchMock.mockResolvedValue(jsonResponse({ section: "a" }))
        const fetchSearchApi = createSearchApiFetcher(API_URL)

        expect(await fetchSearchApi(params("a"))).toEqual({ section: "a" })
        expect(fetchMock).toHaveBeenCalledWith(`${API_URL}?q=a`)
    })

    it("rejects only the section that failed", async () => {
        fetchMock.mockResolvedValue(
            jsonResponse({
                results: [
                    { status: 500, body: { error: "boom" } },
                    { status: 200, body: { section: "b" } },
                ],
            })
        )
        const fetchSearchApi = createSearchApiFetcher(API_URL)

        const [a, b] = await Promise.allSettled([
            fetchSearchApi(params("a")),
            fetchSearchApi(params("b")),
        ])

        expect(a).toMatchObject({
            status: "rejected",
            reason: new Error("Search API request failed: 500"),
        })
        expect(b).toEqual({ status: "fulfilled", value: { section: "b" } })
    })

    it("rejects every section when the batch request itself fails", async () => {
        fetchMock.mockResolvedValue(jsonResponse({ error: "down" }, 503))
        const fetchSearchApi = createSearchApiFetcher(API_URL)

        const results = await Promise.allSettled([
            fetchSearchApi(params("a")),
            fetchSearchApi(params("b")),
        ])

        expect(results.map((result) => result.status)).toEqual([
            "rejected",
            "rejected",
        ])
    })

    it("sends requests made later separately", async () => {
        fetchMock.mockImplementation(async (url) =>
            jsonResponse({ url: String(url) })
        )
        const fetchSearchApi = createSearchApiFetcher(API_URL)

        await fetchSearchApi(params("a"))
        await fetchSearchApi(params("b"))

        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
            `${API_URL}?q=a`,
            `${API_URL}?q=b`,
        ])
    })
})
