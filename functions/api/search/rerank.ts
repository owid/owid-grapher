import * as Sentry from "@sentry/cloudflare"
import { ChartRecordType } from "@ourworldindata/types"
import { RERANK_POOL_SIZE } from "@ourworldindata/utils"
import type { SearchApiResponse, SearchPagesApiResponse } from "./searchApi.js"

/**
 * Experimental: reorder a charts search with a "decision model" — one that
 * returns typed answers with probabilities in a single pass instead of
 * generating text, which makes an LLM relevance judgment cheap and fast
 * enough for a live search request. Opt-in via `/api/search?rerank=jev`, so
 * the search-demand evaluator in owid/analytics can compare it against the
 * same deployment without the parameter, and via the search page's
 * `?rerank=jev`, which sends its charts search to rerank-charts.ts.
 *
 * One call per search, with two questions about the same state (the query and
 * the top RERANK_POOL_SIZE Algolia hits):
 *
 * - `best_result` (choice): which hit best matches the search. Hits are
 *   ordered by their choice probability, ties keeping Algolia's order. One
 *   listwise question rather than a yes/no per hit, which ranked better in
 *   published tests of the same model, at a fraction of the calls.
 * - `any_relevant` (yes/no): whether any hit directly answers the query.
 *   Returned, not acted on, so its calibration can be checked before it
 *   decides anything (e.g. a "No exact matches" notice).
 *
 * A failed or refused call keeps Algolia's order: reranking must never be the
 * reason a search fails.
 */

export { RERANK_POOL_SIZE }

// Decision models on Workers AI, keyed by the `rerank` param value. They all
// take the same state-and-questions input; Cloudflare's Clef models also
// require a `model` selector in it. Pinned versions would be better than these
// moving aliases once the experiment settles.
interface RerankModelSpec {
    id: string
    selector?: string
}
export const RERANK_MODELS = {
    jev: { id: "typesafe/jev" },
    "clef-flash": { id: "@cf/cloudflare/clef-flash", selector: "clef-flash" },
    clef: { id: "@cf/cloudflare/clef", selector: "clef" },
    "clef-omni": { id: "@cf/cloudflare/clef-omni", selector: "clef-omni" },
} as const satisfies Record<string, RerankModelSpec>
export type RerankModel = keyof typeof RERANK_MODELS

// The AI Gateway the calls go through, for per-call logs (latency, cost,
// errors) and its rate limit, which caps spend if the endpoints are abused.
// The limit is set in the gateway (5,000 calls a minute, ~20× a realistic
// peak of the site's searches), not here. The hop costs ~50 ms per call
// (paired timing against calling Workers AI directly); a WAF rate-limit rule
// on the endpoints would cap spend without it, at the price of the logs.
const RERANK_GATEWAY_ID = "owid-search"

// A rerank slower than this keeps Algolia's order instead: the search must
// not wait seconds for it. Decision models answer in a few hundred ms (OpenAI
// Decisions measured p95 0.36 s), so this only cuts off a stalled call.
export const RERANK_TIMEOUT_MS = 1000

/**
 * Where a reranked search's time went, in ms, for finding what to speed up.
 * `pool` (the Algolia search) and `vocabulary` run side by side.
 */
export interface SearchTimings {
    pool: number
    vocabulary?: number
    termSearches?: number
    rerank: number
    total: number
}

/** `run`'s result and how long it took. */
export async function timed<T>(
    run: () => Promise<T>
): Promise<{ value: T; ms: number }> {
    const started = Date.now()
    const value = await run()
    return { value, ms: Date.now() - started }
}

export const isRerankModel = (value: string): value is RerankModel =>
    Object.hasOwn(RERANK_MODELS, value)

// Kept identical to experiments/search_demand/rerank.py in owid/analytics,
// so offline and deployed runs score the same prompt.
export const STATE_INTRO =
    "Someone typed this query into the site search of Our World in Data, which publishes " +
    "charts, data explorers and articles on global problems (health, population, economy, " +
    "energy, environment, food, education, conflict, …):"
const BEST_INSTRUCTIONS =
    "Which search result best matches what this person is looking for?"
const ANY_RELEVANT_INSTRUCTIONS =
    "At least one of the search results directly answers what this person is looking for."

