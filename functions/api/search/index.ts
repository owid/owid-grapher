import * as Sentry from "@sentry/cloudflare"
import { Env } from "../../_common/env.js"
import {
    createSearchClient,
    getAlgoliaConfig,
    getIndexName,
} from "./algoliaClient.js"
import {
    isRerankModel,
    RERANK_MODELS,
    RERANK_POOL_SIZE,
    rerankCharts,
    rerankPages,
    RerankModel,
    timed,
    type SearchTimings,
} from "./rerank.js"
import {
    searchCharts,
    searchPages,
    searchTopicPages,
    SearchApiResponse,
    SearchPagesApiResponse,
    SearchState,
    SearchTopicsApiResponse,
    SearchValidationError,
} from "./searchApi.js"
import {
    appendVocabularyHits,
    pickVocabularyTerms,
    matchVocabularyTopics,
    pickVocabularyTopics,
    VOCABULARY_HITS_PER_TERM,
    VOCABULARY_TOPICS,
    vocabularyNote,
    type VocabularyInfo,
    type VocabularyTopicPick,
    vocabularyTopicNote,
} from "./vocabulary.js"
import {
    FilterType,
    Filter,
    SearchUrlParam,
    ALL_GDOC_TYPES,
    SearchIndexName,
    TagGraphRoot,
} from "@ourworldindata/types"
import {
    rankTopicsOfChartHits,
    searchSingleForHitsWithClosestMatches,
    TOPIC_VOTING_CHART_HITS,
} from "@ourworldindata/utils"

const DEFAULT_HITS_PER_PAGE = 20
const MAX_HITS_PER_PAGE = 100
const MAX_PAGE = 1000

// topics recommends topic pages for a query, like the site's topic cards
const SEARCH_TYPES = ["charts", "pages", "topics"] as const
type SearchType = (typeof SEARCH_TYPES)[number]

// gdoc content types the `pageTypes` param (type=pages only) may request, as
// a Set for O(1) membership checks.
const VALID_PAGE_TYPES = new Set<string>(ALL_GDOC_TYPES)

// Every query parameter this endpoint reads. Anything else is ignored, since
// callers routinely append their own (utm_* tags, cache-busters), but it's
// named in a `warnings` field so a misspelled or misplaced parameter is still
// visible (e.g. the search page's `resultType=writing` returns charts, since
// `type` defaults to "charts").
const KNOWN_PARAMS = new Set<string>([
    "type",
    SearchUrlParam.QUERY,
    SearchUrlParam.COUNTRY,
    SearchUrlParam.TOPIC,
    SearchUrlParam.REQUIRE_ALL_COUNTRIES,
    "pageTypes",
    "page",
    "hitsPerPage",
    "rerank",
    "vocab",
])

// The parameters only some search types read. A request that sends one to a
// type that doesn't read it gets a warning instead of a silently different
// answer (e.g. a type=pages search with `topics`, which only filters charts
// and topic recommendations).
const PARAMS_BY_TYPE = new Map<string, readonly SearchType[]>([
    [SearchUrlParam.COUNTRY, ["charts", "topics"]],
    [SearchUrlParam.TOPIC, ["charts", "topics"]],
    [SearchUrlParam.REQUIRE_ALL_COUNTRIES, ["charts", "topics"]],
    ["pageTypes", ["pages"]],
    ["rerank", ["charts", "pages"]],
    ["vocab", ["charts", "pages"]],
])

// type=topics filters by country only when charts match a query, so never
// without one.
const CHART_ONLY_PARAMS = new Set<string>([
    SearchUrlParam.COUNTRY,
    SearchUrlParam.REQUIRE_ALL_COUNTRIES,
])

const isSearchType = (value: string): value is SearchType =>
    (SEARCH_TYPES as readonly string[]).includes(value)

// Hints for parameters people carry over from the search page's URL.
const PARAM_HINTS = new Map<string, string>([
    [
        SearchUrlParam.RESULT_TYPE,
        'Use "type=pages" to search writing, "type=topics" for topic pages, or "type=charts" for charts.',
    ],
])

/**
 * The topic tag graph the site bakes to /topicTagGraph.json; it maps tag
 * names to topic page slugs for topic page recommendations.
 */
async function fetchTagGraph(env: Env, baseUrl: string): Promise<TagGraphRoot> {
    const response = await env.ASSETS.fetch(
        new URL("/topicTagGraph.json", baseUrl)
    )
    if (!response.ok)
        throw new Error(
            `Failed to fetch /topicTagGraph.json: ${response.status}`
        )
    return response.json()
}

