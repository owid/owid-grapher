import type {
    Filter,
    Limit,
    NamespaceMultiQueryParams,
    NamespaceMultiQueryResponse,
    NamespaceQueryParams,
    NamespaceQueryResponse,
    QueryBilling,
    QueryPerformance,
    RankByText,
    Row,
} from "@turbopuffer/turbopuffer"
import type { SynonymMap } from "@ourworldindata/types"
import { buildSynonymMap, findQuerySynonyms } from "./synonyms.js"

/**
 * Query shapes for the experimental turbopuffer search indexes (see
 * baker/turbopuffer/readme.md), shared by the CLIs and the `engine=tpuf`
 * backend of /api/search.
 */

/**
 * Every index is kept in each region, so readers query the nearer copy. A
 * region holds its own namespaces; the indexer writes every region.
 */
export const TURBOPUFFER_REGIONS = [
    "aws-eu-central-1",
    "aws-us-east-1",
] as const
export type TurbopufferRegion = (typeof TURBOPUFFER_REGIONS)[number]
export const DEFAULT_TURBOPUFFER_REGION: TurbopufferRegion = "aws-eu-central-1"

export const isTurbopufferRegion = (
    value: string
): value is TurbopufferRegion =>
    (TURBOPUFFER_REGIONS as readonly string[]).includes(value)

/**
 * The region nearer a reader on this continent (Cloudflare's
 * `request.cf.continent`): the Americas query N. Virginia, everyone else
 * Frankfurt
 */
export const turbopufferRegionForContinent = (
    continent: string | undefined
): TurbopufferRegion =>
    continent === "NA" || continent === "SA"
        ? "aws-us-east-1"
        : DEFAULT_TURBOPUFFER_REGION

/** What a query needs to know about one namespace's rows */
export interface TurbopufferIndex {
    /** A spike: bump its suffix for a schema change instead of patching the schema in place */
    namespace: string
    /** Attributes returned with each row */
    attributes: readonly string[]
    /** Full-text attributes and their BM25 weights */
    textFields: readonly (readonly [string, number])[]
    /** Rows sharing this attribute are one result, like Algolia's `distinct` */
    distinctBy: string
    /** `Saturate` midpoint for `popularity` */
    popularityMidpoint: number
}

export const TURBOPUFFER_CHARTS_INDEX: TurbopufferIndex = {
    namespace: "owid-charts-spike-v2",
    attributes: [
        "chart_key",
        "type",
        "slug",
        "queryParams",
        "title",
        "subtitle",
        "variantName",
        "containerTitle",
        "availableEntities",
        "popularity",
    ],
    textFields: [
        ["title", 3],
        ["subtitle", 1],
        ["tags", 1],
        ["variantName", 1],
        ["containerTitle", 1],
    ],
    distinctBy: "chart_key",
    // Popularity's 75th percentile in the first load (2026-11-24). The median
    // is 2 (most charts get almost no views), so a median midpoint would
    // saturate nearly every chart; at p75 popularity separates the top quarter
    // and contributes half its weight there.
    popularityMidpoint: 126,
}

/**
 * Articles, data insights, topic, about and profile pages: one row per content
 * chunk, as in Algolia's pages index
 */
export const TURBOPUFFER_PAGES_INDEX: TurbopufferIndex = {
    namespace: "owid-pages-spike-v1",
    attributes: [
        "path",
        "type",
        "slug",
        "title",
        "content",
        "authors",
        "date",
        "modifiedDate",
        "thumbnailUrl",
        "popularity",
    ],
    textFields: [
        ["title", 3],
        ["excerpt", 1],
        ["tags", 1],
        ["authors", 1],
        ["content", 1],
    ],
    // A data insight and an article can share a slug (see #6591)
    distinctBy: "path",
    popularityMidpoint: 126,
}

/** The indexes by the name the CLIs and indexer take */
export const TURBOPUFFER_INDEXES = {
    charts: TURBOPUFFER_CHARTS_INDEX,
    pages: TURBOPUFFER_PAGES_INDEX,
} as const
export type TurbopufferIndexName = keyof typeof TURBOPUFFER_INDEXES

export const TURBOPUFFER_ARMS = ["T0", "T1", "T2", "T3", "T4"] as const
export type TurbopufferArm = (typeof TURBOPUFFER_ARMS)[number]

export const isTurbopufferArm = (value: string): value is TurbopufferArm =>
    (TURBOPUFFER_ARMS as readonly string[]).includes(value)

/** turbopuffer's rerank models that serve both our regions */
export const TURBOPUFFER_RERANK_MODELS = [
    "zeroentropy/zerank-2",
    "voyage/rerank-3",
    "voyage/rerank-3-lite",
] as const
export type TurbopufferRerankModel = (typeof TURBOPUFFER_RERANK_MODELS)[number]

export const isTurbopufferRerankModel = (
    value: string
): value is TurbopufferRerankModel =>
    (TURBOPUFFER_RERANK_MODELS as readonly string[]).includes(value)

