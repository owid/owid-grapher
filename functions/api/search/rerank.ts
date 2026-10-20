import * as Sentry from "@sentry/cloudflare"
import { ChartRecordType } from "@ourworldindata/types"
import type { EnrichedSearchChartHit, SearchApiResponse } from "./searchApi.js"

/**
 * Experimental: reorder a charts search with a "decision model" — one that
 * returns typed answers with probabilities in a single pass instead of
 * generating text, which makes an LLM relevance judgment cheap and fast
 * enough for a live search request. Opt-in via `/api/search?rerank=jev`, so
 * the search-demand evaluator in owid/analytics can compare it against the
 * same deployment without the parameter.
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

export const RERANK_POOL_SIZE = 30

// Model ids on Workers AI, keyed by the `rerank` param value. Pinned versions
// would be better than these moving aliases once the experiment settles.
export const RERANK_MODELS = { jev: "typesafe/jev" } as const
export type RerankModel = keyof typeof RERANK_MODELS

export const isRerankModel = (value: string): value is RerankModel =>
    Object.hasOwn(RERANK_MODELS, value)

// Kept identical to experiments/search_demand/rerank.py in owid/analytics,
// so offline and deployed runs score the same prompt.
const STATE_INTRO =
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

function buildState(query: string, hits: EnrichedSearchChartHit[]): string {
    const listing = hits
        .map((hit, i) => {
            const kind =
                hit.type === ChartRecordType.Chart ? "" : ` [${hit.type}]`
            const subtitle = (hit.subtitle ?? "").slice(0, 200)
            return `${candidateId(i)}. ${hit.title}${kind} — ${subtitle}`
        })
        .join("\n")
    return `${STATE_INTRO}\n\nQuery: ${query}\n\nSearch results:\n${listing}`
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null

interface ParsedAnswers {
    probabilities?: Record<string, number>
    refused: boolean
    anyRelevant?: number
}

/** Reads Jev's typed answers, failing loudly on any other shape. */
function parseAnswers(response: Record<string, unknown>): ParsedAnswers {
    const answers = response.answers
    if (!isRecord(answers)) throw new Error("rerank response has no answers")
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

export async function rerankCharts(
    ai: Ai,
    model: RerankModel,
    pool: SearchApiResponse,
    hitsPerPage: number
): Promise<SearchApiResponse & { rerank: RerankInfo }> {
    const hits = pool.results
    const keepOrder = (
        info: Omit<RerankInfo, "model" | "poolSize">
    ): SearchApiResponse & { rerank: RerankInfo } => ({
        ...pool,
        results: hits.slice(0, hitsPerPage),
        hitsPerPage,
        nbPages: 1,
        rerank: { model, poolSize: hits.length, ...info },
    })

    // Nothing to reorder
    if (hits.length < 2) return keepOrder({ latencyMs: 0 })

    const ids = hits.map((_, i) => candidateId(i))
    const started = Date.now()
    let parsed: ParsedAnswers
    try {
        const response = await ai.run(RERANK_MODELS[model], {
            state: buildState(pool.query, hits),
            questions: {
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
        })
        parsed = parseAnswers(response)
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
        ...pool,
        results: order.slice(0, hitsPerPage).map(({ hit }) => hit),
        hitsPerPage,
        nbPages: 1,
        rerank: {
            model,
            poolSize: hits.length,
            latencyMs,
            anyRelevant: parsed.anyRelevant,
        },
    }
}
