import Anthropic from "@anthropic-ai/sdk"
import * as Sentry from "@sentry/cloudflare"
import {
    AiSearchEvent,
    AiSearchInput,
    AiSearchSettings,
    getAiSearchPagePoolSize,
} from "@ourworldindata/types"
import { createLineSplitter, listedRegionsNames } from "@ourworldindata/utils"
import { Env } from "../../_common/env.js"
import { getAlgoliaConfig } from "../search/algoliaClient.js"
import {
    buildCandidatePool,
    CandidatePool,
    composerPrompt,
    createComposerLineParser,
    keywordQueryFor,
    LAYOUT_SCHEMA,
    layoutPrompt,
    MAX_QUERY_LENGTH,
    parseAiSearchSettings,
    parseLayoutAnswer,
    parsePlannerAnswer,
    PLANNER_SCHEMA,
    plannerPrompt,
} from "./aiSearch.js"
import { searchKeywords } from "./retrieval.js"

/**
 * GET /api/ai-search?q=…&country=…&topic=…: the AI-assisted search prototype.
 *
 * Finds candidate charts and articles with the site's keyword search
 * (optionally widened by a quick Haiku call that suggests extra searches),
 * then asks Claude to organise them into themed groups. The answer streams
 * back as newline-delimited JSON (AiSearchEvent), so groups render as soon as
 * the model writes them.
 *
 * Alongside the grouping, a quick Haiku call reads the search (text plus the
 * country and topic filters) and picks a layout: a lead chart for a measure,
 * a measure for a place, one specific indicator, a country and a topic, or a
 * broad topic. Anything else keeps the grouped layout.
 *
 * Every request costs a model call, so the endpoint only runs under `wrangler
 * pages dev` (ENV=development: staging servers and local dev) with an
 * ANTHROPIC_API_KEY, not in production or on public Cloudflare previews.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
    const url = new URL(request.url)
    const query = (url.searchParams.get("q") ?? "").trim()
    const listParam = (name: string): string[] =>
        url.searchParams
            .getAll(name)
            .map((value) => value.trim())
            .filter(Boolean)
            .slice(0, 5)
    const input: AiSearchInput = {
        query,
        countries: listParam("country"),
        topics: listParam("topic"),
    }

    if (env.ENV !== "development" || !env.ANTHROPIC_API_KEY)
        return jsonError(404, "AI search isn't available here.")
    if (!query && !input.countries.length && !input.topics.length)
        return jsonError(400, "Missing q parameter.")
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
        input,
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
    input,
    settings,
    emit,
    signal,
}: {
    env: Env
    input: AiSearchInput
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
    // What the keyword search runs with, and how the prompts name the search
    const query = keywordQueryFor(input)
    const label = [input.query, ...input.countries, ...input.topics]
        .filter(Boolean)
        .join(" · ")
    const filters = { countries: input.countries, topics: input.topics }

    emit({ type: "status", text: "Searching our charts and articles…" })
    const [base] = await time(
        "keyword search",
        searchKeywords(
            algolia,
            [query],
            { charts: chartPool, pages: pagePool },
            filters
        )
    )

    let expansions: string[] = []
    // Also runs when the search found nothing: keyword search needs every
    // word to match, so a question phrased as a sentence often finds nothing
    // until the planner rewrites it into short searches.
    if (settings.expand) {
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
                                content: plannerPrompt(label, topTitles),
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
              searchKeywords(
                  algolia,
                  expansions,
                  { charts: chartPool, pages: pagePool },
                  filters
              )
          )
        : []
    const pool = buildCandidatePool([base, ...expanded], {
        charts: chartPool,
        pages: pagePool,
    })
    if (!pool.charts.length && !pool.pages.length) {
        emit({ type: "error", code: "no_candidates" })
        return
    }
    emit({
        type: "candidates",
        // Entity lists are long and only needed here, to check the layout
        charts: pool.charts.map(
            ({ availableEntities: _entities, ...chart }) => chart
        ),
        pages: pool.pages.map(({ excerpt: _excerpt, ...page }) => page),
    })

    // Runs while the composer streams its groups
    const layout = time(
        "layout",
        pickLayout({ client, input, pool, settings, emit, signal })
    )

    emit({
        type: "status",
        text: `Grouping ${pool.charts.length} charts and ${pool.pages.length} articles by theme…`,
    })
    const prompt = composerPrompt(label, pool)
    if (settings.debug)
        emit({
            type: "debug",
            title: `Composer prompt (${Math.round(prompt.length / 1024)} KB)`,
            text: prompt,
        })

    let groupCount = 0
    let rawOutput = ""
    const parseLine = createComposerLineParser(pool)
    const splitter = createLineSplitter((line) => {
        const parsed = parseLine(line)
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
    await layout
    timings["grouping"] = Date.now() - composerStart
    timings["end to end"] = Date.now() - started

    if (settings.debug)
        emit({ type: "debug", title: "Raw model output", text: rawOutput })
    if (!groupCount) {
        emit({
            type: "error",
            code: message.stop_reason === "refusal" ? "refused" : "no_groups",
        })
        return
    }
    emit({ type: "done", model: message.model, timings })
}

/**
 * Asks Haiku which layout fits the search and emits it. A failure leaves the
 * grouped layout in place, so it is only reported in debug mode.
 */
async function pickLayout({
    client,
    input,
    pool,
    settings,
    emit,
    signal,
}: {
    client: Anthropic
    input: AiSearchInput
    pool: CandidatePool
    settings: AiSearchSettings
    emit: (event: AiSearchEvent) => void
    signal: AbortSignal
}): Promise<void> {
    const prompt = layoutPrompt(input, pool)
    try {
        const answer = await client.messages.create(
            {
                model: "claude-haiku-5-5",
                max_tokens: 1024,
                thinking: { type: "disabled" },
                output_config: {
                    format: { type: "json_schema", schema: LAYOUT_SCHEMA },
                },
                messages: [{ role: "user", content: prompt }],
            },
            { signal }
        )
        const text = textOf(answer.content)
        const layout = parseLayoutAnswer(
            text,
            input,
            pool,
            listedRegionsNames()
        )
        emit({ type: "layout", ...layout })
        if (settings.debug)
            emit({
                type: "debug",
                title: `Layout: ${layout.intent}`,
                text: `${prompt}\n\n--- answer ---\n${text}`,
            })
    } catch (error) {
        if (signal.aborted) return
        emit({ type: "layout", intent: "other", versions: [], topicPages: [] })
        if (settings.debug)
            emit({
                type: "debug",
                title: "Layout failed (keeping the grouped layout)",
                text: String(error),
            })
    }
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