export interface RerankInfo {
    model: string
    poolSize: number
    latencyMs: number
    /** P(at least one pool hit directly answers the query) */
    anyRelevant?: number
    /** the model declined to choose; Algolia's order was kept */
    refused?: boolean
    /** the call failed; Algolia's order was kept */
    error?: string
}

const candidateId = (index: number): string =>
    `r${String(index + 1).padStart(2, "0")}`

// Explains the notes on vocabulary hits (vocabulary.ts). Only a noted prompt has
// it, so without notes the prompt stays identical to the offline one.
const NOTES_INTRO =
    "Results with a note in parentheses weren't found by the query itself, but by a search on a related topic."

function buildState<T extends RerankableHit>(
    query: string,
    hits: T[],
    note?: (hit: T) => string | undefined
): string {
    const notes = hits.map((hit) => note?.(hit))
    const listing = hits
        .map((hit, i) => {
            const kind =
                hit.type === ChartRecordType.Chart ? "" : ` [${hit.type}]`
            const subtitle = (hit.subtitle ?? "").slice(0, 200)
            const noted = notes[i] ? ` (${notes[i]})` : ""
            const passage = hit.passage
                ? ` Matching passage: "${hit.passage.slice(0, 200)}"`
                : ""
            return `${candidateId(i)}. ${hit.title}${kind} — ${subtitle}${noted}${passage}`
        })
        .join("\n")
    const intro = notes.some(Boolean) ? `${NOTES_INTRO}\n` : ""
    return `${STATE_INTRO}\n\nQuery: ${query}\n\nSearch results:\n${intro}${listing}`
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null

interface ParsedAnswers {
    probabilities?: Record<string, number>
    refused: boolean
    anyRelevant?: number
}

/** Reads the rerank's typed answers, failing loudly on any other shape. */
function parseAnswers(answers: Record<string, unknown>): ParsedAnswers {
    const best = answers.best_result
    const anyRelevant = answers.any_relevant
    const anyRelevantP =
        isRecord(anyRelevant) && typeof anyRelevant.noul === "number"
            ? anyRelevant.noul
            : undefined
    if (isRecord(best) && best.type === "refusal")
        return { refused: true, anyRelevant: anyRelevantP }
    if (!isRecord(best) || !isRecord(best.probabilities))
        throw new Error("rerank response has no best_result choice")
    const probabilities: Record<string, number> = {}
    for (const [id, p] of Object.entries(best.probabilities))
        if (typeof p === "number") probabilities[id] = p
    return { probabilities, refused: false, anyRelevant: anyRelevantP }
}

/** The ids of a choice answer's `n` most likely options, most likely first. */
export function topChoices(answer: unknown, n: number): string[] {
    if (
        !isRecord(answer) ||
        answer.type === "refusal" ||
        !isRecord(answer.probabilities)
    )
        return []
    return Object.entries(answer.probabilities)
        .filter(
            (entry): entry is [string, number] => typeof entry[1] === "number"
        )
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([id]) => id)
}

/**
 * One decision-model call through the AI Gateway: the answers to `questions`
 * about `state`, keyed like `questions`. Throws on a failed call or a
 * response without answers.
 */
export async function runDecisionModel(
    ai: Ai,
    model: RerankModel,
    state: string,
    questions: Record<string, unknown>,
    signal: AbortSignal
): Promise<Record<string, unknown>> {
    const { id, selector }: RerankModelSpec = RERANK_MODELS[model]
    const response = await ai.run(
        id,
        { ...(selector && { model: selector }), state, questions },
        { gateway: { id: RERANK_GATEWAY_ID }, signal }
    )
    // Jev wraps its answers in { state, result }; Clef returns them directly
    const body = isRecord(response.result) ? response.result : response
    if (!isRecord(body.answers))
        throw new Error("decision model response has no answers")
    return body.answers
}

/** A hit as the rerank prompt reads it: Algolia's and /api/search's alike. */
export interface RerankableHit {
    title: string
    subtitle?: string
    /** a chart record type, or a page type such as `article` */
    type: string
    /** the text of a page that matched the query, when `subtitle` isn't it */
    passage?: string
}

/**
 * How the rerank prompt describes a page. Its excerpt says what the page is
 * about; Algolia's matched text (`content`) says why it was found, and can
 * come from anywhere in an article. The model needs both: on the matched text
 * alone, a CO₂ dataset article's paragraph on its GDP source won "gdp", and
 * on the excerpt alone it can't see that an article has a section on the
 * query. A page without an excerpt (a data insight) is described by its text.
 */
