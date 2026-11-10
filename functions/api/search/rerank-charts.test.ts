/**
 * /api/search/rerank-charts stands in for the Algolia request the site's
 * charts section would make. The contract: the first RERANK_PAGES pages are
 * cut from one reranked pool, so together with Algolia's later pages they show
 * every hit exactly once; the pool always comes from this deployment's charts
 * index; and requests the site wouldn't send are rejected, so the site falls
 * back to Algolia instead of showing a search that silently differs. With
 * vocab=1, the vocabulary terms' hits join the pool, unless the reader
 * already filtered to a topic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { ChartRecordType } from "@ourworldindata/types"
import * as utils from "@ourworldindata/utils"
import { RERANK_PAGES } from "@ourworldindata/utils"
import { onRequestPost } from "./rerank-charts.js"
import type { Env } from "../../_common/env.js"

vi.mock(import("@ourworldindata/utils"), async (importOriginal) => {
    const actual = await importOriginal()
    return { ...actual, searchSingleForHitsWithClosestMatches: vi.fn() }
})

vi.mock(import("./vocabulary.js"), async (importOriginal) => {
    const actual = await importOriginal()
    return {
        ...actual,
        pickVocabularyTerms: vi.fn(async () => ({
            terms: [{ topic: "Fertility Rate", keyword: "fertility rate" }],
            latencyMs: 5,
        })),
    }
})

const HITS_PER_PAGE = 2
const POOL_SIZE = HITS_PER_PAGE * RERANK_PAGES

const hit = (objectID: string) => ({
    objectID,
    type: ChartRecordType.Chart,
    title: `Title of ${objectID}`,
    subtitle: `Subtitle of ${objectID}`,
})

// The model ranks the pool in reverse: r06 most likely, r01 least
const reverseAi = (): Ai =>
    ({
        run: vi.fn(async () => ({
            answers: {
                best_result: {
                    type: "choice",
                    probabilities: Object.fromEntries(
                        Array.from({ length: POOL_SIZE }, (_, i) => [
                            `r${String(i + 1).padStart(2, "0")}`,
                            (i + 1) / 100,
                        ])
                    ),
                },
                any_relevant: { type: "noul", noul: 0.9 },
            },
        })),
    }) as unknown as Ai

const env = (ai?: Ai): Env =>
    ({
        ALGOLIA_ID: "test-app-id",
        ALGOLIA_SEARCH_KEY: "test-api-key",
        ALGOLIA_INDEX_PREFIX: "staging",
        AI: ai,
    }) as Env

const siteRequest = (overrides: Record<string, unknown> = {}) => ({
    indexName: "whatever-the-client-thinks",
    query: "birth rate",
    facetFilters: [["availableEntities:France"]],
    attributesToRetrieve: ["title", "subtitle", "type"],
    highlightPreTag: "<mark>",
    highlightPostTag: "</mark>",
    hitsPerPage: HITS_PER_PAGE,
    page: 0,
    ...overrides,
})

const post = async (
    body: unknown,
    ai: Ai | null = reverseAi(),
    params = "model=jev"
) => {
    const request = new Request(
        `http://localhost/api/search/rerank-charts?${params}`,
        { method: "POST", body: JSON.stringify(body) }
    )
    const response = await onRequestPost({
        request,
        env: env(ai ?? undefined),
    } as any)
    return { status: response.status, body: (await response.json()) as any }
}

describe("/api/search/rerank-charts", () => {
    const search = vi.mocked(utils.searchSingleForHitsWithClosestMatches)

    beforeEach(() => {
        search.mockReset()
        search.mockResolvedValue({
            hits: Array.from({ length: POOL_SIZE }, (_, i) => hit(`h${i + 1}`)),
            nbHits: 101,
            page: 0,
            nbPages: 17,
            hitsPerPage: POOL_SIZE,
        } as any)
    })

    it("fetches the pool as page 0 of this deployment's charts index", async () => {
        await post(siteRequest({ page: 1 }))

        expect(search).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                indexName: "staging-explorer-views-and-charts",
                query: "birth rate",
                facetFilters: [["availableEntities:France"]],
                page: 0,
                hitsPerPage: POOL_SIZE,
            })
        )
    })

    it("cuts each page from the reranked pool, so the pages show every pool hit once", async () => {
        const pages = []
        for (let page = 0; page < RERANK_PAGES; page++)
            pages.push((await post(siteRequest({ page }))).body)

        expect(
            pages.flatMap((p) => p.hits.map((h: any) => h.objectID))
        ).toEqual(["h6", "h5", "h4", "h3", "h2", "h1"])
        // pagination as the client asked for it, so Algolia's page
        // RERANK_PAGES starts right after the pool
        expect(pages[1]).toMatchObject({
            page: 1,
            hitsPerPage: HITS_PER_PAGE,
            nbHits: 101,
            nbPages: 51,
        })
        expect(pages[0].rerank).toMatchObject({ model: "jev", poolSize: 6 })
    })

    describe("with vocab=1", () => {
        beforeEach(() => {
            search.mockImplementation(async (_client, params: any) =>
                params.query === "fertility rate"
                    ? ({ hits: [hit("h2"), hit("v1")], nbHits: 2 } as any)
                    : ({
                          hits: Array.from({ length: POOL_SIZE }, (_, i) =>
                              hit(`h${i + 1}`)
                          ),
                          nbHits: 101,
                      } as any)
            )
        })

        it("searches each term within its topic and adds the hits the pool lacks", async () => {
            const ai = reverseAi()
            const { body } = await post(
                siteRequest({ hitsPerPage: 7 }),
                ai,
                "model=jev&vocab=1"
            )

            expect(search).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    query: "fertility rate",
                    facetFilters: [
                        ["availableEntities:France"],
                        "tags:Fertility Rate",
                    ],
                })
            )
            expect(body.rerank.poolSize).toBe(POOL_SIZE + 1)
            expect(body.vocabulary.terms).toHaveLength(1)
            // the rerank is told which hit came from the topic search
            const { state } = vi.mocked(ai.run).mock.calls[0][1] as {
                state: string
            }
            expect(state).toContain(
                'Title of v1 — Subtitle of v1 (found by searching the related topic Fertility Rate for "fertility rate"'
            )
            expect(state).toContain("Title of h2 — Subtitle of h2\n")
        })

        it("leaves a search the reader filtered to a topic alone", async () => {
            const { body } = await post(
                siteRequest({ facetFilters: [["tags:Health"]] }),
                reverseAi(),
                "model=jev&vocab=1"
            )

            expect(search).toHaveBeenCalledOnce()
            expect(body.rerank.poolSize).toBe(POOL_SIZE)
            expect(body.vocabulary).toBeUndefined()
        })
    })

    describe("with section=pages", () => {
        const pagesRequest = (overrides: Record<string, unknown> = {}) => ({
            indexName: "pages",
            query: "malaria",
            filters: "type:article OR type:about-page",
            attributesToRetrieve: ["title", "slug", "type", "content"],
            offset: 0,
            length: 4,
            ...overrides,
        })
        const pageHit = (objectID: string) => ({
            objectID,
            type: "article",
            title: `Title of ${objectID}`,
            excerpt: `About ${objectID}`,
        })

        it("reranks Algolia's first 30 hits and leaves the hits after them in Algolia's order", async () => {
            // 34 hits: a section's page that straddles the end of the pool
            search.mockResolvedValue({
                hits: Array.from({ length: 34 }, (_, i) =>
                    pageHit(`p${i + 1}`)
                ),
                nbHits: 80,
            } as any)

            const { body } = await post(
                pagesRequest({ offset: 28, length: 6 }),
                reverseAi(),
                "model=jev&section=pages"
            )

            expect(search).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    indexName: "staging-pages",
                    filters: "type:article OR type:about-page",
                    offset: 0,
                    length: 34,
                })
            )
            // reverseAi prefers r06 … r01 and gives the rest no probability,
            // so the pool ends on its last two hits in Algolia's order
            expect(body.hits.map((h: any) => h.objectID)).toEqual([
                "p29",
                "p30",
                "p31",
                "p32",
                "p33",
                "p34",
            ])
            expect(body).toMatchObject({ offset: 28, length: 6, nbHits: 80 })
            expect(body.rerank).toMatchObject({ poolSize: 30 })
        })

        it.each([
            ["a filter the site doesn't send", { filters: "type:profile" }],
            ["an offset past the reranked pool", { offset: 30 }],
        ])("rejects %s with a 400", async (_, overrides) => {
            const { status } = await post(
                pagesRequest(overrides),
                reverseAi(),
                "model=jev&section=pages"
            )

            expect(status).toBe(400)
            expect(search).not.toHaveBeenCalled()
        })
    })

    describe("rejects with a 400", () => {
        it.each([
            ["a parameter the site doesn't send", { distinct: true }],
            ["a page past the reranked pool", { page: RERANK_PAGES }],
            ["an empty query", { query: "  " }],
            ["too many hits per page", { hitsPerPage: 21 }],
        ])("%s", async (_, overrides) => {
            const { status } = await post(siteRequest(overrides))

            expect(status).toBe(400)
            expect(search).not.toHaveBeenCalled()
        })

        it("on a deployment without the AI binding", async () => {
            const { status, body } = await post(siteRequest(), null)

            expect(status).toBe(400)
            expect(body.error).toMatch(/not available/)
        })
    })
})
