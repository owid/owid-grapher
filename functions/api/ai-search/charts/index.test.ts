import { describe, it, expect, vi, beforeEach } from "vitest"
import { onRequestGet } from "./index.js"
import type { Env } from "../../../_common/env.js"

describe("AI Search Charts API endpoint", () => {
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
        it("calls AI Search with empty query when no q param provided", async () => {
            mockAutorag.search.mockResolvedValue({
                data: [],
                has_more: false,
            })

            const request = new Request(
                "http://localhost/api/ai-search/charts"
            )
            await onRequestGet({ request, env: mockEnv } as any)

            expect(mockEnv.AI.autorag).toHaveBeenCalledWith("owid-ai-search")
            // Default hitsPerPage=20, fetchSize = max(20, min(20 + 10, 50)) = 30
            expect(mockAutorag.search).toHaveBeenCalledWith({
                query: "",
                max_num_results: 30,
                ranking_options: { score_threshold: 0.1 },
            })
        })

        it("uses provided query parameter", async () => {
            mockAutorag.search.mockResolvedValue({
                data: [],
                has_more: false,
            })

            const request = new Request(
                "http://localhost/api/ai-search/charts?q=climate"
            )
            await onRequestGet({ request, env: mockEnv } as any)

            // Default hitsPerPage=20, fetchSize = max(20, min(20 + 10, 50)) = 30
            expect(mockAutorag.search).toHaveBeenCalledWith({
                query: "climate",
                max_num_results: 30,
                ranking_options: { score_threshold: 0.1 },
            })
        })

        it("respects hitsPerPage parameter", async () => {
            mockAutorag.search.mockResolvedValue({
                data: [],
                has_more: false,
            })

            const request = new Request(
                "http://localhost/api/ai-search/charts?q=test&hitsPerPage=25"
            )
            await onRequestGet({ request, env: mockEnv } as any)

            // fetchSize = max(25, min(25 + 10, 50)) = 35
            expect(mockAutorag.search).toHaveBeenCalledWith({
                query: "test",
                max_num_results: 35,
                ranking_options: { score_threshold: 0.1 },
            })
        })

        it("caps fetchSize at 50", async () => {
            mockAutorag.search.mockResolvedValue({
                data: [],
                has_more: false,
            })

            const request = new Request(
                "http://localhost/api/ai-search/charts?q=test&hitsPerPage=45"
            )
            await onRequestGet({ request, env: mockEnv } as any)

            // fetchSize = max(45, min(45 + 10, 50)) = 50
            expect(mockAutorag.search).toHaveBeenCalledWith({
                query: "test",
                max_num_results: 50,
                ranking_options: { score_threshold: 0.1 },
            })
        })

        it("returns 400 for hitsPerPage > 100", async () => {
            const request = new Request(
                "http://localhost/api/ai-search/charts?q=test&hitsPerPage=150"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(400)
            const body = (await response.json()) as { error: string }
            expect(body.error).toBe("Invalid hitsPerPage parameter")
        })

        it("returns 400 for page > 0 (pagination not supported yet)", async () => {
            const request = new Request(
                "http://localhost/api/ai-search/charts?q=test&page=1"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(400)
            const body = (await response.json()) as { error: string }
            expect(body.error).toBe("Pagination not yet supported")
        })
    })

    describe("response format", () => {
        it("returns successful response with search API format", async () => {
            mockAutorag.search.mockResolvedValue({
                data: [
                    {
                        file_id: "abc123",
                        filename: "charts/population.md",
                        score: 0.9,
                        attributes: {
                            folder: "charts/",
                            filename: "population.md",
                            file: { type: "chart" },
                        },
                        content: [
                            {
                                type: "text",
                                text: "# Population\n\nWorld population over time.\n\n## Topics\nDemographics",
                            },
                        ],
                    },
                ],
                has_more: false,
            })

            const request = new Request(
                "http://localhost/api/ai-search/charts?q=population&hitsPerPage=10"
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
            expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")

            const body = (await response.json()) as {
                query: string
                hits: Array<{
                    objectID: string
                    title: string
                    slug: string
                    subtitle: string
                    type: string
                    url: string
                    __position: number
                    aiSearchScore: number
                    score: number
                }>
                nbHits: number
                page: number
                nbPages: number
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
            expect(body.hits[0].__position).toBe(1)
            expect(body.hits[0].aiSearchScore).toBe(0.9)
            expect(body.hits[0].score).toBe(0.9)
            expect(body.nbHits).toBe(1)
            expect(body.page).toBe(0)
            expect(body.nbPages).toBe(1)
            expect(body.hitsPerPage).toBe(10)
        })

        it("parses metadata from R2 chartdata field including fmRank and all views fields", async () => {
            // chartdata is Base64-encoded JSON
            const chartdata = btoa(
                JSON.stringify({
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
            )

            mockAutorag.search.mockResolvedValue({
                data: [
                    {
                        file_id: "def456",
                        filename: "charts/world-population.md",
                        score: 0.85,
                        attributes: {
                            folder: "charts/",
                            filename: "world-population.md",
                            file: { chartdata },
                        },
                        content: [
                            {
                                type: "text",
                                text: "# World Population\n\nGlobal population growth.\n\n## Topics\nDemographics",
                            },
                        ],
                    },
                ],
                has_more: false,
            })

            const request = new Request(
                "http://localhost/api/ai-search/charts?q=world+population&hitsPerPage=10&verbose=true"
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
                    availableEntities: string[]
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
            // Combined score: 0.85 + 0.27 (fmRank 2 boost) + 0.01 * log10(5001)
            expect(body.hits[0].score).toBeCloseTo(
                0.85 + 0.27 + 0.01 * Math.log10(5001),
                2
            )
            // verbose=true should include availableEntities
            expect(body.hits[0].availableEntities).toEqual([])
        })

        it("strips verbose fields by default", async () => {
            // chartdata is Base64-encoded JSON
            const chartdata = btoa(
                JSON.stringify({
                    type: "chart",
                    views_7d: 1000,
                })
            )

            mockAutorag.search.mockResolvedValue({
                data: [
                    {
                        file_id: "ghi789",
                        filename: "charts/test.md",
                        score: 0.8,
                        attributes: {
                            file: { chartdata },
                        },
                        content: [{ type: "text", text: "# Test\n\nTest chart." }],
                    },
                ],
                has_more: false,
            })

            const request = new Request(
                "http://localhost/api/ai-search/charts?q=test&hitsPerPage=10"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(200)
            const body = (await response.json()) as {
                hits: Array<Record<string, unknown>>
            }

            // availableEntities should be stripped when verbose=false (default)
            expect(body.hits[0]).not.toHaveProperty("availableEntities")
        })

        it("returns error response when AI Search fails", async () => {
            mockAutorag.search.mockRejectedValue(
                new Error("AI Search unavailable")
            )

            const request = new Request(
                "http://localhost/api/ai-search/charts?q=test"
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

    describe("sorting and scoring", () => {
        it("sorts results by combined score and assigns positions", async () => {
            mockAutorag.search.mockResolvedValue({
                data: [
                    {
                        file_id: "1",
                        filename: "charts/low-score.md",
                        score: 0.5,
                        attributes: { file: {} },
                        content: [{ type: "text", text: "# Low Score\n\nLow." }],
                    },
                    {
                        file_id: "2",
                        filename: "charts/high-score.md",
                        score: 0.9,
                        attributes: { file: {} },
                        content: [{ type: "text", text: "# High Score\n\nHigh." }],
                    },
                    {
                        file_id: "3",
                        filename: "charts/mid-score.md",
                        score: 0.7,
                        attributes: { file: {} },
                        content: [{ type: "text", text: "# Mid Score\n\nMid." }],
                    },
                ],
                has_more: false,
            })

            const request = new Request(
                "http://localhost/api/ai-search/charts?q=test&hitsPerPage=10"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            const body = (await response.json()) as {
                hits: Array<{ slug: string; score: number; __position: number }>
            }

            // Results should be sorted by score descending
            expect(body.hits[0].slug).toBe("high-score")
            expect(body.hits[0].score).toBe(0.9)
            expect(body.hits[0].__position).toBe(1)

            expect(body.hits[1].slug).toBe("mid-score")
            expect(body.hits[1].score).toBe(0.7)
            expect(body.hits[1].__position).toBe(2)

            expect(body.hits[2].slug).toBe("low-score")
            expect(body.hits[2].score).toBe(0.5)
            expect(body.hits[2].__position).toBe(3)
        })

        it("trims results to hitsPerPage after sorting", async () => {
            mockAutorag.search.mockResolvedValue({
                data: [
                    {
                        file_id: "1",
                        filename: "charts/a.md",
                        score: 0.9,
                        attributes: { file: {} },
                        content: [{ type: "text", text: "# A\n\nA." }],
                    },
                    {
                        file_id: "2",
                        filename: "charts/b.md",
                        score: 0.8,
                        attributes: { file: {} },
                        content: [{ type: "text", text: "# B\n\nB." }],
                    },
                    {
                        file_id: "3",
                        filename: "charts/c.md",
                        score: 0.7,
                        attributes: { file: {} },
                        content: [{ type: "text", text: "# C\n\nC." }],
                    },
                ],
                has_more: false,
            })

            const request = new Request(
                "http://localhost/api/ai-search/charts?q=test&hitsPerPage=2"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            const body = (await response.json()) as {
                hits: Array<{ slug: string }>
                nbHits: number
                hitsPerPage: number
            }

            // Should only return top 2 results
            expect(body.hits).toHaveLength(2)
            expect(body.hits[0].slug).toBe("a")
            expect(body.hits[1].slug).toBe("b")
            expect(body.nbHits).toBe(2)
            expect(body.hitsPerPage).toBe(2)
        })
    })
})
