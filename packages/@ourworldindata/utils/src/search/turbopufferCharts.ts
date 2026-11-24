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

/**
 * Query shapes for the experimental turbopuffer charts index (see
 * baker/turbopuffer/readme.md), shared by the smoke-test CLI and the
 * `engine=tpuf` backend of /api/search.
 *
 * The namespace is a spike: bump its suffix for a schema change instead of
 * patching the schema in place.
 */
export const TURBOPUFFER_CHARTS_NAMESPACE = "owid-charts-spike-v1"
export const TURBOPUFFER_REGION = "aws-eu-central-1"

/**
 * `Saturate` midpoint for `popularity`: its 75th percentile in the first load
 * (2026-11-24). The median is 2 (most charts get almost no views), so a median
 * midpoint would saturate nearly every chart; at p75 popularity separates the
 * top quarter and contributes half its weight there.
 */
export const DEFAULT_POPULARITY_MIDPOINT = 126

export const TURBOPUFFER_CHART_ATTRIBUTES = [
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
] as const

const BM25_FIELDS = [
    ["title", 3],
    ["subtitle", 1],
    ["tags", 1],
    ["variantName", 1],
    ["containerTitle", 1],
] as const

export const TURBOPUFFER_ARMS = ["T0", "T1", "T2", "T3"] as const
export type TurbopufferArm = (typeof TURBOPUFFER_ARMS)[number]

export const isTurbopufferArm = (value: string): value is TurbopufferArm =>
    (TURBOPUFFER_ARMS as readonly string[]).includes(value)

export interface TurbopufferChartsQuery {
    query: string
    arm: TurbopufferArm
    /** Rows that must have data for these entities (`availableEntities`) */
    countries?: string[]
    /** Require data for every country instead of any of them */
    requireAllCountries?: boolean
    /** Topic tag the rows must carry */
    topic?: string
    popularityMidpoint?: number
    popularityWeight?: number
    limit?: number
}

/** One result per chart, like Algolia's `distinct` on `id` */
const groupedLimit = (total: number): Limit => ({
    total,
    per: { attributes: ["chart_key"], limit: 1 },
})

const bm25Terms = (query: string): RankByText[] =>
    BM25_FIELDS.map(([field, weight]): RankByText => {
        const clause: RankByText = [
            field,
            "BM25",
            query,
            { last_as_prefix: true },
        ]
        return weight === 1 ? clause : ["Product", weight, clause]
    })

const tokenFilters = (query: string): Filter[] =>
    BM25_FIELDS.map(([field]): Filter => [
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

function facetFilters({
    countries = [],
    requireAllCountries = false,
    topic,
}: TurbopufferChartsQuery): Filter[] {
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

const combine = (filters: Filter[]): Filter | undefined =>
    filters.length === 0
        ? undefined
        : filters.length === 1
          ? filters[0]
          : ["And", filters]

/**
 * T0 BM25 only; T1 adds popularity; T2 adds a whole-query Fuzzy match on
 * `search_text`.
 */
export function buildTurbopufferSingleQuery(
    params: TurbopufferChartsQuery & { arm: "T0" | "T1" | "T2" }
): NamespaceQueryParams {
    const {
        arm,
        query,
        popularityMidpoint = DEFAULT_POPULARITY_MIDPOINT,
        popularityWeight = 2,
        limit = 30,
    } = params
    // Without text to match, list the most popular charts, as Algolia does
    if (!query.trim())
        return {
            rank_by: ["popularity", "desc"],
            filters: combine(facetFilters(params)),
            limit: groupedLimit(limit),
            include_attributes: [...TURBOPUFFER_CHART_ATTRIBUTES],
        }

    const terms = bm25Terms(query)
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
    if (arm === "T2") terms.push(fuzzyMatch(query))

    // BM25 alone scores non-matching rows zero, which drops them. A summed
    // popularity term gives every row a score, so T1 and T2 keep out rows
    // that match neither a query token nor (T2) the fuzzy query.
    const matchFilters =
        arm === "T2"
            ? [...tokenFilters(query), fuzzyMatch(query)]
            : tokenFilters(query)
    const filters = [...facetFilters(params)]
    if (arm !== "T0") filters.push(["Or", matchFilters])

    return {
        rank_by: ["Sum", terms],
        filters: combine(filters),
        limit: groupedLimit(limit),
        include_attributes: [...TURBOPUFFER_CHART_ATTRIBUTES],
    }
}

/** T3: T1 and a vector query on `search_text`, fused with reciprocal rank fusion */
export function buildTurbopufferHybridQuery(
    params: TurbopufferChartsQuery
): NamespaceMultiQueryParams {
    const limit = params.limit ?? 30
    return {
        queries: [
            buildTurbopufferSingleQuery({ ...params, arm: "T1" }),
            {
                rank_by: ["search_text", "ANN", ["Embed", params.query]],
                filters: combine(facetFilters(params)),
                limit: groupedLimit(limit),
                include_attributes: [...TURBOPUFFER_CHART_ATTRIBUTES],
            },
        ],
        rerank_by: ["RRF"],
        limit,
    }
}

export interface TurbopufferChartsResult {
    rows: Row[]
    performance: QueryPerformance
    billing: QueryBilling
}

/**
 * Runs one arm over plain `fetch`, so it works in Cloudflare Functions as well
 * as in Node (the SDK depends on undici).
 */
export async function queryTurbopufferCharts(
    apiKey: string,
    params: TurbopufferChartsQuery,
    namespace: string = TURBOPUFFER_CHARTS_NAMESPACE
): Promise<TurbopufferChartsResult> {
    const hybrid = params.arm === "T3" && params.query.trim() !== ""
    const body = hybrid
        ? buildTurbopufferHybridQuery(params)
        : buildTurbopufferSingleQuery({
              ...params,
              arm: params.arm === "T3" ? "T1" : params.arm,
          })
    const response = await fetch(
        `https://${TURBOPUFFER_REGION}.turbopuffer.com/v2/namespaces/${encodeURIComponent(namespace)}/query`,
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
    if (hybrid) {
        const json = (await response.json()) as NamespaceMultiQueryResponse
        return {
            rows: json.results[0]?.rows ?? [],
            performance: json.performance,
            billing: json.billing,
        }
    }
    const json = (await response.json()) as NamespaceQueryResponse
    return {
        rows: json.rows ?? [],
        performance: json.performance,
        billing: json.billing,
    }
}
