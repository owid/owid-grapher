import { describe, it, expect, vi, beforeEach, assert } from "vitest"
import { onRequestGet } from "./index.js"
import * as searchApi from "./searchApi.js"
import type { Env } from "../../_common/env.js"
import { DEFAULT_PAGE_TYPES } from "@ourworldindata/utils"

// Mock the searchApi module
vi.mock(import("./searchApi.js"), async (importOriginal) => {
    const actual = await importOriginal()
    return {
        ...actual,
        searchCharts: vi.fn(),
        searchPages: vi.fn(),
        searchTopicPages: vi.fn(),
        searchProfiles: vi.fn(),
    }
})

// A text search without filters
const textSearch = (query: string) => ({
    query,
    filters: [],
    requireAllCountries: false,
})

describe("Search API endpoint", () => {
    const mockEnv: Env = {
        ALGOLIA_ID: "test-app-id",
        ALGOLIA_SEARCH_KEY: "test-api-key",
    } as Env

    // The edge cache searches without a query go through
    const mockCache = { match: vi.fn(), put: vi.fn() }
    const waitUntil = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockCache.match.mockResolvedValue(undefined)
        mockCache.put.mockResolvedValue(undefined)
        vi.stubGlobal("caches", { default: mockCache })
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
            await onRequestGet({ request, env: mockEnv, waitUntil } as any)

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
            await onRequestGet({ request, env: mockEnv, waitUntil } as any)

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
            await onRequestGet({ request, env: mockEnv, waitUntil } as any)

            expect(mockSearchPages).toHaveBeenCalled()
        })

        it("rejects invalid type parameter", async () => {
            const request = new Request(
                "http://localhost/api/search?q=test&type=invalid"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
                waitUntil,
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
            await onRequestGet({ request, env: mockEnv, waitUntil } as any)

            expect(mockSearchPages).toHaveBeenCalledWith(
                expect.anything(),
                textSearch("test"),
                20, // page 2 * hitsPerPage 10 = offset 20
                10,
                DEFAULT_PAGE_TYPES,
                "http://localhost",
                { highlights: false }
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
            await onRequestGet({ request, env: mockEnv, waitUntil } as any)

            expect(mockSearchPages).toHaveBeenCalledWith(
                expect.anything(),
                textSearch("climate"),
                0, // default page 0
                20, // default hitsPerPage 20
                DEFAULT_PAGE_TYPES,
                "http://localhost",
                { highlights: false }
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
            await onRequestGet({ request, env: mockEnv, waitUntil } as any)

            expect(mockSearchPages).toHaveBeenCalledWith(
                expect.anything(),
                textSearch("malaria"),
                0,
                20,
                ["data-insight"],
                "http://localhost",
                { highlights: false }
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
            await onRequestGet({ request, env: mockEnv, waitUntil } as any)

            expect(mockSearchPages).toHaveBeenCalledWith(
                expect.anything(),
                textSearch("malaria"),
                0,
                20,
                ["article", "about-page"],
                "http://localhost",
                { highlights: false }
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
                waitUntil,
            } as any)

            expect(response.status).toBe(400)
            const body = await response.json()
            assert(typeof body === "object" && body !== null && "error" in body)
            expect(body.error).toContain("bogus-type")
            expect(mockSearchPages).not.toHaveBeenCalled()
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
                waitUntil,
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
                waitUntil,
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
                waitUntil,
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

        it("warns when type=pages is sent a filter pages can't honor", async () => {
            vi.spyOn(searchApi, "searchPages").mockResolvedValue({
                query: "vaccines",
                results: [],
                nbHits: 0,
                offset: 0,
                length: 20,
            })

            // Pages aren't tagged with countries, so "all of them" means nothing
            const request = new Request(
                "http://localhost/api/search?q=vaccines&type=pages&countries=France~Spain&requireAllCountries=true"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
                waitUntil,
            } as any)

            const body = await response.json()
            assert(
                typeof body === "object" && body !== null && "warnings" in body
            )
            expect(body.warnings).toEqual([
                'Ignored parameter "requireAllCountries": it applies only to type=charts, type=topics and type=profiles.',
            ])
        })

        it("filters type=pages by topic and country, as the search page does", async () => {
            const mockSearchPages = vi
                .spyOn(searchApi, "searchPages")
                .mockResolvedValue({
                    query: "vaccines",
                    results: [],
                    nbHits: 0,
                    offset: 0,
                    length: 20,
                })

            const request = new Request(
                "http://localhost/api/search?q=vaccines&type=pages&topics=Vaccination~Health&countries=France"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
                waitUntil,
            } as any)

            expect(await response.json()).not.toHaveProperty("warnings")
            expect(mockSearchPages).toHaveBeenCalledWith(
                expect.anything(),
                {
                    query: "vaccines",
                    filters: [
                        { type: "topic", name: "Vaccination" },
                        { type: "topic", name: "Health" },
                        { type: "country", name: "France" },
                    ],
                    requireAllCountries: false,
                },
                0,
                20,
                DEFAULT_PAGE_TYPES,
                "http://localhost",
                { highlights: false }
            )
        })

        it("takes offset and length over page and hitsPerPage, and passes highlights on", async () => {
            const mockSearchProfiles = vi
                .spyOn(searchApi, "searchProfiles")
                .mockResolvedValue({
                    query: "france",
                    results: [],
                    nbHits: 0,
                    offset: 2,
                    length: 6,
                })

            const request = new Request(
                "http://localhost/api/search?q=france&type=profiles&page=3&offset=2&length=6&highlights=true"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
                waitUntil,
            } as any)

            expect(response.status).toBe(200)
            expect(mockSearchProfiles).toHaveBeenCalledWith(
                expect.anything(),
                textSearch("france"),
                2,
                6,
                "http://localhost",
                { highlights: true }
            )
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
                waitUntil,
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
                    waitUntil,
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
                waitUntil,
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
            await onRequestGet({
                request,
                env: envWithAssets,
                waitUntil,
            } as any)

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
                "http://localhost",
                { highlights: false }
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
            await onRequestGet({
                request,
                env: envWithAssets,
                waitUntil,
            } as any)

            expect(mockSearchPages).toHaveBeenCalledWith(
                expect.anything(),
                textSearch("gdp"),
                0,
                20,
                ["topic-page"],
                "http://localhost",
                { highlights: false }
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
                waitUntil,
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
                waitUntil,
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
                waitUntil,
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
                waitUntil,
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
                waitUntil,
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
                waitUntil,
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
                waitUntil,
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
                waitUntil,
            } as any)

            expect(response.status).toBe(400)
            expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
                "*"
            )
        })
    })

    describe("edge cache", () => {
        const chartsResponse = {
            query: "",
            results: [],
            nbHits: 0,
            page: 0,
            nbPages: 0,
            hitsPerPage: 20,
        }

        it("caches a search without a query for a day", async () => {
            vi.spyOn(searchApi, "searchCharts").mockResolvedValue(
                chartsResponse
            )
            const url = "http://localhost/api/search?topics=Energy"
            const response = await onRequestGet({
                request: new Request(url),
                env: mockEnv,
                waitUntil,
            } as any)

            expect(response.headers.get("Cache-Control")).toBe(
                "public, max-age=86400"
            )
            expect(mockCache.put).toHaveBeenCalledWith(
                url,
                expect.any(Response)
            )
        })

        it("serves a cached search without a query without searching", async () => {
            const searchCharts = vi.spyOn(searchApi, "searchCharts")
            mockCache.match.mockResolvedValue(
                new Response(JSON.stringify(chartsResponse))
            )
            const response = await onRequestGet({
                request: new Request(
                    "http://localhost/api/search?topics=Energy"
                ),
                env: mockEnv,
                waitUntil,
            } as any)

            expect(await response.json()).toEqual(chartsResponse)
            expect(searchCharts).not.toHaveBeenCalled()
        })

        // So that Algolia's analytics see every search readers type
        it("leaves a search with a query to the browser cache", async () => {
            vi.spyOn(searchApi, "searchCharts").mockResolvedValue({
                ...chartsResponse,
                query: "gdp",
            })
            const response = await onRequestGet({
                request: new Request("http://localhost/api/search?q=gdp"),
                env: mockEnv,
                waitUntil,
            } as any)

            expect(response.headers.get("Cache-Control")).toBe(
                "public, max-age=600"
            )
            expect(mockCache.match).not.toHaveBeenCalled()
            expect(mockCache.put).not.toHaveBeenCalled()
        })
    })
})
