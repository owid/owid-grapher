import { FilterType } from "@ourworldindata/types"
import {
    getFilterNamesOfType,
    type SectionSearchState,
} from "@ourworldindata/utils"
import { AlgoliaConfig } from "./algoliaClient.js"
import {
    RERANK_POOL_SIZE,
    rerankHits,
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
 * A rerank reorders Algolia's top RERANK_POOL_SIZE hits as one pool, and the
 * requested page is cut from the reordered pool. Every page within the pool
 * is served this way, each request reranking the pool again (cheap next to
 * keeping state between requests), and the pages after it come from Algolia
 * directly, starting where the pool ends, so the search page's "show more"
 * doesn't repeat or skip a hit. With `vocab`, topic hits join the pool, so
 * the hits the rerank puts last are cut to keep it at RERANK_POOL_SIZE, and a
 * topic hit kept in it can come back after it if the query also finds it
 * there.
 */

export interface RerankOptions {
    ai: Ai
    model: RerankModel
    /** widen the pool with the top results of the query's topics */
    vocab: boolean
    /**
     * Pages pick their topics by static embedding, as charts do, instead of
     * a decision model call (`vocab=static`, under test)
     */
    staticPageTopics: boolean
    waitUntil: (promise: Promise<unknown>) => void
}

type Reranked<TResponse> = TResponse & {
    rerank?: RerankInfo
    vocabulary?: VocabularyInfo
    timings?: SearchTimings
}

/** An empty search within a topic: its results in Algolia's default order. */
const withinTopic = (
    state: SectionSearchState,
    topic: string
): SectionSearchState => ({
    ...state,
    query: "",
    filters: [...state.filters, { type: FilterType.TOPIC, name: topic }],
})

/**
 * The pool, with the query's topics' hits when asked for, reranked and cut
 * to `poolSize`. A search already filtered to a topic gets no topic hits: the
 * reader chose the topic.
 */
async function rerankPool<
    THit extends { url: string },
    TPool extends { results: THit[] },
>(
    state: SectionSearchState,
    rerank: RerankOptions,
    poolSize: number,
    steps: {
        searchPool: () => Promise<TPool>
        /** charts by static embedding, pages by a decision model call */
        pickTopics: () => Promise<VocabularyInfo>
        searchTopic: (state: SectionSearchState) => Promise<THit[]>
        rerank: (
            hits: THit[],
            note: (hit: THit) => string | undefined
        ) => Promise<{ hits: THit[]; rerank: RerankInfo }>
    }
): Promise<{
    pool: TPool
    ranked: THit[]
    info: {
        rerank: RerankInfo
        vocabulary?: VocabularyInfo
        timings: SearchTimings
    }
}> {
    const started = Date.now()
    const expand =
        rerank.vocab &&
        getFilterNamesOfType(state.filters, FilterType.TOPIC).size === 0
    const [{ value: pool, ms: poolMs }, vocabulary] = await Promise.all([
        timed(steps.searchPool),
        expand ? steps.pickTopics() : undefined,
    ])
    const {
        value: { hits, via },
        ms: termSearchesMs,
    } = await timed(() =>
        appendVocabularyHits(
            pool.results,
            vocabulary?.terms ?? [],
            (pick) => steps.searchTopic(withinTopic(state, pick.topic)),
            (hit) => hit.url
        )
    )
    const reranked = await steps.rerank(hits, (hit) => {
        const pick = via.get(hit.url)
        return pick && vocabularyTopicNote(pick)
    })
    return {
        pool,
        ranked: reranked.hits.slice(0, poolSize),
        info: {
            rerank: reranked.rerank,
            ...(vocabulary && { vocabulary }),
            timings: {
                pool: poolMs,
                ...(vocabulary && {
                    vocabulary: vocabulary.latencyMs,
                    termSearches: termSearchesMs,
                }),
                rerank: reranked.rerank.latencyMs,
                total: Date.now() - started,
            },
        },
    }
}

/**
 * A charts search, reranked within the pool. Charts are searched by page, so
 * the pool holds as many whole pages as fit in RERANK_POOL_SIZE, and none
 * when a page is larger, which would make a larger pool, and prompt.
 */
export async function searchChartsReranked(
    config: AlgoliaConfig,
    state: SectionSearchState,
    page: number,
    hitsPerPage: number,
    baseUrl: string,
    options: SearchApiOptions,
    rerank: RerankOptions
): Promise<Reranked<SearchApiResponse>> {
    const poolSize = Math.floor(RERANK_POOL_SIZE / hitsPerPage) * hitsPerPage
    if (page * hitsPerPage >= poolSize)
        return searchCharts(config, state, page, hitsPerPage, baseUrl, options)

    const { pool, ranked, info } = await rerankPool(state, rerank, poolSize, {
        searchPool: () =>
            searchCharts(config, state, 0, poolSize, baseUrl, options),
        pickTopics: () => pickTopicsByEmbedding(state.query, rerank.waitUntil),
        searchTopic: async (topicState) =>
            (
                await searchCharts(
                    config,
                    topicState,
                    0,
                    VOCABULARY_HITS_PER_TERM,
                    baseUrl,
                    options
                )
            ).results,
        rerank: (hits, note) =>
            rerankHits(rerank.ai, rerank.model, state.query, hits, note),
    })
    const nbHits = Math.max(pool.nbHits, ranked.length)
    return {
        ...pool,
        results: ranked.slice(page * hitsPerPage, (page + 1) * hitsPerPage),
        nbHits,
        page,
        hitsPerPage,
        nbPages: Math.ceil(nbHits / hitsPerPage),
        ...info,
    }
}

/**
 * A pages search's `offset`…`offset + length`, reranked where it's within
 * the pool. Any part past the pool comes from Algolia.
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
    const search = (
        searchState: SectionSearchState,
        searchOffset: number,
        searchLength: number,
        searchOptions: SearchApiOptions = options
    ): Promise<SearchPagesApiResponse> =>
        searchPages(
            config,
            searchState,
            searchOffset,
            searchLength,
            pageTypes,
            baseUrl,
            searchOptions
        )
    if (offset >= RERANK_POOL_SIZE) return search(state, offset, length)

    const end = offset + length
    const [{ pool, ranked, info }, afterPool] = await Promise.all([
        rerankPool(state, rerank, RERANK_POOL_SIZE, {
            // The rerank prompt describes each page by its excerpt (see
            // describePage)
            searchPool: () =>
                search(state, 0, RERANK_POOL_SIZE, {
                    ...options,
                    withExcerpt: true,
                }),
            pickTopics: () =>
                rerank.staticPageTopics
                    ? pickTopicsByEmbedding(state.query, rerank.waitUntil)
                    : pickVocabularyTopics(
                          rerank.ai,
                          rerank.model,
                          state.query
                      ),
            searchTopic: async (topicState) =>
                (await search(topicState, 0, VOCABULARY_HITS_PER_TERM)).results,
            rerank: (hits, note) =>
                rerankPages(rerank.ai, rerank.model, state.query, hits, note),
        }),
        end > RERANK_POOL_SIZE
            ? search(state, RERANK_POOL_SIZE, end - RERANK_POOL_SIZE)
            : undefined,
    ])
    // The search page shows a hit's excerpt in place of its matched text, so
    // hits the query found keep only the latter, as without a rerank. Topic
    // hits, which matched no text, keep their excerpt, as in a search without
    // a query.
    const foundByQuery = new Set(pool.results.map((hit) => hit.url))
    const inPool = new Set(ranked.map((hit) => hit.url))
    const results = [
        ...ranked.map((hit) =>
            foundByQuery.has(hit.url) ? withoutExcerpt(hit) : hit
        ),
        ...(afterPool?.results ?? []).filter((hit) => !inPool.has(hit.url)),
    ]
    return {
        ...pool,
        results: results.slice(offset, end),
        nbHits: Math.max(pool.nbHits, ranked.length),
        offset,
        length,
        ...info,
    }
}

function withoutExcerpt(hit: EnrichedSearchPageHit): EnrichedSearchPageHit {
    const copy = { ...hit }
    delete copy.excerpt
    return copy
}
