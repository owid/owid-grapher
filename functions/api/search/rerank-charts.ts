import * as Sentry from "@sentry/cloudflare"
import {
    OwidGdocType,
    SearchChartHit,
    SearchIndexName,
} from "@ourworldindata/types"
import {
    RERANK_PAGES,
    searchSingleForHits,
    searchSingleForHitsWithClosestMatches,
    type SingleSearchRequest,
} from "@ourworldindata/utils"
import { Env } from "../../_common/env.js"
import {
    createSearchClient,
    getAlgoliaConfig,
    getIndexName,
} from "./algoliaClient.js"
import {
    isRerankModel,
    describePage,
    RERANK_MODELS,
    RERANK_POOL_SIZE,
    type RerankModel,
    rerankHits,
    timed,
    type SearchTimings,
} from "./rerank.js"
import {
    appendVocabularyHits,
    pickVocabularyTerms,
    pickVocabularyTopics,
    type VocabularyTopicPick,
    vocabularyTopicNote,
    VOCABULARY_HITS_PER_TERM,
    vocabularyNote,
    type VocabularyTerm,
} from "./vocabulary.js"

/**
 * Experimental: the search page's charts section, reranked (see rerank.ts).
 *
 * The site keeps querying Algolia from the browser and only sends its charts
 * search here when reranking is on (site/search/rerank.ts). The body is the
 * exact search request the site would send Algolia, and the response is
 * Algolia's, so the site can swap one for the other without a second query
 * builder.
 *
 * The first RERANK_PAGES pages are reranked as one pool: this fetches all of
 * them from Algolia as page 0, reorders the pool, and cuts out the requested
 * page. Each page request reranks the pool again, which is cheap next to
 * keeping state between requests.
 *
 * Reranking has to run here rather than in the browser: it needs the Workers
 * AI binding, and the model only ever sees what Algolia returned for the
 * query, never text a client sent as results.
 *
 * With `vocab=1`, the pool also gets the hits of the query translated into
 * the topic vocabulary (see vocabulary.ts), unless the search is already
 * filtered to a topic. The picks run alongside the pool's own search.
 *
 * With `section=pages` it reranks a pages-index section instead (articles,
 * data insights): see rerankPagesSection.
 */

const MAX_BODY_BYTES = 16 * 1024
const MAX_QUERY_LENGTH = 512
const MAX_HITS_PER_PAGE = 20

// The search request keys the site's queryCharts sends. Anything else is
// rejected rather than ignored, so a new key in queryCharts surfaces as a
// failed rerank (the site then falls back to Algolia) instead of a reranked
// search that silently differs from the plain one.
const ALLOWED_KEYS = new Set([
    "indexName",
    "query",
    "facetFilters",
    "attributesToRetrieve",
    "highlightPreTag",
    "highlightPostTag",
    "hitsPerPage",
    "page",
])

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
}

const jsonResponse = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            ...CORS_HEADERS,
        },
    })

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((v) => typeof v === "string")

// Algolia's facetFilters: AND of entries, each a value or an OR of values
const isFacetFilters = (value: unknown): boolean =>
    Array.isArray(value) &&
    value.every((v) => typeof v === "string" || isStringArray(v))

// A facetFilters entry on the `tags` facet: the search is filtered to a topic
const isTopicFacet = (facet: string | string[]): boolean =>
    (Array.isArray(facet) ? facet : [facet]).some((f) => f.startsWith("tags:"))

const isIntegerIn = (value: unknown, min: number, max: number): boolean =>
    Number.isInteger(value) &&
    (value as number) >= min &&
    (value as number) <= max

interface RerankRequest {
    params: SingleSearchRequest
    query: string
    page: number
    hitsPerPage: number
}

