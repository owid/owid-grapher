import * as _ from "lodash-es"

import {
    ChartConfigsTableName,
    DbEnrichedMultiDimDataPage,
    DbPlainMultiDimDataPage,
    DbPlainMultiDimXChartConfig,
    DbRawChartConfig,
    GrapherInterface,
    IndicatorConfig,
    IndicatorEntryBeforePreProcessing,
    IndicatorsBeforePreProcessing,
    JsonError,
    MultiDimDataPageConfigEnriched,
    MultiDimDataPageConfigPreProcessed,
    MultiDimDataPageConfigRaw,
    MultiDimDataPagesTableName,
    MultiDimXChartConfigsTableName,
    MultiDimViewDimensionsTableName,
    parseChartConfig,
    R2GrapherConfigDirectory,
    View,
} from "@ourworldindata/types"
import { mergeGrapherConfigs, dimensionsToViewId } from "@ourworldindata/utils"
import * as db from "../db/db.js"
import {
    buildMdimViewPatchConfig,
    upsertMultiDimDataPage,
} from "../db/model/MultiDimDataPage.js"
import { upsertMultiDimXChartConfigs } from "../db/model/MultiDimXChartConfigs.js"
import {
    getIndicatorChartConfigs,
    getIndicatorIdsByCatalogPath,
} from "../db/model/Variable.js"
import {
    deleteGrapherConfigFromR2,
    deleteGrapherConfigFromR2ByUuid,
    saveMultiDimConfigToR2,
} from "../serverUtils/r2/chartConfigR2Helpers.js"
import {
    saveNewChartConfigInDbAndR2,
    updateChartConfigInDbAndR2,
} from "./chartConfigHelpers.js"

function catalogPathFromIndicatorEntry(
    entry: IndicatorEntryBeforePreProcessing
): string | undefined {
    if (typeof entry === "string") return entry
    if (typeof entry === "object" && "catalogPath" in entry) {
        return entry.catalogPath
    }
    return undefined
}

function getAllCatalogPaths(views: View<IndicatorsBeforePreProcessing>[]) {
    const paths = []
    for (const view of views) {
        const { y, x, size, color } = view.indicators
        if (y) {
            if (Array.isArray(y)) {
                paths.push(...y.map(catalogPathFromIndicatorEntry))
            } else {
                paths.push(catalogPathFromIndicatorEntry(y))
            }
        }
        for (const entry of [x, size, color]) {
            if (entry) paths.push(catalogPathFromIndicatorEntry(entry))
        }
    }
    return paths.filter((path) => path !== undefined)
}

async function resolveMultiDimDataPageCatalogPathsToIndicatorIds(
    knex: db.KnexReadonlyTransaction,
    rawConfig: MultiDimDataPageConfigRaw
): Promise<MultiDimDataPageConfigPreProcessed> {
    const allCatalogPaths = getAllCatalogPaths(rawConfig.views)

    const catalogPathToIndicatorIdMap = await getIndicatorIdsByCatalogPath(
        allCatalogPaths,
        knex
    )

    const missingCatalogPaths = new Set(
        allCatalogPaths.filter(
            (indicator) => !catalogPathToIndicatorIdMap.has(indicator)
        )
    )

    if (missingCatalogPaths.size > 0) {
        throw new Error(
            `Could not find the following catalog paths for MDD ${rawConfig.title} in the database: ${Array.from(
                missingCatalogPaths
            ).join(", ")}`
        )
    }

    function resolveSingleField(
        indicator?: IndicatorEntryBeforePreProcessing
    ): IndicatorConfig | undefined {
        switch (typeof indicator) {
            case "number":
                return { id: indicator }
            case "string": {
                const id = catalogPathToIndicatorIdMap.get(indicator)
                return id ? { id } : undefined
            }
            case "object": {
                if ("id" in indicator) return indicator
                if ("catalogPath" in indicator) {
                    const id = catalogPathToIndicatorIdMap.get(
                        indicator.catalogPath
                    )
                    return id ? { ...indicator, id } : undefined
                }
                return undefined
            }
            default:
                return undefined
        }
    }

    function resolveSingleOrArrayField(
        indicator:
            | IndicatorEntryBeforePreProcessing
            | IndicatorEntryBeforePreProcessing[]
    ) {
        const indicatorIds = []
        if (Array.isArray(indicator)) {
            for (const item of indicator) {
                const resolved = resolveSingleField(item)
                if (resolved) indicatorIds.push(resolved)
            }
        } else {
            const resolved = resolveSingleField(indicator)
            if (resolved) indicatorIds.push(resolved)
        }
        return indicatorIds
    }

    return {
        ...rawConfig,
        views: rawConfig.views.map((view) => ({
            ...view,
            indicators: {
                y: resolveSingleOrArrayField(view.indicators.y),
                x: resolveSingleField(view.indicators.x),
                size: resolveSingleField(view.indicators.size),
                color: resolveSingleField(view.indicators.color),
            },
        })),
    }
}

