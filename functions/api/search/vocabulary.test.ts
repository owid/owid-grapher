/**
 * Vocabulary picks map a query onto the topics the indices can filter by. The
 * contract: the most likely topics, by the model's answer or by embedding
 * similarity; and any failure yields no picks, so the pool is reranked as if
 * the picks never ran.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { embedStaticTexts } from "./staticEmbedding.js"
import {
    appendVocabularyHits,
    parseVocabulary,
    pickTopicsByEmbedding,
    pickVocabularyTopics,
} from "./vocabulary.js"

// One dimension per topic; a text points along the topics it names
vi.mock(import("./staticEmbedding.js"), () => ({
    embedStaticTexts: vi.fn(async (texts: string[]) =>
        texts.map((text) => [
            /hunger/i.test(text) ? 1 : 0,
            /famine/i.test(text) ? 0.5 : 0,
            /energy/i.test(text) ? 0.2 : 0,
        ])
    ),
}))

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

beforeEach(() => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify(VOCABULARY)))
    )
})

describe(pickVocabularyTopics, () => {
    it("picks the two most likely topics", async () => {
        const ai = {
            run: vi.fn(async () => ({
                answers: { topic: choice({ t0: 0.6, t1: 0.3, t2: 0.1 }) },
            })),
        } as unknown as Ai & { run: ReturnType<typeof vi.fn> }
        const info = await pickVocabularyTopics(ai, "clef-flash", "hungry")

        expect(info.terms).toEqual([
            { topic: "Hunger & Undernourishment" },
            { topic: "Famines" },
        ])
        expect(ai.run).toHaveBeenCalledOnce()
        expect(ai.run.mock.calls[0][1].state).toContain("Query: hungry")
    })

    it("yields no picks when the model call fails", async () => {
        const ai = {
            run: vi.fn(async () => {
                throw new Error("gateway down")
            }),
        } as unknown as Ai

        const info = await pickVocabularyTopics(ai, "clef-flash", "malaria")

        expect(info.terms).toEqual([])
        expect(info.error).toBe("gateway down")
    })

    it("yields no picks when the model refuses to pick a topic", async () => {
        const ai = {
            run: vi.fn(async () => ({
                answers: { topic: { type: "refusal" } },
            })),
        } as unknown as Ai

        const info = await pickVocabularyTopics(ai, "clef-flash", "hello")

        expect(info.terms).toEqual([])
        expect(info.error).toBeUndefined()
    })
})

describe(pickTopicsByEmbedding, () => {
    // First, while the topics' vectors aren't loaded yet: a failed load is
    // retried on the next pick
    it("yields no picks when the model fails to load, and retries", async () => {
        vi.mocked(embedStaticTexts).mockRejectedValueOnce(
            new Error("model fetch failed")
        )
        const failed = await pickTopicsByEmbedding("famine and hunger")
        expect(failed).toMatchObject({ terms: [], error: "model fetch failed" })

        const retried = await pickTopicsByEmbedding("famine and hunger")
        expect(retried.terms).toHaveLength(2)
    })

    it("picks the two topics most like the query", async () => {
        const info = await pickTopicsByEmbedding("famine and hunger")

        // the query points mostly along hunger, then famine, never energy
        expect(info.terms).toEqual([
            { topic: "Hunger & Undernourishment" },
            { topic: "Famines" },
        ])
        expect(info.error).toBeUndefined()
    })

    it("picks nothing for a query with no word the model knows", async () => {
        const info = await pickTopicsByEmbedding("zzz")

        expect(info).toMatchObject({ terms: [] })
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
    it("appends only new hits, in pick order, skipping failed searches", async () => {
        const terms = [{ topic: "A" }, { topic: "B" }, { topic: "C" }]
        const results: Record<string, string[]> = {
            A: ["h2", "v1"],
            C: ["v1", "v2"],
        }
        const { hits, via } = await appendVocabularyHits(
            ["h1", "h2"],
            terms,
            async ({ topic }) => {
                if (topic === "B") throw new Error("search failed")
                return results[topic]
            },
            (hit) => hit
        )

        expect(hits).toEqual(["h1", "h2", "v1", "v2"])
        // each appended hit remembers the first pick that found it
        expect(Object.fromEntries(via)).toEqual({
            v1: terms[0],
            v2: terms[2],
        })
    })
})