/** The validated search request, or the reason it was rejected. */
function parseSearchRequest(payload: unknown): RerankRequest | string {
    if (!isRecord(payload)) return "Body must be a JSON object"
    const unknownKeys = Object.keys(payload).filter(
        (key) => !ALLOWED_KEYS.has(key)
    )
    if (unknownKeys.length > 0)
        return `Unsupported search parameter(s): ${unknownKeys.join(", ")}`

    const { query, page = 0, hitsPerPage } = payload
    if (typeof query !== "string" || !query.trim())
        return "query must be a non-empty string"
    if (query.length > MAX_QUERY_LENGTH)
        return `query must be at most ${MAX_QUERY_LENGTH} characters`
    if (!isIntegerIn(page, 0, RERANK_PAGES - 1))
        return `page must be between 0 and ${RERANK_PAGES - 1}`
    if (!isIntegerIn(hitsPerPage, 1, MAX_HITS_PER_PAGE))
        return `hitsPerPage must be between 1 and ${MAX_HITS_PER_PAGE}`
    if (
        payload.facetFilters !== undefined &&
        !isFacetFilters(payload.facetFilters)
    )
        return "facetFilters must be an array of strings or string arrays"
    if (
        payload.attributesToRetrieve !== undefined &&
        !isStringArray(payload.attributesToRetrieve)
    )
        return "attributesToRetrieve must be an array of strings"
    for (const key of ["highlightPreTag", "highlightPostTag"])
        if (payload[key] !== undefined && typeof payload[key] !== "string")
            return `${key} must be a string`

    return {
        params: payload as SingleSearchRequest,
        query,
        page: page as number,
        hitsPerPage: hitsPerPage as number,
    }
}

// The pages-index requests of the site's queryArticles and queryDataInsights
const ALLOWED_PAGES_KEYS = new Set([
    "indexName",
    "query",
    "filters",
    "facetFilters",
    "restrictSearchableAttributes",
    "attributesToRetrieve",
    "highlightPreTag",
    "highlightPostTag",
    "hitsPerPage",
    "page",
    "offset",
    "length",
])

// The page-type filters those two send. Any other filter is rejected: it
// would let a caller run the rerank over records the site doesn't search.
const ALLOWED_PAGES_FILTERS = new Set([
    `type:${OwidGdocType.Article} OR type:${OwidGdocType.AboutPage}`,
    `type:${OwidGdocType.DataInsight}`,
])

// Furthest hit a pages request may ask for. Past the pool the site asks
// Algolia directly, so this only has to cover a page that straddles its end.
const MAX_PAGES_END = RERANK_POOL_SIZE + 20

interface PagesRerankRequest {
    params: SingleSearchRequest
    query: string
    offset: number
    length: number
}

/** The validated pages search request, or the reason it was rejected. */
function parsePagesSearchRequest(
    payload: unknown
): PagesRerankRequest | string {
    if (!isRecord(payload)) return "Body must be a JSON object"
    const unknownKeys = Object.keys(payload).filter(
        (key) => !ALLOWED_PAGES_KEYS.has(key)
    )
    if (unknownKeys.length > 0)
        return `Unsupported search parameter(s): ${unknownKeys.join(", ")}`

    const { query, filters } = payload
    if (typeof query !== "string" || !query.trim())
        return "query must be a non-empty string"
    if (query.length > MAX_QUERY_LENGTH)
        return `query must be at most ${MAX_QUERY_LENGTH} characters`
    if (typeof filters !== "string" || !ALLOWED_PAGES_FILTERS.has(filters))
        return "filters must be one of the site's page-type filters"

    // Either Algolia pagination style: page + hitsPerPage, or offset + length
    const paged = payload.hitsPerPage !== undefined
    const length = paged ? payload.hitsPerPage : payload.length
    if (!isIntegerIn(length, 1, MAX_HITS_PER_PAGE))
        return `hitsPerPage or length must be between 1 and ${MAX_HITS_PER_PAGE}`
    const start = paged ? (payload.page ?? 0) : (payload.offset ?? 0)
    if (!isIntegerIn(start, 0, RERANK_POOL_SIZE))
        return "page or offset must be a non-negative integer within the pool"
    const offset = paged
        ? (start as number) * (length as number)
        : (start as number)
    if (
        offset >= RERANK_POOL_SIZE ||
        offset + (length as number) > MAX_PAGES_END
    )
        return `Only the first ${RERANK_POOL_SIZE} results are reranked`

    if (
        payload.facetFilters !== undefined &&
        !isFacetFilters(payload.facetFilters)
    )
        return "facetFilters must be an array of strings or string arrays"
    for (const key of ["attributesToRetrieve", "restrictSearchableAttributes"])
        if (payload[key] !== undefined && !isStringArray(payload[key]))
            return `${key} must be an array of strings`
    for (const key of ["highlightPreTag", "highlightPostTag"])
        if (payload[key] !== undefined && typeof payload[key] !== "string")
            return `${key} must be a string`

    return {
        params: payload as SingleSearchRequest,
        query,
        offset,
        length: length as number,
    }
}

interface RerankablePageHit {
    objectID: string
    title: string
    type: string
    excerpt?: string
    content?: string
}

