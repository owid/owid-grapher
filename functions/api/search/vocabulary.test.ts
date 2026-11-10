/**
 * Vocabulary picks translate a query into (topic, term) pairs the charts
 * index can find. The contract: the model's most likely topics, each with its
 * most likely term; a one-term topic needs no question; and any failure
 * yields no terms, so the pool is reranked as if the picks never ran.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import {
    appendVocabularyHits,
    parseVocabulary,
    pickVocabularyTerms,
    pickVocabularyTopics,
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

describe(pickVocabularyTopics, () => {
    beforeEach(() => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(JSON.stringify(VOCABULARY)))
        )
    })

    it("picks the two most likely topics with the topic call alone", async () => {
        const ai = pickingAi()
        const info = await pickVocabularyTopics(ai, "clef-flash", "hungry")

        expect(info.terms).toEqual([
            { topic: "Hunger & Undernourishment" },
            { topic: "Famines" },
        ])
        expect(ai.run).toHaveBeenCalledOnce()
    })
})

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
