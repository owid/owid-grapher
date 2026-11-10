import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
    searchChartsTypesense,
    searchPagesTypesense,
} from "./typesenseSearchApi.js"

const config = { host: "typesense", port: 8108, protocol: "http", apiKey: "x" }
const baseUrl = "https://ourworldindata.org"
const state = (query: string) => ({
    query,
    filters: [],
    requireAllCountries: false,
})

const chartDoc = (slug: string, deduplicationId = `grapher/${slug}`) => ({
    slug,
    title: slug,
    type: "chart",
    deduplicationId,
    publishedAt: 1700000000,
})

describe("Typesense search", () => {
    const fetchMock = vi.fn()
    /** The search parameters of the nth request. */
    const sentParams = (n = 0): URLSearchParams =>
        new URL(fetchMock.mock.calls[n][0] as string).searchParams
    const respondWith = (body: object) =>
        fetchMock.mockResolvedValue(
            new Response(JSON.stringify({ found: 0, ...body }))
        )

    beforeEach(() => {
        fetchMock.mockReset()
        vi.stubGlobal("fetch", fetchMock)
    })
    afterEach(() => vi.unstubAllGlobals())

    it("runs a keyword search when alpha is 0: Typesense deduplicates and paginates", async () => {
        respondWith({
            found: 12,
            grouped_hits: [
                { group_key: ["a"], hits: [{ document: chartDoc("a") }] },
            ],
        })

        const response = await searchChartsTypesense(
            config,
            state("gdp"),
            1,
            5,
            baseUrl,
            0
        )

        const params = sentParams()
        expect(params.get("group_by")).toBe("deduplicationId")
        expect(params.get("page")).toBe("2")
        expect(params.get("vector_query")).toBeNull()
        expect(params.get("query_by")).not.toContain("embedding")
        expect(response).toMatchObject({
            nbHits: 12,
            page: 1,
            nbPages: 3,
            results: [
                {
                    slug: "a",
                    url: `${baseUrl}/grapher/a`,
                    publishedAt: "2023-11-14T22:13:20.000Z",
                },
            ],
        })
    })

    it("runs a hybrid search when alpha is above 0: one window, deduplicated and paginated here", async () => {
        respondWith({
            found: 4,
            hits: [
                { document: chartDoc("a") },
                { document: chartDoc("a-view", "grapher/a") },
                { document: chartDoc("b") },
                { document: chartDoc("c") },
            ],
        })

        const response = await searchChartsTypesense(
            config,
            state("gdp"),
            1,
            2,
            baseUrl,
            0.3
        )

        const params = sentParams()
        expect(params.get("vector_query")).toBe(
            "embedding:([], alpha: 0.3, k: 100)"
        )
        expect(params.get("group_by")).toBeNull()
        expect(params.get("sort_by")).toBeNull()
        expect(params.get("page")).toBe("1")
        // the three per-field lists stay as long as each other
        const count = (key: string) => params.get(key)!.split(",").length
        expect(count("query_by_weights")).toBe(count("query_by"))
        expect(count("num_typos")).toBe(count("query_by"))
        // a, b, c after dedup; the second page of two holds c
        expect(response.nbHits).toBe(3)
        expect(response.results.map((hit) => hit.slug)).toEqual(["c"])
        expect(response.results[0]).not.toHaveProperty("deduplicationId")
    })

    it("keeps a search without a query keyword-only, whatever alpha is", async () => {
        respondWith({ grouped_hits: [] })

        await searchChartsTypesense(config, state(""), 0, 5, baseUrl, 0.5)

        expect(sentParams().get("q")).toBe("*")
        expect(sentParams().get("vector_query")).toBeNull()
    })

    it("deduplicates a hybrid pages search by path, keeping each page's best passage", async () => {
        const page = (path: string, content: string) => ({
            document: {
                slug: path,
                path,
                title: path,
                type: "article",
                content,
            },
        })
        respondWith({
            found: 3,
            hits: [
                page("co2", "first passage"),
                page("co2", "second passage"),
                page("energy", "other"),
            ],
        })

        const response = await searchPagesTypesense(
            config,
            "emissions",
            0,
            10,
            ["article"],
            baseUrl,
            ["excerpt"],
            0.3
        )

        expect(sentParams().get("filter_by")).toBe("type:=`article`")
        expect(sentParams().get("include_fields")).toContain("excerpt")
        expect(response.nbHits).toBe(2)
        expect(response.results).toMatchObject([
            { slug: "co2", content: "first passage", url: `${baseUrl}/co2` },
            { slug: "energy" },
        ])
    })
})