async function getViewIdToChartConfigIdMap(
    knex: db.KnexReadonlyTransaction,
    catalogPath: string
): Promise<Map<string, string>> {
    const rows = await db.knexRaw<DbPlainMultiDimXChartConfig>(
        knex,
        `-- sql
        SELECT viewId, chartConfigId
        FROM multi_dim_x_chart_configs mdxcc
        JOIN multi_dim_data_pages mddp ON mddp.id = mdxcc.multiDimId
        WHERE mddp.catalogPath = ?`,
        [catalogPath]
    )
    return new Map(rows.map((row) => [row.viewId, row.chartConfigId]))
}

async function retrieveMultiDimConfigFromDbAndSaveToR2(
    knex: db.KnexReadonlyTransaction,
    id: number
) {
    // We need to get the full config and the md5 hash from the database instead of
    // computing our own md5 hash because MySQL normalizes JSON and our
    // client computed md5 would be different from the ones computed by and stored in R2
    const result = await knex<DbPlainMultiDimDataPage>(
        MultiDimDataPagesTableName
    )
        .select("slug", "config", "configMd5")
        .where({ id })
        .first()
    const { slug, config: normalizedConfig, configMd5 } = result!
    if (slug) {
        await saveMultiDimConfigToR2(normalizedConfig, slug, configMd5)
    }
}

async function upsertMultiDimConfig(
    knex: db.KnexReadWriteTransaction,
    catalogPath: string,
    config: MultiDimDataPageConfigEnriched
) {
    const id = await upsertMultiDimDataPage(knex, {
        catalogPath,
        config: JSON.stringify(config),
    })
    if (id === 0) {
        // There are no updates to the config, return the existing id.
        console.debug(
            `There are no changes to multi dim config catalogPath=${catalogPath}`
        )
        const result = await knex<DbPlainMultiDimDataPage>(
            MultiDimDataPagesTableName
        )
            .select("id")
            .where({ catalogPath })
            .first()
        return result!.id
    }
    await retrieveMultiDimConfigFromDbAndSaveToR2(knex, id)
    return id
}

async function cleanUpOrphanedChartConfigs(
    knex: db.KnexReadWriteTransaction,
    orphanedChartConfigIds: string[]
) {
    await knex<DbPlainMultiDimXChartConfig>(MultiDimXChartConfigsTableName)
        .whereIn("chartConfigId", orphanedChartConfigIds)
        .delete()

    await knex<DbRawChartConfig>(ChartConfigsTableName)
        .whereIn("id", orphanedChartConfigIds)
        .delete()
    for (const id of orphanedChartConfigIds) {
        await deleteGrapherConfigFromR2ByUuid(id)
    }
}