export const describePage = (page: {
    excerpt?: string
    content?: string
}): Pick<RerankableHit, "subtitle" | "passage"> =>
    page.excerpt
        ? { subtitle: page.excerpt, passage: page.content }
        : { subtitle: page.content }

/**
 * Reorders `hits` (in Algolia's order) by the model's choice probabilities.
 * Returns every hit, so callers cut pages from the reordered list. `note`
 * adds a remark to a hit's line in the prompt (vocabulary.ts).
 */
export async function rerankHits<T extends RerankableHit>(
    ai: Ai,
    model: RerankModel,
    query: string,
    hits: T[],
    note?: (hit: T) => string | undefined
): Promise<{ hits: T[]; rerank: RerankInfo }> {
    const keepOrder = (
        info: Omit<RerankInfo, "model" | "poolSize">
    ): { hits: T[]; rerank: RerankInfo } => ({
        hits,
        rerank: { model, poolSize: hits.length, ...info },
    })

    // Nothing to reorder
    if (hits.length < 2) return keepOrder({ latencyMs: 0 })

    const ids = hits.map((_, i) => candidateId(i))
    const started = Date.now()
    let parsed: ParsedAnswers
    try {
        const answers = await runDecisionModel(
            ai,
            model,
            buildState(query, hits, note),
            {
                best_result: {
                    type: "choice",
                    instructions: BEST_INSTRUCTIONS,
                    criteria: Object.fromEntries(
                        hits.map((hit, i) => [ids[i], hit.title])
                    ),
                },
                any_relevant: {
                    type: "noul",
                    instructions: ANY_RELEVANT_INSTRUCTIONS,
                },
            },
            AbortSignal.timeout(RERANK_TIMEOUT_MS)
        )
        parsed = parseAnswers(answers)
    } catch (error) {
        console.error("Search rerank failed:", error)
        Sentry.captureException(error)
        return keepOrder({
            latencyMs: Date.now() - started,
            error: error instanceof Error ? error.message : String(error),
        })
    }
    const latencyMs = Date.now() - started
    if (parsed.refused || !parsed.probabilities)
        return keepOrder({
            latencyMs,
            refused: true,
            anyRelevant: parsed.anyRelevant,
        })

    const probabilities = parsed.probabilities
    const order = hits
        .map((hit, i) => ({ hit, i, p: probabilities[ids[i]] ?? 0 }))
        .sort((a, b) => b.p - a.p || a.i - b.i)
    return {
        hits: order.map(({ hit }) => hit),
        rerank: {
            model,
            poolSize: hits.length,
            latencyMs,
            anyRelevant: parsed.anyRelevant,
        },
    }
}

/** /api/search's reranked charts: one page, cut from the reordered pool. */
export async function rerankCharts(
    ai: Ai,
    model: RerankModel,
    pool: SearchApiResponse,
    hitsPerPage: number,
    note?: (hit: SearchApiResponse["results"][number]) => string | undefined
): Promise<SearchApiResponse & { rerank: RerankInfo }> {
    const { hits, rerank } = await rerankHits(
        ai,
        model,
        pool.query,
        pool.results,
        note
    )
    return {
        ...pool,
        results: hits.slice(0, hitsPerPage),
        hitsPerPage,
        nbPages: 1,
        rerank,
    }
}

/**
 * /api/search's reranked pages (articles, data insights, …): one page, cut
 * from the reordered pool (see describePage).
 */
export async function rerankPages(
    ai: Ai,
    model: RerankModel,
    pool: SearchPagesApiResponse,
    length: number,
    note?: (
        page: SearchPagesApiResponse["results"][number]
    ) => string | undefined
): Promise<SearchPagesApiResponse & { rerank: RerankInfo }> {
    const { hits, rerank } = await rerankHits(
        ai,
        model,
        pool.query,
        pool.results.map((page) => ({
            page,
            title: page.title,
            type: page.type,
            ...describePage(page),
        })),
        note && ((hit) => note(hit.page))
    )
    return {
        ...pool,
        results: hits.slice(0, length).map((hit) => hit.page),
        length,
        rerank,
    }
}
