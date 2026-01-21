import {
    GrapherState,
    fetchInputTableForConfig,
    constructGrapherValuesJson,
    getEntityNamesParam,
    isValuesJsonValid,
    GrapherProgrammaticInterface,
    prepareCalloutTable,
    constructGrapherValuesJsonFromTable,
    PreparedCalloutTable,
} from "@ourworldindata/grapher"
import { OwidTable } from "@ourworldindata/core-table"
import {
    GrapherInterface,
    GrapherValuesJson,
    EntityName,
    OwidEnrichedGdocBlock,
    LinkedCallouts,
    DimensionProperty,
    OwidGdocProfileContent,
} from "@ourworldindata/types"
import {
    makeLinkedCalloutKey,
    Url,
    traverseEnrichedBlock,
    mergeGrapherConfigs,
    parseIntOrUndefined,
    searchParamsToMultiDimView,
    makeCalloutGrapherStateKey,
} from "@ourworldindata/utils"
import {
    ExplorerProgram,
    ExplorerChartCreationMode,
    ExplorerChoiceParams,
} from "@ourworldindata/explorer"
import { DATA_API_URL } from "../../../settings/serverSettings.js"
import * as db from "../../db.js"
import { knexRaw } from "../../db.js"
import { mapSlugsToIds, getChartConfigById } from "../Chart.js"
import { getExplorerBySlug } from "../Explorer.js"
import { transformExplorerProgramToResolveCatalogPaths } from "../ExplorerCatalogResolver.js"
import { getMultiDimDataPageBySlug } from "../MultiDimDataPage.js"
import { getChartConfigByUuid } from "../ChartConfigs.js"

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

export function constructCalloutValuesFromPreparedState(
    state: GrapherState,
    entity: EntityName,
    timeQueryParam?: string
): GrapherValuesJson {
    return constructGrapherValuesJson(state, entity, timeQueryParam)
}

/**
 * Prepare a chart config and input table for direct value extraction.
 * This is the optimized alternative to prepareCalloutStateForUrl that
 * avoids creating a full GrapherState.
 *
 * Supports regular grapher charts, multi-dim pages, and explorers.
 */
export async function prepareCalloutTableForUrl(
    knex: db.KnexReadonlyTransaction,
    calloutUrl: string,
    slugToIdMap?: Record<string, number>
): Promise<{ config: GrapherInterface; inputTable: OwidTable } | undefined> {
    const url = Url.fromURL(calloutUrl)
    const slug = url.slug
    if (!slug) return undefined

    // Handle explorer URLs
    if (url.isExplorer) {
        return prepareCalloutTableForExplorer(
            knex,
            slug,
            url.queryParams as ExplorerChoiceParams
        )
    }

    const map = slugToIdMap ?? (await mapSlugsToIds(knex))
    const chartId = map[slug]

    let config: GrapherInterface | undefined

    if (chartId) {
        const chartRecord = await getChartConfigById(knex, chartId)
        if (chartRecord) {
            config = chartRecord.config
        }
    }

    if (!config) {
        // Try multi-dim page
        const multiDimPage = await getMultiDimDataPageBySlug(knex, slug)
        if (!multiDimPage) return undefined

        const searchParams = new URLSearchParams(url.queryStr || "")
        const view = searchParamsToMultiDimView(
            multiDimPage.config,
            searchParams
        )
        config = await getChartConfigByUuid(knex, view.fullConfigId)
        if (!config) return undefined
    }

    // Fetch the input table
    const inputTable = await fetchInputTableForConfig({
        dimensions: config.dimensions,
        dataApiUrl: DATA_API_URL,
    })

    if (!inputTable) return undefined

    return { config, inputTable }
}

/**
 * Prepare a chart config and input table for an explorer URL.
 * This resolves the explorer's config based on query params and fetches the data.
 */
