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
 * so a poor pick costs a few weak candidates, not a wrong result. The rerank
 * prompt notes which topic search found each of them (vocabularyNote), so the
 * model can weigh a neighbouring topic's chart against the query's own hits.
 *
 * Like the rerank, a failed or slow pick leaves the pool as it was.
 */

const VOCABULARY_URL = "https://files.ourworldindata.org/topic_vocabulary.json"

// Topics to pick a term from. Two, because the topic probability is often
// split (energy questions between Energy and Energy Mix), and a second term
// costs only one more search.
export const VOCABULARY_TOPICS = 2

// Hits taken from each term's search
export const VOCABULARY_HITS_PER_TERM = 5

// Both calls together; the pool goes to the rerank without them after this.
// The two calls take ~650 ms at the median and ~900 ms at p95, so a 1 s cap
// cut off 2–11% of picks per benchmark run.
export const VOCABULARY_TIMEOUT_MS = 1500

const TOPIC_INSTRUCTIONS =
    "Which Our World in Data topic is this person most likely looking for data on?"
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

export interface VocabularyInfo {
    terms: VocabularyTerm[]
    latencyMs: number
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
    query: string
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
                    criteria: Object.fromEntries(
                        topics.map((topic, i) => [
                            optionId("t", i),
                            `${topic.name} (e.g. ${topic.keywords.slice(0, 6).join(", ")})`,
                        ])
                    ),
                },
            },
            signal
        )
        const picked = topChoices(topicAnswers.topic, VOCABULARY_TOPICS)
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

/**
 * The rerank prompt's note on a vocabulary hit. On the benchmark it moved a
 * few relevant keyword hits back above a neighbouring topic's chart ("work
 * laws", "heat").
 */
export const vocabularyNote = (term: VocabularyTerm): string =>
    `found by searching the related topic ${term.topic} for "${term.keyword}", not by the query itself`
