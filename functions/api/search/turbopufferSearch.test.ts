import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { onRequestGet } from "./index.js"
import type { Env } from "../../_common/env.js"
import type {
    TurbopufferPagesApiResponse,
    TurbopufferSearchApiResponse,
} from "./turbopufferSearch.js"

const env = {
    ALGOLIA_ID: "test-app-id",
    ALGOLIA_SEARCH_KEY: "test-api-key",
    TURBOPUFFER_API_KEY: "tpuf_test",
} as Env

const turbopufferResponse = {
    rows: [
        {
            id: "1",
            $dist: 12.3,
            chart_key: "grapher/life-expectancy",
            type: "chart",
            slug: "life-expectancy",
            queryParams: "",
            title: "Life expectancy",
            subtitle: "",
            variantName: "",
            containerTitle: "",
            availableEntities: ["France"],
            popularity: 9000,
        },
        {
            id: "covid-3",
            $dist: 4.5,
            chart_key: "explorer/covid?metric=deaths",
            type: "explorerView",
            slug: "covid",
            queryParams: "?metric=deaths",
            title: "Covid deaths",
            subtitle: "Confirmed deaths",
            variantName: "",
            containerTitle: "Covid explorer",
            availableEntities: ["France"],
            popularity: 5000,
        },
    ],
    performance: {
        server_total_ms: 21,
        embedding_ms: 8,
        cache_temperature: "hot",
    },
    billing: {
        billable_logical_bytes_queried: 1,
        billable_logical_bytes_returned: 1,
    },
}

const search = async (
    params: string,
    searchEnv: Env = env
): Promise<Response> =>
    onRequestGet({
        request: new Request(`http://localhost/api/search?${params}`),
        env: searchEnv,
    } as any)

const searchJson = async (
    params: string
): Promise<TurbopufferSearchApiResponse> =>
    (await search(params)).json<TurbopufferSearchApiResponse>()

