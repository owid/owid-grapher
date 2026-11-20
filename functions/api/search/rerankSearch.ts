import { FilterType } from "@ourworldindata/types"
import {
    getFilterNamesOfType,
    type SectionSearchState,
} from "@ourworldindata/utils"
import { AlgoliaConfig } from "./algoliaClient.js"
import {
    RERANK_POOL_SIZE,
    rerankCharts,
    rerankPages,
    timed,
    type RerankInfo,
    type RerankModel,
    type SearchTimings,
} from "./rerank.js"
import {
    searchCharts,
    searchPages,
    type EnrichedSearchPageHit,
    type SearchApiOptions,
    type SearchApiResponse,
    type SearchPagesApiResponse,
} from "./searchApi.js"
import {
    appendVocabularyHits,
    pickTopicsByEmbedding,
    pickVocabularyTopics,
    VOCABULARY_HITS_PER_TERM,
    vocabularyTopicNote,
    type VocabularyInfo,
} from "./vocabulary.js"

/**
 * /api/search's experimental `rerank` (see rerank.ts) and `vocab` (see
 * vocabulary.ts) params.
 *
 * A rerank reorders Algolia's top hits as one pool, and the requested page is
 * cut from the reordered pool. Every page within the pool is served this way,
 * each request reranking the pool again (cheap next to keeping state between
 * requests), and the pages after it come from Algolia directly, starting
 * exactly where the pool ends, so the search page's "show more" neither
 * repeats nor skips a hit.
 */

export interface RerankOptions {
    ai: Ai
    model: RerankModel
    /** widen the pool with the top results of the query's topics */
    vocab: boolean
    waitUntil: (promise: Promise<unknown>) => void
}

type Reranked<TResponse> = TResponse & {
    rerank: RerankInfo
    vocabulary?: VocabularyInfo
    timings: SearchTimings
}

/**
 * How many pages of a charts search the reranked pool covers: as many whole
 * pages as fit in RERANK_POOL_SIZE, since charts are searched by page.
 */
export const chartsRerankPages = (hitsPerPage: number): number =>
    Math.max(1, Math.floor(RERANK_POOL_SIZE / hitsPerPage))

/** An empty search within a topic: its results in Algolia's default order. */
const withinTopic = (
    state: SectionSearchState,
    topic: string
): SectionSearchState => ({
    ...state,
    query: "",
    filters: [...state.filters, { type: FilterType.TOPIC, name: topic }],
})

// A search already filtered to a topic gets no topic hits: the reader chose
// the topic
const hasTopicFilter = (state: SectionSearchState): boolean =>
    getFilterNamesOfType(state.filters, FilterType.TOPIC).size > 0

/**
 * The pool with the picked topics' hits appended (none without picks), and
 * the rerank prompt's note on each appended hit.
 */
async function withTopicHits<THit extends { url: string }>(
    pool: THit[],
    vocabulary: VocabularyInfo | undefined,
    searchTopic: (topic: string) => Promise<THit[]>
): Promise<{
    hits: THit[]
    note: (hit: THit) => string | undefined
    ms: number
}> {
    if (!vocabulary) return { hits: pool, note: () => undefined, ms: 0 }
    const {
        value: { hits, via },
        ms,
    } = await timed(() =>
        appendVocabularyHits(
            pool,
            vocabulary.terms,
            (pick) => searchTopic(pick.topic),
            (hit) => hit.url
        )
    )
    const note = (hit: THit): string | undefined => {
        const pick = via.get(hit.url)
        return pick && vocabularyTopicNote(pick)
    }
    return { hits, note, ms }
}

