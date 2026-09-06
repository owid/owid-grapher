import { afterEach, describe, expect, it, vi } from "vitest"
import {
    ChartRecordType,
    FilterType,
    OwidGdocType,
} from "@ourworldindata/types"
import {
    searchCharts,
    searchPages,
    SearchValidationError,
} from "./searchApi.js"

const config = { appId: "fixture", apiKey: "fixture", indexPrefix: "test" }
const state = { query: "population", filters: [], requireAllCountries: false }
const internal = {
    objectID: "internal-id",
    _rankingInfo: { words: 2 },
    _highlightResult: { title: "internal" },
    _snippetResult: { content: "internal" },
}

afterEach(() => vi.unstubAllGlobals())

// Stub fetch, not the search API or Algolia client: URL shaping, SDK request
// serialization, closest-match routing and response cleanup all execute normally.
function transport(results: object[]): ReturnType<typeof vi.fn> {
    const fetch = vi.fn(async () => Response.json({ results }))
    vi.stubGlobal("fetch", fetch)
    return fetch
}
function response(hits: object[], pagination: object = {}): object {
    return {
        hits,
        nbHits: hits.length,
        page: 0,
        nbPages: 1,
        hitsPerPage: 20,
        ...pagination,
    }
}
function requestBody(
    fetch: ReturnType<typeof vi.fn>,
    call = 0
): { requests: Record<string, unknown>[] } {
    const args = fetch.mock.calls[call] as [unknown, RequestInit]
    return JSON.parse(String(args[1].body))
}