/**
 * The experimental `rerank` param of a charts or pages search (see
 * rerank.ts). It reorders the top RERANK_POOL_SIZE hits, so it serves page 0
 * only. With `vocab=1`, the pool also gets the query's vocabulary hits (see
 * vocabulary.ts): for charts each topic's term search, for pages each
 * topic's pages.
 */
function parseRerank(
    value: string | null,
    vocab: string | null,
    env: Env,
    page: number
):
    | {
          model: RerankModel
          ai: Ai
          vocab: boolean
          chartsVocab: "term" | "topic" | "query" | "votes" | "wide" | "wideq"
      }
    | undefined {
    // TODO: vocab=topic, vocab=query and vocab=votes are variants under test
    // (see searchChartsReranked and pickTopicsByChartVotes); keep whichever
    // wins as vocab=1
    if (
        vocab &&
        !["1", "topic", "query", "votes", "wide", "wideq"].includes(vocab)
    )
        throw new SearchValidationError(
            `Invalid vocab value "${vocab}". Use vocab=1`
        )
    if (vocab && !value)
        throw new SearchValidationError("vocab=1 needs a rerank")
    if (!value) return undefined
    if (!isRerankModel(value))
        throw new SearchValidationError(
            `Invalid rerank value "${value}". Valid values: ${Object.keys(RERANK_MODELS).join(", ")}`
        )
    if (!env.AI)
        throw new SearchValidationError(
            "rerank is not available on this deployment"
        )
    if (page !== 0)
        throw new SearchValidationError(
            "rerank only supports page=0: it reorders the top results"
        )
    return {
        model: value,
        ai: env.AI,
        vocab: !!vocab,
        chartsVocab:
            vocab === "topic" ||
            vocab === "query" ||
            vocab === "votes" ||
            vocab === "wide" ||
            vocab === "wideq"
                ? vocab
                : "term",
    }
}

/**
 * Under test (vocab=votes): the query's topics without a model call, as the
 * topic page recommendations pick them. The charts matching the query vote
 * for their topic tags, weighted by rank (rankTopicsOfChartHits), and the
 * VOCABULARY_TOPICS winners are the picks. No matching chart, no picks.
 */
async function pickTopicsByChartVotes(
    config: ReturnType<typeof getAlgoliaConfig>,
    query: string,
    loadTagGraph: () => Promise<TagGraphRoot>
): Promise<VocabularyInfo<VocabularyTopicPick>> {
    const started = Date.now()
    try {
        const [found, tagGraph] = await Promise.all([
            searchSingleForHitsWithClosestMatches<{ tags?: string[] }>(
                createSearchClient(config),
                {
                    indexName: getIndexName(
                        SearchIndexName.ExplorerViewsMdimViewsAndCharts,
                        config.indexPrefix
                    ),
                    query,
                    attributesToRetrieve: ["tags"],
                    hitsPerPage: TOPIC_VOTING_CHART_HITS,
                }
            ),
            loadTagGraph(),
        ])
        return {
            terms: rankTopicsOfChartHits(found.hits, tagGraph)
                .slice(0, VOCABULARY_TOPICS)
                .map((topic) => ({ topic: topic.name })),
            latencyMs: Date.now() - started,
        }
    } catch (error) {
        console.error("Search topic votes failed:", error)
        return {
            terms: [],
            latencyMs: Date.now() - started,
            error: error instanceof Error ? error.message : String(error),
        }
    }
}

