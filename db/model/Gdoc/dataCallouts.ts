import {
    fetchInputTableForConfig,
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

    // Prepare each unique chart's table
    for (const [chartKey, fetchableUrl] of urlsByChartKey) {
        const tableResult = await prepareCalloutTableForUrl(
            knex,
            fetchableUrl,
            slugToIdMap
        )
        if (!tableResult) continue

        const { config, inputTable } = tableResult
        const prepared = prepareCalloutTable(inputTable, config)
        preparedTables.set(chartKey, prepared)
    }

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
        if (!prepared) continue

        const url = Url.fromURL(calloutUrl)
        const entityNames = getEntityNamesParam(url.queryParams.country)
        if (!entityNames) continue

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
