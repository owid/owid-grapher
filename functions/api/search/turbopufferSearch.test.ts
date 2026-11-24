import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { onRequestGet } from "./index.js"
import type { Env } from "../../_common/env.js"
import type { TurbopufferSearchApiResponse } from "./turbopufferSearch.js"

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
            "https://aws-eu-central-1.turbopuffer.com/v2/namespaces/owid-charts-spike-v1/query"
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

    it("rejects an unknown arm and reports a missing key", async () => {
        expect((await search("q=life&engine=tpuf&arm=T9")).status).toBe(400)
        const withoutKey = { ...env, TURBOPUFFER_API_KEY: undefined }
        expect((await search("q=life&engine=tpuf", withoutKey)).status).toBe(
            500
        )
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
