import { FilterType, SearchChartHit } from "@ourworldindata/types"
import {
    getFilterNamesOfType,
    queryTurbopufferCharts,
    TurbopufferArm,
    type TurbopufferTuning,
} from "@ourworldindata/utils"
import {
    chartHitUrl,
    EnrichedSearchChartHit,
    SearchApiResponse,
    SearchState,
} from "./searchApi.js"

/** How many rows a turbopuffer arm returns; pages are cut from these */
const MAX_TURBOPUFFER_RESULTS = 100

export interface TurbopufferSearchApiResponse extends SearchApiResponse {
    engine: {
        name: "turbopuffer"
        arm: TurbopufferArm
        /** turbopuffer's own server time, including any query embedding */
        serverMs: number
        embeddingMs?: number
        cacheTemperature: string
    }
}

const RETURNED_ATTRIBUTES = [
    "title",
    "containerTitle",
    "slug",
    "subtitle",
    "variantName",
    "type",
    "queryParams",
    "availableEntities",
] as const

/**
 * Experimental: answers a type=charts search from the turbopuffer spike
 * namespace (`engine=tpuf`), so the search evaluator can score its arms
 * through this endpoint. Algolia-only features are missing: closest matches,
 * topic validation, `availableTabs` and dates on hits.
 */
export async function searchChartsTurbopuffer(
    apiKey: string,
    state: SearchState,
    tuning: TurbopufferTuning,
    page: number,
    hitsPerPage: number,
    baseUrl: string
): Promise<TurbopufferSearchApiResponse> {
    const countries = [
        ...getFilterNamesOfType(state.filters, FilterType.COUNTRY),
    ]
    const [topic] = getFilterNamesOfType(state.filters, FilterType.TOPIC)
    // One row past the page, so nbPages shows whether a next page exists
    const limit = Math.min(
        (page + 1) * hitsPerPage + 1,
        MAX_TURBOPUFFER_RESULTS
    )
    const { rows, performance } = await queryTurbopufferCharts(apiKey, {
        ...tuning,
        query: state.query,
        countries,
        requireAllCountries: state.requireAllCountries,
        topic,
        limit,
    })

    const results = rows
        .slice(page * hitsPerPage, (page + 1) * hitsPerPage)
        .map((row): EnrichedSearchChartHit => {
            const hit: Record<string, unknown> = {}
            for (const attr of RETURNED_ATTRIBUTES) {
                const value = row[attr]
                // The namespace stores missing strings as ""
                if (value !== "" && value !== undefined) hit[attr] = value
            }
            const chartHit = hit as unknown as SearchChartHit
            return { ...chartHit, url: chartHitUrl(chartHit, baseUrl) }
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
        engine: {
            name: "turbopuffer",
            arm: tuning.arm,
            serverMs: performance.server_total_ms,
            embeddingMs: performance.embedding_ms,
            cacheTemperature: performance.cache_temperature,
        },
    }
}