async function prepareCalloutTableForExplorer(
    knex: db.KnexReadonlyTransaction,
    explorerSlug: string,
    queryParams: ExplorerChoiceParams
): Promise<{ config: GrapherInterface; inputTable: OwidTable } | undefined> {
    try {
        // Get explorer from database
        const explorerRecord = await getExplorerBySlug(knex, explorerSlug)
        if (!explorerRecord || !explorerRecord.tsv) {
            console.error(`Explorer not found: ${explorerSlug}`)
            return undefined
        }

        // Create ExplorerProgram and resolve catalog paths
        let program = new ExplorerProgram(explorerSlug, explorerRecord.tsv)
        const { program: transformedProgram } =
            await transformExplorerProgramToResolveCatalogPaths(program, knex)
        program = transformedProgram

        // Initialize decision matrix with query params to select the right row
        program.initDecisionMatrix(queryParams)

        // Get the explorer grapher config for the selected row
        const explorerGrapherConfig = program.explorerGrapherConfig
        const chartCreationMode =
            program.getChartCreationModeForExplorerGrapherConfig(
                explorerGrapherConfig
            )

        let finalConfig: GrapherInterface

        switch (chartCreationMode) {
            case ExplorerChartCreationMode.FromGrapherId: {
                const grapherId = explorerGrapherConfig.grapherId
                if (!grapherId) {
                    console.error(
                        `No grapherId in explorer config: ${explorerSlug}`
                    )
                    return undefined
                }

                // Get the full grapher config from DB
                const chartRecord = await getChartConfigById(knex, grapherId)
                if (!chartRecord) {
                    console.error(`Chart not found for grapherId: ${grapherId}`)
                    return undefined
                }

                // Merge the explorer's grapher config with the base chart config
                finalConfig = mergeGrapherConfigs(
                    chartRecord.config,
                    program.grapherConfig
                )
                break
            }

            case ExplorerChartCreationMode.FromVariableIds: {
                const {
                    yVariableIds = "",
                    xVariableId,
                    colorVariableId,
                    sizeVariableId,
                } = explorerGrapherConfig

                const yVariableIdsList = yVariableIds
                    .split(" ")
                    .map(parseIntOrUndefined)
                    .filter((item): item is number => item !== undefined)

                if (yVariableIdsList.length === 0) {
                    console.error(
                        `No valid yVariableIds in explorer config: ${explorerSlug}`
                    )
                    return undefined
                }

                // Get partial grapher configs for the variable IDs
                const partialConfig =
                    await getPartialGrapherConfigForVariableId(
                        knex,
                        yVariableIdsList[0]
                    )

                // Build config with dimensions
                const config: GrapherProgrammaticInterface = {
                    ...mergeGrapherConfigs(
                        partialConfig,
                        program.grapherConfig
                    ),
                }

                // Build dimensions from variable IDs
                const dimensions: GrapherInterface["dimensions"] = []
                yVariableIdsList.forEach((yVariableId) => {
                    dimensions.push({
                        variableId: yVariableId,
                        property: DimensionProperty.y,
                    })
                })

                if (xVariableId) {
                    const maybeXVariableId = parseIntOrUndefined(xVariableId)
                    if (maybeXVariableId !== undefined) {
                        dimensions.push({
                            variableId: maybeXVariableId,
                            property: DimensionProperty.x,
                        })
                    }
                }
                if (colorVariableId) {
                    const maybeColorVariableId =
                        parseIntOrUndefined(colorVariableId)
                    if (maybeColorVariableId !== undefined) {
                        dimensions.push({
                            variableId: maybeColorVariableId,
                            property: DimensionProperty.color,
                        })
                    }
                }
                if (sizeVariableId) {
                    const maybeSizeVariableId =
                        parseIntOrUndefined(sizeVariableId)
                    if (maybeSizeVariableId !== undefined) {
                        dimensions.push({
                            variableId: maybeSizeVariableId,
                            property: DimensionProperty.size,
                        })
                    }
                }

                config.dimensions = dimensions
                finalConfig = config
                break
            }

            case ExplorerChartCreationMode.FromExplorerTableColumnSlugs: {
                // This mode requires loading external CSV data which is complex.
                // For now, we don't support this mode for callouts.
                console.error(
                    `ExplorerChartCreationMode.FromExplorerTableColumnSlugs is not yet supported for data callouts: ${explorerSlug}`
                )
                return undefined
            }

            default: {
                console.error(
                    `Unknown chart creation mode for explorer: ${explorerSlug}`
                )
                return undefined
            }
        }

        // Fetch the input table
        const inputTable = await fetchInputTableForConfig({
            dimensions: finalConfig.dimensions,
            dataApiUrl: DATA_API_URL,
        })

        if (!inputTable) return undefined

        return { config: finalConfig, inputTable }
    } catch (error) {
        console.error(
            `Failed to prepare explorer callout table for ${explorerSlug}:`,
            error
        )
        return undefined
    }
}

