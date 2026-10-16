import * as Sentry from "@sentry/cloudflare"
import { StatusError } from "itty-router"
import * as z from "zod"
import { Env } from "../../_common/env.js"
import { loadChartContext } from "./chartContext.js"
import { callClaude } from "./claude.js"
import {
    buildPrompt,
    buildSuggestionsRequest,
    parseJsonReply,
    sanitizeSuggestions,
    suggestionsRequestSchema,
} from "./viewfinder.js"

// Staff-only "Try…" suggestions for charts that have none written by hand

const json = (body: unknown, status = 200): Response =>
    Response.json(body, { status })

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    if (env.ENV === "production" || !env.ANTHROPIC_API_KEY)
        return json({ error: "Not available" }, 404)

    let rawBody: unknown
    try {
        rawBody = await request.json()
    } catch {
        return json({ error: "Malformed JSON payload" }, 400)
    }
    const parsed = suggestionsRequestSchema.safeParse(rawBody)
    if (!parsed.success)
        return json(
            {
                error: "Invalid request payload",
                details: z.prettifyError(parsed.error),
            },
            400
        )
    const { slug, queryStr } = parsed.data
    const started = Date.now()

    try {
        const ctx = await loadChartContext(slug, queryStr, env)
        // The same cached part as a reader's request, with the suggestions
        // request in place of theirs
        const { cached } = buildPrompt(ctx, "")
        const claude = await callClaude(
            env.ANTHROPIC_API_KEY,
            "claude-haiku-5-5",
            { cached, request: buildSuggestionsRequest() }
        )
        let suggestions: string[] = []
        try {
            suggestions = sanitizeSuggestions(parseJsonReply(claude.text))
        } catch {
            // No usable JSON: answer with no suggestions
        }
        const usage = {
            model: claude.model,
            inputTokens: claude.inputTokens,
            outputTokens: claude.outputTokens,
            cacheReadTokens: claude.cacheReadTokens,
            cacheWriteTokens: claude.cacheWriteTokens,
            ms: Date.now() - started,
        }
        console.log(
            JSON.stringify({
                event: "configure-with-ai-suggestions",
                slug,
                suggestions,
                usage,
            })
        )
        return json({ suggestions, usage })
    } catch (error) {
        if (error instanceof StatusError && error.status === 404)
            return json({ error: "Chart not found" }, 404)
        console.error(error)
        Sentry.captureException(error)
        return json({ error: "Something went wrong" }, 500)
    }
}
