import { describe, it, expect, vi, beforeEach } from "vitest"
import { onRequestGet } from "./index.js"
import type { Env } from "../../../_common/env.js"
import { generateText } from "ai"
import { searchChartsMulti } from "../../search/searchApi.js"

// Mock AI SDK modules
vi.mock("@ai-sdk/openai", () => ({
    createOpenAI: vi.fn(() => vi.fn(() => "mock-openai-model")),
}))

vi.mock("@ai-sdk/google", () => ({
    createGoogleGenerativeAI: vi.fn(() => vi.fn(() => "mock-gemini-model")),
}))

vi.mock("ai", () => ({
    generateText: vi.fn(),
    tool: vi.fn((config) => config),
    stepCountIs: vi.fn((n) => n),
}))

vi.mock("../../search/algoliaClient.js", () => ({
    getAlgoliaConfig: vi.fn(() => ({
        appId: "test-app-id",
        searchKey: "test-search-key",
    })),
}))

vi.mock("../../search/searchApi.js", () => ({
    searchChartsMulti: vi.fn(),
}))

describe("AI Search Recommend API endpoint", () => {
    const mockEnv: Env = {
        OPENAI_API_KEY: "test-openai-key",
        GOOGLE_API_KEY: "test-google-key",
        ALGOLIA_ID: "test-algolia-id",
        ALGOLIA_SEARCH_KEY: "test-algolia-key",
        AI: {} as any,
    } as unknown as Env

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe("parameter validation", () => {
        it("returns 400 when query is missing", async () => {
            const request = new Request(
                "http://localhost/api/ai-search/recommend"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(400)
            const body = (await response.json()) as { error: string }
            expect(body.error).toBe("Query required")
        })

        it("returns 400 when query is empty", async () => {
            const request = new Request(
                "http://localhost/api/ai-search/recommend?q="
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(400)
            const body = (await response.json()) as { error: string }
            expect(body.error).toBe("Query required")
        })

        it("returns 400 for invalid query parameters", async () => {
            const request = new Request(
                "http://localhost/api/ai-search/recommend?q=test&invalid_param=value"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(400)
            const body = (await response.json()) as { error: string }
            expect(body.error).toBe("Invalid query parameters")
        })

        it("returns 400 for invalid model", async () => {
            const request = new Request(
                "http://localhost/api/ai-search/recommend?q=test&model=claude"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(400)
            const body = (await response.json()) as { error: string }
            expect(body.error).toBe("Invalid model")
        })
    })

    describe("API key validation", () => {
        it("returns 500 when OpenAI key is missing for OpenAI model", async () => {
            const envWithoutOpenAI = {
                ...mockEnv,
                OPENAI_API_KEY: undefined,
            } as unknown as Env

            const request = new Request(
                "http://localhost/api/ai-search/recommend?q=test&model=openai"
            )
            const response = await onRequestGet({
                request,
                env: envWithoutOpenAI,
            } as any)

            expect(response.status).toBe(500)
            const body = (await response.json()) as { error: string }
            expect(body.error).toBe("Configuration error")
        })

        it("returns 500 when Google key is missing for Gemini model", async () => {
            const envWithoutGoogle = {
                ...mockEnv,
                GOOGLE_API_KEY: undefined,
            } as unknown as Env

            const request = new Request(
                "http://localhost/api/ai-search/recommend?q=test&model=gemini"
            )
            const response = await onRequestGet({
                request,
                env: envWithoutGoogle,
            } as any)

            expect(response.status).toBe(500)
            const body = (await response.json()) as { error: string }
            expect(body.error).toBe("Configuration error")
        })
    })

    describe("model selection", () => {
        beforeEach(() => {
            vi.mocked(generateText).mockResolvedValue({
                text: '["test-slug"]',
                steps: [],
            } as any)
            vi.mocked(searchChartsMulti).mockResolvedValue([
                {
                    query: "test",
                    hits: [
                        {
                            title: "Test Chart",
                            slug: "test-slug",
                            subtitle: "Test subtitle",
                            type: "chart",
                            availableEntities: [],
                            availableTabs: [],
                            url: "http://localhost/grapher/test-slug",
                        },
                    ],
                },
            ] as any)
        })

        it("defaults to gemini model", async () => {
            const request = new Request(
                "http://localhost/api/ai-search/recommend?q=test"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(200)
            const body = (await response.json()) as { model: string }
            expect(body.model).toBe("gemini-2.5-flash-lite")
        })

        it("uses OpenAI when model=openai", async () => {
            const request = new Request(
                "http://localhost/api/ai-search/recommend?q=test&model=openai"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(200)
            const body = (await response.json()) as { model: string }
            expect(body.model).toBe("gpt-5-mini")
        })

        it("resolves gemini aliases correctly", async () => {
            const request = new Request(
                "http://localhost/api/ai-search/recommend?q=test&model=gemini-2.5-flash"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(200)
            const body = (await response.json()) as { model: string }
            expect(body.model).toBe("gemini-2.5-flash")
        })
    })

    describe("response format", () => {
        beforeEach(() => {
            // Mock generateText to simulate tool execution by calling the tool's execute
            vi.mocked(generateText).mockImplementation(async (options: any) => {
                // Simulate calling the search tool
                const searchTool = options.tools?.search
                if (searchTool?.execute) {
                    await searchTool.execute({ searches: ["population"] })
                }
                return {
                    text: '["population-growth", "world-population"]',
                    steps: [
                        {
                            text: "",
                            toolCalls: [
                                {
                                    toolName: "search",
                                    input: { searches: ["population"] },
                                },
                            ],
                        },
                    ],
                }
            })
            vi.mocked(searchChartsMulti).mockResolvedValue([
                {
                    query: "population",
                    hits: [
                        {
                            title: "Population Growth",
                            slug: "population-growth",
                            subtitle: "Annual population growth rate",
                            type: "chart",
                            availableEntities: ["World", "USA"],
                            availableTabs: ["chart", "map"],
                            url: "http://localhost/grapher/population-growth",
                        },
                        {
                            title: "World Population",
                            slug: "world-population",
                            subtitle: "Total world population",
                            type: "chart",
                            availableEntities: ["World"],
                            availableTabs: ["chart"],
                            url: "http://localhost/grapher/world-population",
                        },
                    ],
                },
            ] as any)
        })

        it("returns recommendations in correct format", async () => {
            const request = new Request(
                "http://localhost/api/ai-search/recommend?q=population"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            expect(response.status).toBe(200)
            expect(response.headers.get("Content-Type")).toBe(
                "application/json"
            )
            expect(response.headers.get("Cache-Control")).toBe(
                "public, max-age=300"
            )

            const body = (await response.json()) as {
                query: string
                model: string
                recommendations: Array<{
                    title: string
                    slug: string
                    url: string
                }>
                searchQueries: string[]
                timing: { total_ms: number; agent_ms: number }
            }

            expect(body.query).toBe("population")
            expect(body.recommendations).toHaveLength(2)
            expect(body.recommendations[0].title).toBe("Population Growth")
            expect(body.recommendations[0].slug).toBe("population-growth")
            expect(body.timing).toHaveProperty("total_ms")
            expect(body.timing).toHaveProperty("agent_ms")
        })

        it("strips verbose fields by default", async () => {
            const request = new Request(
                "http://localhost/api/ai-search/recommend?q=population"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            const body = (await response.json()) as {
                recommendations: Array<Record<string, unknown>>
            }

            // Should not include availableEntities, availableTabs, type
            expect(body.recommendations[0]).not.toHaveProperty(
                "availableEntities"
            )
            expect(body.recommendations[0]).not.toHaveProperty("availableTabs")
            expect(body.recommendations[0]).not.toHaveProperty("type")
            // Should include essential fields
            expect(body.recommendations[0]).toHaveProperty("title")
            expect(body.recommendations[0]).toHaveProperty("slug")
            expect(body.recommendations[0]).toHaveProperty("url")
        })

        it("includes all fields when verbose=true", async () => {
            const request = new Request(
                "http://localhost/api/ai-search/recommend?q=population&verbose=true"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            const body = (await response.json()) as {
                recommendations: Array<Record<string, unknown>>
            }

            expect(body.recommendations[0]).toHaveProperty("availableEntities")
            expect(body.recommendations[0]).toHaveProperty("availableTabs")
            expect(body.recommendations[0]).toHaveProperty("type")
        })

        it("includes debug info when debug=true", async () => {
            const request = new Request(
                "http://localhost/api/ai-search/recommend?q=population&debug=true"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            const body = (await response.json()) as {
                debug: { steps: unknown[]; finalText: string }
            }

            expect(body.debug).toBeDefined()
            expect(body.debug.steps).toBeDefined()
            expect(body.debug.finalText).toBeDefined()
        })

        it("respects max_results parameter", async () => {
            const request = new Request(
                "http://localhost/api/ai-search/recommend?q=population&max_results=1"
            )
            const response = await onRequestGet({
                request,
                env: mockEnv,
            } as any)

            const body = (await response.json()) as {
                recommendations: unknown[]
            }

            expect(body.recommendations).toHaveLength(1)
        })
    })

    describe("error handling", () => {
        it("returns 500 when generateText fails", async () => {
            vi.mocked(generateText).mockRejectedValue(new Error("API error"))

            const request = new Request(
                "http://localhost/api/ai-search/recommend?q=test"
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
            expect(body.error).toBe("Recommendation failed")
            expect(body.message).toBe("API error")
        })
    })
})
