import * as z from "zod"
import { GRAPHER_QUERY_PARAM_KEYS } from "@ourworldindata/types"

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

/**
 * Only the params that describe the chart view. A visitor's URL can carry
 * anything else too (utm tags, click ids, an email from a campaign link),
 * and none of that belongs in the record.
 */
const keepChartState = (queryStr: string): string => {
    const from = new URLSearchParams(queryStr)
    const out = new URLSearchParams()
    for (const key of GRAPHER_QUERY_PARAM_KEYS) {
        const value = from.get(key)
        if (value !== null) out.set(key, value)
    }
    const s = out.toString()
    return s ? `?${s}` : ""
}

export function buildAskAiQuestionRecord({
    payload,
    receivedAtIso,
}: {
    payload: AskAiQuestionPayload
    receivedAtIso: string
}): Record<string, unknown> {
    const { question, queryStr, ...rest } = payload
    return {
        ...rest,
        queryStr: keepChartState(queryStr),
        question: question?.slice(0, ASK_AI_QUESTION_MAX_STORED_LENGTH),
        questionLength: question?.length ?? 0,
        receivedAt: receivedAtIso,
    }
}
