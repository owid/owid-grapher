import { describe, expect, it } from "vitest"
import {
    ASK_AI_QUESTION_MAX_STORED_LENGTH,
    askAiQuestionPayloadSchema,
    buildAskAiQuestionRecord,
} from "./askAiQuestion.js"

const payload = {
    slug: "child-mortality",
    engine: "claude",
    promptSource: "freeform",
    question: "  Why has this fallen so fast?  ",
    queryStr: "?country=~NGA",
}

const record = (input: unknown): Record<string, unknown> =>
    buildAskAiQuestionRecord({
        payload: askAiQuestionPayloadSchema.parse(input),
        receivedAtIso: "2026-10-16T12:00:00.000Z",
    })

describe("ask-ai question record", () => {
    it("stores the trimmed question with its length and the context", () => {
        expect(record(payload)).toEqual({
            slug: "child-mortality",
            engine: "claude",
            promptSource: "freeform",
            question: "Why has this fallen so fast?",
            questionLength: 28,
            queryStr: "?country=%7ENGA",
            receivedAt: "2026-10-16T12:00:00.000Z",
        })
    })

    it("cuts a long question but keeps its full length", () => {
        const long = "a".repeat(ASK_AI_QUESTION_MAX_STORED_LENGTH + 100)
        const stored = record({ ...payload, question: long })
        expect(stored.question).toHaveLength(ASK_AI_QUESTION_MAX_STORED_LENGTH)
        expect(stored.questionLength).toBe(long.length)
    })

    it("records a submit without a typed question", () => {
        const stored = record({
            ...payload,
            promptSource: "default",
            question: undefined,
        })
        expect(stored.question).toBeUndefined()
        expect(stored.questionLength).toBe(0)
    })

    it("drops fields that could identify the visitor", () => {
        const stored = record({ ...payload, userAgent: "x", ip: "1.2.3.4" })
        expect(stored).not.toHaveProperty("userAgent")
        expect(stored).not.toHaveProperty("ip")
    })

    it("keeps only the chart's own params from the query string", () => {
        const stored = record({
            ...payload,
            queryStr:
                "?country=~NGA&utm_source=newsletter&email=a%40b.com&time=1990..2020",
        })
        expect(stored.queryStr).toBe("?country=%7ENGA&time=1990..2020")
    })

    it("rejects an unknown engine", () => {
        expect(
            askAiQuestionPayloadSchema.safeParse({
                ...payload,
                engine: "gemini",
            }).success
        ).toBe(false)
    })
})
