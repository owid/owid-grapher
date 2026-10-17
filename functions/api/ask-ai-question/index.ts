import * as Sentry from "@sentry/cloudflare"
import * as z from "zod"
import { Env } from "../../_common/env.js"
import {
    askAiQuestionPayloadSchema,
    buildAskAiQuestionRecord,
    buildAskAiQuestionStorageKey,
} from "../../_common/askAiQuestion.js"

const RESPONSE_HEADERS: HeadersInit = {
    "Content-Type": "application/json",
}

const jsonResponse = (body: unknown, status: number): Response =>
    new Response(JSON.stringify(body), { headers: RESPONSE_HEADERS, status })

// Stores what readers type into the Ask-AI block on data pages (experiment
// exp-ask-ai-v1). It shares the user-survey bucket, under its own prefix.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    if (!env.USER_SURVEYS_R2) {
        return jsonResponse({ error: "Failed to store question" }, 500)
    }

    let rawPayload: unknown
    try {
        rawPayload = await request.json()
    } catch {
        return jsonResponse({ error: "Malformed JSON payload" }, 400)
    }

    const parsedPayload = askAiQuestionPayloadSchema.safeParse(rawPayload)
    if (!parsedPayload.success) {
        return jsonResponse(
            {
                error: "Invalid request payload",
                details: z.prettifyError(parsedPayload.error),
            },
            400
        )
    }

    try {
        const record = buildAskAiQuestionRecord({
            payload: parsedPayload.data,
            receivedAtIso: new Date().toISOString(),
        })
        await env.USER_SURVEYS_R2.put(
            buildAskAiQuestionStorageKey(crypto.randomUUID()),
            JSON.stringify(record),
            { httpMetadata: { contentType: "application/json" } }
        )
        return jsonResponse({ ok: true }, 200)
    } catch (error) {
        Sentry.captureException(error)
        return jsonResponse({ error: "Failed to store question" }, 500)
    }
}
