import * as Sentry from "@sentry/cloudflare"
import {
    runDecisionModel,
    STATE_INTRO,
    topChoices,
    type RerankModel,
} from "./rerank.js"

/**
 * Experimental: widen the rerank pool with charts keyword search misses, by
 * translating the query into the topic vocabulary. Opt-in via `vocab=1` next
 * to a rerank.
 *
 * The vocabulary partitions our charts into topics, each with a few search
 * terms picked because they find that topic's charts ("Air Pollution":
 * deaths, particulate matter, ozone, …). A decision model can't write a new
 * query, but it can choose from that list, so "under nurished" becomes
 * Hunger & Undernourishment: undernourishment, and searching that term within
 * its topic finds the charts the typo missed.
 *
 * Two calls in a row, because a choice question takes at most 255 options and
 * a call at most 64 questions: the query's VOCABULARY_TOPICS most likely
 * topics, then the best term within each. Each term's top hits are appended
 * to the pool; the rerank then decides whether any of them belongs on top,
 * so a poor pick costs a few weak candidates, not a wrong result.
 *
 * Like the rerank, a failed or slow pick leaves the pool as it was.
 *
 * Two variants under test, both opt-in through the same param
 * (`vocab=skip`, `vocab=tag` or `vocab=skip,tag`; see parseVocabParam):
 * - skip: the topic question gets a "no rewrite" option, and a query whose
 *   most likely answer is that option gets no vocabulary hits.
 * - tag: the rerank prompt marks each vocabulary hit with the topic search
 *   that found it, so the model can weigh it against the query's own hits.
 */

const VOCABULARY_URL = "https://files.ourworldindata.org/topic_vocabulary.json"

// Topics to pick a term from. Two, because the topic probability is often
// split (energy questions between Energy and Energy Mix), and a second term
// costs only one more search.
export const VOCABULARY_TOPICS = 2

// Hits taken from each term's search
export const VOCABULARY_HITS_PER_TERM = 5

// Both calls together; the pool goes to the rerank without them after this
export const VOCABULARY_TIMEOUT_MS = 1000

const TOPIC_INSTRUCTIONS =
    "Which Our World in Data topic is this person most likely looking for data on?"
// The option that lets the topic question answer "no rewrite" (vocab=skip)
const NO_REWRITE_ID = "none"
const NO_REWRITE_OPTION =
    "None: the query's own words already name the data, so no topic's terms are needed"

const keywordInstructions = (topic: string): string =>
    `Within the topic ${topic}, which search term best describes the data this person is looking for?`

export interface VocabularyTopic {
    /** the topic's tag name, as the charts index's `tags` facet holds it */
    name: string
    keywords: string[]
}

export interface VocabularyTerm {
    topic: string
    keyword: string
}

export interface VocabularyOptions {
    /** the topic question may answer "no rewrite" (vocab=skip) */
    skip: boolean
    /** the rerank prompt marks vocabulary hits (vocab=tag) */
    tag: boolean
}

const VOCAB_VARIANTS = ["skip", "tag"] as const

/**
 * The `vocab` param: "1" for the plain vocabulary, or a comma-separated list
 * of variants. Undefined when absent; throws on anything else.
 */
export function parseVocabParam(
    value: string | null
): VocabularyOptions | undefined {
    if (value === null || value === "") return undefined
    if (value === "1") return { skip: false, tag: false }
    const variants = value.split(",")
    if (
        !variants.every((v) =>
            (VOCAB_VARIANTS as readonly string[]).includes(v)
        )
    )
        throw new Error(
            `Invalid vocab value "${value}". Use vocab=1, or a comma-separated list of ${VOCAB_VARIANTS.join(", ")}`
        )
    return { skip: variants.includes("skip"), tag: variants.includes("tag") }
}

