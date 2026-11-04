/**
 * /api/search/rerank-charts stands in for the Algolia request the site's
 * charts section would make. The contract: the first RERANK_PAGES pages are
 * cut from one reranked pool, so together with Algolia's later pages they show
 * every hit exactly once; the pool always comes from this deployment's charts
 * index; and requests the site wouldn't send are rejected, so the site falls
 * back to Algolia instead of showing a search that silently differs.
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

const post = async (body: unknown, ai: Ai | null = reverseAi()) => {
    const request = new Request(
        "http://localhost/api/search/rerank-charts?model=jev",
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
