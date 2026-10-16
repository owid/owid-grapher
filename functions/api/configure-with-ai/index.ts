import * as Sentry from "@sentry/cloudflare"
import { StatusError } from "itty-router"
import * as z from "zod"
import { Env } from "../../_common/env.js"
import { loadChartContext } from "./chartContext.js"
import { callClaude } from "./claude.js"
import {
    buildPrompt,
    parseJsonReply,
    requestSchema,
    sanitizeViews,
} from "./viewfinder.js"

// Prototype endpoint for "Configure with AI" on staging data pages. The prompt
// is built here rather than on the client, so the endpoint can't be used as a
// general proxy to our API key.

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
    const parsed = requestSchema.safeParse(rawBody)
    if (!parsed.success)
        return json(
            {
                error: "Invalid request payload",
                details: z.prettifyError(parsed.error),
            },
            400
        )
    const { slug, query, queryStr, model } = parsed.data
    const runId = crypto.randomUUID()
    const started = Date.now()

    try {
        const ctx = await loadChartContext(slug, queryStr, env)
        const prompt = buildPrompt(ctx, query)
        const contextMs = Date.now() - started

        const claude = await callClaude(env.ANTHROPIC_API_KEY, model, prompt)
        const ms = Date.now() - started
        const usage = {
            model: claude.model,
            inputTokens: claude.inputTokens,
            outputTokens: claude.outputTokens,
            cacheReadTokens: claude.cacheReadTokens,
            cacheWriteTokens: claude.cacheWriteTokens,
            contextMs,
            ms,
        }
        if (claude.stopReason === "refusal") {
            console.log(
                JSON.stringify({
                    event: "configure-with-ai",
                    runId,
                    slug,
                    query,
                    queryStr,
                    error: "refused",
                    usage,
                })
            )
            return json({ error: "refused", runId, usage }, 502)
        }

        let reply: unknown
        try {
            reply = parseJsonReply(claude.text)
        } catch {
            console.log(
                JSON.stringify({
                    event: "configure-with-ai",
                    runId,
                    slug,
                    query,
                    queryStr,
                    error: "invalid_json",
                    raw: claude.text.slice(0, 2000),
                    usage,
                })
            )
            return json({ error: "invalid_json", runId, usage }, 502)
        }
        const clean = sanitizeViews(reply, ctx)
        // One JSON line per run; read them back with `pm2 logs site` on staging
        console.log(
            JSON.stringify({
                event: "configure-with-ai",
                runId,
                slug,
                query,
                queryStr,
                ...clean,
                usage,
            })
        )
        return json({ runId, ...clean, usage })
    } catch (error) {
        if (error instanceof StatusError && error.status === 404)
            return json({ error: "Chart not found" }, 404)
        console.error(error)
        Sentry.captureException(error)
        return json({ error: "Something went wrong", runId }, 500)
    }
}
