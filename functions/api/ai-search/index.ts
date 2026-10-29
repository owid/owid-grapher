import Anthropic from "@anthropic-ai/sdk"
import * as Sentry from "@sentry/cloudflare"
import { AiSearchEvent, AiSearchSettings } from "@ourworldindata/types"
import { createLineSplitter } from "@ourworldindata/utils"
import { Env } from "../../_common/env.js"
import { getAlgoliaConfig } from "../search/algoliaClient.js"
import {
    buildCandidatePool,
    CHART_POOL_SIZE,
    composerPrompt,
    createBlockParser,
    MAX_QUERY_LENGTH,
    PAGE_POOL_SIZE,
    parseAiSearchSettings,
    parsePlannerAnswer,
    PLANNER_SCHEMA,
    plannerPrompt,
    poolSize,
} from "./aiSearch.js"
import { searchKeywords } from "./retrieval.js"

/**
 * GET /api/ai-search?q=…: the AI search prototype.
 *
 * Finds candidate charts and articles with the site's keyword search, widened
 * by a quick Haiku call that suggests extra searches, then asks Claude to lay
 * out a results page from them as a list of blocks (AiSearchBlock). The page
 * streams back as newline-delimited JSON (AiSearchEvent), one block per line,
 * with each block's ids already replaced by the full search hits.
 *
 * Every request costs model calls, so the endpoint only runs under `wrangler
 * pages dev` (ENV=development: staging servers and local dev) with an
 * ANTHROPIC_API_KEY, not in production or on public Cloudflare previews.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
    const url = new URL(request.url)
    const query = (url.searchParams.get("q") ?? "").trim()

    if (env.ENV !== "development" || !env.ANTHROPIC_API_KEY)
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
        // A failed write means the reader went away, so stop the model too
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
    const depth = { charts: CHART_POOL_SIZE, pages: PAGE_POOL_SIZE }

    emit({ type: "status", text: "Searching our charts and articles…" })
    const [base] = await time(
        "keyword search",
        searchKeywords(algolia, [query], depth)
    )

    // Also runs when the search found nothing: keyword search needs every
    // word to match, so a question phrased as a sentence often finds nothing
    // until the planner rewrites it into short searches.
    let expansions: string[] = []
    emit({ type: "status", text: "Looking at the topic from other angles…" })
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
                        format: { type: "json_schema", schema: PLANNER_SCHEMA },
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
        // The layout still works from the original search alone
        if (settings.debug)
            emit({
                type: "debug",
                title: "Expansion failed (continuing without it)",
                text: String(error),
            })
    }

    const expanded = expansions.length
        ? await time(
              "expansion searches",
              searchKeywords(algolia, expansions, depth)
          )
        : []
    const pool = buildCandidatePool([base, ...expanded])
    if (!poolSize(pool)) {
        emit({ type: "error", code: "no_candidates" })
        return
    }

    emit({ type: "status", text: "Laying out the results…" })
    const prompt = composerPrompt(query, pool)
    if (settings.debug)
        emit({
            type: "debug",
            title: `Prompt (${Math.round(prompt.length / 1024)} KB, ${pool.charts.size} charts, ${pool.pages.size} pages)`,
            text: prompt,
        })

    let blockCount = 0
    let rawOutput = ""
    const parseLine = createBlockParser(pool)
    const splitter = createLineSplitter((line) => {
        const block = parseLine(line)
        if (!block) return
        if (!blockCount) timings["first block"] = Date.now() - started
        blockCount++
        emit({ type: "block", block })
    })

    const isHaiku = settings.model === "claude-haiku-5-5"
    const composerStart = Date.now()
    const stream = client.beta.messages.stream(
        {
            model: settings.model,
            max_tokens: 16000,
            // Haiku answers without thinking, which is what makes it fast
            ...(isHaiku
                ? { thinking: { type: "disabled" as const } }
                : {
                      thinking: { type: "adaptive" as const },
                      output_config: { effort: "low" as const },
                      // When a safety classifier declines (it can misfire on
                      // health topics), another model finishes the answer
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
            // from the model that declined can't be completed
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
    timings["layout"] = Date.now() - composerStart
    timings["end to end"] = Date.now() - started

    if (settings.debug)
        emit({ type: "debug", title: "Raw model output", text: rawOutput })
    if (!blockCount) {
        emit({
            type: "error",
            code: message.stop_reason === "refusal" ? "refused" : "no_blocks",
        })
        return
    }
    emit({ type: "done", model: message.model, timings })
}

const textOf = (content: Anthropic.ContentBlock[]): string =>
    content.map((block) => (block.type === "text" ? block.text : "")).join("")

const errorEvent = (error: unknown): AiSearchEvent => ({
    type: "error",
    code: error instanceof Anthropic.RateLimitError ? "rate_limited" : "failed",
})

const jsonError = (status: number, error: string): Response =>
    new Response(JSON.stringify({ error }), {
        status,
        headers: { "Content-Type": "application/json" },
    })