export async function upsertMultiDim(
    knex: db.KnexReadWriteTransaction,
    catalogPath: string,
    rawConfig: MultiDimDataPageConfigRaw
): Promise<number> {
    const config = await resolveMultiDimDataPageCatalogPathsToIndicatorIds(
        knex,
        rawConfig
    )
    validateViewConfigSchemas(config)
    const indicatorConfigs = await getIndicatorChartConfigs(
        knex,
        _.uniq(config.views.map((view) => view.indicators.y[0].id))
    )
    const existingMultiDim = await knex<DbPlainMultiDimDataPage>(
        MultiDimDataPagesTableName
    )
        .select("published")
        .where({ catalogPath })
        .first()
    const existingIsPublished = existingMultiDim
        ? Boolean(existingMultiDim.published)
        : undefined
    const existingViewIdsToChartConfigIds = await getViewIdToChartConfigIdMap(
        knex,
        catalogPath
    )
    const reusedChartConfigIds = new Set<string>()

    const enrichedViews = await Promise.all(
        config.views.map(async (view) => {
            const variableId = view.indicators.y[0].id
            const patchGrapherConfig = buildMdimViewPatchConfig(
                config,
                view,
                existingIsPublished
            )
            const fullGrapherConfig = mergeGrapherConfigs(
                indicatorConfigs.get(variableId) ?? {},
                patchGrapherConfig
            )
            const existingChartConfigId = existingViewIdsToChartConfigIds.get(
                dimensionsToViewId(view.dimensions)
            )
            let chartConfigId
            if (existingChartConfigId) {
                chartConfigId = existingChartConfigId
                await updateChartConfigInDbAndR2(
                    knex,
                    chartConfigId,
                    fullGrapherConfig
                )
                reusedChartConfigIds.add(chartConfigId)
                console.debug(`Chart config updated id=${chartConfigId}`)
            } else {
                const result = await saveNewChartConfigInDbAndR2(
                    knex,
                    fullGrapherConfig
                )
                chartConfigId = result.chartConfigId
                await knex(MultiDimViewDimensionsTableName).insert({
                    chartConfigId,
                    dimensions: JSON.stringify(view.dimensions),
                })
                console.debug(`Chart config created id=${chartConfigId}`)
            }
            return { ...view, fullConfigId: chartConfigId }
        })
    )

    const orphanedChartConfigIds = existingViewIdsToChartConfigIds
        .values()
        .filter((chartConfigId) => !reusedChartConfigIds.has(chartConfigId))
        .toArray()
    await cleanUpOrphanedChartConfigs(knex, orphanedChartConfigIds)

    const enrichedConfig = { ...config, views: enrichedViews }
    const multiDimId = await upsertMultiDimConfig(
        knex,
        catalogPath,
        enrichedConfig
    )
    for (const view of enrichedConfig.views) {
        await upsertMultiDimXChartConfigs(knex, {
            multiDimId,
            viewId: dimensionsToViewId(view.dimensions),
            variableId: view.indicators.y[0].id,
            chartConfigId: view.fullConfigId,
        })
    }
    return multiDimId
}

/** Throws if any view config does not declare a schema version */
function validateViewConfigSchemas(
    config: MultiDimDataPageConfigPreProcessed
): void {
    if (config.grapherConfigSchema) return
    const viewIds = config.views
        .filter((view) => view.config && !view.config.$schema)
        .map((view) => dimensionsToViewId(view.dimensions))
    if (viewIds.length === 0) return

    // Pages can have thousands of views, so only name the first few
    const sample = viewIds.slice(0, 5).join(", ")
    const more = viewIds.length > 5 ? `, and ${viewIds.length - 5} more` : ""
    throw new JsonError(
        `${viewIds.length} view config(s) declare no schema version (${sample}${more}). ` +
            `Set $schema on each view config, or grapherConfigSchema on the multi-dim config.`
    )
}

async function getViewChartConfigs(
    knex: db.KnexReadonlyTransaction,
    ids: string[]
): Promise<Map<string, GrapherInterface>> {
    const rows = await knex<DbRawChartConfig>(ChartConfigsTableName)
        .select("id", "config")
        .whereIn("id", ids)
    return new Map(rows.map((row) => [row.id, parseChartConfig(row.config)]))
}

export async function setMultiDimPublished(
    knex: db.KnexReadWriteTransaction,
    multiDim: DbEnrichedMultiDimDataPage,
    published: boolean
) {
    const viewConfigs = await getViewChartConfigs(
        knex,
        multiDim.config.views.map((view) => view.fullConfigId)
    )

    await Promise.all(
        multiDim.config.views.map(async (view) => {
            const { fullConfigId: chartConfigId } = view
            const config = viewConfigs.get(chartConfigId)
            if (!config) {
                throw new JsonError(
                    `Chart config not found id=${chartConfigId}`,
                    404
                )
            }
            config.isPublished = published
            await updateChartConfigInDbAndR2(knex, chartConfigId, config)
        })
    )

    await knex(MultiDimDataPagesTableName)
        .where({ id: multiDim.id })
        .update({ published })
    return { ...multiDim, published }
}

export async function setMultiDimSlug(
    knex: db.KnexReadWriteTransaction,
    multiDim: DbEnrichedMultiDimDataPage,
    slug: string
) {
    await knex(MultiDimDataPagesTableName)
        .where({ id: multiDim.id })
        .update({ slug })
    await deleteGrapherConfigFromR2(
        R2GrapherConfigDirectory.multiDim,
        `${multiDim.slug}.json`
    )
    await retrieveMultiDimConfigFromDbAndSaveToR2(knex, multiDim.id)
    return { ...multiDim, slug }
}