export interface TurbopufferQuery {
    query: string
    arm: TurbopufferArm
    /** Filters every row must pass, e.g. from `chartFilters` */
    filters?: Filter[]
    /** Overrides the index's popularity midpoint */
    popularityMidpoint?: number
    popularityWeight?: number
    limit?: number
    /** Also match the query's synonyms from `synonyms.ts`, as Algolia does */
    expandSynonyms?: boolean
    /** Add T2's whole-query fuzzy match to T1 and to T3's text half */
    fuzzy?: boolean
    /** Rows each T3/T4 sub-query contributes to the fusion or rerank (default: `limit`) */
    poolSize?: number
    /** T4's rerank model */
    rerankModel?: TurbopufferRerankModel
    /** T4 asks the rerank model about the query with its synonyms in parentheses */
    rerankSynonyms?: boolean
    /**
     * T4 adds this weight times the row's saturated popularity to the rerank
     * model's score, so popularity breaks near-ties between relevant results
     */
    rerankPopularityWeight?: number
}

/** The query shape and tuning switches, without the query and its filters */
export type TurbopufferTuning = Pick<
    TurbopufferQuery,
    | "arm"
    | "popularityMidpoint"
    | "expandSynonyms"
    | "fuzzy"
    | "poolSize"
    | "rerankModel"
    | "rerankSynonyms"
    | "rerankPopularityWeight"
>

let synonymMap: SynonymMap | undefined
const findSynonyms = (query: string): string[] => {
    synonymMap ??= buildSynonymMap()
    return findQuerySynonyms(query, synonymMap)
}
const querySynonyms = (query: string): string => findSynonyms(query).join(" ")

/** The query as T4's rerank model reads it */
function rerankQuery(params: TurbopufferQuery): string {
    const synonyms = params.rerankSynonyms ? findSynonyms(params.query) : []
    return synonyms.length > 0
        ? `${params.query} (${synonyms.join(", ")})`
        : params.query
}

/** Saturating 0–1 popularity, as the text half's `Saturate` term computes it */
const saturatedPopularity = (popularity: number, midpoint: number): number =>
    popularity / (popularity + midpoint)

/** One row per result, like Algolia's `distinct` */
const distinctLimit = (index: TurbopufferIndex, total: number): Limit => ({
    total,
    per: { attributes: [index.distinctBy], limit: 1 },
})

const bm25Terms = (
    index: TurbopufferIndex,
    query: string,
    lastAsPrefix = true
): RankByText[] =>
    index.textFields.map(([field, weight]): RankByText => {
        const clause: RankByText = [
            field,
            "BM25",
            query,
            { last_as_prefix: lastAsPrefix },
        ]
        return weight === 1 ? clause : ["Product", weight, clause]
    })

const tokenFilters = (index: TurbopufferIndex, query: string): Filter[] =>
    index.textFields.map(([field]): Filter => [
        field,
        "ContainsAnyToken",
        query,
        { last_as_prefix: true },
    ])

/** Matches `search_text` within one edit for queries of 6+ characters; the whole query is one string */
const fuzzyMatch = (query: string): Filter => [
    "search_text",
    "Fuzzy",
    query,
    {
        max_edit_distance: [{ min_query_chars: 6, distance: 1 }],
        case_sensitive: false,
    },
]

/** The charts index's country and topic filters */
export function chartFilters({
    countries = [],
    requireAllCountries = false,
    topic,
}: {
    countries?: string[]
    requireAllCountries?: boolean
    topic?: string
}): Filter[] {
    const filters: Filter[] = []
    if (countries.length > 0)
        filters.push(
            requireAllCountries
                ? [
                      "And",
                      countries.map((country): Filter => [
                          "availableEntities",
                          "Contains",
                          country,
                      ]),
                  ]
                : ["availableEntities", "ContainsAny", countries]
        )
    if (topic) filters.push(["tags", "Contains", topic])
    return filters
}

/** The pages index's filter on gdoc types */
export const pageTypeFilters = (pageTypes: string[]): Filter[] =>
    pageTypes.length > 0 ? [["type", "In", pageTypes]] : []

const combine = (filters: Filter[]): Filter | undefined =>
    filters.length === 0
        ? undefined
        : filters.length === 1
          ? filters[0]
          : ["And", filters]

/**
 * T0 BM25 only; T1 adds popularity; T2 adds a whole-query Fuzzy match on
 * `search_text`. Also builds T3's text half, like T1.
 */
