import { describe, it, expect, vi, beforeEach } from "vitest"
import { type LiteClient } from "algoliasearch/lite"
import {
    FilterType,
    OwidGdocType,
    TagGraphRoot,
    TagGraphRootName,
} from "@ourworldindata/types"
import {
    DEFAULT_PAGE_TYPES,
    fromSearchApiResponse,
    runSearchRequest,
    searchRequestToUrlParams,
    type SearchApiHitsResponse,
    type SearchRequest,
} from "@ourworldindata/utils"
import type { Env } from "../../_common/env.js"
import { getSearchIndexNames } from "./algoliaClient.js"
import { onRequestGet } from "./index.js"

// The search page runs each of its searches either in the browser
// (runSearchRequest against Algolia) or through /api/search with
// highlights=true. These tests run both against the same fake Algolia and
// check that they send Algolia the same requests and that the page gets the
// same response either way, i.e. that a search survives the trip through
// the URL unchanged.

const tagGraph: TagGraphRoot = {
    id: 0,
    name: TagGraphRootName,
    slug: null,
    isTopic: false,
    isSearchable: false,
    weight: 0,
    path: [0],
    children: [
        {
            id: 1,
            name: "Poverty and Economic Development",
            slug: null,
            isTopic: false,
            isSearchable: true,
            weight: 0,
            path: [0, 1],
            children: [
                {
                    id: 2,
                    name: "Economic Growth",
                    slug: "economic-growth",
                    isTopic: true,
                    isSearchable: true,
                    weight: 0,
                    path: [0, 1, 2],
                    children: [],
                },
            ],
        },
    ],
}

type Request = Record<string, unknown>

/**
 * A fake Algolia that answers every search with one hit, except queries
 * containing "nothing", which only match with removeWordsIfNoResults (so
 * the closest-matches fallback runs).
 */
function recordingClient(): { client: LiteClient; requests: Request[] } {
    const requests: Request[] = []
    const answer = (request: Request): Record<string, unknown> => {
        const relaxed = request.removeWordsIfNoResults === "allOptional"
        const empty = String(request.query).includes("nothing") && !relaxed
        const hits = empty
            ? []
            : [
                  {
                      objectID: "1",
                      slug: "economic-growth",
                      title: "Economic growth",
                      tags: ["Economic Growth"],
                      _highlightResult: {
                          title: { value: "<mark>Economic</mark> growth" },
                      },
                      ...(relaxed && { _rankingInfo: { words: 2 } }),
                  },
              ]
        return { hits, nbHits: hits.length, page: 0, nbPages: 1 }
    }
    const client = {
        searchForHits: vi.fn(async (searchRequests: Request[]) => {
            requests.push(...searchRequests)
            return { results: searchRequests.map(answer) }
        }),
    } as unknown as LiteClient
    return { client, requests }
}

let fakeAlgolia = recordingClient()
vi.mock(import("./algoliaClient.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    createSearchClient: () => fakeAlgolia.client,
}))

const env = {
    ALGOLIA_ID: "test-app-id",
    ALGOLIA_SEARCH_KEY: "test-api-key",
    ASSETS: {
        fetch: async () => new Response(JSON.stringify(tagGraph)),
    },
} as unknown as Env

const callEndpoint = (params: URLSearchParams): Promise<Response> =>
    onRequestGet({
        request: new Request(`http://localhost/api/search?${params}`),
        env,
    } as unknown as Parameters<typeof onRequestGet>[0]) as Promise<Response>

const state = (
    query: string,
    filters: { type: FilterType; name: string }[] = [],
    requireAllCountries = false
): SearchRequest["state"] => ({
    query,
    filters,
    requireAllCountries,
})

