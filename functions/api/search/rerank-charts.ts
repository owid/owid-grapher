import * as Sentry from "@sentry/cloudflare"
import { SearchChartHit, SearchIndexName } from "@ourworldindata/types"
import {
    RERANK_PAGES,
    searchSingleForHitsWithClosestMatches,
    type SingleSearchRequest,
} from "@ourworldindata/utils"
import { Env } from "../../_common/env.js"
import {
    createSearchClient,
    getAlgoliaConfig,
    getIndexName,
} from "./algoliaClient.js"
import { isRerankModel, RERANK_MODELS, rerankHits } from "./rerank.js"
import {
    appendVocabularyHits,
    pickVocabularyTerms,
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

        const [pool, vocabulary] = await Promise.all([
            searchSingleForHitsWithClosestMatches<SearchChartHit>(client, {
                ...params,
                // Always this deployment's charts index, whatever the
                // client's build thinks it's called
                indexName,
                page: 0,
                hitsPerPage: hitsPerPage * RERANK_PAGES,
            }),
            expand ? pickVocabularyTerms(env.AI, model, query) : undefined,
        ])
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
        })
    } catch (error) {
        console.error("Rerank charts error:", error)
        Sentry.captureException(error)
        return jsonResponse(500, {
            error: "An error occurred while processing the search request",
        })
    }
}
