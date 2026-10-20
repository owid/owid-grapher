/**
 * rerankCharts reorders an Algolia charts response by a decision model's
 * choice probabilities. The contract: the order follows the model's
 * probabilities (ties keep Algolia's order), the page is cut to hitsPerPage
 * after reordering, and every way the model can fail to answer — a refusal, a
 * thrown error, an unexpected response shape — degrades to Algolia's own
 * order instead of failing the search.
 */
import { describe, it, expect, vi } from "vitest"
import { ChartRecordType } from "@ourworldindata/types"
import { rerankCharts } from "./rerank.js"
import type { EnrichedSearchChartHit, SearchApiResponse } from "./searchApi.js"

const hit = (slug: string): EnrichedSearchChartHit =>
    ({
        type: ChartRecordType.Chart,
        slug,
        title: `Title of ${slug}`,
        subtitle: `Subtitle of ${slug}`,
        url: `https://ourworldindata.org/grapher/${slug}`,
    }) as EnrichedSearchChartHit

const pool = (...slugs: string[]): SearchApiResponse => ({
    query: "birth rate",
    results: slugs.map(hit),
    nbHits: 120,
    page: 0,
    nbPages: 4,
    hitsPerPage: 30,
})

const fakeAi = (run: (...args: unknown[]) => unknown): Ai =>
    ({ run: vi.fn(run) }) as unknown as Ai

const jevAnswers = (probabilities: Record<string, number>, noul = 0.9) => ({
    answers: {
        best_result: { type: "choice", probabilities },
        any_relevant: { type: "noul", noul },
    },
})

const slugsOf = (response: SearchApiResponse): string[] =>
    response.results.map((r) => r.slug)

describe(rerankCharts, () => {
    it("orders hits by choice probability and cuts to hitsPerPage after reordering", async () => {
        const ai = fakeAi(async () =>
            jevAnswers({ r01: 0.1, r02: 0.05, r03: 0.6, r04: 0.25 }, 0.82)
        )

        const response = await rerankCharts(
            ai,
            "jev",
            pool("a", "b", "c", "d"),
            3
        )

        expect(slugsOf(response)).toEqual(["c", "d", "a"])
        expect(response.rerank).toMatchObject({
            model: "jev",
            poolSize: 4,
            anyRelevant: 0.82,
        })
        expect(response.rerank.refused).toBeUndefined()
        expect(response.rerank.error).toBeUndefined()
        // the reranked response is a single page, whatever Algolia reported
        expect(response).toMatchObject({
            nbHits: 120,
            nbPages: 1,
            hitsPerPage: 3,
        })
    })

    it("keeps Algolia's order among hits the model gives equal (or no) probability", async () => {
        const ai = fakeAi(async () => jevAnswers({ r03: 0.7 }))

        const response = await rerankCharts(
            ai,
            "jev",
            pool("a", "b", "c", "d"),
            10
        )

        expect(slugsOf(response)).toEqual(["c", "a", "b", "d"])
    })

    it("asks one listwise question over the whole pool, keyed by candidate ids", async () => {
        const ai = fakeAi(async () => jevAnswers({ r01: 1 }))

        await rerankCharts(ai, "jev", pool("a", "b"), 10)

        const [model, inputs] = vi.mocked(ai.run).mock.calls[0] as [
            string,
            { state: string; questions: Record<string, any> },
        ]
        expect(model).toBe("typesafe/jev")
        expect(inputs.state).toContain("Query: birth rate")
        expect(inputs.state).toContain("r02. Title of b — Subtitle of b")
        expect(inputs.questions.best_result.criteria).toEqual({
            r01: "Title of a",
            r02: "Title of b",
        })
        expect(inputs.questions.any_relevant.type).toBe("noul")
    })

    describe("falls back to Algolia's order", () => {
        it("when the model refuses to choose", async () => {
            const ai = fakeAi(async () => ({
                answers: {
                    best_result: { type: "refusal" },
                    any_relevant: { type: "noul", noul: 0.1 },
                },
            }))

            const response = await rerankCharts(
                ai,
                "jev",
                pool("a", "b", "c"),
                2
            )

            expect(slugsOf(response)).toEqual(["a", "b"])
            expect(response.rerank).toMatchObject({
                refused: true,
                anyRelevant: 0.1,
            })
        })

        it("when the call throws", async () => {
            const ai = fakeAi(async () => {
                throw new Error("5007: model not found")
            })

            const response = await rerankCharts(
                ai,
                "jev",
                pool("a", "b", "c"),
                2
            )

            expect(slugsOf(response)).toEqual(["a", "b"])
            expect(response.rerank.error).toBe("5007: model not found")
        })

        it("when the response has an unexpected shape", async () => {
            const ai = fakeAi(async () => ({ response: "I think r02 is best" }))

            const response = await rerankCharts(
                ai,
                "jev",
                pool("a", "b", "c"),
                2
            )

            expect(slugsOf(response)).toEqual(["a", "b"])
            expect(response.rerank.error).toMatch(/no answers/)
        })
    })

    it("skips the model when there is nothing to reorder", async () => {
        const ai = fakeAi(async () => jevAnswers({}))

        const response = await rerankCharts(ai, "jev", pool("only"), 10)

        expect(ai.run).not.toHaveBeenCalled()
        expect(slugsOf(response)).toEqual(["only"])
        expect(response.rerank.poolSize).toBe(1)
    })
})