describe("engine=tpuf", () => {
    const fetchMock = vi.fn()

    beforeEach(() => {
        fetchMock.mockResolvedValue(
            new Response(JSON.stringify(turbopufferResponse))
        )
        vi.stubGlobal("fetch", fetchMock)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        fetchMock.mockReset()
    })

    it("queries the namespace with the arm's shape and the request's filters", async () => {
        const response = await search(
            "q=life&engine=tpuf&arm=T1&countries=France~Spain&requireAllCountries=true&topics=Health"
        )
        expect(response.status).toBe(200)

        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe(
            "https://aws-eu-central-1.turbopuffer.com/v2/namespaces/owid-charts-spike-v2/query"
        )
        expect(init.headers.Authorization).toBe("Bearer tpuf_test")
        const body = JSON.parse(init.body)
        expect(body.limit).toEqual({
            total: 21,
            per: { attributes: ["chart_key"], limit: 1 },
        })
        const [, [countries, topic, textMatch]] = body.filters
        expect(countries).toEqual([
            "And",
            [
                ["availableEntities", "Contains", "France"],
                ["availableEntities", "Contains", "Spain"],
            ],
        ])
        expect(topic).toEqual(["tags", "Contains", "Health"])
        // T1 adds popularity, so it must keep out rows matching no query token
        expect(textMatch[0]).toBe("Or")
        expect(JSON.stringify(body.rank_by)).toContain("Saturate")
    })

    it("returns hits in the Algolia backend's shape, with turbopuffer's timings", async () => {
        const json = await searchJson("q=life&engine=tpuf")

        expect(json.results).toEqual([
            {
                title: "Life expectancy",
                slug: "life-expectancy",
                type: "chart",
                availableEntities: ["France"],
                url: "http://localhost/grapher/life-expectancy",
            },
            {
                title: "Covid deaths",
                containerTitle: "Covid explorer",
                slug: "covid",
                subtitle: "Confirmed deaths",
                type: "explorerView",
                queryParams: "?metric=deaths",
                availableEntities: ["France"],
                url: "http://localhost/explorers/covid?metric=deaths",
            },
        ])
        expect(json.engine).toEqual({
            name: "turbopuffer",
            arm: "T1",
            region: "aws-eu-central-1",
            serverMs: 21,
            embeddingMs: 8,
            cacheTemperature: "hot",
        })
    })

    it("sends T3 as a hybrid multi-query fused with RRF", async () => {
        fetchMock.mockResolvedValue(
            new Response(
                JSON.stringify({
                    ...turbopufferResponse,
                    rows: undefined,
                    results: [{ rows: turbopufferResponse.rows }],
                })
            )
        )
        const json = await searchJson("q=life&engine=tpuf&arm=T3")

        const body = JSON.parse(fetchMock.mock.calls[0][1].body)
        expect(body.rerank_by).toEqual(["RRF"])
        expect(body.queries[1].rank_by).toEqual([
            "search_text",
            "ANN",
            ["Embed", "life"],
        ])
        expect(json.results).toHaveLength(2)
    })

    it("sends T4 as the same two queries over a deeper pool, scored by a rerank model", async () => {
        fetchMock.mockResolvedValue(
            new Response(
                JSON.stringify({
                    ...turbopufferResponse,
                    rows: undefined,
                    results: [{ rows: turbopufferResponse.rows }],
                })
            )
        )
        await search(
            "q=defense&engine=tpuf&arm=T4&pool=50&synonyms=1&fuzzy=1&model=voyage/rerank-3"
        )

        const body = JSON.parse(fetchMock.mock.calls[0][1].body)
        expect(body.rerank_by).toEqual({
            model: "voyage/rerank-3",
            attribute: "search_text",
            query: "defense",
        })
        // Every candidate comes back, to be collapsed to one row per chart before the page is cut
        expect(body.limit).toBe(100)
        for (const query of body.queries) {
            expect(query.limit.total).toBe(50)
            expect(query.include_attributes).toContain("search_text")
        }
        // The text query also matches the synonyms ("military") and the fuzzy query
        const textQuery = JSON.stringify(body.queries[0])
        expect(textQuery).toContain("military")
        expect(textQuery).toContain("Fuzzy")
    })

    it("tunes T4's rerank with the query's synonyms and a popularity blend", async () => {
        const [life, covid] = turbopufferResponse.rows
        fetchMock.mockResolvedValue(
            new Response(
                JSON.stringify({
                    ...turbopufferResponse,
                    rows: undefined,
                    // The model's order: a near-tie the more popular chart wins after the blend
                    results: [
                        {
                            rows: [
                                { ...covid, $dist: 0.6, popularity: 0 },
                                { ...life, $dist: 0.58, popularity: 9000 },
                            ],
                        },
                    ],
                })
            )
        )
        const json = await searchJson(
            "q=defense&engine=tpuf&arm=T4&pool=50&synonyms=1&rsyn=1&popw=0.05"
        )

        const body = JSON.parse(fetchMock.mock.calls[0][1].body)
        expect(body.rerank_by.query).toMatch(/^defense \(.*military.*\)$/)
        expect(json.results.map((hit) => hit.slug)).toEqual([
            "life-expectancy",
            "covid",
        ])
    })

    it("queries the copy nearer the reader, unless the request names a region", async () => {
        const fromContinent = async (
            continent: string,
            params = "q=life&engine=tpuf"
        ): Promise<string> => {
            fetchMock.mockClear()
            const request = Object.assign(
                new Request(`http://localhost/api/search?${params}`),
                { cf: { continent } }
            )
            await onRequestGet({ request, env } as any)
            return new URL(fetchMock.mock.calls[0][0]).host
        }
        expect(await fromContinent("NA")).toBe("aws-us-east-1.turbopuffer.com")
        expect(await fromContinent("SA")).toBe("aws-us-east-1.turbopuffer.com")
        expect(await fromContinent("EU")).toBe(
            "aws-eu-central-1.turbopuffer.com"
        )
        expect(await fromContinent("AS")).toBe(
            "aws-eu-central-1.turbopuffer.com"
        )
        expect(
            await fromContinent(
                "NA",
                "q=life&engine=tpuf&region=aws-eu-central-1"
            )
        ).toBe("aws-eu-central-1.turbopuffer.com")
    })

    it("searches pages of the requested types, one hit per page", async () => {
        const chunk = {
            type: "data-insight",
            slug: "vaccines-saved-lives",
            path: "/data-insights/vaccines-saved-lives",
            title: "Vaccines saved lives",
            thumbnailUrl: "https://example.org/thumb.png",
            date: "2026-01-01T00:00:00.000Z",
            authors: ["A. Author"],
            excerpt: "",
            popularity: 40,
            search_text: "Vaccines saved lives. …",
        }
        fetchMock.mockResolvedValue(
            new Response(
                JSON.stringify({
                    ...turbopufferResponse,
                    rows: undefined,
                    // The text and vector halves found different chunks of one page
                    results: [
                        {
                            rows: [
                                { ...chunk, id: "a-c0", content: "First" },
                                {
                                    ...chunk,
                                    id: "b-c0",
                                    slug: "measles",
                                    path: "/data-insights/measles",
                                    title: "Measles",
                                    content: "Measles",
                                },
                                { ...chunk, id: "a-c1", content: "Second" },
                            ],
                        },
                    ],
                })
            )
        )
        const response = await search(
            "type=pages&q=vaccines&engine=tpuf&arm=T4&pool=20&pageTypes=data-insight"
        )
        expect(response.status).toBe(200)
        const json = await response.json<
            TurbopufferPagesApiResponse & { warnings?: string[] }
        >()

        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toContain("/v2/namespaces/owid-pages-spike-v1/query")
        const body = JSON.parse(init.body)
        expect(body.queries[1].filters).toEqual([
            "type",
            "In",
            ["data-insight"],
        ])
        expect(body.queries[1].limit.per.attributes).toEqual(["path"])
        expect(json.warnings).toBeUndefined()
        expect(json.results).toEqual([
            {
                type: "data-insight",
                slug: "vaccines-saved-lives",
                title: "Vaccines saved lives",
                thumbnailUrl: "https://example.org/thumb.png",
                date: "2026-01-01T00:00:00.000Z",
                authors: ["A. Author"],
                content: "First",
                url: "http://localhost/data-insights/vaccines-saved-lives",
            },
            expect.objectContaining({
                slug: "measles",
                url: "http://localhost/data-insights/measles",
            }),
        ])
    })

    it("rejects an unknown arm, model, pool or region, a non-finite midpoint and a missing key", async () => {
        expect((await search("q=life&engine=tpuf&popw=2")).status).toBe(400)
        expect((await search("q=life&engine=tpuf&region=mars")).status).toBe(
            400
        )
        expect((await search("q=life&engine=tpuf&arm=T9")).status).toBe(400)
        expect(
            (await search("q=life&engine=tpuf&arm=T4&model=gpt")).status
        ).toBe(400)
        expect((await search("q=life&engine=tpuf&pool=1000")).status).toBe(400)
        expect(
            (await search("q=life&engine=tpuf&midpoint=Infinity")).status
        ).toBe(400)
        const withoutKey = { ...env, TURBOPUFFER_API_KEY: undefined }
        expect((await search("q=life&engine=tpuf", withoutKey)).status).toBe(
            400
        )
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
