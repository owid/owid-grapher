import {
    fetchInputTableForConfig,
    getEntityNamesParam,
    type GrapherProgrammaticInterface,
    prepareCalloutTable,
    constructGrapherValuesJsonFromTable,
    computeRankingFromPreparedTable,
    computeRankingSparkline,
    type PreparedCalloutTable,
} from "@ourworldindata/grapher"
import { OwidTable } from "@ourworldindata/core-table"
import {
    GrapherInterface,
    OwidEnrichedGdocBlock,
    LinkedCallouts,
    LinkedRanking,
    LinkedRankings,
    DimensionProperty,
    OwidGdocProfileContent,
    EnrichedBlockDataCallout,
    EnrichedBlockDataCalloutGroup,
    EntityCode,
    EntityName,
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
    getEntitiesForProfile,
    checkIsBlockWithRankings,
    checkShouldRankingBlockRender,
    countries,
    getRankingSpecsForBlock,
    lazy,
    type EnrichedBlockWithRankings,
    type RankingSpec,
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
import { getIndicatorChartConfig } from "../Variable.js"
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
    return callouts
        .keys()
        .map((urlStr) => {
            const url = Url.fromURL(urlStr)
            return url.pathname + url.queryStr
        })
        .toArray()
}

/**
 * The rankings needed by all ranking-cards / peer-ranking / peer-comparison
 * blocks in `body`, one per `linkedRankings` key (see getRankingSpecsForBlock,
 * the single source of truth for keys).
 *
 * Specs with the same key only differ in `includeSparkline`, which is
 * OR-merged; the URL of a spec that wants a sparkline is kept, since the
 * sparkline is drawn for the country in that URL. Note that keys are
 * entity-independent, so if one gdoc has sparkline blocks for the same chart
 * but different countries, only the first country gets a sparkline.
 */
export function extractRankingSpecs(
    body: OwidEnrichedGdocBlock[]
): RankingSpec[] {
    const specsByKey = new Map<string, RankingSpec>()
    for (const block of body) {
        traverseEnrichedBlock(block, (b) => {
            if (!checkIsBlockWithRankings(b)) return
            for (const spec of getRankingSpecsForBlock(b)) {
                const existing = specsByKey.get(spec.key)
                if (
                    !existing ||
                    (spec.includeSparkline && !existing.includeSparkline)
                )
                    specsByKey.set(spec.key, spec)
            }
        })
    }
    return [...specsByKey.values()]
}

/**
 * Key into prepared tables, independent of the URL's origin: data-callout URLs
 * are stored as path + query (see extractDataCalloutUrls), while ranking specs
 * keep the URL as authored, so that a chart used by both is fetched once.
 */
function getChartKeyForUrl(url: string): string {
    const parsed = Url.fromURL(url)
    return makeCalloutGrapherStateKey((parsed.pathname ?? "") + parsed.queryStr)
}

/**
 * Entities that take part in rankings: all listed, non-historical countries.
 * Aggregates (continents, income groups, World) are never ranked.
 */
const getRankingEligibleEntityNames = lazy(
    (): Map<EntityName, EntityCode> =>
        new Map(countries.map((country) => [country.name, country.code]))
)

/**
 * Cache of entity-independent rankings, keyed by `linkedRankings` key.
 * `undefined` values are cached too (ranking couldn't be computed).
 *
 * Create one per profile template (alongside its prepared tables) and pass it
 * to every instantiation, so that the O(countries) work of collecting all
 * countries' values runs once per chart rather than once per entity. Must not
 * be shared between different sets of prepared tables.
 */
export type RankingCache = Map<string, LinkedRanking | undefined>

export function createRankingCache(): RankingCache {
    return new Map()
}

/**
 * Compute linkedRankings from prepared tables (no API calls). The ranking
 * itself comes from `cache` if present; only the sparkline (for the country in
 * the spec's URL) is computed per call.
 */
