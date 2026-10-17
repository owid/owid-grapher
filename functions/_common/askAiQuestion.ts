import * as z from "zod"

/**
 * Longest question we store. Longer ones are cut, and `questionLength` keeps
 * the original length so the analysis can see how often that happens.
 */
export const ASK_AI_QUESTION_MAX_STORED_LENGTH = 500

/**
 * What site/AskAI.tsx beacons on every submit. Deliberately no IP, user
 * agent or cookie id: the record is meant to be readable without being
 * traceable to a visitor.
 */
export const askAiQuestionPayloadSchema = z.object({
    arm: z.enum(["v3", "v5"]),
    /** Whether the arm came from ?askai= rather than the experiment */
    forced: z.boolean(),
    slug: z.string().min(1).max(200),
    engine: z.enum(["claude", "chatgpt"]),
    promptSource: z.enum(["default", "preset", "freeform"]),
    // Generous ceiling so a pasted essay is still accepted, then cut below.
    question: z.string().trim().max(20_000).optional(),
    queryStr: z.string().max(2_000),
})

export type AskAiQuestionPayload = z.infer<typeof askAiQuestionPayloadSchema>

export function buildAskAiQuestionStorageKey(id: string): string {
    return `responses/ask-ai/${id}.json`
}

export function buildAskAiQuestionRecord({
    payload,
    receivedAtIso,
}: {
    payload: AskAiQuestionPayload
    receivedAtIso: string
}): Record<string, unknown> {
    const { question, ...rest } = payload
    return {
        ...rest,
        question: question?.slice(0, ASK_AI_QUESTION_MAX_STORED_LENGTH),
        questionLength: question?.length ?? 0,
        receivedAt: receivedAtIso,
    }
}