/**
 * A pages-index section of the search page (articles, data insights),
 * reranked. Algolia's first RERANK_POOL_SIZE hits are the pool, however the
 * section pages through them; the hits a request asks for past the pool keep
 * Algolia's order. Later requests go to Algolia directly and start where
 * this one's hits end, so no hit is shown twice or skipped.
 *
 * With `vocab`, the pages of the query's vocabulary topics join the pool
 * (see pickVocabularyTopics), unless the search is already filtered to a
 * topic. Known gap: the pool is then longer than RERANK_POOL_SIZE when
 * Algolia fills it, so its lowest-ranked hits fall between this endpoint's
 * last request and Algolia's first, and a topic's page Algolia ranks past the
 * pool can show twice. Most searches return far fewer pages than the pool.
 */
async function rerankPagesSection(
    env: Env & { AI: Ai },
    model: RerankModel,
    payload: unknown,
    vocab: boolean
): Promise<Response> {
    const parsed = parsePagesSearchRequest(payload)
    if (typeof parsed === "string") return jsonResponse(400, { error: parsed })
    const { params, query, offset, length } = parsed
    const {
        page: _page,
        hitsPerPage: _hitsPerPage,
        ...search
    } = params as Record<string, unknown>

    const config = getAlgoliaConfig(env)
    const client = createSearchClient(config)
    const facetFilters = (params.facetFilters ?? []) as (string | string[])[]
    const pagesSearch = {
        ...search,
        indexName: getIndexName(SearchIndexName.Pages, config.indexPrefix),
        // What the rerank prompt reads (see describePage)
        attributesToRetrieve: [
            ...new Set([
                ...((params.attributesToRetrieve as string[]) ?? []),
                "title",
                "type",
                "excerpt",
                "content",
            ]),
        ],
        offset: 0,
    }
    const started = Date.now()
    const [{ value: found, ms: poolMs }, vocabulary] = await Promise.all([
        timed(() =>
            // The site searches without the closest-matches fallback when it
            // restricts the searchable attributes (a country filter is on)
            (params.restrictSearchableAttributes
                ? searchSingleForHits
                : searchSingleForHitsWithClosestMatches)<RerankablePageHit>(
                client,
                {
                    ...pagesSearch,
                    length: Math.max(RERANK_POOL_SIZE, offset + length),
                }
            )
        ),
        vocab && !facetFilters.some(isTopicFacet)
            ? pickVocabularyTopics(env.AI, model, query)
            : undefined,
    ])
    const termSearchesStarted = Date.now()
    const { hits: candidates, via } = vocabulary
        ? await appendVocabularyHits(
              found.hits.slice(0, RERANK_POOL_SIZE),
              vocabulary.terms,
              async (pick) =>
                  (
                      await searchSingleForHits<RerankablePageHit>(client, {
                          ...pagesSearch,
                          query: "",
                          facetFilters: [...facetFilters, `tags:${pick.topic}`],
                          length: VOCABULARY_HITS_PER_TERM,
                      })
                  ).hits,
              (hit) => hit.objectID
          )
        : {
              hits: found.hits.slice(0, RERANK_POOL_SIZE),
              via: new Map<string, VocabularyTopicPick>(),
          }
    const termSearchesMs = Date.now() - termSearchesStarted
    const { hits: pool, rerank } = await rerankHits(
        env.AI,
        model,
        query,
        candidates.map((hit) => ({
            hit,
            title: hit.title,
            type: hit.type,
            ...describePage(hit),
        })),
        ({ hit }) => {
            const pick = via.get(hit.objectID)
            return pick && vocabularyTopicNote(pick)
        }
    )
    const hits = [
        ...pool.map((entry) => entry.hit),
        ...found.hits.slice(RERANK_POOL_SIZE),
    ]
    return jsonResponse(200, {
        ...found,
        hits: hits.slice(offset, offset + length),
        // Echo the request's own pagination style
        ...(params.hitsPerPage !== undefined
            ? { page: offset / length, hitsPerPage: length }
            : { offset, length }),
        // Topic pages can turn an empty search into a full one
        nbHits: Math.max(found.nbHits ?? 0, hits.length),
        rerank,
        ...(vocabulary && { vocabulary }),
        timings: {
            pool: poolMs,
            ...(vocabulary && {
                vocabulary: vocabulary.latencyMs,
                termSearches: termSearchesMs,
            }),
            rerank: rerank.latencyMs,
            total: Date.now() - started,
        } satisfies SearchTimings,
    })
}

