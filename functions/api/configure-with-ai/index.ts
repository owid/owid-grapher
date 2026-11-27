import * as Sentry from "@sentry/cloudflare"
import { StatusError } from "itty-router"
import * as z from "zod"
import { Env } from "../../_common/env.js"
import { loadChartContext, loadCombinationData } from "./chartContext.js"
import { callClaude } from "./claude.js"
import { costOf, costsByModel } from "./cost.js"
import {
    buildPrompt,
    CombinationData,
    combinationKey,
    combinationsToRank,
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
    const { slug, query, queryStr, model, tableSort } = parsed.data
    const runId = crypto.randomUUID()
    const started = Date.now()

    try {
        const ctx = {
            ...(await loadChartContext(slug, queryStr, env)),
            currentTableSort: tableSort,
        }
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
            costUsd: costOf(claude, model),
            costUsdByModel: costsByModel(claude),
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
        // A ranking on a combination that isn't shown needs that combination's
        // data; if it doesn't load, sanitizeViews falls back to sorting
        const rankStarted = Date.now()
        const combinations = new Map<string, CombinationData>()
        await Promise.all(
            combinationsToRank(reply, ctx).map(async (dims) => {
                try {
                    combinations.set(
                        combinationKey(dims),
                        await loadCombinationData(slug, dims, env)
                    )
                } catch (error) {
                    console.error(error)
                    Sentry.captureException(error)
                }
            })
        )
        const fullUsage = {
            ...usage,
            /** Time spent loading other combinations' data */
            combinationsMs: Date.now() - rankStarted,
        }
        const clean = sanitizeViews(reply, ctx, combinations)
        // One JSON line per run; read them back with `pm2 logs site` on staging
        console.log(
            JSON.stringify({
                event: "configure-with-ai",
                runId,
                slug,
                query,
                queryStr,
                ...clean,
                usage: fullUsage,
            })
        )
        return json({ runId, ...clean, usage: fullUsage })
    } catch (error) {
        if (error instanceof StatusError && error.status === 404)
            return json({ error: "Chart not found" }, 404)
        // A malformed percent-encoding in queryStr
        if (error instanceof URIError)
            return json({ error: "Invalid queryStr" }, 400)
        console.error(error)
        Sentry.captureException(error)
        return json({ error: "Something went wrong", runId }, 500)
    }
}
