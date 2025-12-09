import {
    GrapherState,
    fetchInputTableForConfig,
    constructGrapherValuesJson,
    getEntityNamesParam,
} from "@ourworldindata/grapher"
import {
    GrapherInterface,
    GrapherValuesJson,
    EntityName,
    OwidEnrichedGdocBlock,
    LinkedCallouts,
} from "@ourworldindata/types"
import {
    makeCalloutGrapherStateKey,
    makeLinkedCalloutKey,
    Url,
    traverseEnrichedBlock,
} from "@ourworldindata/utils"
import { DATA_API_URL } from "../../../settings/serverSettings.js"
import * as db from "../../db.js"
import { mapSlugsToIds, getChartConfigById } from "../Chart.js"

/**
 * Extract all data-callout blocks from an array of enriched blocks.
 * This is useful for both GdocBase (via the getter) and for baking
 * instantiated profiles.
 */
export function extractDataCalloutUrls(
    body: OwidEnrichedGdocBlock[]
): string[] {
    const callouts: Set<string> = new Set()
    for (const block of body) {
        traverseEnrichedBlock(block, (b) => {
            if (b.type === "data-callout") {
                callouts.add(b.url)
            }
        })
    }
    return [...callouts].map((urlStr) => {
        const url = Url.fromURL(urlStr)
        return url.pathname + url.queryStr
    })
}

/**
 * A prepared GrapherState with data already loaded.
 * Can be used to efficiently generate GrapherValuesJson for any (available) entity.
 */
export interface CalloutGrapherState {
    grapherState: GrapherState
    availableEntityNames: EntityName[]
}

/**
 * Prepare a GrapherState for a chart config by fetching its data.
 * The returned CalloutGrapherState can be used to generate values for any entity
 * without additional network requests.
 */
export async function prepareCalloutChart(
    config: GrapherInterface,
    queryStr?: string
): Promise<CalloutGrapherState | undefined> {
    try {
        // Create GrapherState with the chart config
        const grapherState = new GrapherState({
            ...config,
            queryStr: queryStr || "",
        })

        // Fetch the input table (this contains ALL entity data)
        const inputTable = await fetchInputTableForConfig({
            dimensions: grapherState.dimensions,
            selectedEntityColors: grapherState.selectedEntityColors,
            dataApiUrl: DATA_API_URL,
        })

        if (inputTable) {
            grapherState.inputTable = inputTable
        }

        return {
            grapherState,
            availableEntityNames: grapherState.availableEntityNames,
        }
    } catch (error) {
        console.error(`Failed to prepare callout chart:`, error)
        return undefined
    }
}

/**
 * Fetch callout values for a single chart + entity combination.
 * This fetches data and constructs values in one call.
 * Use this for one-off requests (like admin preview or CF functions).
 * For batch processing (like baking profiles), use prepareCalloutChart + getCalloutValuesForEntity.
 */
export async function fetchCalloutValuesForConfig(
    config: GrapherInterface,
    entity: EntityName,
    queryStr?: string
): Promise<GrapherValuesJson | undefined> {
    const preparedChart = await prepareCalloutChart(config, queryStr)
    if (!preparedChart) return undefined

    return constructGrapherValuesJson(preparedChart.grapherState, entity)
}

/**
 * Load LinkedCallouts for a list of data-callout blocks.
 * This is the unified function used by GdocBase.loadLinkedCallouts,
 * appClass.tsx profile preview, and can be used elsewhere.
 */
export async function loadLinkedCalloutsForBlocks(
    knex: db.KnexReadonlyTransaction,
    calloutUrls: string[]
): Promise<LinkedCallouts> {
    if (calloutUrls.length === 0) return {}

    const linkedCallouts: LinkedCallouts = {}
    const slugToIdMap = await mapSlugsToIds(knex)

    for (const calloutUrl of calloutUrls) {
        if (linkedCallouts[calloutUrl]) continue

        // Extract slug from URL (grapher only for now)
        const url = Url.fromURL(calloutUrl)
        const slug = url.slug
        if (!slug) continue

        // Get chart config from database
        const chartId = slugToIdMap[slug]
        if (!chartId) continue

        const chartRecord = await getChartConfigById(knex, chartId)
        if (!chartRecord) continue

        const entityNames = getEntityNamesParam(url.queryParams["country"])
        if (!entityNames) continue
        const entityName = entityNames[0]

        // Fetch the callout values
        const values = await fetchCalloutValuesForConfig(
            chartRecord.config,
            entityName,
            url.queryStr || undefined
        )

        if (!values) continue

        linkedCallouts[calloutUrl] = {
            url: calloutUrl,
            values: values,
        }
    }

    return linkedCallouts
}

/**
 * Generate LinkedCallouts from data-callout blocks using pre-fetched CalloutGrapherStates.
 * Used with instantiated profiles during baking to avoid redundant data fetching.
 */
export function generateLinkedCalloutsFromPreparedCharts(
    calloutUrls: string[],
    calloutGrapherStates: Record<string, CalloutGrapherState>
): LinkedCallouts {
    if (calloutUrls.length === 0) return {}

    const linkedCallouts: LinkedCallouts = {}

    for (const stringUrl of calloutUrls) {
        const statesKey = makeCalloutGrapherStateKey(stringUrl)
        const linkedCalloutsKey = makeLinkedCalloutKey(stringUrl)
        const url = Url.fromURL(stringUrl)
        // Skip if we already have this callout (deduplication)
        if (linkedCallouts[linkedCalloutsKey]) continue

        // Look up the prepared chart from prefetched data
        const state = calloutGrapherStates[statesKey]
        if (!state) continue

        const entityNames = getEntityNamesParam(url.queryParams["country"])
        if (!entityNames) continue
        const entityName = entityNames[0]

        const values = constructGrapherValuesJson(
            state.grapherState,
            entityName
        )

        linkedCallouts[linkedCalloutsKey] = {
            url: stringUrl,
            values: values,
        }
    }

    return linkedCallouts
}
