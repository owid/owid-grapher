import { SEARCH_EMBEDDING_MODEL } from "@ourworldindata/utils"

// Experimental: /api/search?rerank=…&vectors=1 widens the rerank's pool with
// the records nearest to the query by embedding. Algolia wants the query's
// words in a record, so a search worded differently from our titles ("how
// rich are countries") finds little; the nearest records by meaning give the
// rerank something to choose from, without the model call the topic search
// (vocabulary.ts) spends on picking topics.
//
// The vectors are built by baker/vectorize/buildSearchEmbeddings.ts, one per
// Algolia record, with the record's objectID as the vector's id. This module
// only finds the ids: the caller fetches those records from Algolia, with
// the search's own filters, so a vector hit looks like any other hit.

/** New hits the vector search may add to a pool. */
export const VECTOR_CANDIDATES = 10

/**
 * Nearest records to ask for. Several can belong to one chart or page (a
 * chart's views, a page's passages) or already be in the pool, so this asks
 * for more than VECTOR_CANDIDATES.
 */
const VECTOR_TOP_K = 40

/**
 * A lookup slower than this adds nothing: the pool is reranked as Algolia
 * returned it. Embedding the query and querying the index take about 0.2 s
 * each, so this only cuts off a stalled call.
 */
export const VECTOR_TIMEOUT_MS = 1500

export interface VectorInfo {
    /** objectIDs of the nearest records, nearest first */
    ids: string[]
    latencyMs: number
    /** latencyMs by step: embedding the query, then querying the index */
    steps?: { embed: number; query: number }
    /** the lookup failed; the pool was reranked without it */
    error?: string
}

async function lookUp(
    ai: Ai,
    index: Vectorize,
    query: string,
    namespace: string,
    types?: string[]
): Promise<Pick<VectorInfo, "ids" | "steps">> {
    const started = Date.now()
    const embedded = (await ai.run(SEARCH_EMBEDDING_MODEL, {
        text: [query],
    })) as { data?: number[][] }
    const vector = embedded.data?.[0]
    if (!vector) throw new Error("The embedding model returned no vector")
    const embedMs = Date.now() - started

    const found = await index.query(vector, {
        topK: VECTOR_TOP_K,
        namespace,
        ...(types && { filter: { type: { $in: types } } }),
    })
    return {
        ids: found.matches.map((match) => match.id),
        steps: { embed: embedMs, query: Date.now() - started - embedMs },
    }
}

/**
 * The records nearest to the query in one namespace of the index (see
 * VECTOR_NAMESPACES), optionally only those of some record types. Never
 * throws: a failed or slow lookup yields no ids and says why.
 */
export async function findVectorCandidates(
    ai: Ai,
    index: Vectorize,
    query: string,
    namespace: string,
    types?: string[]
): Promise<VectorInfo> {
    const started = Date.now()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
        const found = await Promise.race([
            lookUp(ai, index, query, namespace, types),
            new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error("Vector lookup timed out")),
                    VECTOR_TIMEOUT_MS
                )
            }),
        ])
        return { ...found, latencyMs: Date.now() - started }
    } catch (error) {
        console.error("Search vector lookup failed:", error)
        return {
            ids: [],
            latencyMs: Date.now() - started,
            error: error instanceof Error ? error.message : String(error),
        }
    } finally {
        clearTimeout(timer)
    }
}

/**
 * The pool with up to VECTOR_CANDIDATES of the vector hits it lacks, in the
 * order given (nearest first).
 */
export function appendVectorHits<T>(
    pool: T[],
    vectorHits: T[],
    key: (hit: T) => string
): T[] {
    const seen = new Set(pool.map(key))
    const added: T[] = []
    for (const hit of vectorHits) {
        if (added.length === VECTOR_CANDIDATES) break
        if (seen.has(key(hit))) continue
        seen.add(key(hit))
        added.push(hit)
    }
    return [...pool, ...added]
}