export const onRequestOptions: PagesFunction = async () =>
    new Response(null, {
        status: 204,
        headers: {
            ...CORS_HEADERS,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400",
        },
    })

export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { request, env } = context

    try {
        if (!env.AI)
            return jsonResponse(400, {
                error: "Reranking is not available on this deployment",
            })
        const url = new URL(request.url)
        const model = url.searchParams.get("model") ?? "jev"
        if (!isRerankModel(model))
            return jsonResponse(400, {
                error: `Invalid model "${model}". Valid values: ${Object.keys(RERANK_MODELS).join(", ")}`,
            })

        const body = await request.text()
        if (body.length > MAX_BODY_BYTES)
            return jsonResponse(413, { error: "Request body too large" })
        let payload: unknown
        try {
            payload = JSON.parse(body)
        } catch {
            return jsonResponse(400, { error: "Body is not valid JSON" })
        }
        const section = url.searchParams.get("section") ?? "charts"
        if (section === "pages")
            return await rerankPagesSection(
                { ...env, AI: env.AI },
                model,
                payload,
                url.searchParams.get("vocab") === "1"
            )
        if (section !== "charts")
            return jsonResponse(400, {
                error: `Invalid section "${section}". Valid values: charts, pages`,
            })
        const parsed = parseSearchRequest(payload)
        if (typeof parsed === "string")
            return jsonResponse(400, { error: parsed })
        const { params, query, page, hitsPerPage } = parsed

        const config = getAlgoliaConfig(env)
        const client = createSearchClient(config)
        const indexName = getIndexName(
            SearchIndexName.ExplorerViewsMdimViewsAndCharts,
            config.indexPrefix
        )
        const facetFilters = (params.facetFilters ?? []) as (
            | string
            | string[]
        )[]
        const expand =
            url.searchParams.get("vocab") === "1" &&
            !facetFilters.some(isTopicFacet)

        const started = Date.now()
        const [{ value: pool, ms: poolMs }, vocabulary] = await Promise.all([
            timed(() =>
                searchSingleForHitsWithClosestMatches<SearchChartHit>(client, {
                    ...params,
                    // Always this deployment's charts index, whatever the
                    // client's build thinks it's called
                    indexName,
                    page: 0,
                    hitsPerPage: hitsPerPage * RERANK_PAGES,
                })
            ),
            expand ? pickVocabularyTerms(env.AI, model, query) : undefined,
        ])
        const termSearchesStarted = Date.now()
        const { hits: candidates, via } = vocabulary
            ? await appendVocabularyHits(
                  pool.hits,
                  vocabulary.terms,
                  async (term) =>
                      (
                          await searchSingleForHitsWithClosestMatches<SearchChartHit>(
                              client,
                              {
                                  ...params,
                                  indexName,
                                  query: term.keyword,
                                  facetFilters: [
                                      ...facetFilters,
                                      `tags:${term.topic}`,
                                  ],
                                  page: 0,
                                  hitsPerPage: VOCABULARY_HITS_PER_TERM,
                              }
                          )
                      ).hits,
                  (hit) => hit.objectID
              )
            : { hits: pool.hits, via: new Map<string, VocabularyTerm>() }
        const termSearchesMs = Date.now() - termSearchesStarted
        const { hits, rerank } = await rerankHits(
            env.AI,
            model,
            query,
            candidates,
            (hit) => {
                const term = via.get(hit.objectID)
                return term && vocabularyNote(term)
            }
        )
        // Vocabulary hits can turn an empty search into a full one
        const nbHits = Math.max(pool.nbHits ?? 0, candidates.length)

        return jsonResponse(200, {
            ...pool,
            hits: hits.slice(page * hitsPerPage, (page + 1) * hitsPerPage),
            page,
            hitsPerPage,
            // Algolia's default paginationLimitedTo caps how far anyone can page
            nbHits,
            nbPages: Math.ceil(Math.min(nbHits, 1000) / hitsPerPage),
            rerank,
            ...(vocabulary && { vocabulary }),
            timings: {
                pool: poolMs,
                ...(vocabulary && {
                    vocabulary: vocabulary.latencyMs,
                    termSearches: termSearchesMs,
                }),
                rerank: rerank.latencyMs,
                total: Date.now() - started,
            } satisfies SearchTimings,
        })
    } catch (error) {
        console.error("Rerank charts error:", error)
        Sentry.captureException(error)
        return jsonResponse(500, {
            error: "An error occurred while processing the search request",
        })
    }
}
