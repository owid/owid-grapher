import * as Sentry from "@sentry/cloudflare"
import {
    runDecisionModel,
    STATE_INTRO,
    timed,
    topChoices,
    type RerankModel,
} from "./rerank.js"
import { embedStaticTexts } from "./staticEmbedding.js"

/**
 * Experimental: widen the rerank pool with results keyword search misses, by
 * mapping the query onto the topic vocabulary. Opt-in via `vocab=1` next to a
 * rerank.
 *
 * The vocabulary partitions our charts into topics, each with a few search
 * terms picked because they find that topic's charts ("Air Pollution":
 * deaths, particulate matter, ozone, …). The query's VOCABULARY_TOPICS most
 * likely topics are picked, and each topic's top results are appended to the
 * pool, so "under nurished" brings in Hunger & Undernourishment's charts even
 * though the typo matched none. The rerank then decides whether any of them
 * belongs on top, so a poor pick costs a few weak candidates, not a wrong
 * result. The rerank prompt notes which topic found each of them
 * (vocabularyTopicNote), so the model can weigh a neighbouring topic's result
 * against the query's own hits.
 *
 * Charts pick their topics by static embedding (pickTopicsByEmbedding), which
 * runs in the function in well under a millisecond; pages pick them with a
 * decision model call (pickVocabularyTopics).
 *
 * Tried on the benchmark and dropped: searching a model-picked term within
 * each topic (two calls), the reader's query within each topic, topics by
 * bge-m3 embedding (a Workers AI call), topics voted for by the charts
 * matching the query, and topics whose terms share character trigrams with
 * the query. None beat taking each topic's top results, and the model calls
 * cost ~80–100 ms each.
 *
 * Like the rerank, a failed or slow pick leaves the pool as it was.
 */

const VOCABULARY_URL = "https://files.ourworldindata.org/topic_vocabulary.json"

// Topics picked per query. Two, because the topic probability is often split
// (energy questions between Energy and Energy Mix), and a second topic costs
// only one more search.
export const VOCABULARY_TOPICS = 2

// Results taken from each topic's search
export const VOCABULARY_HITS_PER_TERM = 5

// The pick, loads included; the pool goes to the rerank without it after
// this. The decision model's topic call takes ~300 ms at the median; the
// static pick hits this only while an isolate loads the model.
export const VOCABULARY_TIMEOUT_MS = 1500

const TOPIC_INSTRUCTIONS =
    "Which Our World in Data topic is this person most likely looking for data on?"

export interface VocabularyTopic {
    /** the topic's tag name, as the charts index's `tags` facet holds it */
    name: string
    keywords: string[]
}

export interface VocabularyTopicPick {
    topic: string
}

export interface VocabularyInfo {
    terms: VocabularyTopicPick[]
    latencyMs: number
    /** latencyMs by step: loading the vocabulary (and model), then the pick */
    steps?: { load: number; topic: number }
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

const unit = (vector: number[]): number[] => {
    const norm = Math.hypot(...vector)
    return norm > 0 ? vector.map((x) => x / norm) : vector
}

// Per isolate, like the vocabulary: the topics' vectors, unit length
let topicVectors: Promise<{ name: string; vector: number[] }[]> | undefined

function loadTopicVectors(): Promise<{ name: string; vector: number[] }[]> {
    topicVectors ??= loadVocabulary()
        .then(async (topics) => {
            const embedded = await embedStaticTexts(
                topics.map(
                    (topic) =>
                        `${topic.name}: ${topic.keywords.slice(0, 6).join(", ")}`
                )
            )
            return topics.map((topic, i) => ({
                name: topic.name,
                vector: unit(embedded[i]),
            }))
        })
        .catch((error) => {
            topicVectors = undefined // retry on the next request
            throw error
        })
    return topicVectors
}

/** Rejects after `ms`; the promise itself keeps running. */
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
    new Promise((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`timed out after ${ms} ms`)),
            ms
        )
        promise.then(resolve, reject).finally(() => clearTimeout(timer))
    })