/**
 * Prepare a GrapherState for a chart config by fetching its data.
 * The returned GrapherState can be used to generate values for any entity
 * without additional network requests.
 */
export async function prepareCalloutChart(
    config: GrapherInterface
): Promise<GrapherState | undefined> {
    try {
        // Create GrapherState with the chart config
        const grapherState = new GrapherState({
            ...config,
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

        return grapherState
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
    timeQueryParam?: string
): Promise<GrapherValuesJson | undefined> {
    const grapherState = await prepareCalloutChart(config)
    if (!grapherState) return undefined

    return constructGrapherValuesJson(grapherState, entity, timeQueryParam)
}

/**
 * Fetch a chart config by its UUID (used for multi-dim view configs).
 */

/**
 * Fetch callout values for a multi-dimensional chart.
 * Resolves the view based on query params and fetches values for the entity.
 */
export async function fetchCalloutValuesForMultiDim(
    knex: db.KnexReadonlyTransaction,
    slug: string,
    entity: EntityName,
    queryStr?: string
): Promise<GrapherValuesJson | undefined> {
    // Get the multi-dim config from database
    const multiDimPage = await getMultiDimDataPageBySlug(knex, slug)
    if (!multiDimPage) {
        console.error(`Multi-dim data page not found: ${slug}`)
        return undefined
    }

    // Resolve the view based on query params
    const searchParams = new URLSearchParams(queryStr || "")
    const view = searchParamsToMultiDimView(multiDimPage.config, searchParams)

    // Get the chart config for this view using fullConfigId
    const chartConfig = await getChartConfigByUuid(knex, view.fullConfigId)
    if (!chartConfig) {
        console.error(
            `Chart config not found for multi-dim view: ${view.fullConfigId}`
        )
        return undefined
    }

    // Fetch and return values using the resolved config
    const timeQueryParam = queryStr
        ? Url.fromQueryStr(queryStr).queryParams.time
        : undefined
    return fetchCalloutValuesForConfig(chartConfig, entity, timeQueryParam)
}

export async function fetchCalloutValuesForUrl(
    knex: db.KnexReadonlyTransaction,
    calloutUrl: string,
    slugToIdMap?: Record<string, number>
): Promise<GrapherValuesJson | undefined> {
    const url = Url.fromURL(calloutUrl)
    const slug = url.slug
    if (!slug) return undefined

    const entityNames = getEntityNamesParam(url.queryParams["country"])
    if (!entityNames) return undefined
    const entityName = entityNames[0]

    if (url.isExplorer) {
        return fetchCalloutValuesForExplorer(
            knex,
            slug,
            entityName,
            url.queryParams as ExplorerChoiceParams,
            url.queryStr || undefined
        )
    }

    const map = slugToIdMap ?? (await mapSlugsToIds(knex))
    const chartId = map[slug]

    if (chartId) {
        const chartRecord = await getChartConfigById(knex, chartId)
        if (chartRecord) {
            return fetchCalloutValuesForConfig(
                chartRecord.config,
                entityName,
                url.queryParams.time
            )
        }
    }

    return fetchCalloutValuesForMultiDim(
        knex,
        slug,
        entityName,
        url.queryStr || undefined
    )
}

export async function prepareCalloutStateForUrl(
    knex: db.KnexReadonlyTransaction,
    calloutUrl: string,
    slugToIdMap?: Record<string, number>
): Promise<GrapherState | undefined> {
    const url = Url.fromURL(calloutUrl)
    const slug = url.slug
    if (!slug) return undefined

    if (url.isExplorer) {
        return prepareExplorerCalloutChart(
            knex,
            slug,
            url.queryParams as ExplorerChoiceParams,
            url.queryStr || undefined
        )
    }

    const map = slugToIdMap ?? (await mapSlugsToIds(knex))
    const chartId = map[slug]

    if (chartId) {
        const chartRecord = await getChartConfigById(knex, chartId)
        if (chartRecord) {
            return prepareCalloutChart(chartRecord.config)
        }
    }

    const multiDimPage = await getMultiDimDataPageBySlug(knex, slug)
    if (!multiDimPage) return undefined

    const searchParams = new URLSearchParams(url.queryStr || "")
    const view = searchParamsToMultiDimView(multiDimPage.config, searchParams)
    const chartConfig = await getChartConfigByUuid(knex, view.fullConfigId)
    if (!chartConfig) return undefined

    return prepareCalloutChart(chartConfig)
}

/**
 * Load LinkedCallouts for a list of data-callout blocks by computing values
 * on the fly using the optimized table-based approach.
 *
 * Supports grapher URLs (/grapher/slug), explorer URLs (/explorers/slug),
 * and multi-dimensional data page URLs (/grapher/slug with multi-dim config).
 */
export async function loadLinkedCalloutsForBlocks(
    knex: db.KnexReadonlyTransaction,
    calloutUrls: string[]
): Promise<LinkedCallouts> {
    if (calloutUrls.length === 0) return {}

    const linkedCallouts: LinkedCallouts = {}
    const uniqueCalloutUrls = Array.from(new Set(calloutUrls))

    // Group URLs by chart key to prepare each chart's table once
    const urlsByChartKey = new Map<string, string[]>()
    for (const url of uniqueCalloutUrls) {
        const chartKey = makeCalloutGrapherStateKey(url)
        if (!urlsByChartKey.has(chartKey)) {
            urlsByChartKey.set(chartKey, [])
        }
        urlsByChartKey.get(chartKey)!.push(url)
    }

    // Pre-fetch slug to ID map for efficiency
    const slugToIdMap = await mapSlugsToIds(knex)

    // Process each chart group
    for (const [_chartKey, urls] of urlsByChartKey) {
        const tableResult = await prepareCalloutTableForUrl(
            knex,
            urls[0],
            slugToIdMap
        )

        if (!tableResult) continue

        const { config, inputTable } = tableResult
        const prepared = prepareCalloutTable(inputTable, config)

        for (const calloutUrl of urls) {
            const url = Url.fromURL(calloutUrl)
            const entityNames = getEntityNamesParam(url.queryParams.country)
            if (!entityNames) continue

            const entityName = entityNames[0]
            const values = constructGrapherValuesJsonFromTable(
                prepared,
                entityName,
                url.queryParams.time
            )

            if (!isValuesJsonValid(values)) continue

            const linkedCalloutsKey = makeLinkedCalloutKey(calloutUrl)
            linkedCallouts[linkedCalloutsKey] = {
                url: calloutUrl,
                values,
            }
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
    calloutGrapherStates: Record<string, GrapherState>
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
            state,
            entityName,
            url.queryParams.time
        )

        linkedCallouts[linkedCalloutsKey] = {
            url: stringUrl,
            values: values,
        }
    }

    return linkedCallouts
}

/**
 * Prepare a GrapherState for an explorer URL by fetching its data.
 * This handles all three explorer chart creation modes:
 * - FromGrapherId: Uses full grapher config from DB
 * - FromVariableIds: Creates config with variable dimensions
 * - FromExplorerTableColumnSlugs: Uses table data (not yet supported for callouts)
 */
export async function prepareExplorerCalloutChart(
    knex: db.KnexReadonlyTransaction,
    explorerSlug: string,
    queryParams: ExplorerChoiceParams,
    queryStr?: string
): Promise<GrapherState | undefined> {
    try {
        // Get explorer from database
        const explorerRecord = await getExplorerBySlug(knex, explorerSlug)
        if (!explorerRecord || !explorerRecord.tsv) {
            console.error(`Explorer not found: ${explorerSlug}`)
            return undefined
        }

        // Create ExplorerProgram and resolve catalog paths
        let program = new ExplorerProgram(explorerSlug, explorerRecord.tsv)
        const { program: transformedProgram } =
            await transformExplorerProgramToResolveCatalogPaths(program, knex)
        program = transformedProgram

        // Initialize decision matrix with query params to select the right row
        program.initDecisionMatrix(queryParams)

        // Get the explorer grapher config for the selected row
        const explorerGrapherConfig = program.explorerGrapherConfig
        const chartCreationMode =
            program.getChartCreationModeForExplorerGrapherConfig(
                explorerGrapherConfig
            )

        let finalConfig: GrapherInterface

        switch (chartCreationMode) {
            case ExplorerChartCreationMode.FromGrapherId: {
                const grapherId = explorerGrapherConfig.grapherId
                if (!grapherId) {
                    console.error(
                        `No grapherId in explorer config: ${explorerSlug}`
                    )
                    return undefined
                }

                // Get the full grapher config from DB
                const chartRecord = await getChartConfigById(knex, grapherId)
                if (!chartRecord) {
                    console.error(`Chart not found for grapherId: ${grapherId}`)
                    return undefined
                }

                // Merge the explorer's grapher config with the base chart config
                finalConfig = mergeGrapherConfigs(
                    chartRecord.config,
                    program.grapherConfig
                )
                break
            }

            case ExplorerChartCreationMode.FromVariableIds: {
                const {
                    yVariableIds = "",
                    xVariableId,
                    colorVariableId,
                    sizeVariableId,
                } = explorerGrapherConfig

                const yVariableIdsList = yVariableIds
                    .split(" ")
                    .map(parseIntOrUndefined)
                    .filter((item): item is number => item !== undefined)

                if (yVariableIdsList.length === 0) {
                    console.error(
                        `No valid yVariableIds in explorer config: ${explorerSlug}`
                    )
                    return undefined
                }

                // Get partial grapher configs for the variable IDs
                const partialConfig =
                    await getPartialGrapherConfigForVariableId(
                        knex,
                        yVariableIdsList[0]
                    )

                // Build config with dimensions
                const config: GrapherProgrammaticInterface = {
                    ...mergeGrapherConfigs(
                        partialConfig,
                        program.grapherConfig
                    ),
                }

                // Build dimensions from variable IDs
                const dimensions: GrapherInterface["dimensions"] = []
                yVariableIdsList.forEach((yVariableId) => {
                    dimensions.push({
                        variableId: yVariableId,
                        property: DimensionProperty.y,
                    })
                })

                if (xVariableId) {
                    const maybeXVariableId = parseIntOrUndefined(xVariableId)
                    if (maybeXVariableId !== undefined) {
                        dimensions.push({
                            variableId: maybeXVariableId,
                            property: DimensionProperty.x,
                        })
                    }
                }
                if (colorVariableId) {
                    const maybeColorVariableId =
                        parseIntOrUndefined(colorVariableId)
                    if (maybeColorVariableId !== undefined) {
                        dimensions.push({
                            variableId: maybeColorVariableId,
                            property: DimensionProperty.color,
                        })
                    }
                }
                if (sizeVariableId) {
                    const maybeSizeVariableId =
                        parseIntOrUndefined(sizeVariableId)
                    if (maybeSizeVariableId !== undefined) {
                        dimensions.push({
                            variableId: maybeSizeVariableId,
                            property: DimensionProperty.size,
                        })
                    }
                }

                config.dimensions = dimensions
                finalConfig = config
                break
            }

            case ExplorerChartCreationMode.FromExplorerTableColumnSlugs: {
                // This mode requires loading external CSV data which is complex.
                // For now, we don't support this mode for callouts.
                console.error(
                    `ExplorerChartCreationMode.FromExplorerTableColumnSlugs is not yet supported for data callouts: ${explorerSlug}`
                )
                return undefined
            }

            default: {
                console.error(
                    `Unknown chart creation mode for explorer: ${explorerSlug}`
                )
                return undefined
            }
        }

        // Create GrapherState with the final config
        const grapherState = new GrapherState({
            ...finalConfig,
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

        return grapherState
    } catch (error) {
        console.error(
            `Failed to prepare explorer callout chart for ${explorerSlug}:`,
            error
        )
        return undefined
    }
}

/**
 * Fetch callout values for a single explorer + entity combination.
 * Similar to fetchCalloutValuesForConfig but for explorers.
 */
export async function fetchCalloutValuesForExplorer(
    knex: db.KnexReadonlyTransaction,
    explorerSlug: string,
    entity: EntityName,
    queryParams: ExplorerChoiceParams,
    queryStr?: string
): Promise<GrapherValuesJson | undefined> {
    const grapherState = await prepareExplorerCalloutChart(
        knex,
        explorerSlug,
        queryParams,
        queryStr
    )
    if (!grapherState) return undefined

    const timeQueryParam = (queryParams as Record<string, string | undefined>)
        .time
    return constructGrapherValuesJson(grapherState, entity, timeQueryParam)
}

/**
 * Helper function to get partial grapher config for a variable ID.
 * This is used for ExplorerChartCreationMode.FromVariableIds.
 */
async function getPartialGrapherConfigForVariableId(
    knex: db.KnexReadonlyTransaction,
    variableId: number
): Promise<GrapherInterface> {
    const rows = await knexRaw<{
        id: number
        grapherConfigAdmin: string | null
        grapherConfigETL: string | null
    }>(
        knex,
        `-- sql
            SELECT
                v.id,
                cc_etl.patch AS grapherConfigETL,
                cc_admin.patch AS grapherConfigAdmin
            FROM variables v
                LEFT JOIN chart_configs cc_admin ON cc_admin.id=v.grapherConfigIdAdmin
                LEFT JOIN chart_configs cc_etl ON cc_etl.id=v.grapherConfigIdETL
            WHERE v.id = ?
        `,
        [variableId]
    )

    if (rows.length === 0) return {}

    const row = rows[0]
    const adminConfig = row.grapherConfigAdmin
        ? JSON.parse(row.grapherConfigAdmin)
        : {}
    const etlConfig = row.grapherConfigETL
        ? JSON.parse(row.grapherConfigETL)
        : {}

    // Merge ETL config with admin config (admin takes precedence)
    const mergedConfig = mergeGrapherConfigs(etlConfig, adminConfig)

    // Explorers set their own dimensions, so we don't need to include them
    const { dimensions: _, ...configWithoutDimensions } = mergedConfig

    return configWithoutDimensions
}

/**
 * Prepare callout tables for all unique charts in a profile template.
 * Call this ONCE before the entity loop, then reuse the prepared tables.
 *
 * This avoids redundant API calls when baking profiles for many entities.
 * Instead of fetching the same chart data for each entity, we fetch once
 * and extract values from the prepared tables.
 */
export async function prepareCalloutTablesForProfile(
    knex: db.KnexReadonlyTransaction,
    profileContent: OwidGdocProfileContent
): Promise<Map<string, PreparedCalloutTable>> {
    const preparedTables = new Map<string, PreparedCalloutTable>()

    // Extract template URLs (with $entityCode placeholders)
    const templateUrls = extractDataCalloutUrls(profileContent.body ?? [])
    if (templateUrls.length === 0) return preparedTables

    const slugToIdMap = await mapSlugsToIds(knex)

    // Group by chart key to prepare each chart once
    // Use USA as a representative entity code to create a fetchable URL
    const urlsByChartKey = new Map<string, string>()
    for (const templateUrl of templateUrls) {
        // Replace $entityCode with a real code to create a fetchable URL
        // Also handle URL-encoded $ (%24) in case the URL was encoded
        const fetchableUrl = templateUrl
            .replace(/\$entityCode/g, "USA")
            .replace(/%24entityCode/gi, "USA")
        const chartKey = makeCalloutGrapherStateKey(fetchableUrl)
        if (!urlsByChartKey.has(chartKey)) {
            urlsByChartKey.set(chartKey, fetchableUrl)
        }
    }

    console.log(
        `prepareCalloutTablesForProfile: preparing ${urlsByChartKey.size} unique charts from ${templateUrls.length} URLs`
    )

    // Prepare each unique chart's table
    for (const [chartKey, fetchableUrl] of urlsByChartKey) {
        const tableResult = await prepareCalloutTableForUrl(
            knex,
            fetchableUrl,
            slugToIdMap
        )
        if (!tableResult) {
            console.log(
                `prepareCalloutTablesForProfile: failed to prepare table for chartKey=${chartKey} fetchableUrl=${fetchableUrl}`
            )
            continue
        }

        const { config, inputTable } = tableResult
        const prepared = prepareCalloutTable(inputTable, config)
        preparedTables.set(chartKey, prepared)
        console.log(
            `prepareCalloutTablesForProfile: prepared table for chartKey=${chartKey}`
        )
    }

    console.log(
        `prepareCalloutTablesForProfile: successfully prepared ${preparedTables.size}/${urlsByChartKey.size} tables`
    )

    return preparedTables
}

/**
 * Compute linked callouts for an entity using pre-prepared tables.
 * This is the fast path - no API calls, just in-memory lookups.
 *
 * Used during profile baking after tables have been prepared once
 * with prepareCalloutTablesForProfile().
 */
export function computeLinkedCalloutsFromPreparedTables(
    calloutUrls: string[],
    preparedTables: Map<string, PreparedCalloutTable>
): LinkedCallouts {
    const linkedCallouts: LinkedCallouts = {}

    for (const calloutUrl of calloutUrls) {
        const chartKey = makeCalloutGrapherStateKey(calloutUrl)
        const prepared = preparedTables.get(chartKey)
        if (!prepared) {
            console.log(
                `computeLinkedCalloutsFromPreparedTables: no prepared table for chartKey=${chartKey}, calloutUrl=${calloutUrl}`
            )
            continue
        }

        const url = Url.fromURL(calloutUrl)
        const entityNames = getEntityNamesParam(url.queryParams.country)
        if (!entityNames) {
            console.log(
                `computeLinkedCalloutsFromPreparedTables: no entity names for country=${url.queryParams.country}`
            )
            continue
        }

        const entityName = entityNames[0]
        const values = constructGrapherValuesJsonFromTable(
            prepared,
            entityName,
            url.queryParams.time
        )

        if (!isValuesJsonValid(values)) {
            continue
        }

        const key = makeLinkedCalloutKey(calloutUrl)
        linkedCallouts[key] = { url: calloutUrl, values }
    }

    return linkedCallouts
}