export function computeLinkedRankingsFromPreparedTables(
    specs: RankingSpec[],
    preparedTables: Map<string, PreparedCalloutTable>,
    cache: RankingCache = createRankingCache()
): LinkedRankings {
    const linkedRankings: LinkedRankings = {}

    for (const spec of specs) {
        const chartKey = getChartKeyForUrl(spec.url)
        const prepared = preparedTables.get(chartKey)
        if (!prepared) continue

        if (!cache.has(spec.key)) {
            cache.set(
                spec.key,
                computeRankingFromPreparedTable(prepared, {
                    eligibleEntityNames: getRankingEligibleEntityNames(),
                    chartKey,
                    timeQueryParam: Url.fromURL(spec.url).queryParams.time,
                    column: spec.column,
                    tolerance: spec.tolerance,
                    changeSinceYears: spec.changeSinceYears,
                })
            )
        }
        const ranking = cache.get(spec.key)
        if (!ranking) continue

        const entityName = spec.includeSparkline
            ? getEntityNamesParam(
                  Url.fromURL(spec.url).queryParams.country
              )?.[0]
            : undefined
        const sparkline = entityName
            ? computeRankingSparkline(
                  prepared,
                  ranking,
                  entityName,
                  Url.fromURL(spec.url).queryParams.time
              )
            : undefined

        // Don't mutate the cached object, it is shared between entities
        linkedRankings[spec.key] = sparkline
            ? { ...ranking, sparkline }
            : ranking
    }

    return linkedRankings
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
                    (await getIndicatorChartConfig(
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
 * Load linkedCallouts and linkedRankings for a gdoc's blocks by fetching each
 * referenced chart once and computing values on the fly. Used for single
 * documents (regular gdocs, admin previews of a profile for one entity); bulk
 * profile baking uses prepareCalloutTablesForProfile + the prepared-tables
 * path instead.
 *
 * Supports grapher URLs (/grapher/slug), explorer URLs (/explorers/slug),
 * and multi-dimensional data page URLs (/grapher/slug with multi-dim config).
 */
export async function loadLinkedCalloutsForBlocks(
    knex: db.KnexReadonlyTransaction,
    calloutUrls: string[],
    rankingSpecs: RankingSpec[] = []
): Promise<{ linkedCallouts: LinkedCallouts; linkedRankings: LinkedRankings }> {
    const preparedTables = await prepareCalloutTablesForUrls(knex, [
        ...calloutUrls,
        ...rankingSpecs.map((spec) => spec.url),
    ])
    return {
        linkedCallouts: computeLinkedCalloutsFromPreparedTables(
            calloutUrls,
            preparedTables
        ),
        linkedRankings: computeLinkedRankingsFromPreparedTables(
            rankingSpecs,
            preparedTables
        ),
    }
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
 * Prepare callout tables for all unique charts in a profile template, both
 * for data-callouts and ranking blocks (a chart used by both is fetched once).
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
    // Template URLs (with $entityCode placeholders)
    const body = profileContent.body ?? []
    return prepareCalloutTablesForUrls(knex, [
        ...extractDataCalloutUrls(body),
        ...extractRankingSpecs(body).map((spec) => spec.url),
    ])
}

/**
 * Fetch and prepare the table of each unique chart referenced by `urls`,
 * keyed by makeCalloutGrapherStateKey.
 */
async function prepareCalloutTablesForUrls(
    knex: db.KnexReadonlyTransaction,
    urls: string[]
): Promise<Map<string, PreparedCalloutTable>> {
    const preparedTables = new Map<string, PreparedCalloutTable>()
    if (urls.length === 0) return preparedTables

    // Group by chart key to prepare each chart once.
    // stripGrapherQueryParams (called by makeCalloutGrapherStateKey) removes
    // entity-specific params like country, so we can use the chart key directly
    // as a fetchable URL (also for templates, without substituting $entityCode).
    const chartKeys = new Set(urls.map(getChartKeyForUrl))

    const slugToIdMap = await mapSlugsToIds(knex)

    // Prepare each unique chart's table
    for (const chartKey of chartKeys) {
        const tableResult = await prepareCalloutTableForUrl(
            knex,
            chartKey,
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
        const chartKey = getChartKeyForUrl(calloutUrl)
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

        const key = makeLinkedCalloutKey(calloutUrl)
        linkedCallouts[key] = { url: calloutUrl, values }
    }

    return linkedCallouts
}

/**
 * Check if a profile should be rendered.
 * Data blocks are data-callouts, data-callout-groups and ranking blocks
 * (ranking-cards, peer-ranking, peer-comparison).
 * Returns false if there are data blocks and ALL of them are hidden.
 * Returns true if there are no data blocks, or if at least one is visible.
 * A ranking block is visible iff checkShouldRankingBlockRender, i.e. at
 * least one of its rankings has a row for the country in its URL.
 *
 * Precondition: `content` must already have been passed through
 * `clearIncompleteDataCallouts`, which empties callouts/groups whose data is
 * unavailable for the current entity. This function reads `content.length` to
 * detect that emptied state — running it on un-cleared content will report
 * false positives (treating hidden groups as visible).
 *
 * In practice this is guaranteed by `instantiateProfileForEntity`, which
 * clears as its final step before returning.
 */
export function checkShouldProfileRender(
    content: { body?: OwidEnrichedGdocBlock[] },
    linkedRankings: LinkedRankings
): boolean {
    if (!content.body || content.body.length === 0) return false

    const dataCallouts: EnrichedBlockDataCallout[] = []
    const dataCalloutGroups: EnrichedBlockDataCalloutGroup[] = []
    const rankingBlocks: EnrichedBlockWithRankings[] = []
    content.body.forEach((node) => {
        traverseEnrichedBlock(node, (block) => {
            if (block.type === "data-callout") {
                dataCallouts.push(block)
            }
            if (block.type === "data-callout-group") {
                dataCalloutGroups.push(block)
            }
            if (checkIsBlockWithRankings(block)) {
                rankingBlocks.push(block)
            }
        })
    })

    // No data blocks means the profile has other content and is renderable
    if (
        dataCallouts.length === 0 &&
        dataCalloutGroups.length === 0 &&
        rankingBlocks.length === 0
    )
        return true

    // If there are standalone data-callouts, at least one must be visible
    const anyCalloutVisible = dataCallouts.some(
        (callout) => callout.content.length > 0
    )

    // A cleared group has empty content; a visible group still has content
    const anyGroupVisible = dataCalloutGroups.some(
        (group) => group.content.length > 0
    )

    const anyRankingVisible = rankingBlocks.some((block) =>
        checkShouldRankingBlockRender(block, linkedRankings)
    )

    return anyCalloutVisible || anyGroupVisible || anyRankingVisible
}

/**
 * Clear data-callout blocks that have incomplete data.
 * For data-callout-group blocks, if ALL child data-callouts are cleared,
 * the entire group's content is cleared (hiding the heading/prose too).
 * This should be called after linkedCallouts are generated.
 */
export function clearIncompleteDataCallouts(
    content: { body?: OwidEnrichedGdocBlock[] },
    linkedCallouts: LinkedCallouts
): void {
    // First pass: clear individual data-callout blocks with incomplete data
    content.body?.forEach((node) => {
        traverseEnrichedBlock(node, (block) => {
            if (block.type === "data-callout") {
                const dataCalloutBlock = block
                const shouldRender = checkShouldDataCalloutRender(
                    dataCalloutBlock,
                    linkedCallouts
                )
                if (!shouldRender) {
                    dataCalloutBlock.content = []
                }
            }
        })
    })

    // Second pass: clear data-callout-group blocks where all child
    // data-callouts have been cleared (no entity has data for any chart)
    content.body?.forEach((node) => {
        traverseEnrichedBlock(node, (block) => {
            if (block.type === "data-callout-group") {
                const childCallouts = block.content.filter(
                    (child): child is EnrichedBlockDataCallout =>
                        child.type === "data-callout"
                )
                const anyVisible = childCallouts.some(
                    (callout) => callout.content.length > 0
                )
                if (childCallouts.length > 0 && !anyVisible) {
                    block.content = []
                }
            }
        })
    })
}

export interface LoadLinkedCalloutsOptions {
    /** Fetch charts from the DB / data API (single documents, admin previews) */
    knex?: db.KnexReadonlyTransaction
    /** Bulk path: tables from prepareCalloutTablesForProfile (takes precedence over knex) */
    preparedTables?: Map<string, PreparedCalloutTable>
    /**
     * Only used with preparedTables: reuse rankings across instantiations of
     * the same template (see RankingCache). Without it, rankings are
     * recomputed for every call.
     */
    rankingCache?: RankingCache
}

/**
 * Extracts callout URLs and ranking specs from content, loads their data
 * (linkedCallouts and linkedRankings), and clears any callout blocks that
 * have incomplete data. Ranking blocks are not cleared; the site hides them
 * (and individual cards/indicators) based on linkedRankings.
 */
export async function loadAndClearLinkedCallouts<
    T extends { body?: OwidEnrichedGdocBlock[] },
>(
    content: T,
    options?: LoadLinkedCalloutsOptions
): Promise<{
    content: T
    linkedCallouts: LinkedCallouts
    linkedRankings: LinkedRankings
}> {
    if (!content.body) {
        return { content, linkedCallouts: {}, linkedRankings: {} }
    }

    const clonedContent = structuredClone(content)
    const calloutUrls = extractDataCalloutUrls(clonedContent.body!)
    const rankingSpecs = extractRankingSpecs(clonedContent.body!)

    let linkedCallouts: LinkedCallouts = {}
    let linkedRankings: LinkedRankings = {}
    if (options?.preparedTables) {
        linkedCallouts = computeLinkedCalloutsFromPreparedTables(
            calloutUrls,
            options.preparedTables
        )
        linkedRankings = computeLinkedRankingsFromPreparedTables(
            rankingSpecs,
            options.preparedTables,
            options.rankingCache
        )
    } else if (options?.knex) {
        const loaded = await loadLinkedCalloutsForBlocks(
            options.knex,
            calloutUrls,
            rankingSpecs
        )
        linkedCallouts = loaded.linkedCallouts
        linkedRankings = loaded.linkedRankings
    }

    clearIncompleteDataCallouts(clonedContent, linkedCallouts)

    return { content: clonedContent, linkedCallouts, linkedRankings }
}

/**
 * Compute which entity codes actually have chart data for a profile.
 *
 * Uses prepareCalloutTablesForProfile to fetch chart data, then checks
 * which scope entities appear in the union of inputTable.availableEntityNames
 * across all prepared tables.
 *
 * If the profile has no data-callouts or ranking blocks, all scope entities
 * are considered available.
 */
export async function computeAvailableEntityCodes(
    knex: db.KnexReadonlyTransaction,
    profileContent: OwidGdocProfileContent
): Promise<string[]> {
    const scopeEntities = getEntitiesForProfile(
        profileContent.scope,
        profileContent.exclude
    )

    if (scopeEntities.length === 0) return []

    const preparedTables = await prepareCalloutTablesForProfile(
        knex,
        profileContent
    )

    // No data blocks means the profile has other content — all scope entities are available
    if (preparedTables.size === 0) {
        return scopeEntities.map((e) => e.code)
    }

    // Union of entity names that have data in any chart
    const entityNamesWithData = new Set<string>()
    for (const prepared of preparedTables.values()) {
        for (const name of prepared.inputTable.availableEntityNames) {
            entityNamesWithData.add(name as string)
        }
    }

    // Filter scope entities to those with data in at least one chart
    return scopeEntities
        .filter((e) => entityNamesWithData.has(e.name))
        .map((e) => e.code)
}