export interface VocabularyInfo {
    terms: VocabularyTerm[]
    latencyMs: number
    /** the topic question answered "no rewrite" (vocab=skip) */
    skipped?: boolean
    /** the picks failed; the pool was reranked without them */
    error?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The vocabulary file's topics, failing loudly on any other shape. */
export function parseVocabulary(json: unknown): VocabularyTopic[] {
    if (!isRecord(json)) throw new Error("vocabulary is not an object")
    const topics = Object.values(json).map((entry): VocabularyTopic => {
        if (
            !isRecord(entry) ||
            typeof entry.topic_name !== "string" ||
            !Array.isArray(entry.keywords) ||
            entry.keywords.length === 0 ||
            !entry.keywords.every((k) => typeof k === "string")
        )
            throw new Error("vocabulary has a malformed topic")
        return { name: entry.topic_name, keywords: entry.keywords }
    })
    if (topics.length < 2 || topics.length > 255)
        throw new Error(`vocabulary has ${topics.length} topics`)
    return topics
}

// Per isolate: the file changes when the vocabulary is regenerated, months
// apart, and the edge cache keeps the fetch cheap after a cold start
let vocabulary: Promise<VocabularyTopic[]> | undefined

function loadVocabulary(): Promise<VocabularyTopic[]> {
    vocabulary ??= fetch(VOCABULARY_URL, {
        cf: { cacheTtl: 3600, cacheEverything: true },
    })
        .then((response) => {
            if (!response.ok)
                throw new Error(`vocabulary fetch failed: ${response.status}`)
            return response.json()
        })
        .then(parseVocabulary)
        .catch((error) => {
            vocabulary = undefined // retry on the next request
            throw error
        })
    return vocabulary
}

const optionId = (prefix: string, index: number): string => `${prefix}${index}`
const optionIndex = (id: string): number => Number(id.slice(1))

/** The query's most likely topics, each with its best search term. */
export async function pickVocabularyTerms(
    ai: Ai,
    model: RerankModel,
    query: string,
    options: Pick<VocabularyOptions, "skip"> = { skip: false }
): Promise<VocabularyInfo> {
    const started = Date.now()
    const signal = AbortSignal.timeout(VOCABULARY_TIMEOUT_MS)
    try {
        const topics = await loadVocabulary()
        const state = `${STATE_INTRO}\n\nQuery: ${query}`

        const topicAnswers = await runDecisionModel(
            ai,
            model,
            state,
            {
                topic: {
                    type: "choice",
                    instructions: TOPIC_INSTRUCTIONS,
                    criteria: Object.fromEntries([
                        ...topics.map((topic, i) => [
                            optionId("t", i),
                            `${topic.name} (e.g. ${topic.keywords.slice(0, 6).join(", ")})`,
                        ]),
                        ...(options.skip
                            ? [[NO_REWRITE_ID, NO_REWRITE_OPTION]]
                            : []),
                    ]),
                },
            },
            signal
        )
        const ranked = topChoices(topicAnswers.topic, VOCABULARY_TOPICS + 1)
        if (ranked[0] === NO_REWRITE_ID)
            return { terms: [], latencyMs: Date.now() - started, skipped: true }
        const picked = ranked
            .filter((id) => id !== NO_REWRITE_ID)
            .slice(0, VOCABULARY_TOPICS)
            .map((id) => topics[optionIndex(id)])
            .filter((topic) => topic !== undefined)

        // A choice needs two options, so a one-term topic needs no question
        const questions = Object.fromEntries(
            picked.flatMap((topic, i) =>
                topic.keywords.length > 1
                    ? [
                          [
                              optionId("k", i),
                              {
                                  type: "choice",
                                  instructions: keywordInstructions(topic.name),
                                  criteria: Object.fromEntries(
                                      topic.keywords.map((keyword, j) => [
                                          optionId("k", j),
                                          keyword,
                                      ])
                                  ),
                              },
                          ],
                      ]
                    : []
            )
        )
        const keywordAnswers =
            Object.keys(questions).length > 0
                ? await runDecisionModel(ai, model, state, questions, signal)
                : {}

        const terms = picked.flatMap((topic, i): VocabularyTerm[] => {
            if (topic.keywords.length === 1)
                return [{ topic: topic.name, keyword: topic.keywords[0] }]
            const [best] = topChoices(keywordAnswers[optionId("k", i)], 1)
            const keyword = best && topic.keywords[optionIndex(best)]
            return keyword ? [{ topic: topic.name, keyword }] : []
        })
        return { terms, latencyMs: Date.now() - started }
    } catch (error) {
        console.error("Search vocabulary picks failed:", error)
        Sentry.captureException(error)
        return {
            terms: [],
            latencyMs: Date.now() - started,
            error: error instanceof Error ? error.message : String(error),
        }
    }
}

/**
 * Searches each term (a failed search contributes nothing) and appends the
 * hits the pool doesn't have yet, in term order. `via` maps each appended
 * hit's key to the term that found it.
 */
export async function appendVocabularyHits<T>(
    pool: T[],
    terms: VocabularyTerm[],
    search: (term: VocabularyTerm) => Promise<T[]>,
    key: (hit: T) => string
): Promise<{ hits: T[]; via: Map<string, VocabularyTerm> }> {
    const perTerm = await Promise.all(
        terms.map((term) =>
            search(term).catch((error) => {
                console.error("Search vocabulary term failed:", error)
                return []
            })
        )
    )
    const seen = new Set(pool.map(key))
    const merged = [...pool]
    const via = new Map<string, VocabularyTerm>()
    perTerm.forEach((hits, i) => {
        for (const hit of hits) {
            if (seen.has(key(hit))) continue
            seen.add(key(hit))
            merged.push(hit)
            via.set(key(hit), terms[i])
        }
    })
    return { hits: merged, via }
}

/** The rerank prompt's note on a vocabulary hit (vocab=tag). */
export const vocabularyNote = (term: VocabularyTerm): string =>
    `found by searching the related topic ${term.topic} for "${term.keyword}", not by the query itself`