function buildSingleQuery(
    index: TurbopufferIndex,
    params: TurbopufferQuery
): NamespaceQueryParams {
    const {
        arm,
        query,
        popularityMidpoint = index.popularityMidpoint,
        popularityWeight = 2,
        limit = 30,
    } = params
    const facetFilters = params.filters ?? []
    // Without text to match, list the most popular rows, as Algolia does
    if (!query.trim())
        return {
            rank_by: ["popularity", "desc"],
            filters: combine(facetFilters),
            limit: distinctLimit(index, limit),
            include_attributes: [...index.attributes],
        }

    const terms = bm25Terms(index, query)
    const matchFilters = tokenFilters(index, query)
    // Synonyms match like the query's own words, without the prefix match
    const synonyms = params.expandSynonyms ? querySynonyms(query) : ""
    if (synonyms) {
        terms.push(...bm25Terms(index, synonyms, false))
        matchFilters.push(...tokenFilters(index, synonyms))
    }
    if (arm !== "T0")
        terms.push([
            "Product",
            popularityWeight,
            [
                "Saturate",
                ["Attribute", "popularity"],
                { midpoint: popularityMidpoint },
            ],
        ])
    if (arm === "T2" || params.fuzzy) {
        terms.push(fuzzyMatch(query))
        matchFilters.push(fuzzyMatch(query))
    }

    // BM25 alone scores non-matching rows zero, which drops them. A summed
    // popularity term gives every row a score, so the other arms keep out
    // rows that match neither a query token nor the fuzzy query.
    const filters = [...facetFilters]
    if (arm !== "T0") filters.push(["Or", matchFilters])

    return {
        rank_by: ["Sum", terms],
        filters: combine(filters),
        limit: distinctLimit(index, limit),
        include_attributes: [...index.attributes],
    }
}

/**
 * T3: T1 and a vector query on `search_text`, fused with reciprocal rank
 * fusion. T4: the same two queries, with their candidates scored by a rerank
 * model on `search_text` instead. Every candidate comes back, since the two
 * halves can return different rows of one result (two chunks of one article),
 * which only collapse into one after the fusion or rerank.
 */
function buildHybridQuery(
    index: TurbopufferIndex,
    params: TurbopufferQuery
): NamespaceMultiQueryParams {
    const poolSize = params.poolSize ?? params.limit ?? 30
    const reranked = params.arm === "T4"
    // The rerank model reads `search_text`, which must come back from every query
    const include_attributes = reranked
        ? [...index.attributes, "search_text"]
        : [...index.attributes]
    return {
        queries: [
            {
                ...buildSingleQuery(index, { ...params, limit: poolSize }),
                include_attributes,
            },
            {
                rank_by: ["search_text", "ANN", ["Embed", params.query]],
                filters: combine(params.filters ?? []),
                limit: distinctLimit(index, poolSize),
                include_attributes,
            },
        ],
        rerank_by: reranked
            ? {
                  model: params.rerankModel ?? TURBOPUFFER_RERANK_MODELS[0],
                  attribute: "search_text",
                  query: rerankQuery(params),
              }
            : ["RRF"],
        limit: 2 * poolSize,
    }
}

const blendsPopularity = (params: TurbopufferQuery): boolean =>
    params.arm === "T4" && (params.rerankPopularityWeight ?? 0) > 0

/** T4's rows re-sorted by model score plus weighted popularity */
function blendPopularity(
    rows: Row[],
    index: TurbopufferIndex,
    params: TurbopufferQuery
): Row[] {
    const weight = params.rerankPopularityWeight ?? 0
    const midpoint = params.popularityMidpoint ?? index.popularityMidpoint
    const score = (row: Row): number =>
        Number(row.$dist ?? 0) +
        weight * saturatedPopularity(Number(row.popularity ?? 0), midpoint)
    return rows
        .map((row) => ({ row, score: score(row) }))
        .sort((a, b) => b.score - a.score)
        .map(({ row }) => row)
}

/** The first row of each result, in order */
function distinctRows(rows: Row[], index: TurbopufferIndex): Row[] {
    const seen = new Set<unknown>()
    return rows.filter((row) => {
        const key = row[index.distinctBy]
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

export interface TurbopufferResult {
    rows: Row[]
    performance: QueryPerformance
    billing: QueryBilling
}

/**
 * Runs one arm over plain `fetch`, so it works in Cloudflare Functions as well
 * as in Node (the SDK depends on undici).
 */
export async function queryTurbopuffer(
    apiKey: string,
    index: TurbopufferIndex,
    params: TurbopufferQuery,
    region: TurbopufferRegion
): Promise<TurbopufferResult> {
    const hybrid =
        (params.arm === "T3" || params.arm === "T4") &&
        params.query.trim() !== ""
    const body = hybrid
        ? buildHybridQuery(index, params)
        : buildSingleQuery(index, params)
    const response = await fetch(
        `https://${region}.turbopuffer.com/v2/namespaces/${encodeURIComponent(index.namespace)}/query`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        }
    )
    if (!response.ok)
        throw new Error(
            `turbopuffer query failed: ${response.status} ${await response.text()}`
        )
    const json = (await response.json()) as
        | NamespaceQueryResponse
        | NamespaceMultiQueryResponse
    const rows = ("results" in json ? json.results[0]?.rows : json.rows) ?? []
    return {
        rows: hybrid
            ? distinctRows(
                  blendsPopularity(params)
                      ? blendPopularity(rows, index, params)
                      : rows,
                  index
              ).slice(0, params.limit ?? 30)
            : rows,
        performance: json.performance,
        billing: json.billing,
    }
}
