import { FilterType, SearchChartHit } from "@ourworldindata/types"
import {
    chartFilters,
    getFilterNamesOfType,
    pageTypeFilters,
    queryTurbopuffer,
    TURBOPUFFER_CHARTS_INDEX,
    TURBOPUFFER_PAGES_INDEX,
    TurbopufferArm,
    type TurbopufferRegion,
    type TurbopufferResult,
    type TurbopufferTuning,
} from "@ourworldindata/utils"
import type { Row } from "@turbopuffer/turbopuffer"
import {
    chartHitUrl,
    EnrichedSearchChartHit,
    EnrichedSearchPageHit,
    PAGE_ATTRIBUTES,
    pageHitUrl,
    SearchApiResponse,
    SearchPagesApiResponse,
    SearchState,
} from "./searchApi.js"

/** How many rows a turbopuffer arm returns; pages are cut from these */
const MAX_TURBOPUFFER_RESULTS = 100

interface TurbopufferEngine {
    engine: {
        name: "turbopuffer"
        arm: TurbopufferArm
        region: TurbopufferRegion
        /** turbopuffer's own server time, including any query embedding and rerank */
        serverMs: number
        embeddingMs?: number
        cacheTemperature: string
    }
}

export type TurbopufferSearchApiResponse = SearchApiResponse & TurbopufferEngine
export type TurbopufferPagesApiResponse = SearchPagesApiResponse &
    TurbopufferEngine

/** Where and how to query: the request's region and tuning */
export interface TurbopufferRequest {
    apiKey: string
    region: TurbopufferRegion
    tuning: TurbopufferTuning
}

const CHART_ATTRIBUTES = [
    "title",
    "containerTitle",
    "slug",
    "subtitle",
    "variantName",
    "type",
    "queryParams",
    "availableEntities",
] as const

/** The row's public attributes; the namespaces store missing strings as "" */
function pickAttributes(
    row: Row,
    attributes: readonly string[]
): Record<string, unknown> {
    const hit: Record<string, unknown> = {}
    for (const attr of attributes) {
        const value = row[attr]
        if (value !== "" && value !== undefined) hit[attr] = value
    }
    return hit
}

const engineInfo = (
    request: TurbopufferRequest,
    { performance }: TurbopufferResult
): TurbopufferEngine["engine"] => ({
    name: "turbopuffer",
    arm: request.tuning.arm,
    region: request.region,
    serverMs: performance.server_total_ms,
    embeddingMs: performance.embedding_ms,
    cacheTemperature: performance.cache_temperature,
})

/**
 * Experimental: answers a type=charts search from the turbopuffer spike
 * namespace (`engine=tpuf`), so the search evaluator can score its arms
 * through this endpoint. Algolia-only features are missing: closest matches,
 * topic validation, `availableTabs` and dates on hits.
 */
export async function searchChartsTurbopuffer(
    request: TurbopufferRequest,
    state: SearchState,
    page: number,
    hitsPerPage: number,
    baseUrl: string
): Promise<TurbopufferSearchApiResponse> {
    const [topic] = getFilterNamesOfType(state.filters, FilterType.TOPIC)
    // One row past the page, so nbPages shows whether a next page exists
    const limit = Math.min(
        (page + 1) * hitsPerPage + 1,
        MAX_TURBOPUFFER_RESULTS
    )
    const result = await queryTurbopuffer(
        request.apiKey,
        TURBOPUFFER_CHARTS_INDEX,
        {
            ...request.tuning,
            query: state.query,
            filters: chartFilters({
                countries: [
                    ...getFilterNamesOfType(state.filters, FilterType.COUNTRY),
                ],
                requireAllCountries: state.requireAllCountries,
                topic,
            }),
            limit,
        },
        request.region
    )
    const { rows } = result

    const results = rows
        .slice(page * hitsPerPage, (page + 1) * hitsPerPage)
        .map((row): EnrichedSearchChartHit => {
            const hit = pickAttributes(
                row,
                CHART_ATTRIBUTES
            ) as unknown as SearchChartHit
            return { ...hit, url: chartHitUrl(hit, baseUrl) }
        })

    return {
        query: state.query,
        results,
        // turbopuffer returns no total; this counts the rows it returned, so
        // it is a lower bound
        nbHits: rows.length,
        page,
        nbPages: Math.ceil(rows.length / hitsPerPage),
        hitsPerPage,
        engine: engineInfo(request, result),
    }
}

/**
 * Experimental: answers a type=pages search from the turbopuffer pages
 * namespace (`engine=tpuf`), one hit per page with its best-matching chunk as
 * `content`. Algolia's closest matches are missing.
 */
export async function searchPagesTurbopuffer(
    request: TurbopufferRequest,
    query: string,
    offset: number,
    length: number,
    pageTypes: string[],
    baseUrl: string
): Promise<TurbopufferPagesApiResponse> {
    const result = await queryTurbopuffer(
        request.apiKey,
        TURBOPUFFER_PAGES_INDEX,
        {
            ...request.tuning,
            query,
            filters: pageTypeFilters(pageTypes),
            limit: Math.min(offset + length, MAX_TURBOPUFFER_RESULTS),
        },
        request.region
    )
    const results = result.rows
        .slice(offset, offset + length)
        .map((row): EnrichedSearchPageHit => {
            const hit = pickAttributes(row, PAGE_ATTRIBUTES) as Omit<
                EnrichedSearchPageHit,
                "url"
            >
            return { ...hit, url: pageHitUrl(hit, baseUrl) }
        })

    return {
        query,
        results,
        // A lower bound, as for charts
        nbHits: result.rows.length,
        offset,
        length,
        engine: engineInfo(request, result),
    }
}
