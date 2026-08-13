import * as _ from "lodash-es"

import {
    defaultGrapherConfig,
    migrateGrapherConfigToLatestVersionAndFailOnError,
} from "@ourworldindata/grapher"
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
import {
    mergeGrapherConfigs,
    MultiDimDataPageConfig,
    dimensionsToViewId,
} from "@ourworldindata/utils"
import * as db from "../db/db.js"
import { upsertMultiDimDataPage } from "../db/model/MultiDimDataPage.js"
import { upsertMultiDimXChartConfigs } from "../db/model/MultiDimXChartConfigs.js"
import {
    getIndicatorChartConfigs,
    getVariableIdsByCatalogPath,
} from "../db/model/Variable.js"
import {
    deleteGrapherConfigFromR2,
    deleteGrapherConfigFromR2ByUUID,
    saveMultiDimConfigToR2,
} from "../serverUtils/r2/chartConfigR2Helpers.js"
import {
    saveNewChartConfigPairInDbAndR2,
    updateChartConfigInDbAndR2,
    updateChartConfigPairInDbAndR2,
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

    const catalogPathToIndicatorIdMap = await getVariableIdsByCatalogPath(
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
) {
    const rows = await db.knexRaw<DbPlainMultiDimXChartConfig>(
        knex,
        `-- sql
        SELECT viewId, chartConfigId, patchConfigId
        FROM multi_dim_x_chart_configs mdxcc
        JOIN multi_dim_data_pages mddp ON mddp.id = mdxcc.multiDimId
        WHERE mddp.catalogPath = ?`,
        [catalogPath]
    )
    return new Map(
        rows.map((row) => [
            row.viewId,
            {
                chartConfigId: row.chartConfigId,
                patchConfigId: row.patchConfigId,
            },
        ])
    )
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
    orphanedViews: { chartConfigId: string; patchConfigId: string }[]
) {
    const chartConfigIds = orphanedViews.map((view) => view.chartConfigId)

    await knex<DbPlainMultiDimXChartConfig>(MultiDimXChartConfigsTableName)
        .whereIn("chartConfigId", chartConfigIds)
        .delete()

    await knex<DbRawChartConfig>(ChartConfigsTableName)
        .whereIn(
            "id",
            orphanedViews.flatMap((view) => [
                view.chartConfigId,
                view.patchConfigId,
            ])
        )
        .delete()

    // Only the resolved config was published
    for (const id of chartConfigIds) {
        await deleteGrapherConfigFromR2ByUUID(id)
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
    const variableConfigs = await getIndicatorChartConfigs(
        knex,
        _.uniq(config.views.map((view) => view.indicators.y[0].id))
    )
    const existingMultiDim = await knex<DbPlainMultiDimDataPage>(
        MultiDimDataPagesTableName
    )
        .select("published")
        .where({ catalogPath })
        .first()
    const existingIsPublished = existingMultiDim?.published
    const existingViewIdsToChartConfigIds = await getViewIdToChartConfigIdMap(
        knex,
        catalogPath
    )
    const reusedChartConfigIds = new Set<string>()
    const { grapherConfigSchema } = config

    const enrichedViews = await Promise.all(
        config.views.map(async (view) => {
            const viewId = dimensionsToViewId(view.dimensions)
            const variableId = view.indicators.y[0].id
            let viewGrapherConfig: GrapherInterface = {}
            if (view.config) {
                viewGrapherConfig = grapherConfigSchema
                    ? { $schema: grapherConfigSchema, ...view.config }
                    : view.config
                if ("$schema" in viewGrapherConfig) {
                    viewGrapherConfig =
                        migrateGrapherConfigToLatestVersionAndFailOnError(
                            viewGrapherConfig
                        )
                }
            }
            // Main config for each view. The collection-wide default selection
            // applies only to views that don't define their own; a view-level
            // selectedEntityNames sets that view's initial selection, while a
            // reader's own selection still carries across views as before.
            // https://github.com/owid/owid-grapher/issues/4928
            const mainGrapherConfig: GrapherInterface = {
                $schema: defaultGrapherConfig.$schema,
                dimensions: MultiDimDataPageConfig.viewToDimensionsConfig(view),
            }
            if (viewGrapherConfig.selectedEntityNames === undefined) {
                mainGrapherConfig.selectedEntityNames =
                    config.defaultSelection ?? []
            }
            const patchGrapherConfig = mergeGrapherConfigs(
                viewGrapherConfig,
                mainGrapherConfig
            )
            if (existingIsPublished !== undefined) {
                patchGrapherConfig.isPublished = Boolean(existingIsPublished)
            }
            const fullGrapherConfig = mergeGrapherConfigs(
                variableConfigs.get(variableId) ?? {},
                patchGrapherConfig
            )
            const existing = existingViewIdsToChartConfigIds.get(viewId)
            let chartConfigId: string
            let patchConfigId: string
            if (existing) {
                chartConfigId = existing.chartConfigId
                patchConfigId = existing.patchConfigId
                await updateChartConfigPairInDbAndR2(knex, {
                    configId: chartConfigId,
                    patchConfigId,
                    config: fullGrapherConfig,
                    patchConfig: patchGrapherConfig,
                })
                reusedChartConfigIds.add(chartConfigId)
                console.debug(`Chart config updated id=${chartConfigId}`)
            } else {
                const ids = await saveNewChartConfigPairInDbAndR2(knex, {
                    config: fullGrapherConfig,
                    patchConfig: patchGrapherConfig,
                })
                chartConfigId = ids.chartConfigId
                patchConfigId = ids.patchConfigId
                await knex(MultiDimViewDimensionsTableName).insert({
                    chartConfigId,
                    dimensions: JSON.stringify(view.dimensions),
                })
                console.debug(`Chart config created id=${chartConfigId}`)
            }
            return {
                viewId,
                patchConfigId,
                view: { ...view, fullConfigId: chartConfigId },
            }
        })
    )

    const orphanedViews = existingViewIdsToChartConfigIds
        .values()
        .filter((ids) => !reusedChartConfigIds.has(ids.chartConfigId))
        .toArray()
    await cleanUpOrphanedChartConfigs(knex, orphanedViews)

    const enrichedConfig = {
        ...config,
        views: enrichedViews.map(({ view }) => view),
    }
    const multiDimId = await upsertMultiDimConfig(
        knex,
        catalogPath,
        enrichedConfig
    )
    for (const { viewId, patchConfigId, view } of enrichedViews) {
        await upsertMultiDimXChartConfigs(knex, {
            multiDimId,
            viewId,
            variableId: view.indicators.y[0].id,
            chartConfigId: view.fullConfigId,
            patchConfigId,
        })
    }
    return multiDimId
}

/** Both configs of the given views, keyed by the view's resolved id */
async function getViewChartConfigs(
    knex: db.KnexReadonlyTransaction,
    chartConfigIds: string[]
) {
    const rows = await db.knexRaw<{
        chartConfigId: string
        patchConfigId: string | null
        config: DbRawChartConfig["config"]
        patchConfig: DbRawChartConfig["config"] | null
    }>(
        knex,
        `-- sql
        SELECT
            cc.id AS chartConfigId,
            mdxcc.patchConfigId,
            cc.config,
            cc_patch.config AS patchConfig
        FROM chart_configs cc
        LEFT JOIN multi_dim_x_chart_configs mdxcc ON mdxcc.chartConfigId = cc.id
        LEFT JOIN chart_configs cc_patch ON cc_patch.id = mdxcc.patchConfigId
        WHERE cc.id IN (?)`,
        [chartConfigIds]
    )
    return new Map(
        rows.map((row) => [
            row.chartConfigId,
            {
                patchConfigId: row.patchConfigId,
                config: parseChartConfig(row.config),
                patchConfig: row.patchConfig
                    ? parseChartConfig(row.patchConfig)
                    : undefined,
            },
        ])
    )
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
            const viewConfig = viewConfigs.get(chartConfigId)
            if (!viewConfig) {
                throw new JsonError(
                    `Chart config not found id=${chartConfigId}`,
                    404
                )
            }
            const { config, patchConfig, patchConfigId } = viewConfig

            config.isPublished = published
            if (patchConfigId && patchConfig) {
                patchConfig.isPublished = published
                await updateChartConfigPairInDbAndR2(knex, {
                    configId: chartConfigId,
                    patchConfigId,
                    config,
                    patchConfig,
                })
            } else {
                await updateChartConfigInDbAndR2(knex, chartConfigId, config)
            }
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
