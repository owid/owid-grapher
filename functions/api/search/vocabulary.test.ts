/**
 * Vocabulary picks translate a query into (topic, term) pairs the charts
 * index can find. The contract: the model's most likely topics, each with its
 * most likely term; a one-term topic needs no question; and any failure
 * yields no terms, so the pool is reranked as if the picks never ran.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import {
    appendVocabularyHits,
    parseVocabParam,
    parseVocabulary,
    pickVocabularyTerms,
} from "./vocabulary.js"

const VOCABULARY = {
    hunger: {
        topic_name: "Hunger & Undernourishment",
        keywords: ["undernourishment", "food insecurity"],
    },
    famines: { topic_name: "Famines", keywords: ["famine deaths"] },
    energy: { topic_name: "Energy", keywords: ["electricity", "coal"] },
}

const choice = (probabilities: Record<string, number>) => ({
    type: "choice",
    probabilities,
})

// Topic call: Hunger (t0) first, Famines (t1) second, Energy (t2) last.
// Keyword call: "food insecurity" (k1) for the first topic.
const pickingAi = () =>
    ({
        run: vi.fn(async (_model: string, input: any) =>
            input.questions.topic
                ? { answers: { topic: choice({ t0: 0.6, t1: 0.3, t2: 0.1 }) } }
                : { answers: { k0: choice({ k0: 0.2, k1: 0.8 }) } }
        ),
    }) as unknown as Ai & { run: ReturnType<typeof vi.fn> }

describe(pickVocabularyTerms, () => {
    beforeEach(() => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(JSON.stringify(VOCABULARY)))
        )
    })

    it("picks the best term within each of the two most likely topics", async () => {
        const ai = pickingAi()
        const info = await pickVocabularyTerms(
            ai,
            "clef-flash",
            "under nurished"
        )

        expect(info.terms).toEqual([
            { topic: "Hunger & Undernourishment", keyword: "food insecurity" },
            // one term: taken without a question
            { topic: "Famines", keyword: "famine deaths" },
        ])
        expect(info.error).toBeUndefined()
        expect(ai.run).toHaveBeenCalledTimes(2)
        const keywordQuestions = ai.run.mock.calls[1][1].questions
        expect(Object.keys(keywordQuestions)).toEqual(["k0"])
        expect(ai.run.mock.calls[0][1].state).toContain("Query: under nurished")
    })

    // With skip, the topic call also asks whether the query as typed works
    const skippingAi = (queryIsClear: number) =>
        ({
            run: vi.fn(async (_model: string, input: any) =>
                input.questions.topic
                    ? {
                          answers: {
                              topic: choice({ t0: 0.6, t1: 0.3, t2: 0.1 }),
                              ...(input.questions.query_is_clear && {
                                  query_is_clear: {
                                      type: "noul",
                                      noul: queryIsClear,
                                  },
                              }),
                          },
                      }
                    : { answers: { k0: choice({ k0: 0.9, k1: 0.1 }) } }
            ),
        }) as unknown as Ai & { run: ReturnType<typeof vi.fn> }

    it("with skip, takes no terms when the query as typed likely finds its data", async () => {
        const ai = skippingAi(0.8)

        const info = await pickVocabularyTerms(ai, "clef-flash", "malaria", {
            skip: true,
        })

        expect(info).toMatchObject({
            terms: [],
            queryIsClear: 0.8,
            skipped: true,
        })
        expect(ai.run).toHaveBeenCalledOnce()
    })

    it("with skip, picks terms as usual for a query that likely needs them", async () => {
        const ai = skippingAi(0.3)

        const info = await pickVocabularyTerms(
            ai,
            "clef-flash",
            "under nurished",
            { skip: true }
        )

        expect(info.terms).toHaveLength(2)
        expect(info).toMatchObject({ queryIsClear: 0.3 })
        expect(info.skipped).toBeUndefined()
    })

    it("asks about the query only with skip", async () => {
        const ai = skippingAi(0.8)

        const info = await pickVocabularyTerms(ai, "clef-flash", "malaria")

        expect(info.terms).toHaveLength(2)
        expect(ai.run.mock.calls[0][1].questions).not.toHaveProperty(
            "query_is_clear"
        )
    })

    it("yields no terms when the model call fails", async () => {
        const ai = {
            run: vi.fn(async () => {
                throw new Error("gateway down")
            }),
        } as unknown as Ai

        const info = await pickVocabularyTerms(ai, "clef-flash", "malaria")

        expect(info.terms).toEqual([])
        expect(info.error).toBe("gateway down")
    })

    it("yields no terms when the model refuses to pick a topic", async () => {
        const ai = {
            run: vi.fn(async () => ({
                answers: { topic: { type: "refusal" } },
            })),
        } as unknown as Ai

        const info = await pickVocabularyTerms(ai, "clef-flash", "hello")

        expect(info.terms).toEqual([])
        expect(info.error).toBeUndefined()
    })
})

describe(parseVocabulary, () => {
    it("reads each topic's tag name and terms", () => {
        expect(parseVocabulary(VOCABULARY)[0]).toEqual({
            name: "Hunger & Undernourishment",
            keywords: ["undernourishment", "food insecurity"],
        })
    })

    it("rejects a topic without terms", () => {
        expect(() =>
            parseVocabulary({
                ...VOCABULARY,
                empty: { topic_name: "Empty", keywords: [] },
            })
        ).toThrow("malformed")
    })
})

describe(appendVocabularyHits, () => {
    it("appends only new hits, in term order, skipping failed searches", async () => {
        const terms = [
            { topic: "A", keyword: "a" },
            { topic: "B", keyword: "b" },
            { topic: "C", keyword: "c" },
        ]
        const results: Record<string, string[]> = {
            a: ["h2", "v1"],
            c: ["v1", "v2"],
        }
        const { hits, via } = await appendVocabularyHits(
            ["h1", "h2"],
            terms,
            async ({ keyword }) => {
                if (keyword === "b") throw new Error("search failed")
                return results[keyword]
            },
            (hit) => hit
        )

        expect(hits).toEqual(["h1", "h2", "v1", "v2"])
        // each appended hit remembers the first term that found it
        expect(Object.fromEntries(via)).toEqual({
            v1: terms[0],
            v2: terms[2],
        })
    })
})

describe(parseVocabParam, () => {
    it("reads 1 as the plain vocabulary and a list as its variants", () => {
        expect(parseVocabParam(null)).toBeUndefined()
        expect(parseVocabParam("1")).toEqual({ skip: false, tag: false })
        expect(parseVocabParam("tag")).toEqual({ skip: false, tag: true })
        expect(parseVocabParam("skip,tag")).toEqual({ skip: true, tag: true })
    })

    it("rejects anything else", () => {
        expect(() => parseVocabParam("yes")).toThrow("Invalid vocab")
        expect(() => parseVocabParam("1,tag")).toThrow("Invalid vocab")
    })
})
