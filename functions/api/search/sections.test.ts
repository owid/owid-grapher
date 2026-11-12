import { describe, it, expect, vi, beforeEach } from "vitest"
import { type LiteClient } from "algoliasearch/lite"
import {
    FilterType,
    TagGraphRoot,
    TagGraphRootName,
} from "@ourworldindata/types"
import {
    searchPageSection,
    searchPageSectionToUrlParams,
    type SearchPageSectionRequest,
} from "@ourworldindata/utils"
import type { Env } from "../../_common/env.js"
import { getSearchIndexNames } from "./algoliaClient.js"
import { onRequestGet } from "./sections.js"

// The search page runs a section either in the browser (searchPageSection
// against Algolia) or through this endpoint. These tests run both against
// the same fake Algolia and check that they send Algolia the same requests
// and return the same response, i.e. that a section's search survives the
// trip through the URL unchanged.

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
        request: new Request(`http://localhost/api/search/sections?${params}`),
        env,
    } as unknown as Parameters<typeof onRequestGet>[0]) as Promise<Response>

const state = (
    query: string,
    filters: { type: FilterType; name: string }[] = [],
    requireAllCountries = false
): SearchPageSectionRequest["state"] => ({
    query,
    filters,
    requireAllCountries,
})

const SECTION_REQUESTS: [string, SearchPageSectionRequest][] = [
    [
        "charts with every kind of filter, second page",
        {
            section: "charts",
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
        },
    ],
    [
        "data insights with a country",
        {
            section: "data-insights",
            state: state('co₂ & "emissions"', [
                { type: FilterType.COUNTRY, name: "Germany" },
            ]),
            page: 0,
            hitsPerPage: 4,
        },
    ],
    [
        "articles that need closest matches",
        {
            section: "articles",
            state: state("nothing matches growth"),
            offset: 0,
            length: 4,
        },
    ],
    [
        "topic pages recommended from charts",
        {
            section: "topic-pages",
            state: state("growth"),
            offset: 2,
            length: 6,
        },
    ],
    [
        "profiles for a country",
        {
            section: "profiles",
            state: state("france", [
                { type: FilterType.COUNTRY, name: "France" },
            ]),
            offset: 0,
            length: 2,
        },
    ],
]

describe("/api/search/sections", () => {
    beforeEach(() => {
        fakeAlgolia = recordingClient()
    })

    it.each(SECTION_REQUESTS)(
        "answers %s as the browser would",
        async (_name, sectionRequest) => {
            const browser = recordingClient()
            const browserResult = await searchPageSection(
                browser.client,
                sectionRequest,
                {
                    indexNames: getSearchIndexNames(undefined),
                    loadTagGraph: async () => tagGraph,
                }
            )

            const response = await callEndpoint(
                searchPageSectionToUrlParams(sectionRequest)
            )

            expect(response.status).toBe(200)
            expect(fakeAlgolia.requests).toEqual(browser.requests)
            expect(await response.json()).toEqual(browserResult)
        }
    )

    it.each([
        ["an unknown section", "section=everything&q=gdp&page=0"],
        ["no pagination", "section=articles&q=gdp"],
        ["a negative page", "section=charts&q=gdp&page=-1"],
        ["too many hits", "section=data-insights&q=gdp&page=0&hitsPerPage=500"],
        ["an oversized query", `section=charts&page=0&q=${"a".repeat(513)}`],
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
            new URLSearchParams("section=charts&q=gdp&page=0")
        )

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({ error: "Too many words" })
    })
})
