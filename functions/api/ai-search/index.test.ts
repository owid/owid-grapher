import { describe, it, expect, vi, beforeEach } from "vitest"
import { onRequestGet } from "./index.js"
import type { Env } from "../../_common/env.js"

describe("AI Search API endpoint", () => {
    const mockAutorag = {
        search: vi.fn(),
    }

    const mockEnv: Env = {
        AI: {
            autorag: vi.fn().mockReturnValue(mockAutorag),
        },
    } as unknown as Env

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe("basic functionality", () => {
        it("calls AI Search with default query when no q param provided", async () => {
            mockAutorag.search.mockResolvedValue({
                data: [],
                has_more: false,
            })

            const request = new Request("http://localhost/api/ai-search")
            await onRequestGet({ request, env: mockEnv } as any)

            expect(mockEnv.AI.autorag).toHaveBeenCalledWith("owid-ai-search")
            // fetchSize = max(10, min(10 + 10, 50)) = 20
            expect(mockAutorag.search).toHaveBeenCalledWith({
                query: "population",
                max_num_results: 20,
            })
        })

        it("uses provided query parameter", async () => {
            mockAutorag.search.mockResolvedValue({
                data: [],
                has_more: false,
            })

            const request = new Request(
                "http://localhost/api/ai-search?q=climate"
            )
            await onRequestGet({ request, env: mockEnv } as any)

            // fetchSize = max(10, min(10 + 10, 50)) = 20
            expect(mockAutorag.search).toHaveBeenCalledWith({
                query: "climate",
                max_num_results: 20,
            })
        })

        it("respects hitsPerPage parameter up to max of 50", async () => {
            mockAutorag.search.mockResolvedValue({
                data: [],
                has_more: false,
            })

            const request = new Request(
                "http://localhost/api/ai-search?q=test&hitsPerPage=25"
            )
            await onRequestGet({ request, env: mockEnv } as any)

            // fetchSize = max(25, min(25 + 10, 50)) = 35
            expect(mockAutorag.search).toHaveBeenCalledWith({
                query: "test",
                max_num_results: 35,
            })
        })

        it("caps hitsPerPage at 50", async () => {
            mockAutorag.search.mockResolvedValue({
                data: [],
                has_more: false,
            })

            const request = new Request(
                "http://localhost/api/ai-search?q=test&hitsPerPage=100"
            )
            await onRequestGet({ request, env: mockEnv } as any)

            expect(mockAutorag.search).toHaveBeenCalledWith({
                query: "test",
                max_num_results: 50,
            })
        })
    })

    describe("response format", () => {
        it("returns successful response with Algolia-like format", async () => {
            mockAutorag.search.mockResolvedValue({
                data: [
                    {
                        filename: "charts/population.md",
                        score: 0.9,
                        attributes: {
                            folder: "charts/",
                            filename: "population.md",
                            file: { type: "chart" },
                        },
                        content: [
                            {
                                text: "# Population\n\nWorld population over time.\n\n## Topics\nDemographics",
                            },
                        ],
                    },
                ],
                has_more: false,
            })

            const request = new Request(
                "http://localhost/api/ai-search?q=population"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(200)
            expect(response.headers.get("Content-Type")).toBe("application/json")
            expect(response.headers.get("Cache-Control")).toBe(
                "public, max-age=60"
            )

            const body = (await response.json()) as {
                query: string
                hits: Array<{
                    objectID: string
                    title: string
                    slug: string
                    subtitle: string
                    type: string
                    url: string
                    aiSearchScore: number
                    score: number
                    views_7d?: number
                    fmRank?: number
                }>
                nbHits: number
                hitsPerPage: number
            }
            expect(body.query).toBe("population")
            expect(body.hits).toHaveLength(1)
            expect(body.hits[0].objectID).toBe("population")
            expect(body.hits[0].title).toBe("Population")
            expect(body.hits[0].slug).toBe("population")
            expect(body.hits[0].subtitle).toBe("World population over time.")
            expect(body.hits[0].type).toBe("chart")
            expect(body.hits[0].url).toBe("http://localhost/grapher/population")
            expect(body.hits[0].aiSearchScore).toBe(0.9)
            // Combined score: 0.9 (no FM boost, no views boost)
            expect(body.hits[0].score).toBe(0.9)
            expect(body.nbHits).toBe(1)
            expect(body.hitsPerPage).toBe(10)
        })

it("parses metadata from R2 chartdata field including fmRank and all views fields", async () => {
            const chartdata = JSON.stringify({
                type: "chart",
                slug: "world-population",
                variantName: "UN estimates",
                availableTabs: ["chart", "map", "table"],
                queryParams: "",
                publishedAt: "2020-01-01",
                updatedAt: "2024-01-01",
                views_7d: 5000,
                views_14d: 9500,
                views_365d: 180000,
                fmRank: 2,
            })

            mockAutorag.search.mockResolvedValue({
                data: [
                    {
                        filename: "charts/world-population.md",
                        score: 0.85,
                        attributes: {
                            folder: "charts/",
                            filename: "world-population.md",
                            file: { chartdata },
                        },
                        content: [
                            {
                                text: "# World Population\n\nGlobal population growth.\n\n## Topics\nDemographics",
                            },
                        ],
                    },
                ],
                has_more: false,
            })

            const request = new Request(
                "http://localhost/api/ai-search?q=world+population"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(200)
            const body = (await response.json()) as {
                hits: Array<{
                    slug: string
                    views_7d: number
                    views_14d: number
                    views_365d: number
                    fmRank: number
                    aiSearchScore: number
                    score: number
                    variantName: string
                }>
            }

            expect(body.hits).toHaveLength(1)
            expect(body.hits[0].slug).toBe("world-population")
            expect(body.hits[0].views_7d).toBe(5000)
            expect(body.hits[0].views_14d).toBe(9500)
            expect(body.hits[0].views_365d).toBe(180000)
            expect(body.hits[0].fmRank).toBe(2)
            expect(body.hits[0].variantName).toBe("UN estimates")
            expect(body.hits[0].aiSearchScore).toBe(0.85)
            // Combined score: 0.85 + 0.09 (fmRank 2 boost) + 0.01 * log10(5001)
            expect(body.hits[0].score).toBeCloseTo(0.85 + 0.09 + 0.01 * Math.log10(5001), 2)
        })

        it("returns error response when AI Search fails", async () => {
            mockAutorag.search.mockRejectedValue(new Error("AI Search unavailable"))

            const request = new Request(
                "http://localhost/api/ai-search?q=test"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(500)
            const body = (await response.json()) as {
                error: string
                message: string
            }
            expect(body.error).toBe("AI Search failed")
            expect(body.message).toBe("AI Search unavailable")
        })
    })
})
