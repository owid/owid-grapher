import {
    GrapherState,
    fetchInputTableForConfig,
    constructGrapherValuesJson,
} from "@ourworldindata/grapher"
import {
    GrapherInterface,
    GrapherValuesJson,
    EntityName,
    OwidEnrichedGdocBlock,
    EnrichedBlockDataCallout,
} from "@ourworldindata/types"
import { Url, traverseEnrichedBlock } from "@ourworldindata/utils"
import { DATA_API_URL } from "../../../settings/serverSettings.js"

/**
 * Extract all data-callout blocks from an array of enriched blocks.
 * This is useful for both GdocBase (via the getter) and for baking
 * instantiated profiles.
 */
export function extractDataCalloutBlocks(
    body: OwidEnrichedGdocBlock[]
): EnrichedBlockDataCallout[] {
    const callouts: EnrichedBlockDataCallout[] = []
    for (const block of body) {
        traverseEnrichedBlock(block, (b) => {
            if (b.type === "data-callout") {
                callouts.push(b)
            }
        })
    }
    return callouts
}

/**
 * Generate a unique key for a callout based on URL and entity.
 * The key is used for deduplication and caching.
 *
 * Normalization rules:
 * - Remove base domain (just keep path + query)
 * - Sort query parameters alphabetically
 */
export function generateCalloutKey(url: string, entity: EntityName): string {
    return `${generateChartKey(url)}+${entity}`
}

/**
 * Generate a unique key for a chart URL (without entity).
 * Used for caching prepared GrapherStates.
 */
export function generateChartKey(url: string): string {
    const parsedUrl = Url.fromURL(url)
    const path = parsedUrl.pathname || ""

    // Convert QueryParams to entries, filtering out undefined values
    const entries = Object.entries(parsedUrl.queryParams)
        .filter((entry): entry is [string, string] => entry[1] !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))

    const queryString = entries
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join("&")

    return queryString ? `${path}?${queryString}` : path
}

/**
 * A prepared GrapherState with data already loaded.
 * Can be used to efficiently generate GrapherValuesJson for any entity.
 */
export interface PreparedCalloutChart {
    grapherState: GrapherState
    availableEntityNames: EntityName[]
    sourcesLine: string
}

/**
 * Prepare a GrapherState for a chart config by fetching its data.
 * The returned PreparedCalloutChart can be used to generate values for any entity
 * without additional network requests.
 *
 * @param config - The grapher chart configuration
 * @param queryStr - Optional query string (for multi-dim views)
 * @returns PreparedCalloutChart or undefined if data cannot be fetched
 */
export async function prepareCalloutChart(
    config: GrapherInterface,
    queryStr?: string
): Promise<PreparedCalloutChart | undefined> {
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
            sourcesLine: grapherState.sourcesLine,
        }
    } catch (error) {
        console.error(`Failed to prepare callout chart:`, error)
        return undefined
    }
}

/**
 * Generate GrapherValuesJson for a specific entity using a prepared chart.
 * This is fast as all data is already loaded.
 *
 * @param preparedChart - The prepared chart with data loaded
 * @param entity - The entity name to generate values for
 * @returns GrapherValuesJson or undefined if entity has no data
 */
export function getCalloutValuesForEntity(
    preparedChart: PreparedCalloutChart,
    entity: EntityName
): GrapherValuesJson | undefined {
    // Check if the entity exists in the chart
    if (!preparedChart.availableEntityNames.includes(entity)) {
        // Entity not available - return values with just source
        return { source: preparedChart.sourcesLine }
    }

    return constructGrapherValuesJson(preparedChart.grapherState, entity)
}

/**
 * Fetch callout values for a single chart + entity combination.
 * This fetches data and constructs values in one call.
 * Use this for one-off requests (like admin preview or CF functions).
 * For batch processing (like baking profiles), use prepareCalloutChart + getCalloutValuesForEntity.
 *
 * @param config - The grapher chart configuration
 * @param entity - The entity name to fetch data for
 * @param queryStr - Optional query string (for multi-dim views)
 * @returns The GrapherValuesJson or undefined if data cannot be fetched
 */
export async function fetchCalloutValuesForConfig(
    config: GrapherInterface,
    entity: EntityName,
    queryStr?: string
): Promise<GrapherValuesJson | undefined> {
    const preparedChart = await prepareCalloutChart(config, queryStr)
    if (!preparedChart) return undefined

    return getCalloutValuesForEntity(preparedChart, entity)
}