const SEARCH_PAGE_REQUESTS: [string, SearchRequest][] = [
    [
        "charts with every kind of filter, second page",
        {
            type: "charts",
            state: state(
                "gdp per capita",
                [
                    { type: FilterType.COUNTRY, name: "France" },
                    { type: FilterType.COUNTRY, name: "Côte d'Ivoire" },
                    { type: FilterType.TOPIC, name: "Economic Growth" },
                    {
                        type: FilterType.DATASET_PRODUCT,
                        name: "World Development Indicators",
                    },
                    { type: FilterType.DATASET_VERSION, name: "2025-01-01" },
                ],
                true
            ),
            page: 1,
            hitsPerPage: 9,
        },
    ],
    [
        "data insights with a country",
        {
            type: "pages",
            state: state('co₂ & "emissions"', [
                { type: FilterType.COUNTRY, name: "Germany" },
            ]),
            pageTypes: [OwidGdocType.DataInsight],
            offset: 4,
            length: 4,
        },
    ],
    [
        "articles that need closest matches",
        {
            type: "pages",
            state: state("nothing matches growth"),
            pageTypes: DEFAULT_PAGE_TYPES,
            offset: 0,
            length: 4,
        },
    ],
    [
        "topic pages recommended from charts",
        {
            type: "topics",
            state: state("growth"),
            offset: 2,
            length: 6,
        },
    ],
    [
        "profiles for a country",
        {
            type: "profiles",
            state: state("france", [
                { type: FilterType.COUNTRY, name: "France" },
            ]),
            offset: 0,
            length: 2,
        },
    ],
]

describe("the search page's searches through /api/search", () => {
    beforeEach(() => {
        fakeAlgolia = recordingClient()
    })

    it.each(SEARCH_PAGE_REQUESTS)(
        "answers %s as the browser would",
        async (_name, searchRequest) => {
            const browser = recordingClient()
            const browserResult = await runSearchRequest<{ slug: string }>(
                browser.client,
                searchRequest,
                {
                    indexNames: getSearchIndexNames(undefined),
                    loadTagGraph: async () => tagGraph,
                }
            )

            const params = searchRequestToUrlParams(searchRequest)
            params.set("highlights", "true")
            const response = await callEndpoint(params)

            expect(response.status).toBe(200)
            expect(fakeAlgolia.requests).toEqual(browser.requests)
            // The page gets the browser's hits, with their URL added
            const pageResult = fromSearchApiResponse(
                await response.json<SearchApiHitsResponse<{ slug: string }>>()
            )
            expect(pageResult).toEqual({
                hits: browserResult.hits.map((hit) => ({
                    ...hit,
                    url: expect.any(String),
                })),
                nbHits: browserResult.nbHits,
                // Charts page by page, the rest by offset
                ...(searchRequest.type === "charts"
                    ? {
                          page: browserResult.page,
                          nbPages: browserResult.nbPages,
                          hitsPerPage: searchRequest.hitsPerPage,
                      }
                    : {
                          page: undefined,
                          nbPages: undefined,
                          hitsPerPage: undefined,
                      }),
                closestMatches: browserResult.closestMatches,
            })
        }
    )

    it.each([
        ["an unknown type", "type=everything&q=gdp"],
        ["a negative offset", "type=pages&q=gdp&offset=-1"],
        ["a non-numeric page", "type=charts&q=gdp&page=two"],
        ["too many hits", "type=pages&q=gdp&length=500"],
        ["an oversized query", `type=charts&q=${"a".repeat(513)}`],
        [
            "too many filters",
            `q=gdp&countries=${Array.from({ length: 51 }, (_, i) => `C${i}`).join("~")}`,
        ],
    ])("rejects %s", async (_name, query) => {
        const response = await callEndpoint(new URLSearchParams(query))

        expect(response.status).toBe(400)
        expect(fakeAlgolia.requests).toEqual([])
    })

    it("passes on Algolia refusing a request as a 400", async () => {
        const refusal = Object.assign(new Error("Too many words"), {
            status: 400,
        })
        fakeAlgolia.client.searchForHits = vi.fn().mockRejectedValue(refusal)

        const response = await callEndpoint(
            new URLSearchParams("type=charts&q=gdp")
        )

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({ error: "Too many words" })
    })
})
