import {
    GrapherState,
    fetchInputTableForConfig,
    constructGrapherValuesJson,
} from "@ourworldindata/grapher"
import {
    GrapherInterface,
    GrapherValuesJson,
    EntityName,
} from "@ourworldindata/types"
import { Url } from "@ourworldindata/utils"
import { DATA_API_URL } from "../../../settings/serverSettings.js"

/**
 * Information needed to fetch callout values for a single data-callout block.
 */
export interface CalloutFetchInfo {
    /** The chart URL (can include query params for multi-dim) */
    url: string
    /** The entity name to fetch data for */
    entity: EntityName
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
    const parsedUrl = Url.fromURL(url)
    const path = parsedUrl.pathname || ""

    // Convert QueryParams to entries, filtering out undefined values
    const entries = Object.entries(parsedUrl.queryParams)
        .filter((entry): entry is [string, string] => entry[1] !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))

    const queryString = entries
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join("&")

    const normalizedUrl = queryString ? `${path}?${queryString}` : path
    return `${normalizedUrl}+${entity}`
}

/**
 * Fetch callout values for a single chart + entity combination.
 * This is the core function that initializes a GrapherState, fetches data,
 * and constructs the values JSON.
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
    try {
        // Create GrapherState with the chart config
        const grapherState = new GrapherState({
            ...config,
            queryStr: queryStr || "",
        })

        // Fetch the input table
        const inputTable = await fetchInputTableForConfig({
            dimensions: grapherState.dimensions,
            selectedEntityColors: grapherState.selectedEntityColors,
            dataApiUrl: DATA_API_URL,
        })

        if (inputTable) {
            grapherState.inputTable = inputTable
        }

        // Check if the entity exists in the chart
        if (!grapherState.availableEntityNames.includes(entity)) {
            // Entity not available - return values with just source
            return { source: grapherState.sourcesLine }
        }

        // Construct and return the values JSON
        return constructGrapherValuesJson(grapherState, entity)
    } catch (error) {
        console.error(
            `Failed to fetch callout values for entity "${entity}":`,
            error
        )
        return undefined
    }
}
