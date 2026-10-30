import { describe, it, expect, vi, beforeEach, afterEach, assert } from "vitest"
import { onRequestGet } from "./index.js"
import * as searchApi from "./searchApi.js"
import * as algoliaClient from "./algoliaClient.js"
import type { Env } from "../../_common/env.js"

// Mock the searchApi module
vi.mock(import("./searchApi.js"), async (importOriginal) => {
    const actual = await importOriginal()
    return {
        ...actual,
        searchCharts: vi.fn(),
        searchPages: vi.fn(),
        searchTopicPages: vi.fn(),
    }
})

vi.mock(import("./algoliaClient.js"), async (importOriginal) => {
    const actual = await importOriginal()
    return { ...actual, createSearchClient: vi.fn() }
})

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
            const body = await response.json()
            assert(typeof body === "object" && body !== null && "error" in body)
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
                "http://localhost",
                []
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
                "http://localhost",
                []
            )
        })
    })

    describe("pageTypes parameter", () => {
        it("passes a single pageTypes value through to searchPages", async () => {
            const mockSearchPages = vi
                .spyOn(searchApi, "searchPages")
                .mockResolvedValue({
                    query: "malaria",
                    results: [],
                    nbHits: 0,
                    offset: 0,
                    length: 20,
                })

            const request = new Request(
                "http://localhost/api/search?q=malaria&type=pages&pageTypes=data-insight"
            )
            await onRequestGet({ request, env: mockEnv } as any)

            expect(mockSearchPages).toHaveBeenCalledWith(
                expect.anything(),
                "malaria",
                0,
                20,
                ["data-insight"],
                "http://localhost",
                []
            )
        })

        it("parses and trims a comma-separated pageTypes list", async () => {
            const mockSearchPages = vi
                .spyOn(searchApi, "searchPages")
                .mockResolvedValue({
                    query: "malaria",
                    results: [],
                    nbHits: 0,
                    offset: 0,
                    length: 20,
                })

            const request = new Request(
                "http://localhost/api/search?q=malaria&type=pages&pageTypes=article,%20about-page"
            )
            await onRequestGet({ request, env: mockEnv } as any)

            expect(mockSearchPages).toHaveBeenCalledWith(
                expect.anything(),
                "malaria",
                0,
                20,
                ["article", "about-page"],
                "http://localhost",
                []
            )
        })

        it("rejects an unknown pageTypes value without calling searchPages", async () => {
            const mockSearchPages = vi.spyOn(searchApi, "searchPages")

            const request = new Request(
                "http://localhost/api/search?q=malaria&type=pages&pageTypes=bogus-type"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(400)
            const body = await response.json()
            assert(typeof body === "object" && body !== null && "error" in body)
            expect(body.error).toContain("bogus-type")
            expect(mockSearchPages).not.toHaveBeenCalled()
        })
    })

    describe("restrictSearchableAttributes parameter", () => {
        afterEach(() => {
            vi.mocked(searchApi.searchPages).mockReset()
            vi.mocked(algoliaClient.createSearchClient).mockReset()
        })

        // Runs the real searchPages against a fake Algolia client that
        // finds nothing, so both the main request and the closest-matches
        // fallback request are recorded.
        const algoliaRequestsFor = async (
            qs: string
        ): Promise<Record<string, unknown>[]> => {
            const actual =
                await vi.importActual<typeof searchApi>("./searchApi.js")
            vi.mocked(searchApi.searchPages).mockImplementation(
                actual.searchPages
            )
            const searchForHits = vi.fn().mockResolvedValue({
                results: [{ hits: [], nbHits: 0 }],
            })
            vi.mocked(algoliaClient.createSearchClient).mockReturnValue({
                searchForHits,
            } as any)

            const request = new Request(`http://localhost/api/search?${qs}`)
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)
            expect(response.status).toBe(200)
            return searchForHits.mock.calls.map(([requests]) => requests[0])
        }

        it("restricts both the main and the closest-matches request", async () => {
            const requests = await algoliaRequestsFor(
                "q=malaria&type=pages&pageTypes=featured-viz&restrictSearchableAttributes=title,%20excerpt"
            )

            expect(requests).toHaveLength(2)
            expect(requests[1]).toHaveProperty(
                "removeWordsIfNoResults",
                "allOptional"
            )
            for (const algoliaRequest of requests)
                expect(algoliaRequest).toHaveProperty(
                    "restrictSearchableAttributes",
                    ["title", "excerpt"]
                )
        })

        it("sends no restriction when the parameter is absent or empty", async () => {
            for (const qs of [
                "q=malaria&type=pages",
                "q=malaria&type=pages&restrictSearchableAttributes=",
            ]) {
                const requests = await algoliaRequestsFor(qs)
                expect(requests).toHaveLength(2)
                for (const algoliaRequest of requests)
                    expect(algoliaRequest).not.toHaveProperty(
                        "restrictSearchableAttributes"
                    )
            }
        })

        it("rejects an unknown attribute without calling searchPages", async () => {
            const mockSearchPages = vi.spyOn(searchApi, "searchPages")

            const request = new Request(
                "http://localhost/api/search?q=malaria&type=pages&restrictSearchableAttributes=title,slug"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(400)
            const body = await response.json()
            assert(
                typeof body === "object" &&
                    body !== null &&
                    "error" in body &&
                    "details" in body
            )
            expect(body.error).toBe(
                "Invalid restrictSearchableAttributes parameter"
            )
            expect(body.details).toContain('"slug"')
            expect(mockSearchPages).not.toHaveBeenCalled()
        })

        it("warns when sent to type=charts, without validating it", async () => {
            vi.spyOn(searchApi, "searchCharts").mockResolvedValue({
                query: "malaria",
                results: [],
                nbHits: 0,
                page: 0,
                nbPages: 0,
                hitsPerPage: 20,
            })

            const request = new Request(
                "http://localhost/api/search?q=malaria&type=charts&restrictSearchableAttributes=bogus"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(200)
            const body = await response.json()
            assert(
                typeof body === "object" && body !== null && "warnings" in body
            )
            expect(body.warnings).toEqual([
                'Ignored parameter "restrictSearchableAttributes": it applies only to type=pages.',
            ])
        })
    })

    describe("unknown parameters", () => {
        const chartsResponse = {
            query: "deaths",
            results: [],
            nbHits: 0,
            page: 0,
            nbPages: 0,
            hitsPerPage: 20,
        }

        it("ignores the search page's resultType, with a warning and a hint", async () => {
            const mockSearchCharts = vi
                .spyOn(searchApi, "searchCharts")
                .mockResolvedValue(chartsResponse)

            const request = new Request(
                "http://localhost/api/search?q=deaths&resultType=writing"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(200)
            expect(mockSearchCharts).toHaveBeenCalled()
            const body = await response.json()
            assert(
                typeof body === "object" && body !== null && "warnings" in body
            )
            expect(body.warnings).toEqual([
                expect.stringMatching(/"resultType".*type=pages/),
            ])
        })

        it("names a misspelled parameter in a warning", async () => {
            vi.spyOn(searchApi, "searchCharts").mockResolvedValue(
                chartsResponse
            )

            const request = new Request(
                "http://localhost/api/search?q=deaths&topic=Health"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(200)
            const body = await response.json()
            assert(
                typeof body === "object" && body !== null && "warnings" in body
            )
            expect(body.warnings).toEqual([expect.stringContaining('"topic"')])
        })

        it("warns about a parameter the chosen type doesn't use, without validating it", async () => {
            vi.spyOn(searchApi, "searchTopicPages").mockResolvedValue({
                query: "gdp",
                results: [],
                nbHits: 0,
                offset: 0,
                length: 20,
            })

            const request = new Request(
                "http://localhost/api/search?q=gdp&type=topics&pageTypes=bogus"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(200)
            const body = await response.json()
            assert(
                typeof body === "object" && body !== null && "warnings" in body
            )
            expect(body.warnings).toEqual([
                'Ignored parameter "pageTypes": it applies only to type=pages.',
            ])
        })

        it("warns when type=pages is sent a filter only charts and topics read", async () => {
            vi.spyOn(searchApi, "searchPages").mockResolvedValue({
                query: "vaccines",
                results: [],
                nbHits: 0,
                offset: 0,
                length: 20,
            })

            const request = new Request(
                "http://localhost/api/search?q=vaccines&type=pages&pageTypes=topic-page&topics=Health"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            const body = await response.json()
            assert(
                typeof body === "object" && body !== null && "warnings" in body
            )
            expect(body.warnings).toEqual([
                'Ignored parameter "topics": it applies only to type=charts and type=topics.',
            ])
        })

        it("treats a parameter named after an Object property as unknown", async () => {
            vi.spyOn(searchApi, "searchCharts").mockResolvedValue(
                chartsResponse
            )

            const request = new Request(
                "http://localhost/api/search?q=deaths&toString=1&constructor=x"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(200)
            const body = await response.json()
            assert(
                typeof body === "object" && body !== null && "warnings" in body
            )
            expect(body.warnings).toEqual([
                expect.stringMatching(
                    /^Ignored unknown parameter\(s\): "toString", "constructor"\. Valid parameters: [^.]+\.$/
                ),
            ])
        })

        it("warns that type=topics filters by country only with a query", async () => {
            const topicsResponse = {
                query: "",
                results: [],
                nbHits: 0,
                offset: 0,
                length: 20,
            }
            vi.spyOn(searchApi, "searchTopicPages").mockResolvedValue(
                topicsResponse
            )
            const warningsFor = async (qs: string): Promise<unknown> => {
                const response = await onRequestGet({
                    request: new Request(`http://localhost/api/search?${qs}`),
                    env: mockEnv,
                } as any)
                const body = await response.json()
                assert(typeof body === "object" && body !== null)
                return "warnings" in body ? body.warnings : undefined
            }

            expect(
                await warningsFor(
                    "type=topics&countries=France&requireAllCountries=true&topics=Health"
                )
            ).toEqual([
                'Ignored parameter "countries": type=topics filters by country only when charts match a query.',
                'Ignored parameter "requireAllCountries": type=topics filters by country only when charts match a query.',
            ])
            expect(
                await warningsFor("type=topics&q=gdp&countries=France")
            ).toBeUndefined()
        })

        it("doesn't warn about a parameter sent without a value", async () => {
            vi.spyOn(searchApi, "searchPages").mockResolvedValue({
                query: "gdp",
                results: [],
                nbHits: 0,
                offset: 0,
                length: 20,
            })

            const response = await onRequestGet({
                request: new Request(
                    "http://localhost/api/search?q=gdp&type=pages&topics=&countries="
                ),
                env: mockEnv,
            } as any)

            const body = await response.json()
            assert(typeof body === "object" && body !== null)
            expect(body).not.toHaveProperty("warnings")
        })

        it("accepts utm_* tags without a warning", async () => {
            vi.spyOn(searchApi, "searchCharts").mockResolvedValue(
                chartsResponse
            )

            const request = new Request(
                "http://localhost/api/search?q=deaths&utm_source=owid-skills"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(200)
            const body = await response.json()
            assert(typeof body === "object" && body !== null)
            expect(body).not.toHaveProperty("warnings")
        })
    })

    describe("topic page recommendations", () => {
        const tagGraph = { name: "tag-graph-root", children: [] }
        const envWithAssets = {
            ...mockEnv,
            ASSETS: {
                fetch: vi
                    .fn()
                    .mockResolvedValue(new Response(JSON.stringify(tagGraph))),
            },
        } as unknown as Env
        const emptyPagesResponse = {
            query: "gdp",
            results: [],
            nbHits: 0,
            offset: 0,
            length: 20,
        }

        it("answers type=topics from the matching charts, with the filters", async () => {
            const mockSearchTopicPages = vi
                .spyOn(searchApi, "searchTopicPages")
                .mockResolvedValue(emptyPagesResponse)
            const mockSearchPages = vi.spyOn(searchApi, "searchPages")

            const request = new Request(
                "http://localhost/api/search?q=gdp&type=topics&countries=France"
            )
            await onRequestGet({ request, env: envWithAssets } as any)

            expect(mockSearchTopicPages).toHaveBeenCalledWith(
                expect.anything(),
                {
                    query: "gdp",
                    filters: [{ type: "country", name: "France" }],
                    requireAllCountries: false,
                },
                expect.any(Function),
                0,
                20,
                "http://localhost"
            )
            expect(mockSearchPages).not.toHaveBeenCalled()

            const loadTagGraph = mockSearchTopicPages.mock.calls[0][2]
            expect(await loadTagGraph()).toEqual(tagGraph)
            expect(
                (envWithAssets.ASSETS.fetch as any).mock.calls[0][0].toString()
            ).toBe("http://localhost/topicTagGraph.json")
        })

        it("leaves type=pages a text search over exactly the requested page types", async () => {
            const mockSearchTopicPages = vi.spyOn(searchApi, "searchTopicPages")
            const mockSearchPages = vi
                .spyOn(searchApi, "searchPages")
                .mockResolvedValue(emptyPagesResponse)

            const request = new Request(
                "http://localhost/api/search?q=gdp&type=pages&pageTypes=topic-page"
            )
            await onRequestGet({ request, env: envWithAssets } as any)

            expect(mockSearchPages).toHaveBeenCalledWith(
                expect.anything(),
                "gdp",
                0,
                20,
                ["topic-page"],
                "http://localhost",
                []
            )
            expect(mockSearchTopicPages).not.toHaveBeenCalled()
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
            const body = await response.json()
            assert(typeof body === "object" && body !== null && "error" in body)
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
            const body = await response.json()
            assert(typeof body === "object" && body !== null && "error" in body)
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
            const body = await response.json()
            assert(typeof body === "object" && body !== null && "error" in body)
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
            const body = await response.json()
            assert(typeof body === "object" && body !== null && "error" in body)
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
            const body = await response.json()
            assert(typeof body === "object" && body !== null && "error" in body)
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