/**
 * The query's VOCABULARY_TOPICS topics by static embedding similarity (see
 * staticEmbedding.ts), without a model call. A query with no word the model
 * knows picks none. `steps.load` is the vocabulary and model, loaded once per
 * isolate; a load slower than VOCABULARY_TIMEOUT_MS fails the pick, and
 * `waitUntil` keeps it running for the next request.
 */
export async function pickTopicsByEmbedding(
    query: string,
    waitUntil?: (promise: Promise<unknown>) => void
): Promise<VocabularyInfo> {
    const started = Date.now()
    try {
        const loading = loadTopicVectors()
        waitUntil?.(loading.catch(() => undefined))
        const { value: topics, ms: load } = await timed(() =>
            withTimeout(loading, VOCABULARY_TIMEOUT_MS)
        )
        const { value: terms, ms: topic } = await timed(async () => {
            const [queryVector] = await embedStaticTexts([query])
            if (queryVector.every((x) => x === 0)) return []
            const q = unit(queryVector)
            return topics
                .map(({ name, vector }) => ({
                    topic: name,
                    score: vector.reduce((sum, x, i) => sum + x * q[i], 0),
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, VOCABULARY_TOPICS)
                .map(({ topic }) => ({ topic }))
        })
        return {
            terms,
            latencyMs: Date.now() - started,
            steps: { load, topic },
        }
    } catch (error) {
        return failedPicks(error, started)
    }
}

/** Failed picks: no terms, so the pool is reranked as it was. */
function failedPicks(error: unknown, started: number): VocabularyInfo {
    console.error("Search vocabulary picks failed:", error)
    Sentry.captureException(error)
    return {
        terms: [],
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
    }
}

/**
 * The query's VOCABULARY_TOPICS most likely topics, by one decision model
 * call. For pages (articles, data insights), where a topic has few enough of
 * them that its pages are the candidates.
 */
export async function pickVocabularyTopics(
    ai: Ai,
    model: RerankModel,
    query: string
): Promise<VocabularyInfo> {
    const started = Date.now()
    try {
        const signal = AbortSignal.timeout(VOCABULARY_TIMEOUT_MS)
        const { value: topics, ms: load } = await timed(loadVocabulary)
        const { value: answers, ms: topic } = await timed(() =>
            runDecisionModel(
                ai,
                model,
                `${STATE_INTRO}\n\nQuery: ${query}`,
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
        )
        const terms = topChoices(answers.topic, VOCABULARY_TOPICS)
            .map((id) => topics[optionIndex(id)])
            .filter((picked) => picked !== undefined)
            .map((picked) => ({ topic: picked.name }))
        return {
            terms,
            latencyMs: Date.now() - started,
            steps: { load, topic },
        }
    } catch (error) {
        return failedPicks(error, started)
    }
}

/**
 * Searches each picked topic (a failed search contributes nothing) and
 * appends the hits the pool doesn't have yet, in pick order. `via` maps each
 * appended hit's key to the pick that found it.
 */
export async function appendVocabularyHits<T>(
    pool: T[],
    terms: VocabularyTopicPick[],
    search: (term: VocabularyTopicPick) => Promise<T[]>,
    key: (hit: T) => string
): Promise<{ hits: T[]; via: Map<string, VocabularyTopicPick> }> {
    const perTerm = await Promise.all(
        terms.map((term) =>
            search(term).catch((error) => {
                console.error("Search vocabulary topic failed:", error)
                return []
            })
        )
    )
    const seen = new Set(pool.map(key))
    const merged = [...pool]
    const via = new Map<string, VocabularyTopicPick>()
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
 * The rerank prompt's note on a hit added from a vocabulary topic. On the
 * benchmark such notes moved a few relevant keyword hits back above a
 * neighbouring topic's result ("work laws", "heat").
 */
export const vocabularyTopicNote = (pick: VocabularyTopicPick): string =>
    `found by browsing the related topic ${pick.topic}, not by the query itself`