describe("deterministic search response contracts", () => {
    it("returns every chart result type with exact URLs and strips internal/unrequested fields", async () => {
        transport([
            response([
                {
                    ...internal,
                    title: "Chart",
                    slug: "population",
                    type: ChartRecordType.Chart,
                    queryParams: "?ignored=yes",
                    internalScore: 999,
                },
                {
                    ...internal,
                    title: "Explorer",
                    slug: "energy",
                    type: ChartRecordType.ExplorerView,
                    queryParams: "?country=FRA&Metric=Total",
                },
                {
                    ...internal,
                    title: "Multi-dimensional",
                    slug: "health",
                    type: ChartRecordType.MultiDimView,
                    queryParams: "?metric=rate",
                },
            ]),
        ])
        expect(await searchCharts(config, state)).toEqual({
            query: "population",
            nbHits: 3,
            page: 0,
            nbPages: 1,
            hitsPerPage: 20,
            results: [
                {
                    title: "Chart",
                    slug: "population",
                    type: "chart",
                    queryParams: "?ignored=yes",
                    url: "https://ourworldindata.org/grapher/population",
                },
                {
                    title: "Explorer",
                    slug: "energy",
                    type: "explorerView",
                    queryParams: "?country=FRA&Metric=Total",
                    url: "https://ourworldindata.org/explorers/energy?country=FRA&Metric=Total",
                },
                {
                    title: "Multi-dimensional",
                    slug: "health",
                    type: "multiDimView",
                    queryParams: "?metric=rate",
                    url: "https://ourworldindata.org/grapher/health?metric=rate",
                },
            ],
        })
    })

    it("forwards page and page size and returns exact pagination metadata", async () => {
        const fetch = transport([
            response(
                [
                    {
                        ...internal,
                        title: "Second page",
                        slug: "second",
                        type: ChartRecordType.Chart,
                    },
                ],
                { nbHits: 4, page: 1, nbPages: 2, hitsPerPage: 2 }
            ),
        ])
        expect(
            await searchCharts(config, state, 1, 2, "https://preview.example")
        ).toEqual({
            query: "population",
            nbHits: 4,
            page: 1,
            nbPages: 2,
            hitsPerPage: 2,
            results: [
                {
                    title: "Second page",
                    slug: "second",
                    type: "chart",
                    url: "https://preview.example/grapher/second",
                },
            ],
        })
        expect(requestBody(fetch).requests[0]).toMatchObject({
            page: 1,
            hitsPerPage: 2,
            query: "population",
        })
    })

    it.each([
        [OwidGdocType.Article, "/example"],
        [OwidGdocType.AboutPage, "/example"],
        [OwidGdocType.DataInsight, "/data-insights/example"],
        [OwidGdocType.Profile, "/profile/example"],
        [OwidGdocType.Author, "/team/example"],
        [OwidGdocType.TopicPage, "/example"],
        [OwidGdocType.LinearTopicPage, "/example"],
        [OwidGdocType.Announcement, "/example"],
    ])(
        "returns an explicit %s page and its canonical path",
        async (type, path) => {
            const fetch = transport([
                response(
                    [
                        {
                            ...internal,
                            title: "A page",
                            slug: "example",
                            type,
                            content: "Public summary",
                            authors: ["Fixture Author"],
                        },
                    ],
                    { nbHits: 7 }
                ),
            ])
            expect(
                await searchPages(
                    config,
                    "health",
                    3,
                    2,
                    [type],
                    "https://preview.example"
                )
            ).toEqual({
                query: "health",
                nbHits: 7,
                offset: 3,
                length: 2,
                results: [
                    {
                        title: "A page",
                        slug: "example",
                        type,
                        content: "Public summary",
                        authors: ["Fixture Author"],
                        url: `https://preview.example${path}`,
                    },
                ],
            })
            expect(requestBody(fetch).requests[0]).toMatchObject({
                offset: 3,
                length: 2,
                filters: `type:${type}`,
            })
        }
    )

    it.each(["charts", "pages"] as const)(
        "keeps empty %s responses honest",
        async (kind) => {
            transport([response([], { nbPages: 0 })])
            const result =
                kind === "charts"
                    ? await searchCharts(config, {
                          ...state,
                          query: "nonsense",
                      })
                    : await searchPages(config, "nonsense")
            expect(result.query).toBe("nonsense")
            expect(result.results).toEqual([])
            expect(result.nbHits).toBe(0)
            expect(result).not.toHaveProperty("closestMatches")
        }
    )

    it("distinguishes invalid topics from valid topics with no results using the full facet inventory", async () => {
        const fetch = vi.fn(async (_input: unknown, init?: RequestInit) => {
            const { requests } = JSON.parse(String(init?.body)) as {
                requests: { facets?: string[] }[]
            }
            return Response.json({
                results: [
                    requests[0].facets
                        ? {
                              hits: [],
                              facets: { tags: { Health: 5, Polio: 1 } },
                          }
                        : response([], { nbPages: 0 }),
                ],
            })
        })
        vi.stubGlobal("fetch", fetch)
        await expect(
            searchCharts(config, {
                ...state,
                query: "",
                filters: [{ type: FilterType.TOPIC, name: "Imaginary" }],
            })
        ).rejects.toThrow(
            new SearchValidationError(
                'No results found. The topic "Imaginary" does not exist. Available topics: Health, Polio'
            )
        )
        expect(
            await searchCharts(config, {
                ...state,
                query: "",
                filters: [{ type: FilterType.TOPIC, name: "Polio" }],
            })
        ).toEqual({
            query: "",
            results: [],
            nbHits: 0,
            page: 0,
            nbPages: 0,
            hitsPerPage: 20,
        })
        const facetRequests = fetch.mock.calls
            .flatMap(
                ([, init]) =>
                    (
                        JSON.parse(String(init?.body)) as {
                            requests: Record<string, unknown>[]
                        }
                    ).requests
            )
            .filter((request) => request.facets)
        expect(facetRequests).toHaveLength(2)
        for (const request of facetRequests)
            expect(request).toMatchObject({
                facets: ["tags"],
                hitsPerPage: 0,
                maxValuesPerFacet: 1000,
            })
    })
})
