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
    EnrichedBlockDataCallout,
} from "@ourworldindata/types"
import {
    makeLinkedCalloutKey,
    Url,
    traverseEnrichedBlock,
    mergeGrapherConfigs,
    parseIntOrUndefined,
    searchParamsToMultiDimView,
    makeCalloutGrapherStateKey,
    checkShouldDataCalloutRender,
} from "@ourworldindata/utils"
import {
    ExplorerProgram,
    ExplorerChartCreationMode,
    ExplorerChoiceParams,
    ExplorerGrapherInterface,
} from "@ourworldindata/explorer"
import { match } from "ts-pattern"
import { DATA_API_URL } from "../../../settings/serverSettings.js"
import * as db from "../../db.js"
import { mapSlugsToIds, getChartConfigById } from "../Chart.js"
import { getMergedGrapherConfigForVariable } from "../Variable.js"
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

        const finalConfig = await match(chartCreationMode)
            .with(ExplorerChartCreationMode.FromGrapherId, async () => {
                const grapherId = explorerGrapherConfig.grapherId
                if (!grapherId) {
                    console.error(
                        `No grapherId in explorer config: ${explorerSlug}`
                    )
                    return undefined
                }

                const chartRecord = await getChartConfigById(knex, grapherId)
                if (!chartRecord) {
                    console.error(`Chart not found for grapherId: ${grapherId}`)
                    return undefined
                }

                return mergeGrapherConfigs(
                    chartRecord.config,
                    program.grapherConfig
                )
            })
            .with(ExplorerChartCreationMode.FromVariableIds, async () => {
                const yVariableIdsList = (
                    explorerGrapherConfig.yVariableIds ?? ""
                )
                    .split(" ")
                    .map(parseIntOrUndefined)
                    .filter((item): item is number => item !== undefined)

                if (yVariableIdsList.length === 0) {
                    console.error(
                        `No valid yVariableIds in explorer config: ${explorerSlug}`
                    )
                    return undefined
                }

                const variableConfig =
                    (await getMergedGrapherConfigForVariable(
                        knex,
                        yVariableIdsList[0]
                    )) ?? {}

                const { dimensions: _, ...configWithoutDimensions } =
                    variableConfig
                const config: GrapherProgrammaticInterface =
                    mergeGrapherConfigs(
                        configWithoutDimensions,
                        program.grapherConfig
                    )

                config.dimensions = buildDimensionsFromExplorerConfig(
                    explorerGrapherConfig
                )
                return config
            })
            .with(
                ExplorerChartCreationMode.FromExplorerTableColumnSlugs,
                () => {
                    console.error(
                        `ExplorerChartCreationMode.FromExplorerTableColumnSlugs is not yet supported for data callouts: ${explorerSlug}`
                    )
                    return undefined
                }
            )
            .exhaustive()

        if (!finalConfig) return undefined

        // Fetch the input table
        const inputTable = await fetchInputTableForConfig({
            dimensions: finalConfig.dimensions,
            dataApiUrl: DATA_API_URL,
        })

        if (!inputTable) return undefined

        return { config: finalConfig, inputTable }
    } catch (error) {
        console.error(
            "Failed to prepare explorer callout table for %s:",
            explorerSlug,
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
 * Build dimensions array from explorer config's variable IDs.
 * Used for ExplorerChartCreationMode.FromVariableIds.
 */
function buildDimensionsFromExplorerConfig(
    explorerConfig: ExplorerGrapherInterface
): GrapherInterface["dimensions"] {
    const dimensions: GrapherInterface["dimensions"] = []

    const addDimension = (
        idStr: string | undefined,
        property: DimensionProperty
    ): void => {
        const variableId = parseIntOrUndefined(idStr)
        if (variableId !== undefined) {
            dimensions.push({ variableId, property })
        }
    }

    // Add y dimensions (space-separated list)
    const yIds = (explorerConfig.yVariableIds ?? "").split(" ")
    for (const id of yIds) {
        addDimension(id, DimensionProperty.y)
    }

    // Add other dimensions
    addDimension(explorerConfig.xVariableId, DimensionProperty.x)
    addDimension(explorerConfig.colorVariableId, DimensionProperty.color)
    addDimension(explorerConfig.sizeVariableId, DimensionProperty.size)

    return dimensions
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

export function hasRenderableDataCallouts(content: {
    body: OwidEnrichedGdocBlock[]
}): boolean {
    let hasRenderable = false
    content.body.forEach((node) => {
        traverseEnrichedBlock(node, (block) => {
            if (block.type === "data-callout" && block.content.length > 0) {
                hasRenderable = true
            }
        })
    })
    return hasRenderable
}

/**
 * Clear data-callout blocks that have incomplete data.
 * This should be called after linkedCallouts are generated.
 */
export function clearIncompleteDataCallouts(
    content: { body?: OwidEnrichedGdocBlock[] },
    linkedCallouts: LinkedCallouts
): void {
    content.body?.forEach((node) => {
        traverseEnrichedBlock(node, (block) => {
            if (block.type === "data-callout") {
                const dataCalloutBlock = block as EnrichedBlockDataCallout
                const shouldRender = checkShouldDataCalloutRender(
                    dataCalloutBlock,
                    linkedCallouts
                )
                if (!shouldRender) {
                    // Clear the content so it renders as empty
                    dataCalloutBlock.content = []
                }
            }
        })
    })
}

/**
 * Extracts callout URLs from content, loads their data values, and clears
 * any callout blocks that have incomplete data.
 */
export async function loadAndClearLinkedCallouts<
    T extends { body?: OwidEnrichedGdocBlock[] },
>(
    content: T,
    options?: {
        knex?: db.KnexReadonlyTransaction
        preparedTables?: Map<string, PreparedCalloutTable>
    }
): Promise<{
    content: T
    linkedCallouts: LinkedCallouts
}> {
    if (!content.body) {
        return { content, linkedCallouts: {} }
    }

    const clonedContent = structuredClone(content)
    const calloutUrls = extractDataCalloutUrls(clonedContent.body!)

    let linkedCallouts: LinkedCallouts = {}
    if (options?.preparedTables) {
        linkedCallouts = computeLinkedCalloutsFromPreparedTables(
            calloutUrls,
            options.preparedTables
        )
    } else if (options?.knex) {
        linkedCallouts = await loadLinkedCalloutsForBlocks(
            options.knex,
            calloutUrls
        )
    }

    clearIncompleteDataCallouts(clonedContent, linkedCallouts)

    return { content: clonedContent, linkedCallouts }
}