/** A charts search's `page`, which must be below chartsRerankPages. */
export async function searchChartsReranked(
    config: AlgoliaConfig,
    state: SectionSearchState,
    page: number,
    hitsPerPage: number,
    baseUrl: string,
    options: SearchApiOptions,
    rerank: RerankOptions
): Promise<Reranked<SearchApiResponse>> {
    const started = Date.now()
    const poolSize = chartsRerankPages(hitsPerPage) * hitsPerPage
    // Charts pick their topics by static embedding, without a model call
    const [{ value: pool, ms: poolMs }, vocabulary] = await Promise.all([
        timed(() => searchCharts(config, state, 0, poolSize, baseUrl, options)),
        rerank.vocab && !hasTopicFilter(state)
            ? pickTopicsByEmbedding(state.query, rerank.waitUntil)
            : undefined,
    ])
    const topicHits = await withTopicHits(
        pool.results,
        vocabulary,
        async (topic) =>
            (
                await searchCharts(
                    config,
                    withinTopic(state, topic),
                    0,
                    VOCABULARY_HITS_PER_TERM,
                    baseUrl,
                    options
                )
            ).results
    )
    const reranked = await rerankCharts(
        rerank.ai,
        rerank.model,
        { ...pool, results: topicHits.hits },
        topicHits.note
    )
    // Topic hits that didn't make the pool's pages are dropped
    const ranked = reranked.results.slice(0, poolSize)
    const nbHits = Math.max(pool.nbHits, ranked.length)
    return {
        ...pool,
        results: ranked.slice(page * hitsPerPage, (page + 1) * hitsPerPage),
        nbHits,
        page,
        hitsPerPage,
        nbPages: Math.ceil(nbHits / hitsPerPage),
        rerank: reranked.rerank,
        ...(vocabulary && { vocabulary }),
        timings: {
            pool: poolMs,
            ...(vocabulary && {
                vocabulary: vocabulary.latencyMs,
                termSearches: topicHits.ms,
            }),
            rerank: reranked.rerank.latencyMs,
            total: Date.now() - started,
        },
    }
}

/**
 * A pages search's `offset`…`offset + length`, where `offset` must be below
 * RERANK_POOL_SIZE. Any part past the pool comes from Algolia.
 */
export async function searchPagesReranked(
    config: AlgoliaConfig,
    state: SectionSearchState,
    offset: number,
    length: number,
    pageTypes: readonly string[],
    baseUrl: string,
    options: SearchApiOptions,
    rerank: RerankOptions
): Promise<Reranked<SearchPagesApiResponse>> {
    const started = Date.now()
    const end = offset + length
    // Pages pick their topics with a decision model call
    const [{ value: pool, ms: poolMs }, vocabulary, afterPool] =
        await Promise.all([
            timed(() =>
                searchPages(
                    config,
                    state,
                    0,
                    RERANK_POOL_SIZE,
                    pageTypes,
                    baseUrl,
                    // The rerank prompt describes each page by its excerpt
                    // (see describePage)
                    { ...options, excerpts: true }
                )
            ),
            rerank.vocab && !hasTopicFilter(state)
                ? pickVocabularyTopics(rerank.ai, rerank.model, state.query)
                : undefined,
            end > RERANK_POOL_SIZE
                ? searchPages(
                      config,
                      state,
                      RERANK_POOL_SIZE,
                      end - RERANK_POOL_SIZE,
                      pageTypes,
                      baseUrl,
                      options
                  )
                : undefined,
        ])
    // Pages carry the charts' topic tags, so the query's topics find pages a
    // keyword search misses: Algolia wants every query word in a page, which
    // leaves many searches a handful of hits
    const topicHits = await withTopicHits(
        pool.results,
        vocabulary,
        async (topic) =>
            (
                await searchPages(
                    config,
                    withinTopic(state, topic),
                    0,
                    VOCABULARY_HITS_PER_TERM,
                    pageTypes,
                    baseUrl,
                    options
                )
            ).results
    )
    const reranked = await rerankPages(
        rerank.ai,
        rerank.model,
        { ...pool, results: topicHits.hits },
        topicHits.note
    )
    // The search page shows a hit's excerpt in place of its matched text, so
    // hits the query found keep only the latter, as without a rerank. Topic
    // hits, which matched no text, keep their excerpt, as in a search without
    // a query.
    const foundByQuery = new Set(pool.results.map((hit) => hit.url))
    const ranked = reranked.results
        .slice(0, RERANK_POOL_SIZE)
        .map((hit) => (foundByQuery.has(hit.url) ? withoutExcerpt(hit) : hit))
    return {
        ...pool,
        results: [...ranked, ...(afterPool?.results ?? [])].slice(offset, end),
        nbHits: Math.max(pool.nbHits, ranked.length),
        offset,
        length,
        rerank: reranked.rerank,
        ...(vocabulary && { vocabulary }),
        timings: {
            pool: poolMs,
            ...(vocabulary && {
                vocabulary: vocabulary.latencyMs,
                termSearches: topicHits.ms,
            }),
            rerank: reranked.rerank.latencyMs,
            total: Date.now() - started,
        },
    }
}

function withoutExcerpt(hit: EnrichedSearchPageHit): EnrichedSearchPageHit {
    const copy = { ...hit }
    delete copy.excerpt
    return copy
}
