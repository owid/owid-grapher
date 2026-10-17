import * as Sentry from "@sentry/cloudflare"
import { fetchInputTableForConfig } from "@ourworldindata/grapher"
import { StatusError } from "itty-router"
import * as z from "zod"
import { Env } from "../../_common/env.js"
import { getDataApiUrl, initGrapher } from "../../_common/grapherTools.js"
import { TWITTER_OPTIONS } from "../../_common/imageOptions.js"
import { buildChartContext, loadMdimContext } from "./chartContext.js"
import {
    buildPrompt,
    Model,
    parseJsonReply,
    requestSchema,
    sanitizeViews,
} from "./viewfinder.js"

// Prototype endpoint for "Configure with AI" on staging data pages. The prompt
// is built here rather than on the client, so the endpoint can't be used as a
// general proxy to our API key.

const json = (body: unknown, status = 200): Response =>
    Response.json(body, { status })

interface ClaudeResult {
    text: string
    stopReason: string
    model: string
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
}

async function callClaude(
    apiKey: string,
    model: Model,
    prompt: { cached: string; request: string }
): Promise<ClaudeResult> {
    // Server-side fallback on a refusal isn't offered for Haiku
    const useFallbacks = model !== "claude-haiku-5-5"
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            ...(useFallbacks
                ? { "anthropic-beta": "server-side-fallback-2026-07-01" }
                : {}),
        },
        body: JSON.stringify({
            model,
            max_tokens: 16000,
            output_config: { effort: "low" },
            ...(useFallbacks ? { fallbacks: "default" } : {}),
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: prompt.cached,
                            cache_control: { type: "ephemeral" },
                        },
                        { type: "text", text: prompt.request },
                    ],
                },
            ],
        }),
    })
    if (!response.ok)
        throw new Error(
            `Anthropic API ${response.status}: ${(await response.text()).slice(0, 500)}`
        )
    const body: {
        content: { type: string; text?: string }[]
        stop_reason: string
        model: string
        usage: {
            input_tokens: number
            output_tokens: number
            cache_read_input_tokens?: number
            cache_creation_input_tokens?: number
        }
    } = await response.json()
    return {
        text: body.content
            .filter((block) => block.type === "text")
            .map((block) => block.text ?? "")
            .join(""),
        stopReason: body.stop_reason,
        model: body.model,
        inputTokens: body.usage.input_tokens,
        outputTokens: body.usage.output_tokens,
        cacheReadTokens: body.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: body.usage.cache_creation_input_tokens ?? 0,
    }
}

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
        const searchParams = new URLSearchParams(queryStr)
        const { grapher, identifierType } = await initGrapher(
            { type: "slug", id: slug },
            TWITTER_OPTIONS,
            searchParams,
            env
        )
        const grapherState = grapher.grapherState
        const [inputTable, mdim] = await Promise.all([
            fetchInputTableForConfig({
                dimensions: grapherState.dimensionConfigs,
                selectedEntityColors: grapherState.selectedEntityColors,
                dataApiUrl: getDataApiUrl(env),
            }),
            identifierType === "multi-dim-slug"
                ? loadMdimContext(slug, searchParams, env)
                : undefined,
        ])
        if (inputTable) grapherState.inputTable = inputTable
        const ctx = buildChartContext(grapherState, mdim)
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