const hasSearchEnvVars = (env: Env): boolean => {
    return !!env.ALGOLIA_ID && !!env.ALGOLIA_SEARCH_KEY
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { request, env } = context
    const url = new URL(request.url)

    try {
        if (!hasSearchEnvVars(env)) {
            throw new Error(
                "Missing environment variables. Please check that both ALGOLIA_ID and ALGOLIA_SEARCH_KEY are set."
            )
        }

        const typeParam = url.searchParams.get("type") || "charts"
        if (!isSearchType(typeParam)) {
            return new Response(
                JSON.stringify({
                    error: "Invalid type parameter",
                    details: `Type must be one of: ${SEARCH_TYPES.join(", ")}`,
                }),
                {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            )
        }
        const searchType = typeParam

        // utm_* tags are expected noise, not mistakes worth a warning
        const sentParams = [...new Set(url.searchParams.keys())]
        const unknownParams = sentParams.filter(
            (param) => !KNOWN_PARAMS.has(param) && !param.startsWith("utm_")
        )
        // An empty value is as good as not sending the parameter
        const unusedParams = sentParams.filter(
            (param) =>
                url.searchParams.get(param) &&
                PARAMS_BY_TYPE.get(param)?.includes(searchType) === false
        )
        const queryless = !(
            url.searchParams.get(SearchUrlParam.QUERY) ?? ""
        ).trim()
        const queryOnlyParams =
            searchType === "topics" && queryless
                ? sentParams.filter(
                      (param) =>
                          url.searchParams.get(param) &&
                          CHART_ONLY_PARAMS.has(param)
                  )
                : []
        const warningList = [
            ...(unknownParams.length > 0
                ? [
                      [
                          `Ignored unknown parameter(s): "${unknownParams.join('", "')}". Valid parameters: ${Array.from(KNOWN_PARAMS).join(", ")}.`,
                          ...unknownParams
                              .map((param) => PARAM_HINTS.get(param))
                              .filter(Boolean),
                      ].join(" "),
                  ]
                : []),
            ...unusedParams.map(
                (param) =>
                    `Ignored parameter "${param}": it applies only to ${PARAMS_BY_TYPE.get(
                        param
                    )!
                        .map((type) => `type=${type}`)
                        .join(" and ")}.`
            ),
            ...queryOnlyParams.map(
                (param) =>
                    `Ignored parameter "${param}": type=topics filters by country only when charts match a query.`
            ),
        ]
        const warnings = warningList.length > 0 ? warningList : undefined

        // Parse query parameter
        const query = url.searchParams.get(SearchUrlParam.QUERY) || ""

        // Parse filter parameters
        const countriesParam = url.searchParams.get(SearchUrlParam.COUNTRY)
        const topicParam = url.searchParams.get(SearchUrlParam.TOPIC)
        const requireAllCountries =
            url.searchParams.get(SearchUrlParam.REQUIRE_ALL_COUNTRIES) ===
            "true"

        // Which gdoc content types to include (type=pages only, e.g.
        // "data-insight" or "article,about-page"). Omitted -> searchPages()'s
        // own default (article + about-page). Validated upfront against the
        // full gdoc type enum (a static, compile-time list — unlike topics,
        // which are dynamic data and so are validated lazily against a live
        // lookup).
        const pageTypesParam =
            searchType === "pages" ? url.searchParams.get("pageTypes") : null
        let pageTypes: string[] | undefined
        if (pageTypesParam) {
            pageTypes = pageTypesParam
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
            const invalidTypes = pageTypes.filter(
                (t) => !VALID_PAGE_TYPES.has(t)
            )
            if (invalidTypes.length > 0) {
                throw new SearchValidationError(
                    `Invalid pageTypes value(s): "${invalidTypes.join('", "')}". Valid types: ${Array.from(VALID_PAGE_TYPES).join(", ")}`
                )
            }
        }

        // Parse pagination parameters
        const page = parseInt(url.searchParams.get("page") || "0")
        const hitsPerPage = parseInt(
            url.searchParams.get("hitsPerPage") ||
                DEFAULT_HITS_PER_PAGE.toString()
        )

        // Validate pagination parameters

        if (page < 0 || page > MAX_PAGE) {
            return new Response(
                JSON.stringify({
                    error: "Invalid page parameter",
                    details: `Page must be between 0 and ${MAX_PAGE}`,
                }),
                {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            )
        }

        if (hitsPerPage < 1 || hitsPerPage > MAX_HITS_PER_PAGE) {
            return new Response(
                JSON.stringify({
                    error: "Invalid hitsPerPage parameter",
                    details: `hitsPerPage must be between 1 and ${MAX_HITS_PER_PAGE}`,
                }),
                {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            )
        }

        const rerank =
            searchType === "charts" || searchType === "pages"
                ? parseRerank(
                      url.searchParams.get("rerank"),
                      url.searchParams.get("vocab"),
                      env,
                      page
                  )
                : undefined

        // Build filters array
        const filters: Filter[] = []

        if (countriesParam) {
            // Countries are separated by tilde (~) to match Grapher URL format
            const countries = countriesParam
                .split("~")
                .map((c) => c.trim())
                .filter(Boolean)
            countries.forEach((country) => {
                filters.push({
                    type: FilterType.COUNTRY,
                    name: country,
                })
            })
        }

        // Only support single topic (UI doesn't support multiple topics)
        if (topicParam) {
            const topic = topicParam.trim()
            if (topic) {
                filters.push({
                    type: FilterType.TOPIC,
                    name: topic,
                })
            }
        }

        // Build search state
        const searchState: SearchState = {
            query,
            filters,
            requireAllCountries,
        }

        // Get Algolia config
        const algoliaConfig = getAlgoliaConfig(env)

        // Extract base URL from request (for staging/preview deployments)
        const baseUrl = `${url.protocol}//${url.host}`

        const pickTopics = (
            rerank: NonNullable<ReturnType<typeof parseRerank>>
        ): Promise<VocabularyInfo<VocabularyTopicPick>> => {
            const byVotes = (): Promise<VocabularyInfo<VocabularyTopicPick>> =>
                pickTopicsByChartVotes(algoliaConfig, query, () =>
                    fetchTagGraph(env, baseUrl)
                )
            if (rerank.chartsVocab === "votes") return byVotes()
            if (rerank.chartsVocab !== "wide" && rerank.chartsVocab !== "wideq")
                return pickVocabularyTopics(rerank.ai, rerank.model, query)
            // Under test (vocab=wide): no topic call. The topics the
            // matching charts vote for and the ones whose terms look like
            // the query are all candidates, and the rerank decides.
            return Promise.all([
                byVotes(),
                matchVocabularyTopics(query, VOCABULARY_TOPICS).catch(
                    (): string[] => []
                ),
            ]).then(([votes, matched]) => ({
                ...votes,
                terms: [
                    ...new Set([
                        ...votes.terms.map((term) => term.topic),
                        ...matched,
                    ]),
                ].map((topic) => ({ topic })),
            }))
        }

        // A search already filtered to a topic gets no vocabulary hits: the
        // reader chose the topic
        const searchChartsReranked = async (
            rerank: NonNullable<ReturnType<typeof parseRerank>>
        ): Promise<
            SearchApiResponse & {
                vocabulary?:
                    | VocabularyInfo
                    | VocabularyInfo<VocabularyTopicPick>
                timings: SearchTimings
            }
        > => {
            const started = Date.now()
            const expand = rerank.vocab && !topicParam?.trim()
            const [{ value: pool, ms: poolMs }, vocabulary] = await Promise.all(
                [
                    timed(() =>
                        searchCharts(
                            algoliaConfig,
                            searchState,
                            0,
                            Math.max(RERANK_POOL_SIZE, hitsPerPage),
                            baseUrl
                        )
                    ),
                    expand
                        ? rerank.chartsVocab === "term"
                            ? pickVocabularyTerms(
                                  rerank.ai,
                                  rerank.model,
                                  query
                              )
                            : pickTopics(rerank)
                        : undefined,
                ]
            )
            if (!vocabulary) {
                const reranked = await rerankCharts(
                    rerank.ai,
                    rerank.model,
                    pool,
                    hitsPerPage
                )
                return {
                    ...reranked,
                    timings: {
                        pool: poolMs,
                        rerank: reranked.rerank.latencyMs,
                        total: Date.now() - started,
                    },
                }
            }
            const termSearchesStarted = Date.now()
            // Within a topic: the picked term (vocab=1), nothing, which
            // yields the topic's charts in Algolia's default order
            // (vocab=topic), or the reader's own query, and nothing when
            // that finds no chart (vocab=query)
            const searchTopic = async (
                topic: string,
                topicQuery: string
            ): Promise<SearchApiResponse["results"]> =>
                (
                    await searchCharts(
                        algoliaConfig,
                        {
                            ...searchState,
                            query: topicQuery,
                            filters: [
                                ...filters,
                                { type: FilterType.TOPIC, name: topic },
                            ],
                        },
                        0,
                        VOCABULARY_HITS_PER_TERM,
                        baseUrl
                    )
                ).results
            const { hits: results, via } = await appendVocabularyHits<
                SearchApiResponse["results"][number],
                VocabularyTopicPick & { keyword?: string }
            >(
                pool.results,
                vocabulary.terms,
                async (term) => {
                    if (term.keyword !== undefined)
                        return searchTopic(term.topic, term.keyword)
                    if (rerank.chartsVocab === "query") {
                        const found = await searchTopic(term.topic, query)
                        if (found.length > 0) return found
                    }
                    if (rerank.chartsVocab === "wideq") {
                        // Under test: the reader's query within the topic
                        // first, then the topic's top charts, up to
                        // VOCABULARY_HITS_PER_TERM charts the pool lacks
                        const [matching, top] = await Promise.all([
                            searchTopic(term.topic, query),
                            searchTopic(term.topic, ""),
                        ])
                        const taken = new Set(pool.results.map((h) => h.url))
                        return [...matching, ...top]
                            .filter((hit) => {
                                if (taken.has(hit.url)) return false
                                taken.add(hit.url)
                                return true
                            })
                            .slice(0, VOCABULARY_HITS_PER_TERM)
                    }
                    return searchTopic(term.topic, "")
                },
                (hit) => hit.url
            )
            const termSearchesMs = Date.now() - termSearchesStarted
            const reranked = await rerankCharts(
                rerank.ai,
                rerank.model,
                {
                    ...pool,
                    results,
                    nbHits: Math.max(pool.nbHits, results.length),
                },
                hitsPerPage,
                (hit) => {
                    const term = via.get(hit.url)
                    if (!term) return undefined
                    return term.keyword !== undefined
                        ? vocabularyNote({ ...term, keyword: term.keyword })
                        : vocabularyTopicNote(term)
                }
            )
            return {
                ...reranked,
                vocabulary,
                timings: {
                    pool: poolMs,
                    vocabulary: vocabulary.latencyMs,
                    termSearches: termSearchesMs,
                    rerank: reranked.rerank.latencyMs,
                    total: Date.now() - started,
                },
            }
        }

        const searchPagesReranked = async (
            rerank: NonNullable<ReturnType<typeof parseRerank>>
        ): Promise<
            SearchPagesApiResponse & {
                vocabulary?: VocabularyInfo<VocabularyTopicPick>
                timings: SearchTimings
            }
        > => {
            const started = Date.now()
            const [{ value: pool, ms: poolMs }, vocabulary] = await Promise.all(
                [
                    timed(() =>
                        searchPages(
                            algoliaConfig,
                            query,
                            0,
                            Math.max(RERANK_POOL_SIZE, hitsPerPage),
                            pageTypes, // undefined -> searchPages()'s own default
                            baseUrl,
                            ["excerpt"]
                        )
                    ),
                    rerank.vocab ? pickTopics(rerank) : undefined,
                ]
            )
            // Pages carry the charts' topic tags, so the query's vocabulary
            // topics find pages a keyword search misses: Algolia wants every
            // query word in a page, which leaves many searches a handful of
            // hits. An empty search within a topic yields its pages in
            // Algolia's default order.
            const termSearchesStarted = Date.now()
            const { hits: results, via } = vocabulary
                ? await appendVocabularyHits(
                      pool.results,
                      vocabulary.terms,
                      async (term) =>
                          (
                              await searchPages(
                                  algoliaConfig,
                                  "",
                                  0,
                                  VOCABULARY_HITS_PER_TERM,
                                  pageTypes,
                                  baseUrl,
                                  ["excerpt"],
                                  term.topic
                              )
                          ).results,
                      (hit) => hit.url
                  )
                : {
                      hits: pool.results,
                      via: new Map<string, VocabularyTopicPick>(),
                  }
            const termSearchesMs = Date.now() - termSearchesStarted
            const reranked = await rerankPages(
                rerank.ai,
                rerank.model,
                {
                    ...pool,
                    results,
                    nbHits: Math.max(pool.nbHits, results.length),
                },
                hitsPerPage,
                (hit) => {
                    const pick = via.get(hit.url)
                    return pick && vocabularyTopicNote(pick)
                }
            )
            return {
                ...reranked,
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
            }
        }

        const search = (): Promise<
            SearchApiResponse | SearchPagesApiResponse | SearchTopicsApiResponse
        > => {
            switch (searchType) {
                case "charts":
                    if (rerank) return searchChartsReranked(rerank)
                    return searchCharts(
                        algoliaConfig,
                        searchState,
                        page,
                        hitsPerPage,
                        baseUrl
                    )
                case "pages":
                    if (rerank) return searchPagesReranked(rerank)
                    return searchPages(
                        algoliaConfig,
                        query,
                        page * hitsPerPage, // Convert page to offset
                        hitsPerPage,
                        pageTypes, // undefined -> searchPages()'s own default
                        baseUrl
                    )
                case "topics":
                    return searchTopicPages(
                        algoliaConfig,
                        searchState,
                        () => fetchTagGraph(env, baseUrl),
                        page * hitsPerPage, // Convert page to offset
                        hitsPerPage,
                        baseUrl
                    )
            }
        }
        const results = await search()

        return new Response(JSON.stringify({ ...results, warnings }, null, 2), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=600", // 10 minutes
                "Access-Control-Allow-Origin": "*", // Allow CORS for API usage
            },
        })
    } catch (error) {
        // Client validation errors (e.g. invalid topic name) are returned
        // as 400 without being reported to Sentry.
        if (error instanceof SearchValidationError) {
            return new Response(
                JSON.stringify({
                    error: error.message,
                }),
                {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            )
        }

        console.error("Search API error:", error)
        Sentry.captureException(error)

        return new Response(
            JSON.stringify({
                error: "An error occurred while processing the search request",
            }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        )
    }
}
