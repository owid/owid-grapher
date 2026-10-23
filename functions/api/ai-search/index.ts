import Anthropic from "@anthropic-ai/sdk"
import * as Sentry from "@sentry/cloudflare"
import {
    AiSearchErrorCode,
    AiSearchEvent,
    AiSearchSettings,
    getAiSearchPagePoolSize,
} from "@ourworldindata/types"
import { Env } from "../../_common/env.js"
import { getAlgoliaConfig } from "../search/algoliaClient.js"
import {
    buildCandidatePool,
    composerPrompt,
    createLineSplitter,
    MAX_QUERY_LENGTH,
    parseAiSearchSettings,
    parseComposerLine,
    parsePlannerAnswer,
    PLANNER_SCHEMA,
    plannerPrompt,
} from "./aiSearch.js"
import { searchKeywords } from "./retrieval.js"

/**
 * GET /api/ai-search?q=…: the AI-assisted search prototype.
 *
 * Finds candidate charts and articles with the site's keyword search
 * (optionally widened by a quick Haiku call that suggests extra searches),
 * then asks Claude to organise them into themed groups. The answer streams
 * back as newline-delimited JSON (AiSearchEvent), so groups render as soon as
 * the model writes them.
 *
 * Every request costs a model call, so the endpoint is disabled in
 * production; it runs where ANTHROPIC_API_KEY is configured (staging, local).
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
    const url = new URL(request.url)
    const query = (url.searchParams.get("q") ?? "").trim()

    if (env.ENV === "production" || !env.ANTHROPIC_API_KEY)
        return jsonError(404, "AI search isn't available here.")
    if (!query) return jsonError(400, "Missing q parameter.")
    if (query.length > MAX_QUERY_LENGTH)
        return jsonError(
            400,
            `q is longer than ${MAX_QUERY_LENGTH} characters.`
        )

    const settings = parseAiSearchSettings(url.searchParams)
    const { readable, writable } = new TransformStream<Uint8Array>()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()
    const controller = new AbortController()
    request.signal?.addEventListener("abort", () => controller.abort())

    const emit = (event: AiSearchEvent): void => {
        // A failed write means the reader went away, so stop the model too.
        writer
            .write(encoder.encode(JSON.stringify(event) + "\n"))
            .catch(() => controller.abort())
    }

    const run = runAiSearch({
        env,
        query,
        settings,
        emit,
        signal: controller.signal,
    })
        .catch((error) => {
            if (controller.signal.aborted) return
            Sentry.captureException(error)
            console.error("AI search failed", error)
            emit(errorEvent(error))
        })
        .finally(() => writer.close().catch(() => undefined))
    void run

    return new Response(readable, {
        headers: {
            "Content-Type": "application/x-ndjson; charset=utf-8",
            "Cache-Control": "no-store",
            // Stops proxies from buffering the stream
            "X-Accel-Buffering": "no",
        },
    })
}

async function runAiSearch({
    env,
    query,
    settings,
    emit,
    signal,
}: {
    env: Env
    query: string
    settings: AiSearchSettings
    emit: (event: AiSearchEvent) => void
    signal: AbortSignal
}): Promise<void> {
    const started = Date.now()
    const timings: Record<string, number> = {}
    const time = <T>(label: string, promise: Promise<T>): Promise<T> => {
        const t0 = Date.now()
        return promise.finally(() => (timings[label] = Date.now() - t0))
    }

    const algolia = getAlgoliaConfig(env)
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
    const chartPool = settings.pool
    const pagePool = getAiSearchPagePoolSize(chartPool)

    emit({ type: "status", text: "Searching our charts and articles…" })
    const [base] = await time(
        "keyword search",
        searchKeywords(algolia, [query], { charts: chartPool, pages: pagePool })
    )

    let expansions: string[] = []
    if (settings.expand && (base.charts.length || base.pages.length)) {
        emit({ type: "status", text: "Working out the angles on this topic…" })
        try {
            const topTitles = [...base.charts, ...base.pages]
                .slice(0, 20)
                .map((hit) =>
                    "variantName" in hit && hit.variantName
                        ? `${hit.title} (${hit.variantName})`
                        : hit.title
                )
            const answer = await time(
                "expansion",
                client.messages.create(
                    {
                        model: "claude-haiku-5-5",
                        max_tokens: 1024,
                        thinking: { type: "disabled" },
                        output_config: {
                            format: {
                                type: "json_schema",
                                schema: PLANNER_SCHEMA,
                            },
                        },
                        messages: [
                            {
                                role: "user",
                                content: plannerPrompt(query, topTitles),
                            },
                        ],
                    },
                    { signal }
                )
            )
            expansions = parsePlannerAnswer(textOf(answer.content), query)
            emit({ type: "expansion", queries: expansions })
        } catch (error) {
            if (signal.aborted) throw error
            // The grouping still works from the original search alone.
            if (settings.debug)
                emit({
                    type: "debug",
                    title: "Expansion failed (continuing without it)",
                    text: String(error),
                })
        }
    }

    const expanded = expansions.length
        ? await time(
              "expansion searches",
              searchKeywords(algolia, expansions, {
                  charts: chartPool,
                  pages: pagePool,
              })
          )
        : []
    const pool = buildCandidatePool([base, ...expanded], chartPool)
    if (!pool.charts.length && !pool.pages.length) {
        emit({
            type: "error",
            code: "no_candidates",
            message: `We couldn't find any charts or articles matching “${query}”. Try different words.`,
        })
        return
    }
    emit({
        type: "candidates",
        charts: pool.charts,
        pages: pool.pages.map(({ excerpt: _excerpt, ...page }) => page),
    })

    emit({
        type: "status",
        text: `Grouping ${pool.charts.length} charts and ${pool.pages.length} articles by theme…`,
    })
    const prompt = composerPrompt(query, pool)
    if (settings.debug)
        emit({
            type: "debug",
            title: `Composer prompt (${Math.round(prompt.length / 1024)} KB)`,
            text: prompt,
        })

    const usedIds = new Set<number>()
    let groupCount = 0
    let rawOutput = ""
    const splitter = createLineSplitter((line) => {
        const parsed = parseComposerLine(line, pool, usedIds)
        if (!parsed) return
        if (parsed.type === "group") {
            if (!groupCount) timings["first group"] = Date.now() - started
            groupCount++
        }
        emit(parsed)
    })

    const isHaiku = settings.model === "claude-haiku-5-5"
    const composerStart = Date.now()
    const stream = client.beta.messages.stream(
        {
            model: settings.model,
            max_tokens: 16000,
            // Haiku answers without thinking, which is what makes it fast.
            ...(isHaiku
                ? { thinking: { type: "disabled" as const } }
                : {
                      thinking: { type: "adaptive" as const },
                      output_config: { effort: settings.effort },
                      // When a safety classifier declines (it can misfire on
                      // health topics), another model finishes the answer.
                      betas: ["server-side-fallback-2026-07-01"],
                      fallbacks: "default" as const,
                  }),
            messages: [{ role: "user", content: prompt }],
        },
        { signal }
    )
    for await (const event of stream) {
        if (
            event.type === "content_block_start" &&
            event.content_block.type === "fallback"
        ) {
            // The fallback model continues the answer; a half-written line
            // from the model that declined can't be completed.
            splitter.reset()
        } else if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
        ) {
            rawOutput += event.delta.text
            splitter.push(event.delta.text)
        }
    }
    const message = await stream.finalMessage()
    splitter.flush()
    timings["grouping"] = Date.now() - composerStart
    timings["end to end"] = Date.now() - started

    if (settings.debug)
        emit({ type: "debug", title: "Raw model output", text: rawOutput })
    if (!groupCount) {
        emit(
            message.stop_reason === "refusal"
                ? {
                      type: "error",
                      code: "refused",
                      message:
                          "Claude declined this search. Try wording it differently.",
                  }
                : {
                      type: "error",
                      code: "no_groups",
                      message:
                          "The model didn't return any groups. Try again or change the settings.",
                  }
        )
        return
    }
    emit({ type: "done", model: message.model, timings })
}

const textOf = (content: Anthropic.ContentBlock[]): string =>
    content.map((block) => (block.type === "text" ? block.text : "")).join("")

function errorEvent(error: unknown): AiSearchEvent {
    const code: AiSearchErrorCode =
        error instanceof Anthropic.RateLimitError ? "rate_limited" : "failed"
    return {
        type: "error",
        code,
        message:
            code === "rate_limited"
                ? "Too many AI searches in a short time. Wait a minute, then try again."
                : "Something went wrong while grouping the results. Try again.",
    }
}

const jsonError = (status: number, error: string): Response =>
    new Response(JSON.stringify({ error }), {
        status,
        headers: { "Content-Type": "application/json" },
    })
